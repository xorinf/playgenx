import type { Provider } from '@playgenx/types';

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
}

/** Body shape we send to the chat completions endpoint. */
interface ChatCompletionRequest {
  model: string;
  messages: { role: 'user' | 'system' | 'assistant'; content: string }[];
  temperature: number;
}

/** Response shape we read from the chat completions endpoint. */
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const MAX_ERROR_BODY_CHARS = 500;

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

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  }

  async complete(prompt: string, options?: { model?: string }): Promise<string> {
    const apiKey = this.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new OpenAIError(
        'OpenAI API key missing. Set OPENAI_API_KEY env var or pass { apiKey } to the constructor.',
      );
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const body: ChatCompletionRequest = {
      model: options?.model ?? this.defaultModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.temperature,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new OpenAIError('OpenAI request failed (network error)', { cause: err });
    }

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

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new OpenAIError('OpenAI response missing choices[0].message.content');
    }
    return content;
  }
}
