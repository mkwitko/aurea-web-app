# Aurea Web App

React frontend for Aurea, an AI growth operating system: founders define business context and goals, review AI-proposed strategies and experiments, and track results.

**Status:** Prototype, not in production. UI is localized (en, pt, es).

## What it does

- Auth and workspace/organization screens, business context editors with AI "fill" proposals.
- Goals, strategies, experiments and actions with in-app explanations of domain terms.
- Integrations (GA4 service account, social accounts) and billing/credits screens.
- i18n with three locales; typed API client generated from OpenAPI (Kubb).

## Screenshots

Captured from a local run with fictitious seed data (a made-up bakery workspace, no real users). The app is dark-only; the UI is in Portuguese.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/02-dashboard-desktop.png" alt="Dashboard: onboarding progress and recent activity"><br><sub>Dashboard: onboarding progress and recent activity.</sub></td>
    <td width="50%"><img src="docs/screenshots/03-business-desktop.png" alt="Business profile and context sections"><br><sub>Business profile and context sections.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/04-icps-desktop.png" alt="Ideal customer profiles"><br><sub>Ideal customer profiles.</sub></td>
    <td width="50%"><img src="docs/screenshots/06-strategies-desktop.png" alt="Growth loop, Plans stage: one active and one draft strategy"><br><sub>Growth loop, Plans stage: one active and one draft strategy.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/07-experiments-desktop.png" alt="Growth loop, Tests stage: one running and one draft experiment"><br><sub>Growth loop, Tests stage: one running and one draft experiment.</sub></td>
  </tr>
</table>

<table>
  <tr>
    <td width="25%"><img src="docs/screenshots/02-dashboard-mobile.png" alt="Dashboard on mobile"><br><sub>Dashboard on mobile.</sub></td>
    <td width="25%"><img src="docs/screenshots/06-strategies-mobile.png" alt="Strategies on mobile"><br><sub>Strategies on mobile.</sub></td>
  </tr>
</table>

## Architecture

System context: the web app only talks to aurea-api.

```mermaid
flowchart LR
  Founder([Founder]) --> Web[aurea-web-app<br/>React SPA]
  Web -->|REST, Bearer token, workspace header| API[aurea-api]
  API -->|SSE: run status events| Web
  API -.->|api.json, Kubb| Web
  API --> Agents[AI agent worker, billing, social publishing]
```

Layers inside this repo:

```mermaid
flowchart TD
  App["Routes, each wrapped in Protected + AppLayout<br/>src/App.tsx"] --> Pages["Pages<br/>src/pages"]
  Pages --> Comp["Feature components: ai, business, strategies, experiments, billing<br/>src/components"]
  Comp --> Hooks["Generated hooks<br/>src/api/generated"]
  Comp --> Mod["Hand-written endpoint modules and query keys<br/>src/api/modules"]
  Hooks --> Client["Fetch client: token, 401 refresh<br/>src/api/client.ts, src/lib/api.ts"]
  Mod --> Client
  Events["Single EventSource for run events<br/>src/lib/run-events.ts"] --> QC["TanStack Query cache invalidation<br/>src/api/query-client.ts"]
  Client --> API[(aurea-api)]
  Events --> API
```

Main flow, an AI "fill" proposal (`src/components/ai/useFillRun.ts`, `src/lib/run-events.ts`):

```mermaid
sequenceDiagram
  participant U as Founder
  participant W as Web app
  participant A as aurea-api
  U->>W: click AI fill on a business-context section
  W->>A: create agent run
  alt credits missing or a run already in flight
    A-->>W: error (409 returns the run in flight)
    W-->>U: show it, with cancel
  else accepted
    A-->>W: run id
    A-->>W: SSE status event
    W->>A: refetch run (query invalidated)
    W-->>U: proposal to review and apply or discard
  end
```

- All server calls go through `src/api/client.ts`; generated types/hooks come from `api.json` via `pnpm api:generate`.
- One app-wide `EventSource` instead of one per component, because each route remounts the layout; it reopens after errors and when the workspace changes.
- A 401 triggers one refresh attempt and a retry before the session is cleared.
- Tailwind + shadcn/ui for styling; form schemas in `src/schemas`; strings in three locales under `src/i18n/locales`, with tests that check key coverage.

## Tech stack

Vite, React 19, TypeScript (strict), react-router 7, TanStack Query, React Hook Form + Zod, Tailwind 4, Radix, i18next, Vitest.

## Getting started

Prerequisites: Node 22, pnpm 10, a running aurea-api.

```bash
cp .env.example .env     # VITE_API_URL: base URL of aurea-api
pnpm install
pnpm dev                 # http://localhost:5173
pnpm typecheck && pnpm test && pnpm build
```

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the API |

## Testing

115 test files (Vitest + Testing Library); run `pnpm test`.

## Project structure

```
src/   pages, components, lib, api (generated), schemas, i18n
docs/  plans and specs
```

## Related repositories

- [aurea-api](https://github.com/mkwitko/aurea-api): backend (growth domain model, AI agents, billing).

## License

All rights reserved. Source available for portfolio review.
