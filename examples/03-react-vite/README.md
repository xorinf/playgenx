# 03 — React + Vite (minimal)

A minimal Vite + React app embedding the PlayGenX SDK. This is essentially
a smaller version of `apps/playground`.

## Run me

```sh
# from the repo root
pnpm install
pnpm run build
cd examples/03-react-vite
pnpm dlx vite
```

Then open the URL Vite prints.

> You'll need an OpenAI key. Either set `VITE_OPENAI_API_KEY` in
> `examples/03-react-vite/.env.local` (after copying `.env.example`) or
> edit `App.tsx` to use a different provider.

## Files

This is the *minimum* you'd write to embed the SDK in a React app:

- `package.json` — Vite + React + `@playgenx/core`.
- `vite.config.ts` — minimal Vite config.
- `index.html` — root HTML.
- `src/main.tsx` — mount React.
- `src/App.tsx` — the actual app.
- `src/styles.css` — minimal styles.
