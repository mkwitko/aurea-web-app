# AUREA Web

Frontend of AUREA, an AI Growth Operating System. Vite + React 19 + TypeScript
(strict, ESM), react-router-dom 7. It is the human interface to the Growth
Brain and talks to the `aurea-api` API through the typed client in
`src/lib/api.ts`.

## Source of truth

Product, domain, architecture, and agent documentation live in the **`aurea-api`
repository** under `docs/` (the Growth Brain is the canonical model). This repo
implements the UI for those concepts; it does not define business rules.

## How to work here

Follow these (the agent skill that held them is not included in this snapshot):
golden rules:

1. **Styling: Tailwind CSS + shadcn/ui only. Never plain/pure CSS.** No
   hand-written stylesheets, no ad-hoc `style={{}}`. Use Tailwind utilities +
   shadcn/ui components; design tokens live as Tailwind theme + shadcn CSS
   variables (light/dark). ⚠️ The initial scaffold used plain CSS
   (`styles/*.css`, `.btn/.card/.field`) — **pending migration to Tailwind +
   shadcn**; migrate before/while building real screens.
2. **Explain everything in-app.** Every user-facing domain term (ICP, Strategy,
   Hypothesis, Experiment, Goal, CAC, …) must be explainable via the `Help`
   primitive (rebuilt on shadcn Popover/HoverCard). The app is the docs — the
   user (a non-technical founder) never reads external docs.
3. **All server calls go through `src/lib/api.ts`.** No raw `fetch`.
4. **Propose, don't ask.** Pre-fill AI proposals; the user edits and confirms.
5. **Clean, accessible, responsive.** Labels, keyboard, focus, aria.
6. **Typed everything.** No `any`.

## Commands

```bash
pnpm dev         # dev server :5173
pnpm typecheck   # the real gate today (lint/test are stubs)
pnpm build       # production build → dist
```

## Deploy

Cloudflare Pages. See `DEPLOY.md`.
