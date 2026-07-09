# PlayGenX Playground

A minimal Vite + React app for generating and inspecting interactive
playground artifacts live. Talks to OpenAI directly from the browser via
the published `playgenx` SDK.

## Quickstart

```sh
# 1. Install
pnpm install

# 2. Add your OpenAI key
cp apps/playground/.env.example apps/playground/.env
$EDITOR apps/playground/.env   # set VITE_OPENAI_API_KEY

# 3. Build the SDK packages (the app consumes them via workspace links)
pnpm run build

# 4. Run the dev server
pnpm --filter playgenx-playground dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Security

The playground calls OpenAI **directly from the browser** as a local-dev
convenience. **Do not deploy this app to a public host** — anyone could
read your API key from the bundle. For production, run the SDK on a
server and proxy requests.

The generated body is rendered in a sandboxed `<iframe sandbox="allow-scripts">`
to avoid executing anything that escapes our validator. v0.1.0's validator
is deliberately lightweight (no real AST parsing) — treat the output as
untrusted even after it passes.

## What it does

1. You fill in `concept` + `context` and pick an artifact `kind`.
2. The app calls `generatePlayground(...)` from `playgenx`.
3. The result is shown in a `<pre>` and rendered in a sandboxed iframe.
4. Failures surface the pipeline `stage` (`parse`, `validate`, `provider`)
   so you can debug.

## Stack

- Vite 5
- React 18
- TypeScript
- `playgenx` (workspace dep)
