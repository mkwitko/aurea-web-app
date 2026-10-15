# Experiments & Hypotheses UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the middle of the growth loop reachable. Two complete, tested backend domains — hypotheses and experiments, both with lifecycles — currently have no UI at all: `/app/experiments` renders `PlaceholderPage` and hypotheses are unreachable from anywhere. After this, a founder can go strategy → hypothesis → experiment → running → completed without leaving the app.

**Architecture:** Frontend only. No backend change, no migration, no OpenAPI regeneration: all 21 hooks already exist under `src/api/generated/hooks/{experiments,hypotheses}Hooks/`. Hypotheses are surfaced *inside* a strategy (a hypothesis without its strategy means nothing, and `POST /hypotheses` requires `strategyId`); experiments get their own nav destination, list, detail and create pages, because that is where the user spends the run. Both lifecycles are driven by a client-side mirror of the backend's transition table, so the UI only ever offers a legal move — same approach as `src/lib/subscription.ts` mirroring the billing guard.

**Tech Stack:** Vite 6, React 19, TypeScript strict ESM, Kubb 4 + TanStack Query 5, Tailwind v4 + shadcn/ui, react-i18next (en/pt/es), Vitest + Testing Library.

## Survey (read on 2026-07-28 from `back/`)

**Experiment lifecycle** (`src/http/api/experiments/experiments.domain.ts`) — routes exist for every edge:

```
DRAFT     → PLANNED, CANCELLED
PLANNED   → APPROVED, CANCELLED
APPROVED  → RUNNING, CANCELLED
RUNNING   → PAUSED, COMPLETED, CANCELLED
PAUSED    → RUNNING, CANCELLED
COMPLETED → (terminal)
CANCELLED → (terminal)
```

**Hypothesis lifecycle** (`hypotheses.domain.ts`):

```
DRAFT     → PROPOSED, REJECTED
PROPOSED  → TESTED, REJECTED
TESTED    → VALIDATED, REJECTED
VALIDATED → (terminal)
REJECTED  → (terminal)
```

| Backend fact | Consequence for this plan |
|---|---|
| `POST /experiments` requires `hypothesisId`, `name`, `metric` | the create page needs a hypothesis selector; an experiment cannot exist without one |
| `POST /hypotheses` requires `strategyId`, `statement` | hypotheses are created from a strategy, not standalone |
| `GET /experiments?hypothesisId=&strategyId=`, `GET /hypotheses?strategyId=` | both lists filter server-side; no client-side filtering needed |
| `experimentSchema` fields: objective, channel, audience, metric, baselineValue, targetValue, successCriteria, startDate, endDate | the detail page has real content to show, not just a status |
| `create-experiment.schema.ts` limits: name ≤200, metric ≤160, description ≤2000, objective ≤1000, channel ≤160, audience ≤500, successCriteria ≤1000 | client validation mirrors these so the user is not told "400" by the server |
| `variables: z.record(...)` on create | **out of scope** for this pass — no UI for free-form JSON |
| Neither module registers a role guard (only `authenticate` + `resolveTenant`) | see Risks: the UI must not invent a restriction the API does not enforce |
| `status` i18n has DRAFT/ACTIVE/PAUSED/COMPLETED/CANCELLED/PROPOSED/APPROVED/ARCHIVED | **missing:** PLANNED, RUNNING, TESTED, VALIDATED, REJECTED |

## Global Constraints

- **Domain data only through the generated hooks.** No hand-written fetch. `src/lib/api.ts` is the token lifecycle and stays that way.
- **Tailwind + shadcn only.** The existing `StrategiesPage` uses the plain-CSS `card-tech`; new pages must NOT — per the Task 5 ruling of the billing plan, existing consumers keep it and the migration is its own task.
- **Only shadcn primitives already installed:** `button`, `card`, `badge`, `label`, `input`, `textarea`, `popover`, `hover-card`, `select`, `alert-dialog`. Do not add one.
- **No `any`, no casual `as`.** Status unions come from `src/api/generated/types`.
- **Every domain term gets a `<Help>`**: Hypothesis, Experiment, Metric, Baseline, Target, Success criteria, Confidence, and each lifecycle state. The founder is non-technical and the app is the docs.
- **Propose, don't ask:** forms arrive pre-filled where the data allows (metric defaulted from the hypothesis's `targetMetric`, baseline from the goal where one exists).
- **Every string is an i18n key** present in all of `en/pt/es`.
- **TDD, no exceptions.** Watch each test fail, for the stated reason, before writing production code.
- **Gate per task:** `pnpm typecheck` + `pnpm test`; `pnpm build` on the last task.

---

## Task 1 — Transition mirrors and cache keys

- [ ] RED: `src/lib/experiment-actions.test.ts` — `allowedExperimentActions(status)` returns exactly the backend's edge list for all 7 states, terminal states return `[]`. Table-driven, asserting the whole map, so a missing edge cannot hide.
- [ ] RED: `src/lib/hypothesis-actions.test.ts` — same for all 5 hypothesis states.
- [ ] GREEN: both modules, typed on the generated status unions (not hand-rolled string unions), each with a doc comment naming the backend file it mirrors and the fact that the server re-checks.
- [ ] `src/api/modules/experiments.ts` and `hypotheses.ts` with `queryKeyRoot`, exported from `modules/index.ts`, following `strategies.ts`.

## Task 2 — `LifecycleActions`, a pure action bar

- [ ] RED: `src/components/LifecycleActions.test.tsx` — renders one button per allowed action with its translated label; renders nothing for a terminal state; disables every button while one is pending; the destructive action (cancel/reject) is visually distinct and confirms through `AlertDialog` before firing.
- [ ] GREEN: `src/components/LifecycleActions.tsx`, pure and generic over `{ actions, pending, onAct }` so both domains use it.
- [ ] Confirmation is required only for the terminal-destructive moves (CANCELLED, REJECTED): they cannot be undone, the transition table has no edge out.

## Task 3 — Move `SectionState` out of `billing/`

- [ ] `src/components/billing/SectionState.tsx` → `src/components/SectionState.tsx`; update the three billing imports and its test. It is not billing-specific and the new pages need the same loading/error/retry behaviour. Pure move — no behaviour change, so the existing tests must stay green untouched.

## Task 4 — Experiments list at `/app/experiments`

- [ ] RED: `src/pages/ExperimentsPage.test.tsx` — lists name, status badge and metric per experiment; shows the teaching empty state (no experiments yet, and how to get one) rather than a blank card; loading state before data; error state offering a retry that refetches.
- [ ] GREEN: page + route, replacing the `PlaceholderPage` entry in `src/App.tsx`.
- [ ] Cards link to the detail page. Status badges reuse the `status.*` namespace, extended in Task 8.

## Task 5 — Experiment detail at `/app/experiments/:id`

- [ ] RED: shows the experiment's objective, channel, audience, metric, baseline → target, success criteria and dates; offers exactly the lifecycle actions the current status allows (assert a RUNNING experiment offers pause/complete/cancel and NOT approve); a successful transition updates the badge; a rejected transition (409/400 from the server) leaves the status alone and says why, using `apiErrorMessage`.
- [ ] GREEN: page wired to `usePlanExperiment`, `useApproveExperiment`, `useStartExperiment`, `usePauseExperiment`, `useCompleteExperiment`, `useCancelExperiment`, invalidating `EXPERIMENTS.queryKeyRoot` on success.
- [ ] One shared `pending` guard across all six, so a second click cannot fire a second transition.

## Task 6 — Create an experiment at `/app/experiments/new`

- [ ] RED: the hypothesis selector lists only hypotheses that can carry an experiment and shows their statement; submitting sends `hypothesisId`, `name` and `metric` (assert the real request body, not just that a call happened); client validation refuses a name over 200 chars and an empty metric before any request goes out; a server rejection is reported without losing what the user typed.
- [ ] GREEN: page + route, `useCreateHypothesis`-style form conventions from `StrategyNewPage`, metric pre-filled from the chosen hypothesis's `targetMetric`.
- [ ] On success, navigate to the new experiment's detail page.

## Task 7 — Strategy detail at `/app/strategies/:id`, with its hypotheses

- [ ] RED: lists the strategy's hypotheses with statement, confidence and status; the inline "add hypothesis" form posts `strategyId` + `statement` (+ optional rationale, expectedOutcome, targetMetric, confidence) and the new hypothesis appears without a reload; propose/tested/validate/reject offer only the legal moves; a hypothesis in a state that allows an experiment links to `/app/experiments/new` carrying its id.
- [ ] GREEN: page + route; `StrategiesPage` cards link to it.
- [ ] Reuses `LifecycleActions` from Task 2 — if it needs changing to fit, that is a signal the Task 2 API was wrong; fix it there with its own test.

## Task 8 — i18n completeness and the loop rail

- [ ] Add the missing `status.*` keys (PLANNED, RUNNING, TESTED, VALIDATED, REJECTED) and the `pages.experiments.*` / `pages.hypotheses.*` namespaces to **en, pt and es**.
- [ ] RED: a test asserting the three locale files have identical key structure (recursive key-set comparison). This does not exist yet and every prior plan verified it by eye.
- [ ] `LoopRail` marks Experiments as reachable now that it is a real page.
- [ ] Gate: `pnpm typecheck`, `pnpm test`, `pnpm build`.

---

## Risks

| Risk | Mitigation |
|---|---|
| **Neither backend module enforces roles** — a VIEWER can approve or cancel an experiment through the API today | Out of scope here, and the UI must not fake a guard the server does not have (a client-only restriction is not a permission). Recorded as a backend follow-up: add the same `canManage`-style guard the billing routes use. Flagged for the user in the summary. |
| The two lifecycles drift from the mirrored tables | Task 1's tests assert the whole map; if the backend adds an edge, the mirror fails loudly rather than silently offering nothing |
| `LifecycleActions` bent to fit two domains becomes a config blob | It only takes a list of actions and a callback; anything domain-specific stays in the pages |
| Dates round-trip | `startDate`/`endDate` are `z.coerce.date()` server-side and `Date` in the generated types; `src/api/client.ts` already serializes them as ISO |
| Scope creep into Outcome/Learning | Explicitly out: those have Prisma models but **no routes**. Completing an experiment is where this plan stops; feature B picks it up. |
