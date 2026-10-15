# Billing & Credits Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the founder one page — `/app/settings/billing` — that shows the plan, the credit balance and the ledger, and lets them subscribe, buy a credit pack and manage their card, plus an always-visible credit chip in the app shell.

**Architecture:** The backend gains one read-only route, `GET /billing/plans`, that publishes the plan/pack catalog (credits, workspace cap, price) so the frontend never duplicates those numbers. The frontend consumes it and the seven existing billing/credit endpoints through Kubb-generated TanStack Query hooks; the page is composed of three sections (plan, credits, ledger) built from small pure components that receive props and are unit-tested, plus a return banner that reconciles a Stripe redirect by calling `POST /billing/sync`.

**Tech Stack:** Backend — Node 22, Fastify 5, TypeScript strict ESM, Zod, Vitest. Frontend — Vite 6, React 19, TypeScript strict ESM, Kubb 4 + TanStack Query 5, Tailwind v4 + shadcn/ui, react-i18next (en/pt/es), Vitest + Testing Library.

**Spec:** `web/docs/superpowers/specs/2026-07-28-billing-frontend-design.md`

## Global Constraints

- **Two separate git repos.** `back/` (`aurea-back`) and `web/` are independent repositories. Commit inside the repo you changed; never try to commit both in one command. Every command in this plan is run from `back/` or from `web/`, as stated in the task.
- **Backend:** vertical slice per use case — `src/http/api/<resource>/<use-case>/{controller}.ts`, shared `<resource>.schema.ts`. Controllers are `FastifyPluginAsync` using `app.withTypeProvider<ZodTypeProvider>()` and MUST declare `operationId` and a response schema.
- **Frontend: domain data only through Kubb-generated hooks** (`src/api/generated/hooks/<tag>Hooks/use<OperationId>`). No new hand-written fetch. `src/lib/api.ts` stays limited to the auth/token lifecycle.
- **Frontend: Tailwind + shadcn only.** No plain CSS file, no themed inline `style={{}}`. Only the shadcn primitives already installed: `button`, `card`, `badge`, `label`, `input`, `textarea`, `popover`, `hover-card`, `select`, `alert-dialog`. Do not add a new primitive; do not use a Dialog.
- **No `any`, no casual `as`.** Domain types come from `src/api/generated/types`.
- **Every user-facing string is an i18n key** present in all three of `src/i18n/locales/{en,pt,es}.json`. Every domain term gets a `<Help>`.
- **Prices are copied verbatim** from the Stripe test Prices already configured (read on 2026-07-28 via the Stripe API): STARTER `29700`, GROWTH `99700`, SCALE `249700`, pack SMALL `19700`, pack MEDIUM `79700`, pack LARGE `249700` — all `brl`, values in cents.
- **Gate before declaring a task done:** in `back/` → `pnpm typecheck` and `pnpm test`; in `web/` → `pnpm typecheck`, `pnpm test`, and `pnpm build` for the last frontend task. All clean.
- **Never `git commit` without the user's approval** if you are the main session; a task-executing subagent commits as the task's final step, which is the approval boundary.

---

## File Structure

**Backend (`back/`)**

| File | Responsibility |
|---|---|
| `src/billing/plan-catalog.ts` (modify) | plan credits, workspace cap, **and now price**; `planCatalog()` returns the published list |
| `src/billing/credit-packs.ts` (modify) | pack credits **and now price**; `packCatalog()` returns the published list |
| `src/billing/plan-catalog.test.ts` (create) | catalog values and invariants |
| `src/billing/credit-packs.test.ts` (modify) | pack catalog values |
| `src/http/api/billing/billing.schema.ts` (modify) | `plansResponse` Zod schema |
| `src/http/api/billing/get-plans/get-plans.controller.ts` (create) | `GET /billing/plans` |
| `src/http/api/billing/index.ts` (modify) | register the new route |
| `src/http/api/billing/billing.test.ts` (modify) | route test |
| `docs/architecture/billing.md` (modify) | record the route and the money divergence |

**Frontend (`web/`)**

| File | Responsibility |
|---|---|
| `api.json` (regenerated) | OpenAPI fixture — input to Kubb |
| `src/api/modules/billing.ts`, `credits.ts`, `index.ts` | cache-key constants |
| `src/lib/money.ts` | `formatCents` |
| `src/lib/credits.ts` | `availableCredits` |
| `src/lib/roles.ts` | `canManageSubscription`, `canBuyCredits` |
| `src/lib/auth.tsx` (modify) | expose the current `role` |
| `src/test/render.tsx` | `renderWithProviders` (i18n + QueryClient + Router) |
| `src/components/billing/PlanCard.tsx` | one plan card (pure) |
| `src/components/billing/CreditPackCard.tsx` | one pack card (pure) |
| `src/components/billing/AllowanceBar.tsx` | consumed/allowance bar (pure) |
| `src/components/billing/PlanSection.tsx` | plan status + portal + the three plan cards (queries) |
| `src/components/billing/CreditsSection.tsx` | balance + the three pack cards (queries) |
| `src/components/billing/LedgerSection.tsx` | ledger with cursor pagination (query) |
| `src/components/billing/CheckoutReturnBanner.tsx` | `?checkout=` handling + `POST /billing/sync` |
| `src/components/CreditBalanceChip.tsx` | shell chip with the available balance |
| `src/pages/BillingPage.tsx` | composes the sections |
| `src/App.tsx` (modify) | route `/app/settings/billing` |
| `src/components/AppLayout.tsx` (modify) | secondary nav item + chip |
| `src/i18n/locales/{en,pt,es}.json` (modify) | `pages.billing.*`, `app.nav.billing` |

---

### Task 1: Catalog publishes price (backend)

**Files:**
- Modify: `back/src/billing/plan-catalog.ts`
- Modify: `back/src/billing/credit-packs.ts`
- Create: `back/src/billing/plan-catalog.test.ts`
- Modify: `back/src/billing/credit-packs.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks. Existing exports `monthlyAllowance`, `maxWorkspaces`, `effectiveAllowance`, `planForPrice`, `TRIAL_CREDITS`, `packCredits`, `isPackId`, `priceForPack`, `packForPrice` must keep their current signatures and behaviour.
- Produces:
  ```ts
  // plan-catalog.ts
  export type PlanCatalogEntry = {
    plan: Plan;              // 'STARTER' | 'GROWTH' | 'SCALE'
    monthlyCredits: number;
    maxWorkspaces: number;
    priceCents: number;
    currency: string;        // 'BRL'
  };
  export function planCatalog(): PlanCatalogEntry[];   // STARTER, GROWTH, SCALE — in this order

  // credit-packs.ts
  export type PackCatalogEntry = {
    packId: PackId;          // 'SMALL' | 'MEDIUM' | 'LARGE'
    credits: number;
    priceCents: number;
    currency: string;        // 'BRL'
  };
  export function packCatalog(): PackCatalogEntry[];   // SMALL, MEDIUM, LARGE — in this order
  ```

All work in this task is run from the `back/` directory.

- [ ] **Step 1: Write the failing test for the plan catalog**

Create `back/src/billing/plan-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { maxWorkspaces, monthlyAllowance, planCatalog } from './plan-catalog.js';

describe('plan catalog', () => {
  it('publishes the three plans in ascending order', () => {
    expect(planCatalog().map((e) => e.plan)).toEqual(['STARTER', 'GROWTH', 'SCALE']);
  });

  it('publishes the same credits and cap the rest of the system uses', () => {
    for (const entry of planCatalog()) {
      expect(entry.monthlyCredits).toBe(monthlyAllowance(entry.plan));
      expect(entry.maxWorkspaces).toBe(maxWorkspaces(entry.plan));
    }
  });

  it('publishes the price configured in Stripe, in cents', () => {
    expect(planCatalog()).toEqual([
      { plan: 'STARTER', monthlyCredits: 200, maxWorkspaces: 1, priceCents: 29_700, currency: 'BRL' },
      { plan: 'GROWTH', monthlyCredits: 1_000, maxWorkspaces: 3, priceCents: 99_700, currency: 'BRL' },
      { plan: 'SCALE', monthlyCredits: 4_000, maxWorkspaces: 10, priceCents: 249_700, currency: 'BRL' },
    ]);
  });

  it('charges more for more credits', () => {
    const [starter, growth, scale] = planCatalog();
    expect(growth!.priceCents).toBeGreaterThan(starter!.priceCents);
    expect(scale!.priceCents).toBeGreaterThan(growth!.priceCents);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/billing/plan-catalog.test.ts`
Expected: FAIL — `planCatalog` is not exported from `./plan-catalog.js`.

- [ ] **Step 3: Add price and `planCatalog()` to `plan-catalog.ts`**

Add after the `MAX_WORKSPACES` constant:

```ts
// Preço mensal em centavos de real, espelhando o Price do Stripe apontado por
// STRIPE_PRICE_*. Mudar preço é mudar em dois lugares (dashboard do Stripe e
// aqui); o teste do catálogo é o que lembra disso. A alternativa — ler do
// Stripe a cada request — põe rede numa rota que é constante por deploy.
const PRICE_CENTS: Record<Plan, number> = {
  STARTER: 29_700,
  GROWTH: 99_700,
  SCALE: 249_700,
};

const CURRENCY = 'BRL';

export type PlanCatalogEntry = {
  plan: Plan;
  monthlyCredits: number;
  maxWorkspaces: number;
  priceCents: number;
  currency: string;
};

const PLAN_ORDER: Plan[] = ['STARTER', 'GROWTH', 'SCALE'];

// O front precisa comparar planos, e comparar exige os números dos três — não
// só do plano corrente que GET /billing devolve. Publicar o catálogo aqui evita
// a mesma tabela escrita à mão no front, divergindo sem quebrar nada.
export function planCatalog(): PlanCatalogEntry[] {
  return PLAN_ORDER.map((plan) => ({
    plan,
    monthlyCredits: MONTHLY_CREDITS[plan],
    maxWorkspaces: MAX_WORKSPACES[plan],
    priceCents: PRICE_CENTS[plan],
    currency: CURRENCY,
  }));
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/billing/plan-catalog.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the failing test for the pack catalog**

Append to `back/src/billing/credit-packs.test.ts` (inside the existing `describe('credit packs', …)`), and add `packCatalog` to the existing import from `./credit-packs.js`:

```ts
  it('publishes the pack catalog with credits and price', () => {
    expect(packCatalog()).toEqual([
      { packId: 'SMALL', credits: 100, priceCents: 19_700, currency: 'BRL' },
      { packId: 'MEDIUM', credits: 500, priceCents: 79_700, currency: 'BRL' },
      { packId: 'LARGE', credits: 2_000, priceCents: 249_700, currency: 'BRL' },
    ]);
  });

  it('keeps the published credits equal to what a purchase grants', () => {
    for (const entry of packCatalog()) {
      expect(entry.credits).toBe(packCredits(entry.packId));
    }
  });
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `pnpm vitest run src/billing/credit-packs.test.ts`
Expected: FAIL — `packCatalog` is not exported.

- [ ] **Step 7: Add price and `packCatalog()` to `credit-packs.ts`**

Add after the `PACK_CREDITS` constant and its `PackId` type:

```ts
// Centavos de real, espelhando os Prices de pacote no Stripe. Mesma razão e
// mesmo cuidado do preço de plano em plan-catalog.ts.
const PACK_PRICE_CENTS: Record<PackId, number> = {
  SMALL: 19_700,
  MEDIUM: 79_700,
  LARGE: 249_700,
};

const CURRENCY = 'BRL';

export type PackCatalogEntry = {
  packId: PackId;
  credits: number;
  priceCents: number;
  currency: string;
};

const PACK_ORDER: PackId[] = ['SMALL', 'MEDIUM', 'LARGE'];

export function packCatalog(): PackCatalogEntry[] {
  return PACK_ORDER.map((packId) => ({
    packId,
    credits: PACK_CREDITS[packId],
    priceCents: PACK_PRICE_CENTS[packId],
    currency: CURRENCY,
  }));
}
```

- [ ] **Step 8: Run the whole backend suite**

Run: `pnpm test`
Expected: PASS — the previous count plus 6 new tests, nothing broken (the `never leaks money` test on `GET /billing` still passes: that response is untouched).

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: no output, exit 0.

- [ ] **Step 10: Commit (from `back/`)**

```bash
git add src/billing/plan-catalog.ts src/billing/credit-packs.ts src/billing/plan-catalog.test.ts src/billing/credit-packs.test.ts
git commit -m "feat(billing): publish plan and pack catalogs with price

The web app has to let a founder compare plans, and comparing needs the
numbers of all three — GET /billing only reports the current one. Rather
than hand-copying credits, workspace caps and prices into the frontend
where they would drift silently, the catalog that already owns those
numbers now publishes them, price included.

Price lives in code mirroring the Stripe Price, so changing it means
changing two places; the catalog test is what remembers that."
```

---

### Task 2: `GET /billing/plans` (backend)

**Files:**
- Modify: `back/src/http/api/billing/billing.schema.ts`
- Create: `back/src/http/api/billing/get-plans/get-plans.controller.ts`
- Modify: `back/src/http/api/billing/index.ts`
- Modify: `back/src/http/api/billing/billing.test.ts`
- Modify: `back/docs/architecture/billing.md`

**Interfaces:**
- Consumes: `planCatalog(): PlanCatalogEntry[]` and `packCatalog(): PackCatalogEntry[]` from Task 1.
- Produces: HTTP contract `GET /billing/plans`, `operationId: getBillingPlans`, tag `billing`:
  ```json
  { "plans": [{ "plan": "STARTER", "monthlyCredits": 200, "maxWorkspaces": 1, "priceCents": 29700, "currency": "BRL" }],
    "packs": [{ "packId": "SMALL", "credits": 100, "priceCents": 19700, "currency": "BRL" }] }
  ```
  Frontend hook name after regeneration: `useGetBillingPlans` in `src/api/generated/hooks/billingHooks/`.

All work in this task is run from the `back/` directory.

- [ ] **Step 1: Write the failing route test**

Append to `back/src/http/api/billing/billing.test.ts`. Add the import beside the other route imports:

```ts
import { getPlansRoute } from './get-plans/get-plans.controller.js';
```

Register it inside `buildTestApp`, after `getBillingRoute`:

```ts
  await app.register(getPlansRoute);
```

Add the describe block at the end of the file:

```ts
describe('GET /billing/plans', () => {
  it('publishes the catalog to any member, VIEWER included', async () => {
    const res = await (await buildTestApp('VIEWER')).inject({ method: 'GET', url: '/billing/plans' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      plans: [
        { plan: 'STARTER', monthlyCredits: 200, maxWorkspaces: 1, priceCents: 29_700, currency: 'BRL' },
        { plan: 'GROWTH', monthlyCredits: 1_000, maxWorkspaces: 3, priceCents: 99_700, currency: 'BRL' },
        { plan: 'SCALE', monthlyCredits: 4_000, maxWorkspaces: 10, priceCents: 249_700, currency: 'BRL' },
      ],
      packs: [
        { packId: 'SMALL', credits: 100, priceCents: 19_700, currency: 'BRL' },
        { packId: 'MEDIUM', credits: 500, priceCents: 79_700, currency: 'BRL' },
        { packId: 'LARGE', credits: 2_000, priceCents: 249_700, currency: 'BRL' },
      ],
    });
  });

  it('does not touch Stripe or the database', async () => {
    const app = await buildTestApp('MEMBER');
    await app.inject({ method: 'GET', url: '/billing/plans' });

    expect(stripeFake.ensureCustomer).not.toHaveBeenCalled();
    expect(stripeFake.fetchSubscription).not.toHaveBeenCalled();
  });
});
```

`stripeFake` is a module-level `const` in this file whose `vi.fn()`s are shared
across every test, and the file has no `beforeEach` today — without one, the
"does not touch Stripe" test sees calls made by an earlier describe block. Change
the vitest import on line 1 to include `beforeEach` and add, right after the
`stripeFake` declaration:

```ts
beforeEach(() => {
  vi.clearAllMocks();
});
```

`clearAllMocks` clears call history but keeps the `mockResolvedValue`
implementations, which the other tests in the file depend on. Do not use
`resetAllMocks` here — it would strip them.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/http/api/billing/billing.test.ts`
Expected: FAIL — cannot resolve `./get-plans/get-plans.controller.js`.

- [ ] **Step 3: Add the response schema**

Append to `back/src/http/api/billing/billing.schema.ts`:

```ts
// Este é o único lugar do contrato onde dinheiro aparece, divergindo do §8 do
// design do B2b: sem preço o fundador escolhe plano no escuro. Continua sendo
// preço de catálogo, não fatura — nada aqui é específico de um cliente.
export const plansResponse = z.object({
  plans: z.array(
    z.object({
      plan: z.enum(['STARTER', 'GROWTH', 'SCALE']),
      monthlyCredits: z.number().int(),
      maxWorkspaces: z.number().int(),
      priceCents: z.number().int(),
      currency: z.string(),
    }),
  ),
  packs: z.array(
    z.object({
      packId: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
      credits: z.number().int(),
      priceCents: z.number().int(),
      currency: z.string(),
    }),
  ),
});
```

- [ ] **Step 4: Write the controller**

Create `back/src/http/api/billing/get-plans/get-plans.controller.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { planCatalog } from '../../../../billing/plan-catalog.js';
import { packCatalog } from '../../../../billing/credit-packs.js';
import { plansResponse } from '../billing.schema.js';

export const getPlansRoute: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/billing/plans',
    { schema: { tags: ['billing'], operationId: 'getBillingPlans', response: { 200: plansResponse } } },
    async (_req, reply) => {
      // Constante por deploy: nem banco, nem Stripe, nem tenant. Funciona sem
      // STRIPE_SECRET_KEY, como GET /billing — a tela de cobrança tem que abrir
      // mesmo num ambiente sem Stripe configurado.
      return reply.send({ plans: planCatalog(), packs: packCatalog() });
    },
  );
};
```

- [ ] **Step 5: Register the route**

In `back/src/http/api/billing/index.ts`, add the import beside the others and register it right after `getBillingRoute`:

```ts
import { getPlansRoute } from './get-plans/get-plans.controller.js';
```
```ts
  await app.register(getPlansRoute);
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `pnpm vitest run src/http/api/billing/billing.test.ts`
Expected: PASS, including the two new tests.

- [ ] **Step 7: Full backend gate**

Run: `pnpm test && pnpm typecheck`
Expected: both clean.

- [ ] **Step 8: Document the route and the divergence**

In `back/docs/architecture/billing.md`, in the HTTP contract section (§8), add the row:

```markdown
| `GET /billing/plans` | `getBillingPlans` | qualquer membro | catálogo: por plano `monthlyCredits`, `maxWorkspaces`, `priceCents`, `currency`; por pacote `credits`, `priceCents`, `currency` |
```

And below the table add:

```markdown
> **Divergência consciente do §8 do design do B2b (2026-07-28).** Aquele
> documento dizia que preço em dinheiro não aparece nas respostas. `GET
> /billing/plans` devolve `priceCents`, porque a tela de cobrança precisa
> deixar o fundador comparar planos antes de clicar em "assinar". O que
> continua valendo: as respostas de estado (`GET /billing`, `GET /credits`)
> não têm dinheiro, e o cliente conta em créditos.
```

- [ ] **Step 9: Dump the OpenAPI fixture**

Run: `pnpm openapi:dump`
Expected: writes `../web/api.json`. Confirm the new path is there:

Run: `grep -c '"/billing/plans"' ../web/api.json`
Expected: `1`.

Note: this modifies a file in the **web** repo. Do not commit it here — Task 3 commits it in `web/`.

- [ ] **Step 10: Commit (from `back/`)**

```bash
git add src/http/api/billing/billing.schema.ts src/http/api/billing/get-plans src/http/api/billing/index.ts src/http/api/billing/billing.test.ts docs/architecture/billing.md
git commit -m "feat(billing): add GET /billing/plans

The billing screen has to show what each plan gives and costs before the
founder commits. This route publishes the catalog — credits, workspace cap
and price per plan, credits and price per pack — to any member, VIEWER
included. It reads no database and no Stripe, so it also answers in an
environment with no STRIPE_SECRET_KEY, like GET /billing already does.

Price in a response diverges from B2b design §8, which is recorded in
docs/architecture/billing.md: state responses still carry no money."
```

---

### Task 3: Regenerate the client, cache keys, and the pure helpers (frontend)

**Files:**
- Modify: `web/api.json` (already regenerated by Task 2 step 9)
- Create: `web/src/api/modules/billing.ts`
- Create: `web/src/api/modules/credits.ts`
- Modify: `web/src/api/modules/index.ts`
- Create: `web/src/lib/money.ts`
- Create: `web/src/lib/money.test.ts`
- Create: `web/src/lib/credits.ts`
- Create: `web/src/lib/credits.test.ts`
- Create: `web/src/lib/roles.ts`
- Create: `web/src/lib/roles.test.ts`

**Interfaces:**
- Consumes: the OpenAPI fixture produced by Task 2.
- Produces:
  ```ts
  // src/api/modules  (barrel re-exports both)
  export const BILLING = {
    ENDPOINT: '/billing',
    queryKeyRoot: [{ url: '/billing' }] as const,
    PLANS_ENDPOINT: '/billing/plans',
    plansQueryKeyRoot: [{ url: '/billing/plans' }] as const,
  } as const;
  export const CREDITS = {
    ENDPOINT: '/credits',
    queryKeyRoot: [{ url: '/credits' }] as const,
    LEDGER_ENDPOINT: '/credits/ledger',
    ledgerQueryKeyRoot: [{ url: '/credits/ledger' }] as const,
  } as const;

  // src/lib/money.ts
  export function formatCents(cents: number, currency: string, locale: string): string;

  // src/lib/credits.ts
  export function availableCredits(input: { allowance: number; consumed: number; purchasedBalance: number }): number;
  export function allowanceRemaining(input: { allowance: number; consumed: number }): number;

  // src/lib/roles.ts
  export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  export function canManageSubscription(role: Role | null): boolean;   // OWNER
  export function canBuyCredits(role: Role | null): boolean;           // OWNER | ADMIN
  ```
  Generated hooks that later tasks rely on (all in `src/api/generated/hooks/`): `billingHooks/useGetBilling`, `billingHooks/useGetBillingPlans`, `billingHooks/useCreateSubscriptionCheckout`, `billingHooks/useCreateCreditPackCheckout`, `billingHooks/useCreateBillingPortal`, `billingHooks/useSyncBilling`, `creditsHooks/useGetCredits`, `creditsHooks/useListCreditLedger`.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Regenerate the typed client**

Run: `pnpm api:generate`
Expected: Kubb writes `src/api/generated/`. Confirm the new hook exists:

Run: `ls src/api/generated/hooks/billingHooks/useGetBillingPlans.ts`
Expected: the path prints (no error).

- [ ] **Step 2: Add the cache-key modules**

Create `src/api/modules/billing.ts`:

```ts
// Per-module constants for cache invalidation. Matches the Kubb queryKey prefix.
export const BILLING = {
  ENDPOINT: '/billing',
  queryKeyRoot: [{ url: '/billing' }] as const,
  PLANS_ENDPOINT: '/billing/plans',
  plansQueryKeyRoot: [{ url: '/billing/plans' }] as const,
} as const;
```

Create `src/api/modules/credits.ts`:

```ts
// Per-module constants for cache invalidation. Matches the Kubb queryKey prefix.
// The ledger has its own root: a grant changes the statement without changing
// the balance query's key, so both have to be invalidated by name.
export const CREDITS = {
  ENDPOINT: '/credits',
  queryKeyRoot: [{ url: '/credits' }] as const,
  LEDGER_ENDPOINT: '/credits/ledger',
  ledgerQueryKeyRoot: [{ url: '/credits/ledger' }] as const,
} as const;
```

Add both to `src/api/modules/index.ts`, following the existing named-export style
(the file currently reads `export { GOALS } from './goals';` and three siblings):

```ts
export { BILLING } from './billing';
export { CREDITS } from './credits';
```

- [ ] **Step 3: Write the failing tests for the helpers**

Create `src/lib/money.test.ts`:

```ts
import { formatCents } from './money';

describe('formatCents', () => {
  it('formats Brazilian currency in Portuguese', () => {
    // The separator between symbol and digits is a non-breaking space in ICU —
    // matching it literally is how this test breaks on a different Node build.
    expect(formatCents(29_700, 'BRL', 'pt')).toMatch(/^R\$\s?297,00$/);
  });

  it('keeps the currency when the locale changes', () => {
    expect(formatCents(29_700, 'BRL', 'en')).toMatch(/297\.00/);
  });

  it('formats a whole thousand', () => {
    expect(formatCents(249_700, 'BRL', 'pt')).toMatch(/2\.497,00/);
  });

  it('formats zero', () => {
    expect(formatCents(0, 'BRL', 'pt')).toMatch(/0,00/);
  });
});
```

Create `src/lib/credits.test.ts`:

```ts
import { allowanceRemaining, availableCredits } from './credits';

describe('credit balance', () => {
  it('adds what is left of the allowance to the purchased balance', () => {
    expect(availableCredits({ allowance: 1_000, consumed: 400, purchasedBalance: 850 })).toBe(1_450);
  });

  it('never turns overspend into a negative balance', () => {
    // An upgrade mid-period grants the difference instead of rewriting the
    // frozen allowance, so consumed can exceed allowance legitimately.
    expect(availableCredits({ allowance: 200, consumed: 260, purchasedBalance: 100 })).toBe(100);
    expect(allowanceRemaining({ allowance: 200, consumed: 260 })).toBe(0);
  });

  it('reports a zero allowance on trial', () => {
    expect(availableCredits({ allowance: 0, consumed: 0, purchasedBalance: 50 })).toBe(50);
  });
});
```

Create `src/lib/roles.test.ts`:

```ts
import { canBuyCredits, canManageSubscription } from './roles';

describe('billing permissions', () => {
  it('lets only the OWNER change the subscription', () => {
    expect(canManageSubscription('OWNER')).toBe(true);
    expect(canManageSubscription('ADMIN')).toBe(false);
    expect(canManageSubscription('MEMBER')).toBe(false);
    expect(canManageSubscription('VIEWER')).toBe(false);
  });

  it('lets OWNER and ADMIN buy credits', () => {
    expect(canBuyCredits('OWNER')).toBe(true);
    expect(canBuyCredits('ADMIN')).toBe(true);
    expect(canBuyCredits('MEMBER')).toBe(false);
    expect(canBuyCredits('VIEWER')).toBe(false);
  });

  it('denies everything when the role is unknown', () => {
    expect(canManageSubscription(null)).toBe(false);
    expect(canBuyCredits(null)).toBe(false);
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `pnpm vitest run src/lib/money.test.ts src/lib/credits.test.ts src/lib/roles.test.ts`
Expected: FAIL — the three modules do not exist.

- [ ] **Step 5: Write the helpers**

Create `src/lib/money.ts`:

```ts
/**
 * Formats a catalog price. Cents in, localized currency out — the backend
 * publishes integers so no float ever crosses the wire.
 */
export function formatCents(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
```

Create `src/lib/credits.ts`:

```ts
/** What is left of this period's allowance. Never negative. */
export function allowanceRemaining({ allowance, consumed }: { allowance: number; consumed: number }): number {
  return Math.max(allowance - consumed, 0);
}

/**
 * What the workspace can actually spend: the rest of the monthly allowance
 * plus the purchased balance, which no subscription status takes away.
 */
export function availableCredits({
  allowance,
  consumed,
  purchasedBalance,
}: {
  allowance: number;
  consumed: number;
  purchasedBalance: number;
}): number {
  return allowanceRemaining({ allowance, consumed }) + purchasedBalance;
}
```

Create `src/lib/roles.ts`:

```ts
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/** Subscription and card belong to the organization's owner (backend: OWNER only). */
export function canManageSubscription(role: Role | null): boolean {
  return role === 'OWNER';
}

/** Buying a pack and forcing a sync are OWNER or ADMIN on the backend. */
export function canBuyCredits(role: Role | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm vitest run src/lib/money.test.ts src/lib/credits.test.ts src/lib/roles.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 8: Commit (from `web/`)**

```bash
git add api.json src/api/modules src/lib/money.ts src/lib/money.test.ts src/lib/credits.ts src/lib/credits.test.ts src/lib/roles.ts src/lib/roles.test.ts
git commit -m "feat(billing): add the billing data layer foundations

Picks up the regenerated OpenAPI fixture with GET /billing/plans, adds the
cache-key constants for the billing and credits modules, and the three pure
helpers the screen is built on: price formatting from cents, the spendable
balance (allowance left plus purchased, never negative — an upgrade grants
the difference instead of rewriting a frozen allowance, so consumed can
legitimately exceed it), and the role predicates that mirror what the
backend enforces."
```

---

### Task 4: `useAuth` exposes the current role (frontend)

**Files:**
- Modify: `web/src/lib/auth.tsx`
- Create: `web/src/lib/auth.test.tsx`

**Interfaces:**
- Consumes: `Role` from `src/lib/roles.ts` (Task 3); existing `api.me()` returning `{ user, memberships }` and `Membership` from `src/lib/api.ts`.
- Produces: `useAuth()` returns, in addition to today's `user`, `status`, `login`, `register`, `logout`:
  ```ts
  role: Role | null;   // role of the membership for the current workspace, org-level membership as fallback
  ```

The billing page has to know the role before rendering a button, and today the
provider throws away the `memberships` that `api.me()` already returns.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/auth.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth';
import { api, tokenStore } from './api';

function RoleProbe() {
  const { role, status } = useAuth();
  return <span data-testid="probe">{status}:{role ?? 'none'}</span>;
}

function renderProbe() {
  render(
    <AuthProvider>
      <RoleProbe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('AuthProvider role', () => {
  it('prefers the membership of the current workspace', async () => {
    tokenStore.set('access', 'refresh');
    vi.spyOn(api, 'me').mockResolvedValue({
      user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
      memberships: [
        { organizationId: 'org-1', workspaceId: null, role: 'VIEWER' },
        { organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' },
      ],
    });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:OWNER'));
  });

  it('falls back to the organization membership', async () => {
    tokenStore.set('access', 'refresh');
    vi.spyOn(api, 'me').mockResolvedValue({
      user: { id: 'u1', email: 'admin@acme.com', name: 'Admin' },
      memberships: [{ organizationId: 'org-1', workspaceId: null, role: 'ADMIN' }],
    });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:ADMIN'));
  });

  it('has no role while anonymous', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm vitest run src/lib/auth.test.tsx`
Expected: FAIL — `role` does not exist on the context value (TS error at runtime it renders `none`, and the first two assertions fail).

- [ ] **Step 3: Implement `role` in the provider**

In `web/src/lib/auth.tsx`:

Add the imports:

```tsx
import { api, tokenStore, type Membership, type User } from './api';
import type { Role } from './roles';
```

Extend the context type:

```tsx
interface AuthContextValue {
  user: User | null;
  role: Role | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  logout: () => Promise<void>;
}
```

Add the picker above `AuthProvider`:

```tsx
/**
 * The role that governs what this user may do here. A workspace membership
 * wins over the organization-level one: the backend resolves the tenant to a
 * workspace, so that is the role it will enforce.
 */
function currentRole(memberships: Membership[]): Role | null {
  return (memberships.find((m) => m.workspaceId !== null) ?? memberships[0])?.role ?? null;
}
```

Inside `AuthProvider`, add the state and fill it:

```tsx
  const [role, setRole] = useState<Role | null>(null);
```

In the mount effect, replace the `.then` body with:

```tsx
      .then((data) => {
        setUser(data.user);
        setRole(currentRole(data.memberships));
        setStatus('authenticated');
      })
```

and in its `.catch`, add `setRole(null);` beside `tokenStore.clear()`.

`login` and `register` only get the user back, so they read the memberships
right after the tokens are stored — one extra request, at the one moment the
app is already waiting on the network:

```tsx
  const login = async (email: string, password: string) => {
    const u = await api.login({ email, password });
    setUser(u);
    setRole(currentRole((await api.me()).memberships));
    setStatus('authenticated');
  };

  const register = async (input: { name: string; email: string; password: string; organizationName: string }) => {
    const u = await api.register(input);
    setUser(u);
    setRole(currentRole((await api.me()).memberships));
    setStatus('authenticated');
  };
```

In `logout`, add `setRole(null);` beside `setUser(null)`.

Finally include `role` in the provider value:

```tsx
  return (
    <AuthContext.Provider value={{ user, role, status, login, register, logout }}>{children}</AuthContext.Provider>
  );
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm vitest run src/lib/auth.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Full gate**

Run: `pnpm typecheck && pnpm test`
Expected: both clean.

- [ ] **Step 6: Commit (from `web/`)**

```bash
git add src/lib/auth.tsx src/lib/auth.test.tsx
git commit -m "feat(auth): expose the current role from useAuth

The billing screen has to know whether to enable a button before it renders
one, and the provider was already fetching memberships from /auth/me and
throwing them away. The workspace membership wins over the organization one
because the backend resolves the tenant to a workspace and enforces that
role. login/register read memberships right after storing tokens — one extra
request at the one moment the app is already waiting on the network."
```

---

### Task 5: `PlanCard`, `CreditPackCard`, `AllowanceBar` (frontend, pure)

**Files:**
- Create: `web/src/test/render.tsx`
- Create: `web/src/components/billing/PlanCard.tsx`
- Create: `web/src/components/billing/PlanCard.test.tsx`
- Create: `web/src/components/billing/CreditPackCard.tsx`
- Create: `web/src/components/billing/CreditPackCard.test.tsx`
- Create: `web/src/components/billing/AllowanceBar.tsx`
- Create: `web/src/components/billing/AllowanceBar.test.tsx`
- Modify: `web/src/i18n/locales/en.json`, `pt.json`, `es.json`

**Interfaces:**
- Consumes: `formatCents` (Task 3), `canManageSubscription`/`canBuyCredits`/`Role` (Task 3), generated types `GetBillingPlans200` (Task 3) — but the props below are declared structurally, so the components do not import generated types.
- Produces:
  ```tsx
  export function PlanCard(props: {
    plan: 'STARTER' | 'GROWTH' | 'SCALE';
    monthlyCredits: number;
    maxWorkspaces: number;
    priceCents: number;
    currency: string;
    isCurrent: boolean;
    hasSubscription: boolean;
    canManage: boolean;
    pending: boolean;
    onChoose: (plan: 'STARTER' | 'GROWTH' | 'SCALE') => void;
  }): JSX.Element;

  export function CreditPackCard(props: {
    packId: 'SMALL' | 'MEDIUM' | 'LARGE';
    credits: number;
    priceCents: number;
    currency: string;
    canBuy: boolean;
    pending: boolean;
    onBuy: (packId: 'SMALL' | 'MEDIUM' | 'LARGE') => void;
  }): JSX.Element;

  export function AllowanceBar(props: { allowance: number; consumed: number }): JSX.Element;

  // src/test/render.tsx
  export function renderWithProviders(ui: ReactNode): ReturnType<typeof render>;
  ```

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Add the test render helper**

Create `web/src/test/render.tsx`:

```tsx
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';

/**
 * Renders a component with the providers the app gives it: i18n pinned to
 * English so assertions read the en.json copy, a throwaway QueryClient with
 * retries off so a failing request surfaces immediately, and a router.
 */
export function renderWithProviders(ui: ReactNode) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
```

- [ ] **Step 2: Add the i18n keys these cards need**

In `src/i18n/locales/en.json`, add under `pages` (sibling of `goals`):

```json
"billing": {
  "title": "Billing & credits",
  "subtitle": "Your plan, your credits, and where they went.",
  "helpTitle": "Billing",
  "help": "Your organization subscribes; every workspace in it gets the plan's monthly credits. Buying a pack adds credits that never expire.",
  "plans": {
    "title": "Plans",
    "helpTitle": "Plan",
    "help": "The plan sets how many credits each workspace gets per month and how many workspaces you can create.",
    "current": "Current plan",
    "creditsPerMonth": "{{count}} credits/month",
    "workspaceCap": "Up to {{count}} workspaces",
    "perMonth": "/month",
    "subscribe": "Subscribe",
    "switch": "Switch to this plan",
    "ownerOnlyHelpTitle": "Who can change the plan",
    "ownerOnly": "Only the organization owner can subscribe or change the plan. Ask them to do it."
  },
  "packs": {
    "title": "Credit packs",
    "helpTitle": "Purchased credits",
    "help": "Credits you buy once. They do not expire, do not renew, and stay spendable even if the subscription is canceled.",
    "credits": "{{count}} credits",
    "buy": "Buy",
    "adminOnlyHelpTitle": "Who can buy credits",
    "adminOnly": "Only an owner or admin can buy credit packs. Ask one of them to do it."
  },
  "allowance": {
    "title": "Monthly allowance",
    "helpTitle": "Monthly allowance",
    "help": "Credits included in your plan for this workspace. They reset every month and do not roll over.",
    "used": "{{consumed}} of {{allowance}} used",
    "exhausted": "Allowance used up for this period."
  }
}
```

Add the same keys, translated, to `pt.json` and `es.json`. Portuguese copy:

```json
"billing": {
  "title": "Cobrança e créditos",
  "subtitle": "Seu plano, seus créditos e para onde eles foram.",
  "helpTitle": "Cobrança",
  "help": "Quem assina é a sua organização; cada workspace dela recebe os créditos mensais do plano. Comprar um pacote adiciona créditos que não expiram.",
  "plans": {
    "title": "Planos",
    "helpTitle": "Plano",
    "help": "O plano define quantos créditos cada workspace recebe por mês e quantos workspaces você pode criar.",
    "current": "Plano atual",
    "creditsPerMonth": "{{count}} créditos/mês",
    "workspaceCap": "Até {{count}} workspaces",
    "perMonth": "/mês",
    "subscribe": "Assinar",
    "switch": "Mudar para este plano",
    "ownerOnlyHelpTitle": "Quem pode mudar o plano",
    "ownerOnly": "Só o proprietário da organização pode assinar ou mudar o plano. Peça para ele."
  },
  "packs": {
    "title": "Pacotes de crédito",
    "helpTitle": "Créditos comprados",
    "help": "Créditos que você compra uma vez. Não expiram, não renovam e continuam gastáveis mesmo com a assinatura cancelada.",
    "credits": "{{count}} créditos",
    "buy": "Comprar",
    "adminOnlyHelpTitle": "Quem pode comprar crédito",
    "adminOnly": "Só proprietário ou administrador pode comprar pacotes. Peça para um deles."
  },
  "allowance": {
    "title": "Franquia mensal",
    "helpTitle": "Franquia mensal",
    "help": "Créditos que já vêm no seu plano para este workspace. Renovam todo mês e não acumulam.",
    "used": "{{consumed}} de {{allowance}} usados",
    "exhausted": "Franquia deste período esgotada."
  }
}
```

Spanish copy:

```json
"billing": {
  "title": "Facturación y créditos",
  "subtitle": "Tu plan, tus créditos y a dónde fueron.",
  "helpTitle": "Facturación",
  "help": "Quien se suscribe es tu organización; cada workspace recibe los créditos mensuales del plan. Comprar un paquete añade créditos que no caducan.",
  "plans": {
    "title": "Planes",
    "helpTitle": "Plan",
    "help": "El plan define cuántos créditos recibe cada workspace por mes y cuántos workspaces puedes crear.",
    "current": "Plan actual",
    "creditsPerMonth": "{{count}} créditos/mes",
    "workspaceCap": "Hasta {{count}} workspaces",
    "perMonth": "/mes",
    "subscribe": "Suscribirse",
    "switch": "Cambiar a este plan",
    "ownerOnlyHelpTitle": "Quién puede cambiar el plan",
    "ownerOnly": "Solo el propietario de la organización puede suscribirse o cambiar el plan. Pídeselo.",
  },
  "packs": {
    "title": "Paquetes de crédito",
    "helpTitle": "Créditos comprados",
    "help": "Créditos que compras una vez. No caducan, no se renuevan y siguen gastables incluso con la suscripción cancelada.",
    "credits": "{{count}} créditos",
    "buy": "Comprar",
    "adminOnlyHelpTitle": "Quién puede comprar crédito",
    "adminOnly": "Solo un propietario o administrador puede comprar paquetes. Pídeselo a uno de ellos."
  },
  "allowance": {
    "title": "Franquicia mensual",
    "helpTitle": "Franquicia mensual",
    "help": "Créditos incluidos en tu plan para este workspace. Se renuevan cada mes y no se acumulan.",
    "used": "{{consumed}} de {{allowance}} usados",
    "exhausted": "Franquicia de este periodo agotada."
  }
}
```

Note: JSON has no trailing commas — the Spanish `ownerOnly` line above ends the object, so drop the comma when pasting. Run `node -e "require('./src/i18n/locales/es.json')"` after editing each file to prove it parses.

Also add the plan display names under the existing top-level `enums` object in all three files, if `enums.plan` is not there yet:

```json
"plan": { "STARTER": "Starter", "GROWTH": "Growth", "SCALE": "Scale" },
"pack": { "SMALL": "Small", "MEDIUM": "Medium", "LARGE": "Large" }
```

(Portuguese and Spanish use the same proper names for plans; for packs use `Pequeno/Médio/Grande` and `Pequeño/Mediano/Grande`.)

- [ ] **Step 3: Write the failing tests**

Create `web/src/components/billing/PlanCard.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PlanCard } from './PlanCard';

const base = {
  plan: 'GROWTH' as const,
  monthlyCredits: 1_000,
  maxWorkspaces: 3,
  priceCents: 99_700,
  currency: 'BRL',
  isCurrent: false,
  hasSubscription: false,
  canManage: true,
  pending: false,
  onChoose: () => {},
};

describe('PlanCard', () => {
  it('shows credits, workspace cap and price', () => {
    renderWithProviders(<PlanCard {...base} />);

    expect(screen.getByText('1000 credits/month')).toBeInTheDocument();
    expect(screen.getByText('Up to 3 workspaces')).toBeInTheDocument();
    expect(screen.getByText(/997\.00|997,00/)).toBeInTheDocument();
  });

  it('marks the current plan and offers no action for it', () => {
    renderWithProviders(<PlanCard {...base} isCurrent hasSubscription />);

    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says subscribe without a subscription and switch with one', () => {
    const { unmount } = renderWithProviders(<PlanCard {...base} />);
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
    unmount();

    renderWithProviders(<PlanCard {...base} hasSubscription />);
    expect(screen.getByRole('button', { name: 'Switch to this plan' })).toBeEnabled();
  });

  it('disables the action and explains it when the user cannot manage billing', () => {
    renderWithProviders(<PlanCard {...base} canManage={false} />);

    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
    expect(screen.getByLabelText('Explain: Who can change the plan')).toBeInTheDocument();
  });

  it('reports the chosen plan', async () => {
    const onChoose = vi.fn();
    renderWithProviders(<PlanCard {...base} onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(onChoose).toHaveBeenCalledWith('GROWTH');
  });

  it('disables the action while a checkout is being created', () => {
    renderWithProviders(<PlanCard {...base} pending />);
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });
});
```

Create `web/src/components/billing/CreditPackCard.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreditPackCard } from './CreditPackCard';

const base = {
  packId: 'MEDIUM' as const,
  credits: 500,
  priceCents: 79_700,
  currency: 'BRL',
  canBuy: true,
  pending: false,
  onBuy: () => {},
};

describe('CreditPackCard', () => {
  it('shows credits and price', () => {
    renderWithProviders(<CreditPackCard {...base} />);

    expect(screen.getByText('500 credits')).toBeInTheDocument();
    expect(screen.getByText(/797\.00|797,00/)).toBeInTheDocument();
  });

  it('reports the chosen pack', async () => {
    const onBuy = vi.fn();
    renderWithProviders(<CreditPackCard {...base} onBuy={onBuy} />);

    await userEvent.click(screen.getByRole('button', { name: 'Buy' }));

    expect(onBuy).toHaveBeenCalledWith('MEDIUM');
  });

  it('disables buying and explains it for a member', () => {
    renderWithProviders(<CreditPackCard {...base} canBuy={false} />);

    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
    expect(screen.getByLabelText('Explain: Who can buy credits')).toBeInTheDocument();
  });
});
```

Create `web/src/components/billing/AllowanceBar.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { AllowanceBar } from './AllowanceBar';

describe('AllowanceBar', () => {
  it('reports consumption as a labelled progress bar', () => {
    renderWithProviders(<AllowanceBar allowance={1_000} consumed={400} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '400');
    expect(bar).toHaveAttribute('aria-valuemax', '1000');
    expect(screen.getByText('400 of 1000 used')).toBeInTheDocument();
  });

  it('caps the bar at full when consumption passes the allowance', () => {
    renderWithProviders(<AllowanceBar allowance={200} consumed={260} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '200');
    expect(screen.getByText('Allowance used up for this period.')).toBeInTheDocument();
  });

  it('handles a zero allowance without dividing by zero', () => {
    renderWithProviders(<AllowanceBar allowance={0} consumed={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '0');
    expect(screen.getByText('0 of 0 used')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run them and confirm they fail**

Run: `pnpm vitest run src/components/billing`
Expected: FAIL — the three components do not exist.

- [ ] **Step 5: Write `AllowanceBar`**

Create `web/src/components/billing/AllowanceBar.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { allowanceRemaining } from '@/lib/credits';
import { cn } from '@/lib/utils';

/**
 * Consumption of this period's allowance. Consumed can exceed the allowance —
 * a mid-period upgrade grants the difference instead of rewriting the frozen
 * allowance — so the bar clamps instead of overflowing.
 */
export function AllowanceBar({ allowance, consumed }: { allowance: number; consumed: number }) {
  const { t } = useTranslation();
  const shown = Math.min(consumed, allowance);
  const pct = allowance === 0 ? 100 : Math.round((shown / allowance) * 100);
  const exhausted = allowanceRemaining({ allowance, consumed }) === 0;

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={shown}
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-label={t('pages.billing.allowance.title')}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', exhausted ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {t('pages.billing.allowance.used', { consumed, allowance })}
      </p>
      {exhausted && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('pages.billing.allowance.exhausted')}</p>}
    </div>
  );
}
```

Note on the one allowed inline style: `width` is a computed layout value, not a
theme value — Tailwind cannot express an arbitrary runtime percentage. Every
color here is a token class.

- [ ] **Step 6: Write `PlanCard`**

Create `web/src/components/billing/PlanCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

type Plan = 'STARTER' | 'GROWTH' | 'SCALE';

export function PlanCard({
  plan,
  monthlyCredits,
  maxWorkspaces,
  priceCents,
  currency,
  isCurrent,
  hasSubscription,
  canManage,
  pending,
  onChoose,
}: {
  plan: Plan;
  monthlyCredits: number;
  maxWorkspaces: number;
  priceCents: number;
  currency: string;
  isCurrent: boolean;
  hasSubscription: boolean;
  canManage: boolean;
  pending: boolean;
  onChoose: (plan: Plan) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Card className={cn('card-tech', isCurrent && 'ring-1 ring-primary/40')}>
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-lg font-bold">{t(`enums.plan.${plan}`)}</span>
          {isCurrent && (
            <Badge variant="success">
              <Check className="mr-1 size-3" /> {t('pages.billing.plans.current')}
            </Badge>
          )}
        </div>

        <div>
          <span className="font-display text-2xl font-extrabold">{formatCents(priceCents, currency, i18n.language)}</span>
          <span className="text-sm text-muted-foreground">{t('pages.billing.plans.perMonth')}</span>
        </div>

        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>{t('pages.billing.plans.creditsPerMonth', { count: monthlyCredits })}</li>
          <li>{t('pages.billing.plans.workspaceCap', { count: maxWorkspaces })}</li>
        </ul>

        {!isCurrent && (
          <div className="mt-auto flex items-center">
            <Button
              className="w-full"
              variant={hasSubscription ? 'outline' : 'default'}
              disabled={!canManage || pending}
              onClick={() => onChoose(plan)}
            >
              {hasSubscription ? t('pages.billing.plans.switch') : t('pages.billing.plans.subscribe')}
            </Button>
            {!canManage && (
              <Help title={t('pages.billing.plans.ownerOnlyHelpTitle')}>{t('pages.billing.plans.ownerOnly')}</Help>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

A disabled button takes no focus and fires no event, which is exactly why the
explanation sits in the `Help` next to it — that trigger is reachable by
keyboard.

- [ ] **Step 7: Write `CreditPackCard`**

Create `web/src/components/billing/CreditPackCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { formatCents } from '@/lib/money';

type PackId = 'SMALL' | 'MEDIUM' | 'LARGE';

export function CreditPackCard({
  packId,
  credits,
  priceCents,
  currency,
  canBuy,
  pending,
  onBuy,
}: {
  packId: PackId;
  credits: number;
  priceCents: number;
  currency: string;
  canBuy: boolean;
  pending: boolean;
  onBuy: (packId: PackId) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Card className="card-tech">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t(`enums.pack.${packId}`)}
        </span>
        <span className="font-display text-xl font-bold">{t('pages.billing.packs.credits', { count: credits })}</span>
        <span className="text-sm text-muted-foreground">{formatCents(priceCents, currency, i18n.language)}</span>

        <div className="mt-auto flex items-center">
          <Button className="w-full" variant="outline" disabled={!canBuy || pending} onClick={() => onBuy(packId)}>
            {t('pages.billing.packs.buy')}
          </Button>
          {!canBuy && (
            <Help title={t('pages.billing.packs.adminOnlyHelpTitle')}>{t('pages.billing.packs.adminOnly')}</Help>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `pnpm vitest run src/components/billing`
Expected: PASS — 12 tests.

If a `credits/month` assertion fails on the thousands separator, the cause is
i18next's `count` interpolation formatting the number for the locale. Keep the
raw number by asserting with a regex (`/1[.,]?000 credits\/month/`) rather than
by changing the copy.

- [ ] **Step 9: Verify the locale files parse and the gate is clean**

Run: `node -e "['en','pt','es'].forEach(l=>require('./src/i18n/locales/'+l+'.json'))" && pnpm typecheck && pnpm test`
Expected: all clean.

- [ ] **Step 10: Commit (from `web/`)**

```bash
git add src/test/render.tsx src/components/billing src/i18n/locales
git commit -m "feat(billing): add the plan, pack and allowance cards

The three pure pieces of the billing screen: a plan card that shows what a
plan gives and costs and marks the current one, a pack card, and the
allowance bar. The bar clamps instead of overflowing because a mid-period
upgrade grants the difference rather than rewriting the frozen allowance, so
consumed can legitimately exceed the allowance.

Actions the user's role does not allow are rendered disabled next to a Help
that says who can do it — a disabled button takes no focus, so the
explanation has to live in something that does."
```

---

### Task 6: `PlanSection` (frontend, queries)

**Files:**
- Create: `web/src/components/billing/PlanSection.tsx`
- Create: `web/src/components/billing/PlanSection.test.tsx`
- Modify: `web/src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `useGetBilling`, `useGetBillingPlans`, `useCreateSubscriptionCheckout`, `useCreateBillingPortal` (Task 3); `PlanCard` (Task 5); `useAuth().role` (Task 4); `canManageSubscription` (Task 3).
- Produces: `export function PlanSection(): JSX.Element` — self-contained: does its own queries, renders loading/error/content.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Add the i18n keys for status and the section chrome**

Add inside `pages.billing` in all three locale files (English shown; translate for pt/es):

```json
"status": {
  "TRIAL": "Trial",
  "ACTIVE": "Active",
  "PAST_DUE": "Payment overdue",
  "CANCELED": "Canceled"
},
"renewsOn": "Renews on {{date}}",
"trialNotice": "You are on trial: the plan allowance is zero until you subscribe. Your welcome credits still work.",
"pastDueNotice": "A payment failed. Your allowance stays for now while the card is retried — update it to avoid losing it.",
"canceledNotice": "The subscription is canceled, so the monthly allowance is zero. Credits you purchased are still spendable.",
"portal": "Manage billing",
"portalHelpTitle": "Billing portal",
"portalHelp": "Opens Stripe, where you can change the card, see invoices, or cancel.",
"notConfigured": "Billing is not available in this environment.",
"retry": "Try again",
"loadError": "Could not load this section."
```

Portuguese:

```json
"status": {
  "TRIAL": "Teste",
  "ACTIVE": "Ativo",
  "PAST_DUE": "Pagamento em atraso",
  "CANCELED": "Cancelado"
},
"renewsOn": "Renova em {{date}}",
"trialNotice": "Você está em teste: a franquia do plano é zero até assinar. Seus créditos de boas-vindas continuam valendo.",
"pastDueNotice": "Um pagamento falhou. Sua franquia continua por enquanto enquanto o cartão é recobrado — atualize para não perdê-la.",
"canceledNotice": "A assinatura está cancelada, então a franquia mensal é zero. Os créditos que você comprou continuam gastáveis.",
"portal": "Gerenciar cobrança",
"portalHelpTitle": "Portal de cobrança",
"portalHelp": "Abre o Stripe, onde você troca o cartão, vê faturas ou cancela.",
"notConfigured": "Cobrança indisponível neste ambiente.",
"retry": "Tentar de novo",
"loadError": "Não foi possível carregar esta seção."
```

Spanish:

```json
"status": {
  "TRIAL": "Prueba",
  "ACTIVE": "Activo",
  "PAST_DUE": "Pago atrasado",
  "CANCELED": "Cancelado"
},
"renewsOn": "Se renueva el {{date}}",
"trialNotice": "Estás en prueba: la franquicia del plan es cero hasta que te suscribas. Tus créditos de bienvenida siguen valiendo.",
"pastDueNotice": "Un pago falló. Tu franquicia se mantiene por ahora mientras se reintenta la tarjeta — actualízala para no perderla.",
"canceledNotice": "La suscripción está cancelada, así que la franquicia mensual es cero. Los créditos que compraste siguen gastables.",
"portal": "Gestionar facturación",
"portalHelpTitle": "Portal de facturación",
"portalHelp": "Abre Stripe, donde puedes cambiar la tarjeta, ver facturas o cancelar.",
"notConfigured": "Facturación no disponible en este entorno.",
"retry": "Intentar de nuevo",
"loadError": "No se pudo cargar esta sección."
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/billing/PlanSection.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PlanSection } from './PlanSection';

const billing = {
  plan: 'GROWTH',
  status: 'ACTIVE',
  currentPeriodEnd: '2026-08-28T00:00:00.000Z',
  hasSubscription: true,
  maxWorkspaces: 3,
  workspaceCount: 1,
};

const plans = {
  plans: [
    { plan: 'STARTER', monthlyCredits: 200, maxWorkspaces: 1, priceCents: 29_700, currency: 'BRL' },
    { plan: 'GROWTH', monthlyCredits: 1_000, maxWorkspaces: 3, priceCents: 99_700, currency: 'BRL' },
    { plan: 'SCALE', monthlyCredits: 4_000, maxWorkspaces: 10, priceCents: 249_700, currency: 'BRL' },
  ],
  packs: [],
};

let role: string | null = 'OWNER';
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ role }) }));

const assign = vi.fn();

function stubFetch(routes: Record<string, { status?: number; body: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = new URL(url).pathname;
      const hit = routes[path];
      if (!hit) throw new Error(`unstubbed ${path}`);
      return Promise.resolve(
        new Response(JSON.stringify(hit.body), {
          status: hit.status ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
}

beforeEach(() => {
  role = 'OWNER';
  assign.mockClear();
  vi.stubGlobal('location', { assign, href: 'http://localhost/app/settings/billing' } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlanSection', () => {
  it('shows the current plan, its status and the renewal date', async () => {
    stubFetch({ '/billing': { body: billing }, '/billing/plans': { body: plans } });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText(/Renews on/)).toBeInTheDocument();
  });

  it('sends the owner to Stripe when a plan is chosen', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/checkout/subscription': { body: { url: 'https://checkout.stripe/x' } },
    });

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Switch to this plan' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe/x'));
  });

  it('opens the billing portal', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/portal': { body: { url: 'https://portal.stripe/x' } },
    });

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://portal.stripe/x'));
  });

  it('warns a past-due organization without taking the allowance away', async () => {
    stubFetch({
      '/billing': { body: { ...billing, status: 'PAST_DUE' } },
      '/billing/plans': { body: plans },
    });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByText('Payment overdue')).toBeInTheDocument();
    expect(screen.getByText(/allowance stays for now/)).toBeInTheDocument();
  });

  it('explains an unconfigured billing environment instead of a generic failure', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/portal': { status: 500, body: { error: { code: 'AUR-T0016', message: 'not configured' } } },
    });

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage billing' }));

    expect(await screen.findByText('Billing is not available in this environment.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('disables plan actions and the portal for a member', async () => {
    role = 'MEMBER';
    stubFetch({ '/billing': { body: billing }, '/billing/plans': { body: plans } });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByRole('button', { name: 'Manage billing' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });
});
```

Two notes on this test: `useAuth` is mocked because the section needs a role and
not an auth session, and `fetch` is stubbed rather than the hooks because the
generated hooks are the contract under test — mocking them would test nothing.
`Subscribe` appears for STARTER/SCALE because `hasSubscription` is only used for
non-current plans in this fixture; with `hasSubscription: true` both non-current
cards read `Switch to this plan`, so the last assertion uses the label that is
actually rendered — adjust it to `Switch to this plan` if that is what the
implementation produces, and keep the disabled expectation.

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run src/components/billing/PlanSection.test.tsx`
Expected: FAIL — `./PlanSection` does not exist.

- [ ] **Step 4: Write `PlanSection`**

Create `web/src/components/billing/PlanSection.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Loader2 } from 'lucide-react';
import { useGetBilling } from '@/api/generated/hooks/billingHooks/useGetBilling';
import { useGetBillingPlans } from '@/api/generated/hooks/billingHooks/useGetBillingPlans';
import { useCreateSubscriptionCheckout } from '@/api/generated/hooks/billingHooks/useCreateSubscriptionCheckout';
import { useCreateBillingPortal } from '@/api/generated/hooks/billingHooks/useCreateBillingPortal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { useAuth } from '@/lib/auth';
import { canManageSubscription } from '@/lib/roles';
import { PlanCard } from './PlanCard';

type Plan = 'STARTER' | 'GROWTH' | 'SCALE';
type Status = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

const statusVariant: Record<Status, 'default' | 'success' | 'muted'> = {
  TRIAL: 'default',
  ACTIVE: 'success',
  PAST_DUE: 'default',
  CANCELED: 'muted',
};

const NOTICE: Partial<Record<Status, string>> = {
  TRIAL: 'pages.billing.trialNotice',
  PAST_DUE: 'pages.billing.pastDueNotice',
  CANCELED: 'pages.billing.canceledNotice',
};

/** `AUR-T0016 BILLING_NOT_CONFIGURED` — an operator problem, not a user error. */
function isNotConfigured(error: unknown): boolean {
  const data = (error as { data?: { error?: { code?: string } } } | null)?.data;
  return data?.error?.code === 'AUR-T0016';
}

export function PlanSection() {
  const { t, i18n } = useTranslation();
  const { role } = useAuth();
  const canManage = canManageSubscription(role);
  const [notConfigured, setNotConfigured] = useState(false);

  const billing = useGetBilling();
  const catalog = useGetBillingPlans();

  // O redirect tem que ser na mesma aba: o Stripe volta pelo RETURN_PATH e uma
  // aba nova perderia o retorno que reconcilia o pagamento.
  const goTo = (url: string) => window.location.assign(url);
  const onError = (error: unknown) => setNotConfigured(isNotConfigured(error));

  const checkout = useCreateSubscriptionCheckout({
    mutation: { onSuccess: (data) => goTo(data.url), onError },
  });
  const portal = useCreateBillingPortal({
    mutation: { onSuccess: (data) => goTo(data.url), onError },
  });

  if (billing.isLoading || catalog.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  if (billing.isError || catalog.isError || !billing.data || !catalog.data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5 text-sm text-muted-foreground">
          {t('pages.billing.loadError')}
          <Button size="sm" variant="outline" onClick={() => void billing.refetch().then(() => catalog.refetch())}>
            {t('pages.billing.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const state = billing.data;
  const status = state.status as Status;
  const notice = NOTICE[status];
  const renewal = state.currentPeriodEnd
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(state.currentPeriodEnd))
    : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-bold">
          {t('pages.billing.plans.title')}
          <Help title={t('pages.billing.plans.helpTitle')}>{t('pages.billing.plans.help')}</Help>
        </h2>
        <Badge variant={statusVariant[status]}>{t(`pages.billing.status.${status}`)}</Badge>
        {renewal && status === 'ACTIVE' && (
          <span className="font-mono text-xs text-muted-foreground">{t('pages.billing.renewsOn', { date: renewal })}</span>
        )}
        <div className="ml-auto flex items-center">
          <Button variant="outline" size="sm" disabled={!canManage || portal.isPending} onClick={() => portal.mutate()}>
            <CreditCard className="size-4" /> {t('pages.billing.portal')}
          </Button>
          <Help title={t('pages.billing.portalHelpTitle')}>{t('pages.billing.portalHelp')}</Help>
        </div>
      </div>

      {notice && <p className="text-sm text-muted-foreground">{t(notice)}</p>}
      {notConfigured && <p className="text-sm text-amber-600 dark:text-amber-400">{t('pages.billing.notConfigured')}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.data.plans.map((entry) => (
          <PlanCard
            key={entry.plan}
            plan={entry.plan as Plan}
            monthlyCredits={entry.monthlyCredits}
            maxWorkspaces={entry.maxWorkspaces}
            priceCents={entry.priceCents}
            currency={entry.currency}
            isCurrent={entry.plan === state.plan}
            hasSubscription={state.hasSubscription}
            canManage={canManage}
            pending={checkout.isPending}
            onChoose={(plan) => checkout.mutate({ data: { plan } })}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/components/billing/PlanSection.test.tsx`
Expected: PASS — 6 tests. If the member assertion fails on the button label,
change the expected label to the one the fixture actually renders (see the note
in step 2) and keep the `toBeDisabled` expectation.

- [ ] **Step 6: Full gate**

Run: `pnpm typecheck && pnpm test`
Expected: both clean.

- [ ] **Step 7: Commit (from `web/`)**

```bash
git add src/components/billing/PlanSection.tsx src/components/billing/PlanSection.test.tsx src/i18n/locales
git commit -m "feat(billing): add the plan section

Reads state from GET /billing and the catalog from GET /billing/plans, then
renders the status, the renewal date, the portal button and the three plan
cards. Checkout and portal redirect in the same tab on purpose: Stripe comes
back through RETURN_PATH, and a new tab would lose the return that
reconciles the payment.

past_due says the allowance stays while the card is retried, and canceled
says purchased credits are still spendable — both are the backend's actual
behaviour, and guessing wrong here costs a customer. AUR-T0016 is reported
as an unavailable environment rather than a failed action, because it is an
operator problem the user cannot fix."
```

---

### Task 7: `CreditsSection` (frontend, queries)

**Files:**
- Create: `web/src/components/billing/CreditsSection.tsx`
- Create: `web/src/components/billing/CreditsSection.test.tsx`
- Modify: `web/src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `useGetCredits`, `useGetBillingPlans`, `useCreateCreditPackCheckout` (Task 3); `AllowanceBar`, `CreditPackCard` (Task 5); `availableCredits` (Task 3); `canBuyCredits` + `useAuth().role` (Tasks 3–4).
- Produces: `export function CreditsSection(): JSX.Element`.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Add the i18n keys**

Add inside `pages.billing` in all three locale files:

English:
```json
"credits": {
  "title": "Credits",
  "helpTitle": "Credits",
  "help": "Every AI run costs credits. The allowance comes with your plan and resets monthly; purchased credits never expire.",
  "purchased": "Purchased balance",
  "available": "Available now",
  "workspaceScope": "These credits belong to the workspace you are in, not to the whole organization."
}
```

Portuguese:
```json
"credits": {
  "title": "Créditos",
  "helpTitle": "Créditos",
  "help": "Cada execução de IA custa créditos. A franquia vem do seu plano e renova todo mês; crédito comprado não expira.",
  "purchased": "Saldo comprado",
  "available": "Disponível agora",
  "workspaceScope": "Estes créditos são do workspace em que você está, não da organização inteira."
}
```

Spanish:
```json
"credits": {
  "title": "Créditos",
  "helpTitle": "Créditos",
  "help": "Cada ejecución de IA cuesta créditos. La franquicia viene de tu plan y se renueva cada mes; el crédito comprado no caduca.",
  "purchased": "Saldo comprado",
  "available": "Disponible ahora",
  "workspaceScope": "Estos créditos son del workspace en el que estás, no de toda la organización."
}
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/billing/CreditsSection.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreditsSection } from './CreditsSection';

const credits = {
  plan: 'GROWTH',
  allowance: 1_000,
  consumed: 400,
  purchasedBalance: 850,
  periodStart: '2026-07-28T00:00:00.000Z',
  periodEnd: '2026-08-28T00:00:00.000Z',
};

const catalog = {
  plans: [],
  packs: [
    { packId: 'SMALL', credits: 100, priceCents: 19_700, currency: 'BRL' },
    { packId: 'MEDIUM', credits: 500, priceCents: 79_700, currency: 'BRL' },
    { packId: 'LARGE', credits: 2_000, priceCents: 249_700, currency: 'BRL' },
  ],
};

let role: string | null = 'ADMIN';
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ role }) }));

const assign = vi.fn();

function stubFetch(routes: Record<string, { status?: number; body: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = new URL(url).pathname;
      const hit = routes[path];
      if (!hit) throw new Error(`unstubbed ${path}`);
      return Promise.resolve(
        new Response(JSON.stringify(hit.body), {
          status: hit.status ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
}

beforeEach(() => {
  role = 'ADMIN';
  assign.mockClear();
  vi.stubGlobal('location', { assign, href: 'http://localhost/app/settings/billing' } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CreditsSection', () => {
  it('shows the allowance, the purchased balance and what is available', async () => {
    stubFetch({ '/credits': { body: credits }, '/billing/plans': { body: catalog } });

    renderWithProviders(<CreditsSection />);

    expect(await screen.findByText('400 of 1000 used')).toBeInTheDocument();
    expect(screen.getByText('850')).toBeInTheDocument();
    expect(screen.getByText('1450')).toBeInTheDocument();
  });

  it('sends an admin to Stripe for the chosen pack', async () => {
    stubFetch({
      '/credits': { body: credits },
      '/billing/plans': { body: catalog },
      '/billing/checkout/credits': { body: { url: 'https://checkout.stripe/pack' } },
    });

    renderWithProviders(<CreditsSection />);
    const buy = await screen.findAllByRole('button', { name: 'Buy' });
    await userEvent.click(buy[1]!);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe/pack'));
  });

  it('disables buying for a member', async () => {
    role = 'MEMBER';
    stubFetch({ '/credits': { body: credits }, '/billing/plans': { body: catalog } });

    renderWithProviders(<CreditsSection />);

    for (const button of await screen.findAllByRole('button', { name: 'Buy' })) {
      expect(button).toBeDisabled();
    }
  });

  it('reports a zero allowance on trial without hiding the purchased balance', async () => {
    stubFetch({
      '/credits': { body: { ...credits, allowance: 0, consumed: 0, purchasedBalance: 50 } },
      '/billing/plans': { body: catalog },
    });

    renderWithProviders(<CreditsSection />);

    expect(await screen.findByText('0 of 0 used')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run src/components/billing/CreditsSection.test.tsx`
Expected: FAIL — `./CreditsSection` does not exist.

- [ ] **Step 4: Write `CreditsSection`**

Create `web/src/components/billing/CreditsSection.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetBillingPlans } from '@/api/generated/hooks/billingHooks/useGetBillingPlans';
import { useCreateCreditPackCheckout } from '@/api/generated/hooks/billingHooks/useCreateCreditPackCheckout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { useAuth } from '@/lib/auth';
import { canBuyCredits } from '@/lib/roles';
import { availableCredits } from '@/lib/credits';
import { AllowanceBar } from './AllowanceBar';
import { CreditPackCard } from './CreditPackCard';

type PackId = 'SMALL' | 'MEDIUM' | 'LARGE';

function isNotConfigured(error: unknown): boolean {
  const data = (error as { data?: { error?: { code?: string } } } | null)?.data;
  return data?.error?.code === 'AUR-T0016';
}

export function CreditsSection() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const canBuy = canBuyCredits(role);
  const [notConfigured, setNotConfigured] = useState(false);

  const credits = useGetCredits();
  const catalog = useGetBillingPlans();

  const checkout = useCreateCreditPackCheckout({
    mutation: {
      onSuccess: (data) => window.location.assign(data.url),
      onError: (error) => setNotConfigured(isNotConfigured(error)),
    },
  });

  if (credits.isLoading || catalog.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  if (credits.isError || catalog.isError || !credits.data || !catalog.data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5 text-sm text-muted-foreground">
          {t('pages.billing.loadError')}
          <Button size="sm" variant="outline" onClick={() => void credits.refetch()}>
            {t('pages.billing.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const state = credits.data;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">
        {t('pages.billing.credits.title')}
        <Help title={t('pages.billing.credits.helpTitle')}>{t('pages.billing.credits.help')}</Help>
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="card-tech sm:col-span-2">
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">
              {t('pages.billing.allowance.title')}
              <Help title={t('pages.billing.allowance.helpTitle')}>{t('pages.billing.allowance.help')}</Help>
            </p>
            <AllowanceBar allowance={state.allowance} consumed={state.consumed} />
            <p className="mt-3 text-xs text-muted-foreground">{t('pages.billing.credits.workspaceScope')}</p>
          </CardContent>
        </Card>

        <Card className="card-tech">
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-sm font-medium">
                {t('pages.billing.credits.purchased')}
                <Help title={t('pages.billing.packs.helpTitle')}>{t('pages.billing.packs.help')}</Help>
              </p>
              <p className="font-display text-2xl font-extrabold">{state.purchasedBalance}</p>
            </div>
            <div>
              <p className="text-sm font-medium">{t('pages.billing.credits.available')}</p>
              <p className="font-display text-2xl font-extrabold text-primary">{availableCredits(state)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <h3 className="pt-2 font-display text-lg font-bold">{t('pages.billing.packs.title')}</h3>
      {notConfigured && <p className="text-sm text-amber-600 dark:text-amber-400">{t('pages.billing.notConfigured')}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {catalog.data.packs.map((pack) => (
          <CreditPackCard
            key={pack.packId}
            packId={pack.packId as PackId}
            credits={pack.credits}
            priceCents={pack.priceCents}
            currency={pack.currency}
            canBuy={canBuy}
            pending={checkout.isPending}
            onBuy={(packId) => checkout.mutate({ data: { packId } })}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/components/billing/CreditsSection.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 6: Full gate**

Run: `pnpm typecheck && pnpm test`
Expected: both clean.

- [ ] **Step 7: Commit (from `web/`)**

```bash
git add src/components/billing/CreditsSection.tsx src/components/billing/CreditsSection.test.tsx src/i18n/locales
git commit -m "feat(billing): add the credits section

Shows the monthly allowance as a bar, the purchased balance, what is
spendable right now, and the three packs. It says out loud that these
credits belong to the current workspace and not to the whole organization:
the allowance is per workspace while the plan is per organization, and a
number without that sentence reads as an org-wide total."
```

---

### Task 8: `LedgerSection` (frontend, cursor pagination)

**Files:**
- Create: `web/src/components/billing/LedgerSection.tsx`
- Create: `web/src/components/billing/LedgerSection.test.tsx`
- Modify: `web/src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `useListCreditLedger` (Task 3).
- Produces: `export function LedgerSection(): JSX.Element`.

The ledger paginates by cursor (`before`, `nextCursor`). This section keeps the
accumulated pages in local state and asks for the next one with a new `before`
param, so each page is its own query key and TanStack caches it.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Add the i18n keys**

Add inside `pages.billing` in all three locale files:

English:
```json
"ledger": {
  "title": "Statement",
  "helpTitle": "Statement",
  "help": "Every credit that came in or went out, newest first: AI runs that spent credits, refunds, purchases and grants.",
  "empty": "Nothing here yet. Every agent run will show up in this statement.",
  "loadMore": "Load more",
  "kind": {
    "DEBIT": "Spent",
    "REFUND": "Refunded",
    "PURCHASE": "Purchased",
    "GRANT": "Granted"
  }
}
```

Portuguese:
```json
"ledger": {
  "title": "Extrato",
  "helpTitle": "Extrato",
  "help": "Todo crédito que entrou ou saiu, do mais recente para o mais antigo: execuções de IA que gastaram, estornos, compras e concessões.",
  "empty": "Nada aqui ainda. Cada execução de agente vai aparecer neste extrato.",
  "loadMore": "Carregar mais",
  "kind": {
    "DEBIT": "Gasto",
    "REFUND": "Estornado",
    "PURCHASE": "Comprado",
    "GRANT": "Concedido"
  }
}
```

Spanish:
```json
"ledger": {
  "title": "Extracto",
  "helpTitle": "Extracto",
  "help": "Todo crédito que entró o salió, del más reciente al más antiguo: ejecuciones de IA que gastaron, reembolsos, compras y concesiones.",
  "empty": "Nada aquí todavía. Cada ejecución de agente aparecerá en este extracto.",
  "loadMore": "Cargar más",
  "kind": {
    "DEBIT": "Gastado",
    "REFUND": "Reembolsado",
    "PURCHASE": "Comprado",
    "GRANT": "Concedido"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `web/src/components/billing/LedgerSection.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LedgerSection } from './LedgerSection';

const page1 = {
  entries: [
    { id: 'e1', kind: 'DEBIT', credits: 12, agentRunId: 'run-1', reason: 'goal.research', createdAt: '2026-07-28T12:00:00.000Z' },
    { id: 'e2', kind: 'GRANT', credits: 1_000, agentRunId: null, reason: 'plan upgrade STARTER→GROWTH', createdAt: '2026-07-26T12:00:00.000Z' },
  ],
  nextCursor: 'cursor-2',
};

const page2 = {
  entries: [
    { id: 'e3', kind: 'PURCHASE', credits: 500, agentRunId: null, reason: 'pack MEDIUM', createdAt: '2026-07-20T12:00:00.000Z' },
    { id: 'e4', kind: 'REFUND', credits: 12, agentRunId: 'run-9', reason: 'run failed', createdAt: '2026-07-19T12:00:00.000Z' },
  ],
  nextCursor: null,
};

function stubLedger() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const parsed = new URL(url);
      const body = parsed.searchParams.get('before') ? page2 : page1;
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LedgerSection', () => {
  it('lists the entries with their kind and amount', async () => {
    stubLedger();

    renderWithProviders(<LedgerSection />);

    expect(await screen.findByText('goal.research')).toBeInTheDocument();
    expect(screen.getByText('Spent')).toBeInTheDocument();
    expect(screen.getByText('-12')).toBeInTheDocument();
    expect(screen.getByText('Granted')).toBeInTheDocument();
    expect(screen.getByText('+1000')).toBeInTheDocument();
  });

  it('appends the next page and then hides the button', async () => {
    stubLedger();

    renderWithProviders(<LedgerSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('pack MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('goal.research')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('teaches instead of showing an empty table', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ entries: [], nextCursor: null }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    renderWithProviders(<LedgerSection />);

    expect(await screen.findByText(/Every agent run will show up/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run src/components/billing/LedgerSection.test.tsx`
Expected: FAIL — `./LedgerSection` does not exist.

- [ ] **Step 4: Write `LedgerSection`**

Create `web/src/components/billing/LedgerSection.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useListCreditLedger } from '@/api/generated/hooks/creditsHooks/useListCreditLedger';
import type { ListCreditLedgerQueryResponse } from '@/api/generated/types/ListCreditLedger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';

// Derived from the generated response so the row shape cannot drift from the contract.
type LedgerEntry = ListCreditLedgerQueryResponse['entries'][number];

type Kind = 'DEBIT' | 'REFUND' | 'PURCHASE' | 'GRANT';

const kindVariant: Record<Kind, 'default' | 'success' | 'muted'> = {
  DEBIT: 'muted',
  REFUND: 'default',
  PURCHASE: 'success',
  GRANT: 'success',
};

const PAGE_SIZE = 20;

/** DEBIT takes credits away; every other kind puts them in. */
function signed(kind: Kind, credits: number): string {
  return kind === 'DEBIT' ? `-${credits}` : `+${credits}`;
}

export function LedgerSection() {
  const { t, i18n } = useTranslation();
  // Cursor of the page being requested.
  const [before, setBefore] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const { data, isLoading, isFetching } = useListCreditLedger({ limit: PAGE_SIZE, ...(before ? { before } : {}) });

  // Cada página é uma query key própria; acumular aqui é o que faz "carregar
  // mais" acrescentar em vez de trocar. Deduplica por id porque um refetch da
  // primeira página repetiria lançamentos.
  useEffect(() => {
    if (!data) return;
    setEntries((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      for (const entry of data.entries) byId.set(entry.id, entry);
      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, [data]);

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">
        {t('pages.billing.ledger.title')}
        <Help title={t('pages.billing.ledger.helpTitle')}>{t('pages.billing.ledger.help')}</Help>
      </h2>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
        </p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('pages.billing.ledger.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card className="card-tech">
          <CardContent className="p-0">
            <ul className="divide-y divide-border/70">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={kindVariant[entry.kind as Kind]}>{t(`pages.billing.ledger.kind.${entry.kind}`)}</Badge>
                      <span className="truncate text-sm">{entry.reason}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(
                        new Date(entry.createdAt),
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-sm">{signed(entry.kind as Kind, entry.credits)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {data?.nextCursor && (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => setBefore(data.nextCursor ?? undefined)}
        >
          {t('pages.billing.ledger.loadMore')}
        </Button>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/components/billing/LedgerSection.test.tsx`
Expected: PASS — 3 tests.

The empty-state test passes because `entries` only fills from the effect after
`data` arrives; while `isLoading` is true the loading line renders instead, so
an empty first page shows the teaching copy and not a blank card.

- [ ] **Step 6: Full gate**

Run: `pnpm typecheck && pnpm test`
Expected: both clean.

- [ ] **Step 7: Commit (from `web/`)**

```bash
git add src/components/billing/LedgerSection.tsx src/components/billing/LedgerSection.test.tsx src/i18n/locales
git commit -m "feat(billing): add the credit statement

Lists the ledger newest-first with the kind, the reason and a signed amount,
and pages by cursor. Pages accumulate in component state — each cursor is
its own query key — deduplicated by id, because a refetch of the first page
would otherwise repeat entries. The empty state teaches what will show up
here instead of rendering an empty table."
```

---

### Task 9: `CheckoutReturnBanner`, page, route, nav (frontend)

**Files:**
- Create: `web/src/components/billing/CheckoutReturnBanner.tsx`
- Create: `web/src/components/billing/CheckoutReturnBanner.test.tsx`
- Create: `web/src/pages/BillingPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AppLayout.tsx`
- Modify: `web/src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `useSyncBilling` (Task 3); `BILLING`/`CREDITS` cache keys (Task 3); `PlanSection` (Task 6), `CreditsSection` (Task 7), `LedgerSection` (Task 8); `PageHeader`, `Help` (existing).
- Produces: `export function CheckoutReturnBanner(): JSX.Element | null`, `export function BillingPage(): JSX.Element`, and the route `/app/settings/billing`. This path is the backend's `RETURN_PATH` — do not rename it.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Add the i18n keys**

Add inside `pages.billing` in all three locale files:

English:
```json
"return": {
  "confirming": "Confirming your payment…",
  "confirmed": "Payment confirmed. Your plan and credits are up to date.",
  "pending": "Payment received. The confirmation can take a moment.",
  "refresh": "Refresh",
  "canceled": "Checkout canceled. Nothing was charged."
}
```

Portuguese:
```json
"return": {
  "confirming": "Confirmando seu pagamento…",
  "confirmed": "Pagamento confirmado. Seu plano e seus créditos estão atualizados.",
  "pending": "Pagamento recebido. A confirmação pode levar um instante.",
  "refresh": "Atualizar",
  "canceled": "Checkout cancelado. Nada foi cobrado."
}
```

Spanish:
```json
"return": {
  "confirming": "Confirmando tu pago…",
  "confirmed": "Pago confirmado. Tu plan y tus créditos están actualizados.",
  "pending": "Pago recibido. La confirmación puede tardar un momento.",
  "refresh": "Actualizar",
  "canceled": "Checkout cancelado. No se cobró nada."
}
```

Add `"billing": "Billing"` / `"billing": "Cobrança"` / `"billing": "Facturación"` to `app.nav` in the respective files.

- [ ] **Step 2: Write the failing test**

Create `web/src/components/billing/CheckoutReturnBanner.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { CheckoutReturnBanner } from './CheckoutReturnBanner';

function renderAt(url: string) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <CheckoutReturnBanner />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const billingState = {
  plan: 'GROWTH',
  status: 'ACTIVE',
  currentPeriodEnd: '2026-08-28T00:00:00.000Z',
  hasSubscription: true,
  maxWorkspaces: 3,
  workspaceCount: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CheckoutReturnBanner', () => {
  it('renders nothing without a checkout param', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { container } = renderAt('/app/settings/billing');

    expect(container).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('syncs once on success and reports confirmation', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(billingState), { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    renderAt('/app/settings/billing?checkout=success');

    expect(screen.getByText('Confirming your payment…')).toBeInTheDocument();
    expect(await screen.findByText(/Payment confirmed/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('/billing/sync');
  });

  it('never calls the payment a failure when the sync fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'AUR-T0016', message: 'nope' } }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );

    renderAt('/app/settings/billing?checkout=success');

    expect(await screen.findByText(/Payment received/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('says nothing was charged on cancel and does not sync', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    renderAt('/app/settings/billing?checkout=cancel');

    expect(screen.getByText('Checkout canceled. Nothing was charged.')).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run src/components/billing/CheckoutReturnBanner.test.tsx`
Expected: FAIL — `./CheckoutReturnBanner` does not exist.

- [ ] **Step 4: Write `CheckoutReturnBanner`**

Create `web/src/components/billing/CheckoutReturnBanner.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useSyncBilling } from '@/api/generated/hooks/billingHooks/useSyncBilling';
import { BILLING, CREDITS } from '@/api/modules';
import { Button } from '@/components/ui/button';

type Outcome = 'idle' | 'confirming' | 'confirmed' | 'pending' | 'canceled';

/**
 * Reconciles a return from Stripe Checkout.
 *
 * The redirect can beat the webhook, so success calls POST /billing/sync —
 * idempotent, same handlers as the webhook — and then invalidates plan,
 * credits and ledger. A failing sync is never reported as a failed payment:
 * the money may well be in.
 */
export function CheckoutReturnBanner() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const requested = useRef(false);
  const checkout = params.get('checkout');
  const [outcome, setOutcome] = useState<Outcome>(
    checkout === 'success' ? 'confirming' : checkout === 'cancel' ? 'canceled' : 'idle',
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: BILLING.queryKeyRoot });
    void queryClient.invalidateQueries({ queryKey: CREDITS.queryKeyRoot });
    void queryClient.invalidateQueries({ queryKey: CREDITS.ledgerQueryKeyRoot });
  };

  const sync = useSyncBilling({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOutcome('confirmed');
      },
      onError: () => setOutcome('pending'),
    },
  });

  useEffect(() => {
    if (checkout !== 'success' || requested.current) return;
    requested.current = true;
    sync.mutate();
    // Drop the query param so a reload does not replay the return. The banner
    // keeps its state, so the message stays on screen.
    const next = new URLSearchParams(params);
    next.delete('checkout');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  useEffect(() => {
    if (checkout !== 'cancel') return;
    const next = new URLSearchParams(params);
    next.delete('checkout');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  if (outcome === 'idle') return null;

  const tone =
    outcome === 'confirmed'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : outcome === 'pending'
        ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
        : 'border-border text-muted-foreground';

  return (
    <div role="status" className={`mb-6 flex items-center gap-3 rounded-lg border bg-card/60 px-4 py-3 text-sm ${tone}`}>
      {outcome === 'confirming' && <Loader2 className="size-4 shrink-0 animate-spin" />}
      {outcome === 'confirmed' && <CheckCircle2 className="size-4 shrink-0" />}
      {(outcome === 'pending' || outcome === 'canceled') && <Info className="size-4 shrink-0" />}

      <span>
        {outcome === 'confirming' && t('pages.billing.return.confirming')}
        {outcome === 'confirmed' && t('pages.billing.return.confirmed')}
        {outcome === 'pending' && t('pages.billing.return.pending')}
        {outcome === 'canceled' && t('pages.billing.return.canceled')}
      </span>

      {outcome === 'pending' && (
        <Button size="sm" variant="outline" className="ml-auto" onClick={invalidate}>
          {t('pages.billing.return.refresh')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `pnpm vitest run src/components/billing/CheckoutReturnBanner.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 6: Write the page**

Create `web/src/pages/BillingPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { CheckoutReturnBanner } from '@/components/billing/CheckoutReturnBanner';
import { PlanSection } from '@/components/billing/PlanSection';
import { CreditsSection } from '@/components/billing/CreditsSection';
import { LedgerSection } from '@/components/billing/LedgerSection';

export function BillingPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        eyebrow={t('app.nav.billing')}
        title={t('pages.billing.title')}
        help={<Help title={t('pages.billing.helpTitle')}>{t('pages.billing.help')}</Help>}
        subtitle={t('pages.billing.subtitle')}
      />

      <CheckoutReturnBanner />

      <div className="space-y-10">
        <PlanSection />
        <CreditsSection />
        <LedgerSection />
      </div>
    </div>
  );
}
```

No `LoopRail` here: billing is not a stage of the growth loop.

- [ ] **Step 7: Add the route**

In `web/src/App.tsx`, add the import beside the other pages:

```tsx
import { BillingPage } from './pages/BillingPage';
```

and the route after the experiments one:

```tsx
      {/* The backend's Stripe RETURN_PATH — renaming this breaks checkout return. */}
      <Route path="/app/settings/billing" element={<Protected><BillingPage /></Protected>} />
```

- [ ] **Step 8: Add the nav item**

In `web/src/components/AppLayout.tsx`, add `CreditCard` to the lucide import, and
below the existing `nav` array add:

```tsx
// Fora do laço de crescimento: cobrança não é uma etapa, é uma configuração.
const secondaryNav = [{ to: '/app/settings/billing', key: 'billing', icon: CreditCard }];
```

In the desktop sidebar, right after the `</nav>` that closes the primary nav:

```tsx
          <nav className="mt-3 flex flex-col gap-1 border-t border-border/70 pt-3">
            {secondaryNav.map(({ to, key, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => navItem(isActive)}>
                <Icon className="size-4" />
                {t(`app.nav.${key}`)}
              </NavLink>
            ))}
          </nav>
```

In the mobile nav row, render the same items after the primary map, inside the
existing `<nav>`, reusing that row's class expression:

```tsx
            {secondaryNav.map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-3.5" />
                {t(`app.nav.${key}`)}
              </NavLink>
            ))}
```

- [ ] **Step 9: Full gate including the production build**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all three clean.

- [ ] **Step 10: Commit (from `web/`)**

```bash
git add src/components/billing/CheckoutReturnBanner.tsx src/components/billing/CheckoutReturnBanner.test.tsx src/pages/BillingPage.tsx src/App.tsx src/components/AppLayout.tsx src/i18n/locales
git commit -m "feat(billing): add the billing page, its route and nav entry

The page composes plan, credits and statement at /app/settings/billing —
the path the backend already uses as the Stripe return URL, which is why it
is not shortened.

The return banner reconciles the redirect: Stripe can come back before the
webhook does, so success calls the idempotent POST /billing/sync and
invalidates plan, credits and ledger. A failing sync says the payment was
received and may take a moment, never that it failed — the money may well
be in. The query param is dropped on arrival so a reload does not replay
the return."
```

---

### Task 10: `CreditBalanceChip` in the app shell (frontend)

**Files:**
- Create: `web/src/components/CreditBalanceChip.tsx`
- Create: `web/src/components/CreditBalanceChip.test.tsx`
- Modify: `web/src/components/AppLayout.tsx`
- Modify: `web/src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `useGetCredits` (Task 3), `availableCredits` (Task 3), the route from Task 9.
- Produces: `export function CreditBalanceChip(): JSX.Element | null` — renders nothing while loading or on error, so a broken credits call never breaks the shell.

All work in this task is run from the `web/` directory.

- [ ] **Step 1: Add the i18n keys**

Add to `app` in all three locale files:

```json
"creditsChip": "{{count}} credits",
"creditsChipLabel": "Credits available — open billing"
```

Portuguese: `"{{count}} créditos"`, `"Créditos disponíveis — abrir cobrança"`.
Spanish: `"{{count}} créditos"`, `"Créditos disponibles — abrir facturación"`.

- [ ] **Step 2: Write the failing test**

Create `web/src/components/CreditBalanceChip.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreditBalanceChip } from './CreditBalanceChip';

const credits = {
  plan: 'GROWTH',
  allowance: 1_000,
  consumed: 400,
  purchasedBalance: 850,
  periodStart: '2026-07-28T00:00:00.000Z',
  periodEnd: '2026-08-28T00:00:00.000Z',
};

function stubCredits(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CreditBalanceChip', () => {
  it('shows the spendable balance and links to billing', async () => {
    stubCredits(200, credits);

    renderWithProviders(<CreditBalanceChip />);

    const link = await screen.findByRole('link', { name: /Credits available/ });
    expect(link).toHaveAttribute('href', '/app/settings/billing');
    expect(link).toHaveTextContent('1450');
  });

  it('stays out of the way when credits cannot be read', async () => {
    stubCredits(500, { error: { code: 'AUR-T0001', message: 'boom' } });

    const { container } = renderWithProviders(<CreditBalanceChip />);

    // Nothing rendered: the shell must not break because one query failed.
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm vitest run src/components/CreditBalanceChip.test.tsx`
Expected: FAIL — `./CreditBalanceChip` does not exist.

- [ ] **Step 4: Write the chip**

Create `web/src/components/CreditBalanceChip.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { availableCredits } from '@/lib/credits';

/**
 * Spendable balance, always visible in the shell: agents spend credits from
 * every screen, so the number cannot live only on the billing page. Renders
 * nothing while loading or on error — a failing credits call must not break
 * the shell.
 */
export function CreditBalanceChip() {
  const { t } = useTranslation();
  const { data, isError } = useGetCredits();

  if (isError || !data) return null;

  return (
    <Link
      to="/app/settings/billing"
      aria-label={t('app.creditsChipLabel')}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Coins className="size-3.5 text-aura" />
      {t('app.creditsChip', { count: availableCredits(data) })}
    </Link>
  );
}
```

- [ ] **Step 5: Mount it in the shell**

In `web/src/components/AppLayout.tsx`, add the import:

```tsx
import { CreditBalanceChip } from '@/components/CreditBalanceChip';
```

In the desktop sidebar footer, put it above the language/theme row — inside the
`<div className="mt-auto flex flex-col gap-3 border-t border-border/70 pt-3">`,
as its first child:

```tsx
            <CreditBalanceChip />
```

In the mobile top bar, add it before `<ThemeToggle />` inside the
`<div className="flex items-center gap-1.5">`:

```tsx
              <CreditBalanceChip />
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `pnpm vitest run src/components/CreditBalanceChip.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 7: Final gate**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all clean.

- [ ] **Step 8: Verify in the browser**

Run: `pnpm dev` (with the backend running on `:3337`)

Check, as an OWNER: the chip shows a number and links to the page; the page
shows status, renewal, three plan cards with prices, the allowance bar, three
packs and the statement; `?checkout=cancel` appended to the URL shows the
neutral banner and charges nothing; the page works in light and dark, at mobile
width, and by keyboard alone (every action reachable, focus visible, every
`Help` openable).

- [ ] **Step 9: Commit (from `web/`)**

```bash
git add src/components/CreditBalanceChip.tsx src/components/CreditBalanceChip.test.tsx src/components/AppLayout.tsx src/i18n/locales
git commit -m "feat(billing): show the credit balance in the app shell

Agents spend credits from every screen, so the spendable balance cannot
live only on the billing page. The chip renders nothing while loading or on
error: one failing query must not break the shell."
```

---

## Notes for the executor

- **`api.json` is regenerated, never hand-edited.** If a frontend type looks
  wrong, the fix is in the backend schema followed by `pnpm openapi:dump` in
  `back/` and `pnpm api:generate` in `web/`.
- **`src/api/generated/` is gitignored.** Never `git add` it; never edit it.
- **Do not add a shadcn primitive.** Everything here is built from the ones
  already in `src/components/ui/`.
- **The route path `/app/settings/billing` is a contract** with
  `back/src/billing/checkout.service.ts:11`. Changing one without the other
  breaks the checkout return.
- **Two of the spec's `Help` targets are explained as visible copy instead of a
  hover, on purpose.** "Pagamento em atraso" and "Canceled" are the status
  notices in `PlanSection` — a state the user is *in* should not require
  hovering to understand — and the workspace cap is explained by the plans
  section `Help`, next to the cards that show the number. Every other term in
  spec §7 has its own `<Help>`.
