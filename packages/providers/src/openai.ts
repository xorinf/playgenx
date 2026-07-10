import type { Provider, ProviderCompleteOptions } from '@playgenx/types';

/**
 * Thrown by {@link OpenAIProvider} on any failure.
 *
 * - `status` is the HTTP status code when the failure came from the API.
 * - `cause` is the underlying error (e.g. a `fetch` rejection) when available.
 */
export class OpenAIError extends Error {
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = 'OpenAIError';
    this.status = options.status;
    this.cause = options.cause;
  }
}

export interface OpenAIProviderOptions {
  /**
   * API key. If omitted, the provider reads `process.env.OPENAI_API_KEY`
   * lazily on every call. Constructor key wins over the env var.
   */
  readonly apiKey?: string;
  /**
   * Override the API base URL. Defaults to `https://api.openai.com`.
   * Useful for OpenAI-compatible services (Together, OpenRouter, vLLM, ...).
   */
  readonly baseUrl?: string;
  /**
   * Default model to use when the caller does not pass one. Defaults to `gpt-4o-mini`.
   */
  readonly defaultModel?: string;
  /**
   * Sampling temperature. Defaults to `0.7`.
   */
  readonly temperature?: number;
  /**
   * Per-request timeout in milliseconds. Defaults to 60_000 (60s).
   * Set to 0 to disable (NOT recommended — a hung request will hang forever).
   */
  readonly timeoutMs?: number;
  /**
   * Maximum number of retries on 429 (rate limit) and 5xx (server error)
   * responses. Defaults to 2. Set to 0 to disable retries.
   *
   * Uses exponential backoff: ~500ms, ~1s, ~2s, ... Each delay is jittered
   * by ±25% to avoid thundering-herd.
   */
  readonly maxRetries?: number;
  /**
   * Optional system message. Sent as the first message in the chat
   * completion request. Useful for giving the model persistent
   * instructions (e.g. "always respond in JSON for the quiz kind").
   */
  readonly systemPrompt?: string;
}

/** Body shape we send to the chat completions endpoint. */
interface ChatCompletionRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature: number;
  /** Optional server-side cap on output tokens. Only sent when set. */
  max_tokens?: number;
}

/** Response shape we read from the chat completions endpoint. */
interface ChatCompletionResponse {
  choices?: {
    finish_reason?: string;
    message?: { content?: string };
  }[];
}

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_ERROR_BODY_CHARS = 500;
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const BACKOFF_BASE_MS = 500;

/**
 * LLM provider backed by the OpenAI Chat Completions API.
 *
 * Uses the global `fetch` (Node 18+, Bun, Deno, modern browsers). No SDK
 * dependency — keeps the package dep-light.
 *
 * ```ts
 * const provider = new OpenAIProvider();
 * const text = await provider.complete('Explain binary search in one sentence.');
 * ```
 */
export class OpenAIProvider implements Provider {
  readonly id = 'openai';
  readonly defaultModel: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly systemPrompt: string | undefined;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.systemPrompt = options.systemPrompt;
  }

  async complete(prompt: string, options?: ProviderCompleteOptions): Promise<string> {
    const apiKey = this.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new OpenAIError(
        'OpenAI API key missing. Set OPEN_API_KEY env var or pass { apiKey } to the constructor.',
      );
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // Per-call timeout overrides the constructor default. Per-call
    // maxRetries is honored by the runPipeline retry loop in @playgenx/core,
    // not here (this provider's internal retry was the v0.1.x behavior;
    // v0.2.x+ lets the caller drive retries via runPipeline).
    const effectiveTimeoutMs = options?.timeoutMs ?? this.timeoutMs;

    const body: ChatCompletionRequest = {
      model: options?.model ?? this.defaultModel,
      messages,
      temperature: this.temperature,
    };
    // Send max_tokens server-side only when the caller explicitly set
    // it. Otherwise we let OpenAI apply its own default (or whatever
    // the model supports). Setting it arbitrarily would cap response
    // length and degrade quality.
    if (typeof options?.maxTokens === 'number') {
      body.max_tokens = options.maxTokens;
    }

    return this.attemptWithRetries(url, apiKey, body, effectiveTimeoutMs);
  }

  private async attemptWithRetries(
    url: string,
    apiKey: string,
    body: ChatCompletionRequest,
    timeoutMs: number,
  ): Promise<never> {
    let lastError: OpenAIError | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.attemptOnce(url, apiKey, body, timeoutMs);
      } catch (err) {
        if (err instanceof OpenAIError && err.status !== undefined && RETRYABLE_STATUSES.has(err.status) && attempt < this.maxRetries) {
          lastError = err;
          const delay = this.backoffMs(attempt);
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
    // Unreachable: the loop above either returns or throws. The
    // `lastError` is only set if we exhausted retries.
    throw lastError ?? new OpenAIError('OpenAI request failed: exhausted retries');
  }

  private backoffMs(attempt: number): number {
    const base = BACKOFF_BASE_MS * Math.pow(2, attempt);
    const jitter = base * 0.25 * (Math.random() * 2 - 1);
    return Math.max(50, Math.floor(base + jitter));
  }

  private async attemptOnce(
    url: string,
    apiKey: string,
    body: ChatCompletionRequest,
    timeoutMs: number,
  ): Promise<string> {
    const ac = new AbortController();
    const timer = timeoutMs > 0 ? setTimeout(() => ac.abort(), timeoutMs) : null;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
    } catch (err) {
      if (timer !== null) clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        // Wrap the AbortError so the retry layer knows this came from
        // OUR timeout, not a user-supplied AbortSignal. User aborts
        // are transient; internal timeouts are not (a retry would just
        // hit the same timeout).
        const timeoutErr: Error & { __playgenxTimeout?: boolean } = new OpenAIError(
          `OpenAI request timed out after ${timeoutMs}ms`,
          { cause: err },
        );
        timeoutErr.__playgenxTimeout = true;
        throw timeoutErr;
      }
      throw new OpenAIError('OpenAI request failed (network error)', { cause: err });
    }
    if (timer !== null) clearTimeout(timer);

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      const snippet = raw.length > MAX_ERROR_BODY_CHARS ? `${raw.slice(0, MAX_ERROR_BODY_CHARS)}…` : raw;
      throw new OpenAIError(`OpenAI request failed (HTTP ${response.status}): ${snippet}`, {
        status: response.status,
      });
    }

    let data: ChatCompletionResponse;
    try {
      data = (await response.json()) as ChatCompletionResponse;
    } catch (err) {
      throw new OpenAIError('OpenAI returned invalid JSON', { cause: err });
    }

    const choice = data.choices?.[0];
    if (!choice) {
      throw new OpenAIError('OpenAI response missing choices[0]');
    }
    const content = choice.message?.content;
    if (typeof content !== 'string') {
      throw new OpenAIError('OpenAI response missing choices[0].message.content');
    }
    // Surface truncation: if the model hit the token limit, the body
    // might be incomplete. Warn via the message — we still return the
    // content, but the caller can choose to retry or report a partial
    // artifact.
    if (choice.finish_reason === 'length') {
      // Append a marker so the caller can detect truncation. The
      // validator/parser may or may not catch this depending on the
      // kind — surfacing the signal here is enough.
      return content + '\n/* [playgenx: response was truncated by the model] */';
    }
    return content;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}