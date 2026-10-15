# Sub-projeto A — UX e clean code dos 12 forms

Data: 2026-07-27
Status: aprovado no design, pendente de plano de implementação
Repos afetados: `aurea/web` (maior parte), `aurea/back` (correção de contrato)

---

## 1. Contexto

O pedido original foi "melhorar UX dos outros forms, adicionar IA para preencher".
O brainstorm mostrou que isso são seis subsistemas, então o trabalho foi decomposto
em quatro sub-projetos (ver §9). Este documento cobre apenas o **A**: refatorar os
12 forms existentes. Nada de IA entra aqui.

"Outros forms" = tudo além de `BusinessSetupPage`, que já foi refeito em 2026-07-27:

- 3 forms simples: `IcpNewPage` (90 linhas), `GoalNewPage` (100), `StrategyNewPage` (116)
- 9 seções de contexto de negócio: `src/components/BusinessContextWizard/steps/*.tsx`
  (204–331 linhas cada, ~2.400 no total)

O A vem primeiro porque não depende de nada e porque a UI de review de proposta de
IA (sub-projeto C) precisa de uma primitiva de campo que este refactor produz.
Fazer A depois de C significa refatorar os mesmos arquivos duas vezes.

## 2. Problemas a resolver

Arquivo grande é sintoma. Os defeitos estruturais encontrados:

### 2.1 Estado duplicado nos 9 steps

Cada step faz `useState(data.<slice> ?? …)` no mount **e** chama `onChange`. O
`draft` vive em `BusinessContextSectionPage`, mas cada step mantém sua própria
cópia. A fragilidade está documentada no próprio código
(`BusinessContextSectionPage.tsx:84-85`): a página não pode renderizar o step antes
do contexto salvo estar dobrado no draft, senão o step semeia vazio.

Consequência para o C: se a IA escrever no `draft`, o step não vê — ele já semeou
no mount. Este é o item que mais importa corrigir.

### 2.2 `<select>` cru com classes escritas à mão

8+ ocorrências, em duas variantes divergentes:

- `ProductsStep.tsx:148` — `class="w-full px-3 py-2 border rounded-md"` (sem focus ring)
- `StrategyNewPage.tsx:82` — `class="flex h-9 … focus-visible:ring-2 …"`

Sem shadcn Select: dark mode inconsistente, navegação por teclado pobre, nenhum
estado de foco acessível na primeira variante.

### 2.3 Manipulação direta de DOM

`CompanyStep.tsx:188-198` — o botão "adicionar valor" faz
`document.getElementById('newValue')` e escreve `input.value = ''`. Input
não-controlado, id fixo que colide se o padrão for reusado.

### 2.4 `dangerouslySetInnerHTML` em strings de i18n

7 ocorrências (ex.: `ProductsStep.tsx:199`). Risco de execução é baixo — os
arquivos de locale são nossos — mas é superfície de injeção sem necessidade, e o
mesmo padrão de "confiar em string que virou HTML" gerou o XSS de upload de SVG
corrigido em 2026-07-27.

### 2.5 Repetição

- Triplete `space-y-2` + `Label` + `Help` + input: ~60 ocorrências
- Trio add/update/remove de array: 7 ocorrências (products, competitors, projects,
  campaigns, channels, kpis, objectives)
- Coerção `e.target.value ? Number(e.target.value) : undefined`: em todo campo numérico
- Listas de `<option>` de enum: repetidas inline, sem fonte única

### 2.6 Zero validação nas 9 seções

Os atributos `required` (`ProductsStep.tsx:84,100`) não têm efeito: salvar é clique
de botão, não submit de form. Payload inválido chega ao backend e volta como 400
genérico, exibido como `pages.business.saveFailed`.

### 2.7 Validação da seção está no lugar errado — e devolve 500

`back/src/http/api/business/update-section/update-section.schema.ts:6` declara
`data: z.unknown()`, então o OpenAPI não carrega forma nenhuma para o payload da
seção. A validação existe, mas **dentro do handler**:
`update-section.controller.ts:34-63` chama `.parse()` com o schema da seção
correspondente.

Consequência: o `.parse()` lança `ZodError` cru. O error handler
(`back/src/plugins/error-handler.ts:21`) só reconhece erro vindo da camada de schema
do Fastify, via `hasZodFastifySchemaValidationErrors`. `ZodError` cru não casa, não é
`AppError`, e cai no fallback da linha 42 → **HTTP 500 `INTERNAL`** com
`"Unhandled error"` no log.

**Payload de seção inválido hoje devolve 500, não 400**, sem detalhe de campo para o
frontend exibir.

Mover a validação para o schema da rota conserta os dois problemas de uma vez: o
Fastify passa a produzir o erro, `hasZodFastifySchemaValidationErrors` casa, e o
cliente recebe 400 `VALIDATION` com `details` por campo — e o OpenAPI passa a
carregar a forma real, que é o que destrava validação gerada no frontend.

Nota: os 9 `*SectionSchema` envelopam o campo (`{ companyProfile: … }`) e o
controller desembrulha (`.parse({ companyProfile: data }).companyProfile`). Com a
union discriminada esse envelope some.

### 2.8 `painPoints` como CSV

`IcpNewPage.tsx:43-46` faz `.split(',')`. Nome de ICP com vírgula quebra.

## 3. Não-objetivos

- Qualquer coisa de IA (sub-projetos B, C, D)
- `LoginPage`, `RegisterPage` (só auth, fora do pedido)
- `BusinessSetupPage` (já refeito)
- ESLint (o script `lint` segue sendo `echo`)
- Visual regression / testes E2E
- Migração dos `styles/*.css` remanescentes do scaffold inicial (fora deste escopo)

## 4. Primitivas

Tailwind + shadcn/ui apenas. Nenhum CSS puro, nenhum `style={{}}` — regra 1 do
`web/CLAUDE.md`.

### 4.1 `src/components/ui/select.tsx`

shadcn Select sobre `@radix-ui/react-select` (dependência nova). Substitui os 8+
`<select>` crus. Traz teclado, foco acessível e dark mode consistentes.

### 4.2 `src/components/form/`

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `Field.tsx` | `Label` + `Help` + marca "opcional" + texto de erro. Wrapper puro de layout, sem estado. | `ui/label`, `Help` |
| `TextField.tsx` | `Field` + `ui/input` controlado | `Field` |
| `NumberField.tsx` | `Field` + input numérico. Centraliza `'' → undefined`. | `Field` |
| `TextAreaField.tsx` | `Field` + `ui/textarea` controlado | `Field` |
| `SelectField.tsx` | `Field` + `ui/select`, recebe `options: {value,label}[]` | `Field`, `ui/select` |
| `TagsField.tsx` | Array de strings. Controlado, Enter adiciona, chip com remover. Rejeita vazio e duplicado. | `Field`, `ui/badge` |
| `Repeater.tsx` | Array de objetos genérico: `items`, `onChange`, `newItem`, `renderItem`, rótulo. | `ui/card`, `ui/button` |

Cada arquivo tem uma responsabilidade e é testável isolado. `Field` não sabe o que
é um input; `Repeater` não sabe o que é um produto.

`TagsField` cobre 15 campos hoje escritos à mão: `values`, `trends`,
`opportunities`, `threats`, `limitations`, `technicalCapabilities`,
`regulatoryConstraints`, `competitiveAdvantages`, `threatsFromCompetitors`,
`activeChannels`, `partnerships`, `other`, `platforms`, `strengths`, `weaknesses` —
mais o `painPoints` do ICP, que deixa de ser CSV (§2.8).

`Repeater` cobre os 7 arrays de objeto: products, competitors, projects,
campaigns, channels, kpis, objectives.

### 4.3 `src/lib/enums.ts`

Listas de opção num lugar só, tipadas contra os types gerados pelo Kubb:
`fundingStage`, `pricingModel`, `productStatus`, `marketShare`, `marketPosition`,
`maturity`, `urgency`, `projectType`, `projectStatus`, `objectiveStatus`,
`campaignStatus`.

Cada opção é `{ value, labelKey }`; o componente traduz. Enum que muda no backend
vira erro de typecheck, não bug silencioso.

## 5. Estado e estrutura

### 5.1 Steps sem estado

Remover o `useState` dos 9 steps. Passam a ler de `data` e escrever por `onChange`.
O `draft` de `BusinessContextSectionPage` vira fonte única.

Isso resolve §2.1 e destrava o C: IA escreve no draft → step re-renderiza.

### 5.2 Registry no lugar do switch

`BusinessContextSectionPage` hoje tem o mapa `SECTION_FIELD` (`:30-40`) e um switch
de 9 casos (`:119-140`). Cada entrada de `CONTEXT_SECTIONS`
(`src/types/business-context.ts`) passa a carregar `field` e `Component`.

A página perde ~40 linhas; adicionar uma seção passa a ser uma entrada em vez de
três edições em arquivos diferentes.

### 5.3 Quebra de arquivos

Alvo: nenhum arquivo acima de ~120 linhas.

| Arquivo | Linhas hoje | Depois |
|---|---|---|
| `PerformanceStep.tsx` | 331 | `PerformanceStep` + `ChannelsRepeater` |
| `ProjectsStep.tsx` | 290 | `ProjectsStep` + `ProjectCard` + `ObjectivesRepeater` |
| `CampaignsStep.tsx` | 262 | `CampaignsStep` + `CampaignCard` + `KpisRepeater` |
| `CompetitiveStep.tsx` | 243 | `CompetitiveStep` + `CompetitorCard` |
| `ActivitiesStep.tsx` | 271 | encolhe só pelas primitivas |
| `MarketStep.tsx` | 233 | encolhe só pelas primitivas |
| `ConstraintsStep.tsx` | 215 | encolhe só pelas primitivas |
| `CompanyStep.tsx` | 209 | encolhe só pelas primitivas |
| `ProductsStep.tsx` | 204 | `ProductsStep` + `ProductCard` |

Estimativa: ~3.860 linhas de form → ~1.900, mais ~400 de primitivas reusadas.

## 6. Validação

Três passos, nesta ordem — o passo 1 é no backend e destrava os outros dois.

### Passo 1 — contrato do backend (`aurea/back`)

`updateSectionBody` passa a ser union discriminada em `section`, com `data` tipado
por seção:

```ts
export const updateSectionBody = z.discriminatedUnion('section', [
  z.object({ section: z.literal('company'),     data: businessContextDataSchema.shape.companyProfile }),
  z.object({ section: z.literal('products'),    data: businessContextDataSchema.shape.products }),
  z.object({ section: z.literal('competitive'), data: businessContextDataSchema.shape.competitiveLandscape }),
  z.object({ section: z.literal('market'),      data: businessContextDataSchema.shape.marketContext }),
  z.object({ section: z.literal('constraints'), data: businessContextDataSchema.shape.constraints }),
  z.object({ section: z.literal('performance'), data: businessContextDataSchema.shape.currentPerformance }),
  z.object({ section: z.literal('activities'),  data: businessContextDataSchema.shape.currentActivities }),
  z.object({ section: z.literal('projects'),    data: businessContextDataSchema.shape.projects }),
  z.object({ section: z.literal('campaigns'),   data: businessContextDataSchema.shape.campaigns }),
]);
```

Os 9 `*SectionSchema` envelopados são removidos, e com eles o `switch` de 63 linhas
que faz `.parse()` no controller (`update-section.controller.ts:34-63`). O controller
fica só com o service. `update-section.service.ts` perde os 9 casts `as` e passa a
receber input já narrowed pela union.

Ganho duplo: payload inválido volta a ser 400 `VALIDATION` com `details` em vez de
500 `INTERNAL` (§2.7), e o OpenAPI passa a carregar a forma real de cada seção.

### Passo 2 — gerar Zod no frontend

Adicionar `@kubb/plugin-zod` ao `kubb.config.ts`. Fluxo: `pnpm openapi:dump` no
repo `aurea/back` → copiar o `api.json` gerado para `aurea/web/api.json` →
`pnpm api:generate` no web.

(O comentário em `kubb.config.ts` ainda diz `pnpm --filter @aurea/back
openapi:dump`, herdado de quando era monorepo. Corrigir junto.)

As 9 seções ganham schema Zod gerado a partir do backend. Zero duplicação escrita
à mão.

### Passo 3 — RHF nas páginas de seção

`useForm` + `zodResolver(<schema gerado>)`. `Field` renderiza o erro. `Repeater` e
`TagsField` ficam controlados via `useFieldArray` / `Controller`.

Os 3 forms simples já usam RHF + zodResolver com schemas escritos à mão em
`src/schemas/`; passam a usar os gerados quando existirem, e mantêm os manuais onde
o schema gerado não cobrir (ex.: campos de UI que não existem na API).

## 7. Testes e verificação

### 7.1 Test runner (novo no web)

O web não tem runner hoje. Adicionar `vitest`, `@testing-library/react`,
`@testing-library/user-event`, `jsdom`, e script `test`.

Testes das 7 primitivas de `src/components/form/` — o código mais reusado do
escopo, onde um bug vaza para os 12 forms. `TextField` e `TextAreaField` dividem um
arquivo de teste (mesma lógica, elemento diferente), então são 6 arquivos:

- `Field` — renderiza label, associa `htmlFor`, mostra erro quando presente, marca "opcional"
- `TextField` / `TextAreaField` — valor controlado, `onChange` dispara com o texto
- `NumberField` — string vazia vira `undefined`; texto não-numérico não vira `NaN`
- `SelectField` — seleciona por teclado, valor vazio limpa para `undefined`
- `TagsField` — Enter adiciona, não adiciona vazio, não adiciona duplicado, remover tira o item certo, Enter não submete o form ao redor
- `Repeater` — adicionar cria item com `newItem()`, remover tira o índice certo, `key` é id estável (não índice)

### 7.2 Gate automático

- `pnpm typecheck` nos dois repos (o gate real hoje, por `web/CLAUDE.md`)
- `pnpm test` no web
- `pnpm build` no web

### 7.3 i18n

Remover os 7 `dangerouslySetInnerHTML` faz 7 strings perderem `<strong>`. Onde a
ênfase importa, usar `<Trans>` do react-i18next (mantém o markup sem injetar HTML);
onde não importa, limpar a tag. 21 strings tocadas (7 × en/pt/es).

Invariante: os 3 locales terminam com a mesma contagem de chaves (843 hoje).

### 7.4 Walkthrough manual

Não existe visual regression, então:

- 12 forms: preencher, salvar, recarregar, confirmar persistência
- Dark mode em cada primitiva nova — o Select do Radix é onde isso costuma vazar
- Teclado: ordem de tab, Enter no `TagsField`, Escape fecha o Select, foco visível
- Sair no meio de uma seção e voltar (o hazard de §2.1)

## 8. Riscos

| Risco | Mitigação |
|---|---|
| **zod v3 no back, v4 no web.** A saída do `plugin-zod` pode não casar limpo. | Descobrir na primeira geração, não no fim. Fallback: escrever os 9 schemas à mão em `src/schemas/business-context.ts` — duplicação, mas funciona, e o passo 1 (validação no backend) permanece válido de qualquer forma. |
| **Round-trip Zod → OpenAPI → Zod não é byte-idêntico.** `.default([])`, `.optional()` e refinements não sobrevivem inteiros. | Aceito: valida forma e tipo, que é o que o form precisa. Refinement profundo continua só no backend. |
| **Union discriminada é breaking change de contrato.** | Único consumidor é este frontend, e os dois repos são deployados juntos. Exige `openapi:dump` + `api:generate` na mesma passada, senão o typecheck do web quebra. |
| **Steps sem estado podem introduzir re-render em cascata** nos steps grandes. | `Repeater` recebe `renderItem` memoizado; medir só se aparecer lentidão real, não otimizar preventivamente. |
| **Os dois repos têm mudanças não commitadas** da sessão de 2026-07-27. | Não tocar nelas. Commitar o trabalho do A separado. |

## 9. Registro da decomposição

Sub-projetos, em ordem de dependência. A é independente; B destrava C e D; C vem
antes de D porque D reusa a máquina de review.

- **A — este documento.** UX + clean code dos 12 forms. Frontend, mais a correção
  de contrato de §6 passo 1.
- **B — Fundação da camada de IA.** Backend. Abstração de provider, Model Router,
  `AgentRun` sendo gravado, guardrails (structured output validado por Zod),
  BullMQ com worker in-process, Configurações de IA (BYOK com chave criptografada),
  ledger de créditos com bloqueio. É a camada que
  `back/docs/architecture/ai-architecture.md` descreve e que hoje não existe.
- **C — Preenchimento por IA do contexto de negócio.** Agente por seção com
  grounding via `web_search` / `web_fetch`, endpoint de proposta, UI de review de
  diff campo-a-campo, run global do onboarding.
- **D — Propostas de IA para ICP / Goal / Strategy.** Reusa a máquina do C. Valor
  aqui não é preencher campo: é derivar ICP e Goal do contexto que já existe.

## 10. Apêndice — decisões já tomadas para B, C e D

Registradas aqui para não se perderem entre os specs. Cada uma foi decidida no
brainstorm de 2026-07-27 e deve ser herdada pelo spec correspondente, não
re-litigada.

**Fonte dos dados do preenchimento (C):** mix. Identificar o que já existe no
Growth Brain, somar com o site do business, busca externa, e prompt livre do
usuário.

**Grounding sem infra própria (C):** usar as ferramentas server-side da Anthropic
(`web_search_20260209`, `web_fetch_20260209`) em vez de escrever scraper e
contratar provider de busca. Vêm com citações, que alimentam o campo "fonte" no
review. Nota: são específicas da Anthropic — com BYOK em outro provider o
grounding degrada, e isso precisa de capability flag por provider no B.

**Forma na UI (C):** os dois pontos de entrada. Run global quando o contexto está
vazio (maior impacto no primeiro uso) e botão por seção sempre disponível para
refinar. Mesmo backend.

**Review obrigatório (C):** nada grava sem confirmação. Proposta por campo com
valor + confiança + fonte; aceitar tudo / aceitar alguns / editar. Cumpre
"inference is not fact" e "human-in-the-loop by default" do `back/CLAUDE.md`.

**Execução (B):** BullMQ com worker in-process no container da API. Redis já está
nos três composes (`docker-compose.yml`, `compose.local.yml`, `compose.prod.yml`)
com volume nomeado e nunca foi usado — adicionar é `REDIS_URL` no env + `bullmq` na
dependência. Fixar `--appendonly yes` e `maxmemory-policy noeviction` no compose.
`AgentRun` no Postgres é o que a UI lê; Redis é só mecânica.

**Chave de IA (B):** híbrido. Chave AUREA por default para não haver parede no
onboarding (a persona é fundador não-técnico, por `back/docs/product/personas.md`),
BYOK opcional em Configurações > IA. Chave do usuário é segredo em repouso:
AES-256-GCM com KEK em env var, campo write-only, nunca em resposta de GET, nunca
em log, mascarada na UI. É o item de maior risco de segurança dos quatro
sub-projetos.

**Monetização (B):** já definida em `back/docs/product/business-model.md` §3-6 —
assinatura + IA medida, orçamento por workspace, custo real em `AgentRun`, routing
rebaixa modelo perto do teto, overage vira receita. A fatia a implementar no B é
crédito por operação: 1 seção preenchida = 1 crédito, run global = 9, franquia
mensal por workspace. `AgentRun.estimatedCost` grava o custo real para monitorar
margem e calibrar preço. Run com BYOK não consome crédito — BYOK deixa de ser
fricção e passa a ser a válvula de escape de quem estourou a franquia.

**Fora de escopo dos quatro:** cobrança de verdade (Stripe, tiers, fatura de
overage) é projeto próprio.
