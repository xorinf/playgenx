# The pipeline

When you call `generatePlayground(request, options)`, four stages run
sequentially. Each stage is pure except `provider.complete`, which makes
the network call.

```
        ┌─────────────────────────────────────┐
        │  generatePlayground(req, opts)       │
        └────────────────┬────────────────────┘
                         │
                         ▼
   ┌─────────────────────────────────────────────┐
   │  1. PROMPT — playgroundPrompt(req)         │
   │     Pure. Builds the string sent to the     │
   │     provider.                               │
   └────────────────┬────────────────────────────┘
                    ▼
   ┌─────────────────────────────────────────────┐
   │  2. PROVIDER — provider.complete(prompt)   │
   │     The only side-effecting stage. Returns  │
   │     the raw LLM text.                       │
   │     Throws on network / API errors.         │
   └────────────────┬────────────────────────────┘
                    ▼
   ┌─────────────────────────────────────────────┐
   │  3. PARSE — extractArtifact(raw)            │
   │     Pure. Strips code fences, identifies    │
   │     tsx / html / plain.                     │
   └────────────────┬────────────────────────────┘
                    ▼
   ┌─────────────────────────────────────────────┐
   │  4. VALIDATE — validate(body, registry)     │
   │     Pure. Rejects eval, import, unknown     │
   │     components, unbalanced tags.            │
   └────────────────┬────────────────────────────┘
                    ▼
            { ok: true,  artifact }
            { ok: false, error: { stage, … } }
```

## Why this shape

The pipeline is split so each stage is independently testable and
replaceable:

- You can plug in your own `validate` (e.g. one that uses `@babel/parser`)
  without touching the parser.
- You can swap the `Provider` (OpenAI, Anthropic, Ollama, your own
  thing) without touching anything else.
- You can swap the `Registry` to scope which components you accept.

## Error `stage` values

`ArtifactError.stage` tells you which pipeline stage failed:

| Stage       | When                                       |
| ----------- | ------------------------------------------ |
| `prompt`    | Prompt template error (very rare).         |
| `provider`  | Network / API / auth failure.              |
| `parse`     | Unbalanced fence or no extractable body.   |
| `validate`  | Body failed safety or registry checks.     |

## Catching failures

```ts
const result = await generatePlayground(req, opts);
if (!result.ok) {
  switch (result.error.stage) {
    case 'provider':
      // retry? fall back? show a network error to the user?
      break;
    case 'parse':
    case 'validate':
      // the LLM produced something we can't use — usually a prompt
      // problem. Surface a clear message and consider tweaking the
      // prompt template or the registry.
      break;
  }
}
```

## Stage purity

| Stage      | Pure? | Reads env? | Reads network? |
| ---------- | :---: | :--------: | :------------: |
| prompt     |  ✅   |     no     |       no       |
| provider   |  ❌   |    yes¹    |      yes       |
| parse      |  ✅   |     no     |       no       |
| validate   |  ✅   |     no     |       no       |

¹ The OpenAI provider reads `OPENAI_API_KEY` lazily, but only because
that env var was a deliberate design choice. You can pass the key
explicitly via `new OpenAIProvider({ apiKey })` to opt out.
