# Frontend de cobrança e créditos (B2b-web)

**Data:** 2026-07-28
**Status:** aprovado no brainstorm, pronto para plano
**Depende de:** `aurea-back` B2a (`docs/superpowers/specs/2026-07-27-ai-billing-b2a-design.md`) e B2b
(`docs/superpowers/specs/2026-07-28-ai-billing-b2b-design.md`), ambos mergeados em `master`

---

## 1. Contexto

O back já cobra e já credita. O B2a criou a franquia mensal por workspace, o ledger
append-only e o saldo comprado; o B2b ligou o Stripe: assinatura, pacote de crédito avulso,
cupom, portal e webhook. Nada disso tem tela.

Hoje o fundador não consegue ver em que plano está, quanto de franquia gastou, quanto de
crédito comprado sobrou, nem assinar ou comprar sem CLI. Oito endpoints existem sem
consumidor:

```text
GET  /billing                      plano, status, renovação, teto de workspaces
GET  /credits                      franquia, consumido, saldo comprado, período
GET  /credits/ledger               extrato paginado por cursor
POST /billing/checkout/subscription
POST /billing/checkout/credits
POST /billing/portal
POST /billing/sync
```

Este sub-projeto é a tela que fecha esse ciclo: **uma página de cobrança e créditos**, mais
um indicador de saldo sempre visível.

---

## 2. O que é e o que não é

**É** a interface pela qual o fundador entende o que tem, entende o que gastou, assina,
compra crédito e gerencia o cartão.

**Não é** painel administrativo, relatório financeiro, nem tela de nota fiscal.

Fora de escopo explícito: UI de workspaces (`GET/POST /workspaces` e o erro
`WORKSPACE_LIMIT_REACHED`), UI de BYOK (`/ai/provider-key`), tela de preços pública na
landing, tabela de preço por operação (`GET /credits/pricing`), reembolso, histórico de
faturas próprio (o portal do Stripe já mostra).

---

## 3. Decisões (não re-litigar)

Do brainstorm de 2026-07-28:

- **Cobrança e créditos na mesma página.** O fundador pensa "quanto eu tenho e quanto eu
  pago" como uma pergunta só. Separar em duas rotas obriga a saber qual é qual.
- **O catálogo vem do back, não do front.** Créditos por plano, teto de workspaces,
  créditos por pacote e preço passam a sair de uma rota nova, `GET /billing/plans`. Front
  não duplica número que o back já conhece: número duplicado divergindo não quebra nada e o
  usuário vê 1.000 e recebe 2.000.
- **Preço em dinheiro vem do catálogo em código**, junto de `monthlyCredits`. Divergência
  consciente do §8 do design do B2b, que dizia que dinheiro não aparece nas respostas: sem
  preço, o fundador clica em "assinar" sem saber quanto custa. Registrar a divergência em
  `docs/architecture/billing.md` do back.
- **A rota da página é `/app/settings/billing`**, que é o `RETURN_PATH` que o back já usa
  no `success_url`/`cancel_url` (`back/src/billing/checkout.service.ts:11`). O front adota o
  caminho existente em vez de mexer em código já testado contra o Stripe real.
- **No retorno do checkout, o front chama `POST /billing/sync`.** O redirect do Stripe pode
  chegar antes do webhook. `sync` é idempotente e usa os mesmos handlers, então chamar não
  duplica crédito e cobre webhook atrasado, servidor fora do ar e desenvolvimento sem túnel.
- **Ação sem permissão aparece desabilitada com explicação**, não escondida. Esconder faz o
  MEMBER não descobrir que existe upgrade nem a quem pedir. Nenhum botão que resulta em 403.
- **Três cards por seção**, não dialog. Comparar plano é a decisão comercial da página; ela
  não deve custar um clique.

---

## 4. Delta no backend

Uma rota nova e dois campos no catálogo. Sem migration, sem Stripe.

### 4.1 Catálogo

`plan-catalog.ts` e `credit-packs.ts` ganham preço:

```ts
export type PlanEntry = {
  monthlyCredits: number;
  maxWorkspaces: number;
  priceCents: number;   // em BRL, o mesmo valor do Price do Stripe
  currency: string;     // 'BRL'
};
```

O preço é o mesmo configurado no Price do Stripe apontado por `STRIPE_PRICE_*`. Divergir
faz o cliente ver um valor e pagar outro — o teste do catálogo documenta o par
`priceId → priceCents` e a mudança de preço passa a ser uma alteração em dois lugares
(dashboard do Stripe e catálogo). Aceito para o MVP; buscar do Stripe fica registrado como
alternativa no §10.

### 4.2 `GET /billing/plans`

`operationId: getBillingPlans`, tag `billing`, qualquer membro (inclusive VIEWER), sem
dependência de `StripeClient` — logo, funciona com `STRIPE_SECRET_KEY` ausente, como o
`GET /billing` já funciona.

```ts
{
  plans: [{ plan: 'STARTER'|'GROWTH'|'SCALE', monthlyCredits: number,
            maxWorkspaces: number, priceCents: number, currency: string }],
  packs: [{ packId: 'SMALL'|'MEDIUM'|'LARGE', credits: number,
            priceCents: number, currency: string }]
}
```

Resposta derivada do catálogo, não do banco: é constante por deploy.

### 4.3 Regeneração

```bash
pnpm --filter @aurea/back openapi:dump   # → web/api.json
pnpm api:generate                        # no web/ → types + hooks
```

`api.json` é commitado; `src/api/generated/` é gitignored.

---

## 5. Arquitetura do front

### 5.1 Camada de dados

`src/api/modules/` ganha dois módulos, adicionados ao barrel:

```ts
// billing.ts
export const BILLING = { ENDPOINT: '/billing', queryKeyRoot: [{ url: '/billing' }] } as const;
// credits.ts
export const CREDITS = {
  ENDPOINT: '/credits',
  queryKeyRoot: [{ url: '/credits' }],
  LEDGER_ENDPOINT: '/credits/ledger',
  ledgerQueryKeyRoot: [{ url: '/credits/ledger' }],
} as const;
```

Todo dado de domínio passa por hook gerado pelo Kubb:

| Uso | Hook |
|---|---|
| plano, status, renovação, teto | `useGetBilling` |
| catálogo de planos e pacotes | `useGetBillingPlans` |
| franquia, consumido, saldo comprado | `useGetCredits` |
| extrato | `useListCreditLedger` |
| assinar / mudar plano | `useCreateSubscriptionCheckout` |
| comprar pacote | `useCreateCreditPackCheckout` |
| gerenciar cartão | `useCreateBillingPortal` |
| reconciliar | `useSyncBilling` |

Regras de cache e efeito:

- checkout e portal: `onSuccess` faz `window.location.assign(url)`. Nada de `window.open`:
  o Stripe volta pelo `RETURN_PATH` e uma aba nova perde o retorno.
- `syncBilling.onSuccess`: invalida `BILLING.queryKeyRoot`, `CREDITS.queryKeyRoot` e
  `CREDITS.ledgerQueryKeyRoot` (o sync pode ter lançado um `GRANT`).
- nenhum `fetch` novo; `src/lib/api.ts` continua exclusivo do ciclo de token.

### 5.2 Componentes

```text
src/pages/BillingPage.tsx          orquestra as seções, lê ?checkout=
src/components/billing/
  PlanCard.tsx           um plano: créditos/mês, teto de workspaces, preço,
                         marca de "plano atual", ação (assinar / mudar)
  PlanSection.tsx        status, renovação, portal, os três PlanCard
  CreditPackCard.tsx     um pacote: créditos, preço, comprar
  CreditsSection.tsx     franquia consumida/total (barra), saldo comprado,
                         os três CreditPackCard
  LedgerSection.tsx      extrato: tipo, créditos, motivo, data; "carregar mais"
  CheckoutReturnBanner.tsx  a faixa de retorno do Stripe
  CreditBalanceChip.tsx  indicador no header, linka para a página
src/lib/money.ts         formatCents(cents, currency, locale) via Intl.NumberFormat
```

`PlanCard`, `CreditPackCard`, `CreditBalanceChip` e `money.ts` são puros — recebem props,
não chamam hook de rede. É onde os testes moram. `PlanSection`, `CreditsSection` e
`LedgerSection` fazem as queries e passam props para baixo.

Saldo do chip: `max(allowance − consumed, 0) + purchasedBalance`. O mesmo cálculo aparece na
seção de créditos; vive numa função só, exportada e testada.

### 5.3 Papéis

Papel vem de `useAuth` → `memberships`, comparando `organizationId`/`workspaceId` do
membership com o contexto corrente.

| Ação | Papel |
|---|---|
| ver plano, créditos, extrato | qualquer membro, inclusive VIEWER |
| assinar / mudar plano, portal | OWNER |
| comprar pacote, sync | OWNER ou ADMIN |

Sem papel: botão `disabled` com `<Help>` explicando quem pode. Um `<button disabled>` não
recebe foco nem evento, então a explicação fica no `Help` ao lado, alcançável por teclado.

---

## 6. Estados

Todos são estados de primeira classe, não afterthought:

| Situação | UI |
|---|---|
| carregando | skeleton por seção; a página não vira um spinner |
| erro de rede | card com a mensagem e botão de tentar de novo, por seção |
| `AUR-T0016 BILLING_NOT_CONFIGURED` (500) | só é descobrível ao agir: `GET /billing` e `GET /billing/plans` funcionam sem `STRIPE_SECRET_KEY`. Quando um checkout ou o portal falha com esse código, a página mostra "cobrança indisponível neste ambiente" e mantém plano, créditos e extrato visíveis — não é erro do usuário e não deve virar um card de falha genérico |
| `?checkout=success` | faixa "confirmando pagamento…" → `POST /billing/sync` → invalidação → "plano atualizado" ou "créditos adicionados"; o query param é limpo com `navigate(pathname, { replace: true })` para o F5 não reprocessar |
| `?checkout=cancel` | faixa neutra: "checkout cancelado, nada foi cobrado" |
| `sync` falha no retorno | faixa: "pagamento recebido; a confirmação pode levar um instante" + botão de atualizar. Nunca "falhou": o dinheiro pode ter entrado |
| `TRIAL` | franquia zero explicada, saldo de trial visível, CTA de assinatura |
| `ACTIVE` | plano, renovação em `currentPeriodEnd` |
| `PAST_DUE` | faixa âmbar: franquia mantida enquanto o Stripe recobra, CTA para atualizar o cartão no portal |
| `CANCELED` | franquia zerada explicada; crédito comprado continua gastável |
| extrato vazio | estado vazio que ensina: "cada execução de agente aparece aqui" |
| franquia esgotada | barra cheia + CTA de pacote (ou de upgrade, se OWNER) |

`hasSubscription` (`stripeSubscriptionId !== null`) decide "assinar" vs "mudar plano";
não é sinal de cartão válido e não deve ser rotulado como tal.

---

## 7. Explicação in-app

`<Help>` novo, uma ou duas frases em linguagem de fundador, em: **Plano**, **Franquia
mensal**, **Créditos comprados**, **Extrato**, **Workspaces do plano**, **Pagamento em
atraso**. Termo de domínio sem `Help` é bug.

A distinção que mais confunde e precisa estar explícita: **franquia renova todo mês e não
acumula; crédito comprado não expira e sobrevive ao cancelamento.**

---

## 8. i18n

Chaves novas em `en.json`, `pt.json`, `es.json` sob `billing.*`, incluindo os quatro status,
os três planos, os três pacotes, as faixas de retorno e os textos de `Help`. Nenhuma string
crua em JSX. Dinheiro e número formatados por `Intl` com o locale do i18next; data de
renovação com `Intl.DateTimeFormat`.

---

## 9. Testes

Vitest + Testing Library já estão instalados (`pnpm test`).

- `money.ts`: formata BRL em pt/en/es; centavos zero; valor grande.
- saldo: `allowance − consumed + purchasedBalance`; consumo acima da franquia não vira
  saldo negativo.
- `PlanCard`: marca o plano atual; ação desabilitada sem papel; rótulo "assinar" vs "mudar".
- `CreditPackCard`: mostra créditos e preço; clique chama o handler com o `packId`.
- `CheckoutReturnBanner`: `success` dispara o sync uma vez; `cancel` não dispara nada.
- `LedgerSection`: rende os quatro tipos de lançamento; sem `nextCursor` não mostra
  "carregar mais".
- estado vazio e estado de erro renderizam.

Gate antes de declarar pronto: `pnpm typecheck`, `pnpm test`, `pnpm build` — os três limpos.
No back: `pnpm test` e `pnpm typecheck` após a rota nova.

---

## 10. Riscos e alternativas registradas

- **Preço em dois lugares.** Catálogo em código e Price no dashboard do Stripe. Alternativa
  descartada para o MVP: `stripe.prices.retrieve` com cache em memória — sempre igual ao
  que o cliente paga, mas adiciona rede na rota e um modo degradado quando o Stripe cai.
- **A franquia é por workspace e a página é da organização.** `GET /credits` responde pelo
  workspace corrente; `GET /billing` pela organização. Com vários workspaces, a seção de
  créditos mostra o workspace atual — a página deve dizer isso, não deixar o número
  parecer o total da organização.
- **`sync` exige OWNER/ADMIN.** Um MEMBER não faz checkout, então o retorno com
  `checkout=success` só acontece para quem pode chamar o sync. Se isso mudar (link de
  pagamento compartilhado, por exemplo), o retorno precisa cair no caminho de poll.
- **Sem UI de workspaces**, o erro `WORKSPACE_LIMIT_REACHED` do back não tem tela própria;
  o teto aparece apenas informativo nos cards de plano.
