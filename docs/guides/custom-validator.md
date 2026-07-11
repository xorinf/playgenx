# Custom validator

The built-in validator in v0.1.0 is deliberately lightweight (substring
checks + tag balance, no real AST). If you want stricter validation,
plug in your own.

## Simplest case

```ts
import { generatePlayground, OpenAIProvider } from 'playgenx';

await generatePlayground(req, {
  provider: new OpenAIProvider(),
  validate: (body) => {
    if (body.includes('forbidden-phrase')) return 'contains a forbidden phrase';
    return null;
  },
});
```

Return `null` to pass, or a string with an error message to fail.

## Composing with the built-in

If you want to use the built-in validator _and_ your own check:

```ts
import { validate, createRegistry, generatePlayground, OpenAIProvider } from 'playgenx';

const strict = createRegistry(['Button', 'Slider']);

await generatePlayground(req, {
  provider: new OpenAIProvider(),
  registry: strict,
  validate: (body) => {
    // Built-in first.
    const built = validate(body, strict);
    if (built) return built.message;
    // Then your own.
    if (body.length > 5000) return 'Body too long';
    return null;
  },
});
```

## Using `@babel/parser` (0.2.0 preview)

This is a sketch — `@babel/parser` isn't a v0.1.0 dep — but it's what
the real validator will look like in 0.2.0:

```ts
import { parse } from '@babel/parser';

function strictValidate(body: string): string | null {
  try {
    parse(body, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (err) {
    return err instanceof Error ? err.message : 'parse error';
  }
  // …then your own rules on top
  return null;
}
```

## Why you'd want this

- **Stricter syntax checking** than the built-in provides.
- **Custom rules** — e.g. "no inline event handlers", "no external
  URLs", "no images larger than X".
- **Integration with a linting system** — call your linter on the body
  and surface its messages.
- **Domain-specific checks** — e.g. "this is a math artifact, so it
  must include a `<NumberInput>` for the user to try values".

## Where to draw the line

The validator's job is to reject obviously-bad bodies. The playground's
job is to render the surviving ones in a sandbox. Keep validation
**fast** (it runs on every generation) and **predictable** (same input,
same verdict).
