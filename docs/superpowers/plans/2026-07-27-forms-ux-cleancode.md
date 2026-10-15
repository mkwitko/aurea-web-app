# Forms UX + Clean Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar os 12 forms de AUREA web para primitivas shadcn reusáveis, estado controlado e validação gerada a partir do backend, reduzindo ~3.860 linhas de form para ~1.900.

**Architecture:** Sete primitivas de form (`src/components/form/`) sobre shadcn/ui absorvem a repetição de label+help+input, arrays de string e arrays de objeto. Os 9 steps de contexto perdem o `useState` interno e passam a ser controlados pelo `draft` da página, que passa a ser react-hook-form. A validação deixa de ser escrita à mão: o contrato do backend ganha union discriminada por seção, e o Kubb gera os schemas Zod do frontend a partir do OpenAPI.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), react-hook-form 7 + `@hookform/resolvers` 5, zod 4 (web) / zod 3 (back), Kubb 4, vitest + @testing-library/react (novos), Fastify 5 + fastify-type-provider-zod 4 (back).

## Global Constraints

- **Styling: Tailwind + shadcn/ui apenas.** Nenhum CSS puro, nenhum `style={{}}`, nenhuma folha de estilo escrita à mão. Regra 1 de `web/CLAUDE.md`.
- **Todo termo de domínio precisa ser explicável in-app** via a primitiva `Help`. Regra 2 de `web/CLAUDE.md`.
- **Toda chamada de servidor passa por `src/lib/api.ts`** (ou pelos hooks gerados que o usam). Nenhum `fetch` cru. Regra 3.
- **Sem `any`.** `tsconfig.base.json` é strict. Regra 6.
- **Alvo de tamanho: nenhum arquivo novo ou refatorado acima de ~120 linhas.**
- **i18n em 3 locales** (`src/i18n/locales/{en,pt,es}.json`), hoje com 843 linhas cada. Qualquer chave adicionada ou removida vale para os 3; a contagem de chaves tem que fechar igual entre eles no fim.
- **Sem `dangerouslySetInnerHTML`.** Ênfase em string traduzida usa `<Trans>` do react-i18next.
- **Nenhuma primitiva nova mantém estado do valor.** Recebem `value` + `onChange`. A única exceção é a lista de keys interna do `Repeater` (Task 9), que é identidade de render, não valor.
- **Gate por task:** `pnpm typecheck` e `pnpm test` no repo tocado passam antes do commit.
- **Não tocar nas mudanças não commitadas** que já existem nos dois repos. Commitar apenas os arquivos que a task nomeia.

---

## File Structure

**Criar em `aurea/web`:**

| Arquivo | Responsabilidade |
|---|---|
| `vitest.setup.ts` | Setup global de teste: jest-dom, polyfills de jsdom que o Radix exige |
| `src/components/ui/select.tsx` | shadcn Select sobre `@radix-ui/react-select` |
| `src/components/form/Field.tsx` | Layout label + Help + marca opcional + erro. Sem estado, sem input. |
| `src/components/form/TextField.tsx` | `Field` + `Input` de texto controlado |
| `src/components/form/TextAreaField.tsx` | `Field` + `Textarea` controlado |
| `src/components/form/NumberField.tsx` | `Field` + input numérico; centraliza `'' → undefined` |
| `src/components/form/SelectField.tsx` | `Field` + `ui/select` a partir de `options` |
| `src/components/form/TagsField.tsx` | Array de strings: chips + input com Enter |
| `src/components/form/Repeater.tsx` | Array de objetos genérico com keys estáveis |
| `src/lib/enums.ts` | Listas de opção de enum, tipadas contra `src/types/business-context.ts` |
| `src/components/BusinessContextWizard/steps/ProductCard.tsx` | Um produto dentro do `Repeater` |
| `src/components/BusinessContextWizard/steps/CompetitorCard.tsx` | Um concorrente dentro do `Repeater` |
| `src/components/BusinessContextWizard/steps/ChannelsRepeater.tsx` | Array `currentPerformance.channels` |
| `src/components/BusinessContextWizard/steps/ProjectCard.tsx` | Um projeto (contém `ObjectivesRepeater`) |
| `src/components/BusinessContextWizard/steps/ObjectivesRepeater.tsx` | Array `project.objectives` |
| `src/components/BusinessContextWizard/steps/CampaignCard.tsx` | Uma campanha (contém `KpisRepeater`) |
| `src/components/BusinessContextWizard/steps/KpisRepeater.tsx` | Array `campaign.kpis` |
| `src/components/form/*.test.tsx` | 6 arquivos de teste das 7 primitivas |

**Modificar em `aurea/web`:** `package.json`, `vite.config.ts`, `tsconfig.json`, `kubb.config.ts`, `api.json`, os 3 `pages/*NewPage.tsx`, `pages/BusinessContextSectionPage.tsx`, os 9 `steps/*Step.tsx`, `types/business-context.ts`, `schemas/icps.ts`, os 3 locales.

**Modificar em `aurea/back`:** `src/http/api/business/update-section/update-section.schema.ts`, `.controller.ts`, `.service.ts`.

---

## Task 1: Infraestrutura de teste

**Files:**
- Modify: `package.json` (deps + script `test`)
- Modify: `vite.config.ts` (bloco `test`)
- Modify: `tsconfig.json` (types + include)
- Create: `vitest.setup.ts`
- Test: `src/components/ui/badge.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: comando `pnpm test`; ambiente jsdom com `@testing-library/react`, `userEvent` e os polyfills que o Radix exige (`hasPointerCapture`, `scrollIntoView`, `ResizeObserver`). Todas as tasks seguintes dependem disso.

- [ ] **Step 1: Instalar dependências de teste**

```bash
cd /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/web
pnpm add -D vitest@^3 jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Criar o setup global**

Radix usa APIs de ponteiro e layout que o jsdom não implementa. Sem estes stubs, o teste do `SelectField` (Task 7) falha com `target.hasPointerCapture is not a function`, que é um erro confuso e não tem a ver com o componente.

Criar `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom não implementa a API de Pointer Capture nem scrollIntoView, que os
// componentes do Radix (Select, HoverCard) chamam ao abrir. Sem estes stubs o
// teste falha com "hasPointerCapture is not a function".
Element.prototype.hasPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```

- [ ] **Step 3: Configurar o vitest no vite.config.ts**

Substituir o conteúdo de `vite.config.ts` por:

```ts
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: Registrar os tipos globais do vitest**

Em `tsconfig.json`, trocar a linha `"types"` e a linha `"include"`:

```json
"types": ["vite/client", "node", "vitest/globals", "@testing-library/jest-dom/vitest"],
```

```json
"include": ["src", "vite.config.ts", "vitest.setup.ts"]
```

- [ ] **Step 5: Adicionar o script `test`**

Em `package.json`, dentro de `scripts`, depois de `"typecheck"`:

```json
"test": "vitest run",
"test:watch": "vitest",
```

- [ ] **Step 6: Escrever o teste de fumaça**

Testa um componente que já existe, para provar que o ambiente funciona sem depender de código novo. Criar `src/components/ui/badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Ativo</Badge>);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('applies the variant class', () => {
    render(<Badge variant="muted">Rascunho</Badge>);
    expect(screen.getByText('Rascunho')).toHaveClass('bg-muted');
  });
});
```

- [ ] **Step 7: Rodar o teste**

Run: `pnpm test`
Expected: PASS, 2 testes.

- [ ] **Step 8: Rodar o typecheck**

Run: `pnpm typecheck`
Expected: sem erro. Se acusar `Cannot find name 'describe'`, o array `types` do Step 4 não foi aplicado.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tsconfig.json vitest.setup.ts src/components/ui/badge.test.tsx
git commit -m "test: add vitest + testing-library setup for web"
```

---

## Task 2: shadcn Select

**Files:**
- Create: `src/components/ui/select.tsx`
- Test: `src/components/ui/select.test.tsx`
- Modify: `package.json` (dep `@radix-ui/react-select`)

**Interfaces:**
- Consumes: `cn` de `@/lib/utils` (Task 1 não altera isso; já existe).
- Produces: `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`. Consumido por `SelectField` (Task 7). Contrato: `Select` recebe `value: string`, `onValueChange: (v: string) => void`; `SelectTrigger` aceita `id` e `className`.

- [ ] **Step 1: Instalar o Radix Select**

```bash
pnpm add @radix-ui/react-select
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `src/components/ui/select.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

function Harness({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger id="stage" aria-label="Estágio">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="seed">Seed</SelectItem>
        <SelectItem value="series-a">Série A</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('shows the placeholder when no value is selected', () => {
    render(<Harness />);
    expect(screen.getByText('Selecione')).toBeInTheDocument();
  });

  it('reports the chosen value', async () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Estágio' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Série A' }));

    expect(onValueChange).toHaveBeenCalledWith('series-a');
  });
});
```

- [ ] **Step 3: Rodar o teste para ver falhar**

Run: `pnpm test src/components/ui/select.test.tsx`
Expected: FAIL — `Failed to resolve import "./select"`.

- [ ] **Step 4: Implementar o Select**

Criar `src/components/ui/select.tsx`. As classes seguem as do `Input` existente (`h-9`, `rounded-md`, `border-input`, `focus-visible:ring-2 focus-visible:ring-ring`) para o form ficar visualmente homogêneo:

```tsx
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
      'data-[placeholder]:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
        position === 'popper' && 'data-[side=bottom]:translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';
```

- [ ] **Step 5: Rodar o teste**

Run: `pnpm test src/components/ui/select.test.tsx`
Expected: PASS, 2 testes.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: sem erro.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/select.tsx src/components/ui/select.test.tsx
git commit -m "feat(ui): add shadcn Select on Radix"
```

---

## Task 3: Primitiva Field

**Files:**
- Create: `src/components/form/Field.tsx`
- Test: `src/components/form/Field.test.tsx`

**Interfaces:**
- Consumes: `Label` de `@/components/ui/label`, `Help` de `@/components/Help`.
- Produces:

```ts
interface FieldProps {
  htmlFor: string;
  label: string;
  help?: ReactNode;
  helpTitle?: string;
  optional?: boolean;
  optionalLabel?: string;
  error?: string;
  children: ReactNode;
}
```

Consumido por `TextField`, `TextAreaField`, `NumberField`, `SelectField`, `TagsField` (Tasks 4–8).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/form/Field.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field htmlFor="mission" label="Missão">
        <input id="mission" />
      </Field>,
    );
    expect(screen.getByLabelText('Missão')).toBe(screen.getByRole('textbox'));
  });

  it('renders the error message when present', () => {
    render(
      <Field htmlFor="mission" label="Missão" error="Campo obrigatório">
        <input id="mission" />
      </Field>,
    );
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('does not render an error region when there is no error', () => {
    render(
      <Field htmlFor="mission" label="Missão">
        <input id="mission" />
      </Field>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks the field as optional when asked', () => {
    render(
      <Field htmlFor="mission" label="Missão" optional optionalLabel="opcional">
        <input id="mission" />
      </Field>,
    );
    expect(screen.getByText('opcional')).toBeInTheDocument();
  });

  it('links the error to the control via aria-describedby', () => {
    render(
      <Field htmlFor="mission" label="Missão" error="Campo obrigatório">
        <input id="mission" aria-describedby="mission-error" />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'mission-error');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/components/form/Field.test.tsx`
Expected: FAIL — `Failed to resolve import "./Field"`.

- [ ] **Step 3: Implementar**

Criar `src/components/form/Field.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Help } from '@/components/Help';

export interface FieldProps {
  /** id do controle que este campo rotula. Também deriva o id do erro. */
  htmlFor: string;
  label: string;
  /** Explicação in-app do termo de domínio (regra 2 de CLAUDE.md). */
  help?: ReactNode;
  helpTitle?: string;
  optional?: boolean;
  /** Texto traduzido de "opcional". O Field não traduz nada por conta própria. */
  optionalLabel?: string;
  error?: string;
  children: ReactNode;
}

/**
 * Layout de um campo de formulário: rótulo, explicação, marca de opcional e erro.
 * Não guarda estado e não sabe que tipo de controle envolve.
 */
export function Field({
  htmlFor,
  label,
  help,
  helpTitle,
  optional,
  optionalLabel,
  error,
  children,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {help && <Help title={helpTitle}>{help}</Help>}
        {optional && optionalLabel && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{optionalLabel}</span>
        )}
      </Label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm test src/components/form/Field.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/form/Field.tsx src/components/form/Field.test.tsx
git commit -m "feat(form): add Field primitive"
```

---

## Task 4: TextField e TextAreaField

**Files:**
- Create: `src/components/form/TextField.tsx`
- Create: `src/components/form/TextAreaField.tsx`
- Test: `src/components/form/TextField.test.tsx`

**Interfaces:**
- Consumes: `Field`, `FieldProps` de `./Field` (Task 3); `Input` de `@/components/ui/input`; `Textarea` de `@/components/ui/textarea`.
- Produces:

```ts
type ValueFieldProps = Omit<FieldProps, 'children'> & {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Só no TextField. `date` é usado por baselineDate/startDate/endDate; `url` por website e competitor.url. */
  type?: 'text' | 'date' | 'url' | 'email';
};
// TextField: ValueFieldProps
// TextAreaField: Omit<ValueFieldProps, 'type'> & { rows?: number }
```

`onChange` sempre recebe string (nunca evento). `value` `undefined` renderiza `''` — o controle nunca fica não-controlado.

Também produz `errorAria(htmlFor, error)`, exportado de `Field.tsx`:

```ts
export function errorAria(htmlFor: string, error: string | undefined) {
  return error ? { 'aria-describedby': `${htmlFor}-error`, 'aria-invalid': true as const } : {};
}
```

Mora em `Field.tsx` de propósito: o `Field` é quem renderiza o id `${htmlFor}-error`, então
produtor e derivador do id ficam no mesmo arquivo e mudar a convenção toca um lugar só.
Consumido por `TextField`, `TextAreaField`, `NumberField` (Task 5), `SelectField` (Task 7)
e `TagsField` (Task 8) — cinco consumidores conhecidos, não hipotéticos.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/form/TextField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';
import { TextAreaField } from './TextAreaField';

describe('TextField', () => {
  it('renders an undefined value as an empty controlled input', () => {
    render(<TextField htmlFor="hq" label="Sede" value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('Sede')).toHaveValue('');
  });

  it('calls onChange with the text, not the event', async () => {
    const onChange = vi.fn();
    render(<TextField htmlFor="hq" label="Sede" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Sede'), 'S');
    expect(onChange).toHaveBeenCalledWith('S');
  });

  it('shows the error from Field', () => {
    render(
      <TextField htmlFor="hq" label="Sede" value="" onChange={() => {}} error="Obrigatório" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Obrigatório');
  });

  it('forwards the input type', () => {
    render(
      <TextField htmlFor="start" label="Início" type="date" value="" onChange={() => {}} />,
    );
    expect(screen.getByLabelText('Início')).toHaveAttribute('type', 'date');
  });
});

describe('TextAreaField', () => {
  it('renders a textarea with the given rows', () => {
    render(
      <TextAreaField htmlFor="mission" label="Missão" value="oi" onChange={() => {}} rows={4} />,
    );
    const el = screen.getByLabelText('Missão');
    expect(el.tagName).toBe('TEXTAREA');
    expect(el).toHaveAttribute('rows', '4');
    expect(el).toHaveValue('oi');
  });

  it('calls onChange with the text', async () => {
    const onChange = vi.fn();
    render(<TextAreaField htmlFor="mission" label="Missão" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Missão'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/components/form/TextField.test.tsx`
Expected: FAIL — `Failed to resolve import "./TextField"`.

- [ ] **Step 3: Implementar o TextField**

Criar `src/components/form/TextField.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Field, type FieldProps } from './Field';

export type ValueFieldProps = Omit<FieldProps, 'children'> & {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Só o TextField usa. `date` para as datas do domínio, `url` para website e competitor.url. */
  type?: 'text' | 'date' | 'url' | 'email';
};

export function TextField({ value, onChange, placeholder, type = 'text', ...field }: ValueFieldProps) {
  return (
    <Field {...field}>
      <Input
        id={field.htmlFor}
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        aria-describedby={field.error ? `${field.htmlFor}-error` : undefined}
        aria-invalid={field.error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
```

- [ ] **Step 4: Implementar o TextAreaField**

Criar `src/components/form/TextAreaField.tsx`:

```tsx
import { Textarea } from '@/components/ui/textarea';
import { Field } from './Field';
import type { ValueFieldProps } from './TextField';

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  ...field
}: Omit<ValueFieldProps, 'type'> & { rows?: number }) {
  return (
    <Field {...field}>
      <Textarea
        id={field.htmlFor}
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        aria-describedby={field.error ? `${field.htmlFor}-error` : undefined}
        aria-invalid={field.error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
```

- [ ] **Step 5: Rodar o teste**

Run: `pnpm test src/components/form/TextField.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 6: Commit**

```bash
git add src/components/form/TextField.tsx src/components/form/TextAreaField.tsx src/components/form/TextField.test.tsx
git commit -m "feat(form): add TextField and TextAreaField"
```

---

## Task 5: NumberField

**Files:**
- Create: `src/components/form/NumberField.tsx`
- Test: `src/components/form/NumberField.test.tsx`

**Interfaces:**
- Consumes: `Field`, `FieldProps` de `./Field` (Task 3); `Input`.
- Produces:

```ts
type NumberFieldProps = Omit<FieldProps, 'children'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};
```

Contrato que os 9 steps dependem: campo vazio emite `undefined`, nunca `NaN` e nunca `0`. Hoje essa coerção está copiada em todo campo numérico (ex.: `CompanyStep.tsx:59`, `:88`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/form/NumberField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('renders an undefined value as empty', () => {
    render(<NumberField htmlFor="mrr" label="MRR" value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('MRR')).toHaveValue(null);
  });

  it('emits a number when digits are typed', async () => {
    const onChange = vi.fn();
    render(<NumberField htmlFor="mrr" label="MRR" value={undefined} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('MRR'), '7');
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('emits undefined — not NaN, not 0 — when the field is cleared', async () => {
    const onChange = vi.fn();
    render(<NumberField htmlFor="mrr" label="MRR" value={9} onChange={onChange} />);
    await userEvent.clear(screen.getByLabelText('MRR'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('emits undefined for a value that is not a finite number', async () => {
    const onChange = vi.fn();
    render(<NumberField htmlFor="mrr" label="MRR" value={undefined} onChange={onChange} />);
    // input[type=number] aceita "-" e "e" como entrada parcial não-numérica
    await userEvent.type(screen.getByLabelText('MRR'), '-');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('forwards min, max and step to the input', () => {
    render(
      <NumberField
        htmlFor="year"
        label="Ano"
        value={2020}
        onChange={() => {}}
        min={1900}
        max={2099}
        step={1}
      />,
    );
    const el = screen.getByLabelText('Ano');
    expect(el).toHaveAttribute('min', '1900');
    expect(el).toHaveAttribute('max', '2099');
    expect(el).toHaveAttribute('step', '1');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/components/form/NumberField.test.tsx`
Expected: FAIL — `Failed to resolve import "./NumberField"`.

- [ ] **Step 3: Implementar**

Criar `src/components/form/NumberField.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { errorAria, Field, type FieldProps } from './Field';

export type NumberFieldProps = Omit<FieldProps, 'children'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

/**
 * Campo numérico. Único lugar do app que converte string de input em número:
 * vazio e entrada parcial não-numérica ("-", "e") emitem `undefined`, nunca NaN.
 */
export function NumberField({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  ...field
}: NumberFieldProps) {
  return (
    <Field {...field}>
      <Input
        id={field.htmlFor}
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        {...errorAria(field.htmlFor, field.error)}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') return onChange(undefined);
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : undefined);
        }}
      />
    </Field>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm test src/components/form/NumberField.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/form/NumberField.tsx src/components/form/NumberField.test.tsx
git commit -m "feat(form): add NumberField with single empty-to-undefined coercion"
```

---

## Task 6: Catálogo de enums

**Files:**
- Create: `src/lib/enums.ts`
- Test: `src/lib/enums.test.ts`

**Interfaces:**
- Consumes: tipos de `@/types/business-context`.
- Produces:

```ts
export interface EnumOption<T extends string> { value: T; labelKey: string }
export const FUNDING_STAGE_OPTIONS: EnumOption<NonNullable<CompanyProfile['fundingStage']>>[];
export const PRICING_MODEL_OPTIONS: EnumOption<NonNullable<Product['pricingModel']>>[];
export const PRODUCT_STATUS_OPTIONS: EnumOption<NonNullable<Product['status']>>[];
export const MARKET_SHARE_OPTIONS: EnumOption<NonNullable<Competitor['marketShare']>>[];
export const MARKET_POSITION_OPTIONS: EnumOption<NonNullable<CompetitiveLandscape['marketPosition']>>[];
export const MATURITY_OPTIONS: EnumOption<NonNullable<MarketContext['maturity']>>[];
export const URGENCY_OPTIONS: EnumOption<NonNullable<BusinessConstraints['urgency']>>[];
export const PROJECT_TYPE_OPTIONS: EnumOption<NonNullable<Project['type']>>[];
export const PROJECT_STATUS_OPTIONS: EnumOption<NonNullable<Project['status']>>[];
export const OBJECTIVE_STATUS_OPTIONS: EnumOption<NonNullable<ProjectObjective['status']>>[];
export const CAMPAIGN_STATUS_OPTIONS: EnumOption<NonNullable<Campaign['status']>>[];
```

Consumido por `SelectField` (Task 7) nos steps. `labelKey` é chave de i18n; o componente traduz. Tipar cada lista contra o tipo faz um enum que mudou no backend virar erro de typecheck.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/enums.test.ts`. O teste garante o que o typecheck não garante: nenhuma lista vazia e nenhum valor duplicado.

```ts
import * as enums from './enums';

const ALL = Object.entries(enums).filter(([name]) => name.endsWith('_OPTIONS')) as [
  string,
  { value: string; labelKey: string }[],
][];

describe('enum option catalogue', () => {
  it('exports every expected list', () => {
    expect(ALL.map(([name]) => name).sort()).toEqual(
      [
        'CAMPAIGN_STATUS_OPTIONS',
        'FUNDING_STAGE_OPTIONS',
        'MARKET_POSITION_OPTIONS',
        'MARKET_SHARE_OPTIONS',
        'MATURITY_OPTIONS',
        'OBJECTIVE_STATUS_OPTIONS',
        'PRICING_MODEL_OPTIONS',
        'PRODUCT_STATUS_OPTIONS',
        'PROJECT_STATUS_OPTIONS',
        'PROJECT_TYPE_OPTIONS',
        'URGENCY_OPTIONS',
      ].sort(),
    );
  });

  it.each(ALL)('%s is non-empty with unique values and i18n keys', (_name, options) => {
    expect(options.length).toBeGreaterThan(0);
    expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
    for (const o of options) {
      expect(o.value).not.toBe('');
      expect(o.labelKey).toMatch(/^enums\./);
    }
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/lib/enums.test.ts`
Expected: FAIL — `Failed to resolve import "./enums"`.

- [ ] **Step 3: Implementar**

Criar `src/lib/enums.ts`:

```ts
import type {
  BusinessConstraints,
  Campaign,
  CompanyProfile,
  Competitor,
  CompetitiveLandscape,
  MarketContext,
  Product,
  Project,
  ProjectObjective,
} from '@/types/business-context';

export interface EnumOption<T extends string> {
  value: T;
  /** Chave de i18n. Quem renderiza traduz — este módulo não importa i18next. */
  labelKey: string;
}

export const FUNDING_STAGE_OPTIONS: EnumOption<NonNullable<CompanyProfile['fundingStage']>>[] = [
  { value: 'bootstrapped', labelKey: 'enums.fundingStage.bootstrapped' },
  { value: 'pre-seed', labelKey: 'enums.fundingStage.preSeed' },
  { value: 'seed', labelKey: 'enums.fundingStage.seed' },
  { value: 'series-a', labelKey: 'enums.fundingStage.seriesA' },
  { value: 'series-b', labelKey: 'enums.fundingStage.seriesB' },
  { value: 'series-c+', labelKey: 'enums.fundingStage.seriesCPlus' },
  { value: 'public', labelKey: 'enums.fundingStage.public' },
];

export const PRICING_MODEL_OPTIONS: EnumOption<NonNullable<Product['pricingModel']>>[] = [
  { value: 'free', labelKey: 'enums.pricingModel.free' },
  { value: 'freemium', labelKey: 'enums.pricingModel.freemium' },
  { value: 'subscription', labelKey: 'enums.pricingModel.subscription' },
  { value: 'one-time', labelKey: 'enums.pricingModel.oneTime' },
  { value: 'usage-based', labelKey: 'enums.pricingModel.usageBased' },
  { value: 'custom', labelKey: 'enums.pricingModel.custom' },
];

export const PRODUCT_STATUS_OPTIONS: EnumOption<NonNullable<Product['status']>>[] = [
  { value: 'active', labelKey: 'enums.productStatus.active' },
  { value: 'beta', labelKey: 'enums.productStatus.beta' },
  { value: 'planned', labelKey: 'enums.productStatus.planned' },
  { value: 'sunset', labelKey: 'enums.productStatus.sunset' },
];

export const MARKET_SHARE_OPTIONS: EnumOption<NonNullable<Competitor['marketShare']>>[] = [
  { value: 'dominant', labelKey: 'enums.marketShare.dominant' },
  { value: 'major', labelKey: 'enums.marketShare.major' },
  { value: 'emerging', labelKey: 'enums.marketShare.emerging' },
  { value: 'niche', labelKey: 'enums.marketShare.niche' },
];

export const MARKET_POSITION_OPTIONS: EnumOption<
  NonNullable<CompetitiveLandscape['marketPosition']>
>[] = [
  { value: 'leader', labelKey: 'enums.marketPosition.leader' },
  { value: 'challenger', labelKey: 'enums.marketPosition.challenger' },
  { value: 'follower', labelKey: 'enums.marketPosition.follower' },
  { value: 'niche', labelKey: 'enums.marketPosition.niche' },
];

export const MATURITY_OPTIONS: EnumOption<NonNullable<MarketContext['maturity']>>[] = [
  { value: 'emerging', labelKey: 'enums.maturity.emerging' },
  { value: 'growth', labelKey: 'enums.maturity.growth' },
  { value: 'mature', labelKey: 'enums.maturity.mature' },
  { value: 'declining', labelKey: 'enums.maturity.declining' },
];

export const URGENCY_OPTIONS: EnumOption<NonNullable<BusinessConstraints['urgency']>>[] = [
  { value: 'low', labelKey: 'enums.urgency.low' },
  { value: 'medium', labelKey: 'enums.urgency.medium' },
  { value: 'high', labelKey: 'enums.urgency.high' },
  { value: 'critical', labelKey: 'enums.urgency.critical' },
];

export const PROJECT_TYPE_OPTIONS: EnumOption<NonNullable<Project['type']>>[] = [
  { value: 'product', labelKey: 'enums.projectType.product' },
  { value: 'marketing', labelKey: 'enums.projectType.marketing' },
  { value: 'sales', labelKey: 'enums.projectType.sales' },
  { value: 'operations', labelKey: 'enums.projectType.operations' },
  { value: 'technical', labelKey: 'enums.projectType.technical' },
  { value: 'other', labelKey: 'enums.projectType.other' },
];

export const PROJECT_STATUS_OPTIONS: EnumOption<NonNullable<Project['status']>>[] = [
  { value: 'planned', labelKey: 'enums.projectStatus.planned' },
  { value: 'in-progress', labelKey: 'enums.projectStatus.inProgress' },
  { value: 'completed', labelKey: 'enums.projectStatus.completed' },
  { value: 'on-hold', labelKey: 'enums.projectStatus.onHold' },
];

export const OBJECTIVE_STATUS_OPTIONS: EnumOption<
  NonNullable<ProjectObjective['status']>
>[] = [
  { value: 'not-started', labelKey: 'enums.objectiveStatus.notStarted' },
  { value: 'in-progress', labelKey: 'enums.objectiveStatus.inProgress' },
  { value: 'achieved', labelKey: 'enums.objectiveStatus.achieved' },
  { value: 'missed', labelKey: 'enums.objectiveStatus.missed' },
];

export const CAMPAIGN_STATUS_OPTIONS: EnumOption<NonNullable<Campaign['status']>>[] = [
  { value: 'planned', labelKey: 'enums.campaignStatus.planned' },
  { value: 'running', labelKey: 'enums.campaignStatus.running' },
  { value: 'finished', labelKey: 'enums.campaignStatus.finished' },
  { value: 'paused', labelKey: 'enums.campaignStatus.paused' },
];
```

- [ ] **Step 4: Adicionar as chaves `enums.*` aos 3 locales**

Em `src/i18n/locales/en.json`, `pt.json` e `es.json`, adicionar o bloco `"enums"` no topo do objeto raiz. As 11 listas têm 49 valores no total; cada arquivo recebe as mesmas 49 chaves. Reaproveitar os textos que já existem em `wizard.products.pricingModel*`, `wizard.company.fundingStage*` etc. — as chaves antigas ficam por enquanto e são removidas na task do step correspondente.

Exemplo para `pt.json` (traduzir para en/es):

```json
"enums": {
  "fundingStage": { "bootstrapped": "Bootstrapped", "preSeed": "Pre-seed", "seed": "Seed", "seriesA": "Série A", "seriesB": "Série B", "seriesCPlus": "Série C+", "public": "Capital aberto" },
  "pricingModel": { "free": "Grátis", "freemium": "Freemium", "subscription": "Assinatura", "oneTime": "Pagamento único", "usageBased": "Por uso", "custom": "Personalizado" },
  "productStatus": { "active": "Ativo", "beta": "Beta", "planned": "Planejado", "sunset": "Descontinuado" },
  "marketShare": { "dominant": "Dominante", "major": "Grande", "emerging": "Emergente", "niche": "Nicho" },
  "marketPosition": { "leader": "Líder", "challenger": "Desafiante", "follower": "Seguidor", "niche": "Nicho" },
  "maturity": { "emerging": "Emergente", "growth": "Crescimento", "mature": "Maduro", "declining": "Em declínio" },
  "urgency": { "low": "Baixa", "medium": "Média", "high": "Alta", "critical": "Crítica" },
  "projectType": { "product": "Produto", "marketing": "Marketing", "sales": "Vendas", "operations": "Operações", "technical": "Técnico", "other": "Outro" },
  "projectStatus": { "planned": "Planejado", "inProgress": "Em andamento", "completed": "Concluído", "onHold": "Pausado" },
  "objectiveStatus": { "notStarted": "Não iniciado", "inProgress": "Em andamento", "achieved": "Atingido", "missed": "Não atingido" },
  "campaignStatus": { "planned": "Planejada", "running": "Em veiculação", "finished": "Encerrada", "paused": "Pausada" }
}
```

- [ ] **Step 5: Rodar o teste**

Run: `pnpm test src/lib/enums.test.ts`
Expected: PASS, 12 testes (1 + 11 do `it.each`).

- [ ] **Step 6: Verificar que os 3 locales têm a mesma forma**

Run:
```bash
node -e "const f=['en','pt','es'].map(l=>require('./src/i18n/locales/'+l+'.json'));const k=o=>Object.entries(o).flatMap(([a,b])=>typeof b==='object'&&b?k(b).map(s=>a+'.'+s):[a]).sort();const [a,b,c]=f.map(k);console.log(a.length,b.length,c.length);console.log('iguais:',JSON.stringify(a)===JSON.stringify(b)&&JSON.stringify(b)===JSON.stringify(c))"
```
Expected: três contagens idênticas e `iguais: true`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/enums.ts src/lib/enums.test.ts src/i18n/locales/en.json src/i18n/locales/pt.json src/i18n/locales/es.json
git commit -m "feat: add typed enum option catalogue with i18n keys"
```

---

## Task 7: SelectField

**Files:**
- Create: `src/components/form/SelectField.tsx`
- Test: `src/components/form/SelectField.test.tsx`

**Interfaces:**
- Consumes: `Field`, `FieldProps` (Task 3); `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (Task 2); `EnumOption` (Task 6).
- Produces:

```ts
type SelectFieldProps<T extends string> = Omit<FieldProps, 'children'> & {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: readonly EnumOption<T>[];
  placeholder?: string;
  /** Texto da opção que limpa o campo. Omitir torna o campo não-limpável. */
  clearLabel?: string;
  /** Tradutor injetado — a primitiva não depende de provider de i18n. */
  translate: (key: string) => string;
};
```

`translate` é obrigatório e injetado. Nos selects dinâmicos (goal na Task 14,
projeto na Task 24) `labelKey` já é texto do usuário e `translate` é a identidade.

O Radix Select proíbe `SelectItem` com `value=""`, então "limpar" usa a sentinela interna `__clear__`, que nunca sai do componente: `onChange` recebe `undefined`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/form/SelectField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from './SelectField';

const OPTIONS = [
  { value: 'seed', labelKey: 'Seed' },
  { value: 'series-a', labelKey: 'Série A' },
] as const;

describe('SelectField', () => {
  it('renders the placeholder when the value is undefined', () => {
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value={undefined}
        onChange={() => {}}
        options={OPTIONS}
        placeholder="Selecione"
        translate={(k) => k}
      />,
    );
    expect(screen.getByText('Selecione')).toBeInTheDocument();
  });

  it('emits the selected value', async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value={undefined}
        onChange={onChange}
        options={OPTIONS}
        translate={(k) => k}
      />,
    );
    await userEvent.click(screen.getByLabelText('Estágio'));
    await userEvent.click(await screen.findByRole('option', { name: 'Série A' }));
    expect(onChange).toHaveBeenCalledWith('series-a');
  });

  it('emits undefined when the clear option is chosen', async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value="seed"
        onChange={onChange}
        options={OPTIONS}
        clearLabel="—"
        translate={(k) => k}
      />,
    );
    await userEvent.click(screen.getByLabelText('Estágio'));
    await userEvent.click(await screen.findByRole('option', { name: '—' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not render a clear option when clearLabel is omitted', async () => {
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value="seed"
        onChange={() => {}}
        options={OPTIONS}
        translate={(k) => k}
      />,
    );
    await userEvent.click(screen.getByLabelText('Estágio'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/components/form/SelectField.test.tsx`
Expected: FAIL — `Failed to resolve import "./SelectField"`.

- [ ] **Step 3: Implementar**

Criar `src/components/form/SelectField.tsx`. `translate` é injetado em vez de usar `useTranslation` direto — mantém a primitiva testável sem provider de i18n e sem mock.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EnumOption } from '@/lib/enums';
import { errorAria, Field, type FieldProps } from './Field';

/** O Radix rejeita SelectItem com value="". Sentinela interna para "sem valor". */
const CLEAR = '__clear__';

export type SelectFieldProps<T extends string> = Omit<FieldProps, 'children'> & {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: readonly EnumOption<T>[];
  placeholder?: string;
  /** Texto da opção que limpa o campo. Omitir torna o campo não-limpável. */
  clearLabel?: string;
  /** Tradutor injetado — a primitiva não depende de provider de i18n. */
  translate: (key: string) => string;
};

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  clearLabel,
  translate,
  ...field
}: SelectFieldProps<T>) {
  return (
    <Field {...field}>
      <Select
        value={value ?? ''}
        onValueChange={(next) => onChange(next === CLEAR ? undefined : (next as T))}
      >
        <SelectTrigger id={field.htmlFor} {...errorAria(field.htmlFor, field.error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {clearLabel && <SelectItem value={CLEAR}>{clearLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {translate(o.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm test src/components/form/SelectField.test.tsx`
Expected: PASS, 4 testes. Se falhar com `hasPointerCapture is not a function`, o `vitest.setup.ts` da Task 1 não está sendo carregado.

- [ ] **Step 5: Commit**

```bash
git add src/components/form/SelectField.tsx src/components/form/SelectField.test.tsx
git commit -m "feat(form): add SelectField over shadcn Select"
```

---

## Task 8: TagsField

**Files:**
- Create: `src/components/form/TagsField.tsx`
- Test: `src/components/form/TagsField.test.tsx`

**Interfaces:**
- Consumes: `Field`, `FieldProps` (Task 3); `Input`; `Badge`; `X` de `lucide-react`.
- Produces:

```ts
type TagsFieldProps = Omit<FieldProps, 'children'> & {
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  placeholder?: string;
  addLabel: string;
  removeLabel: (tag: string) => string;
};
```

Substitui 15 campos de array de string escritos à mão nos steps, mais o `painPoints` do ICP (Task 12). O rascunho do input é estado interno — é texto ainda não commitado, não o valor do campo.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/form/TagsField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagsField } from './TagsField';

function setup(value: string[] = []) {
  const onChange = vi.fn();
  render(
    <TagsField
      htmlFor="values"
      label="Valores"
      value={value}
      onChange={onChange}
      addLabel="Adicionar"
      removeLabel={(t) => `Remover ${t}`}
    />,
  );
  return { onChange, input: screen.getByLabelText('Valores') };
}

describe('TagsField', () => {
  it('renders existing tags', () => {
    setup(['Transparência', 'Foco']);
    expect(screen.getByText('Transparência')).toBeInTheDocument();
    expect(screen.getByText('Foco')).toBeInTheDocument();
  });

  it('adds a tag on Enter and clears the draft', async () => {
    const { onChange, input } = setup([]);
    await userEvent.type(input, 'Transparência{Enter}');
    expect(onChange).toHaveBeenCalledWith(['Transparência']);
    expect(input).toHaveValue('');
  });

  it('adds a tag via the add button', async () => {
    const { onChange, input } = setup(['Foco']);
    await userEvent.type(input, 'Rigor');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onChange).toHaveBeenCalledWith(['Foco', 'Rigor']);
  });

  it('trims whitespace and ignores an empty draft', async () => {
    const { onChange, input } = setup([]);
    await userEvent.type(input, '   {Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(input, '  Foco  {Enter}');
    expect(onChange).toHaveBeenCalledWith(['Foco']);
  });

  it('ignores a duplicate tag', async () => {
    const { onChange, input } = setup(['Foco']);
    await userEvent.type(input, 'Foco{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes the clicked tag, not the first one', async () => {
    const { onChange } = setup(['a', 'b', 'c']);
    await userEvent.click(screen.getByRole('button', { name: 'Remover b' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('does not submit the surrounding form when Enter is pressed', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <TagsField
          htmlFor="tags"
          label="Tags"
          value={[]}
          onChange={() => {}}
          addLabel="Adicionar"
          removeLabel={(t) => `Remover ${t}`}
        />
      </form>,
    );
    await userEvent.type(screen.getByLabelText('Tags'), 'x{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats an undefined value as an empty list', async () => {
    const onChange = vi.fn();
    render(
      <TagsField
        htmlFor="tags"
        label="Tags"
        value={undefined}
        onChange={onChange}
        addLabel="Adicionar"
        removeLabel={(t) => `Remover ${t}`}
      />,
    );
    await userEvent.type(screen.getByLabelText('Tags'), 'x{Enter}');
    expect(onChange).toHaveBeenCalledWith(['x']);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/components/form/TagsField.test.tsx`
Expected: FAIL — `Failed to resolve import "./TagsField"`.

- [ ] **Step 3: Implementar**

Criar `src/components/form/TagsField.tsx`. Substitui o padrão de `CompanyStep.tsx:176-199`, que usava `document.getElementById` e escrevia em `input.value` direto.

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorAria, Field, type FieldProps } from './Field';

export type TagsFieldProps = Omit<FieldProps, 'children'> & {
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  placeholder?: string;
  addLabel: string;
  removeLabel: (tag: string) => string;
};

/**
 * Lista de strings livres. O rascunho do input é estado interno — é texto ainda
 * não commitado, não o valor do campo. O valor em si vem sempre de `value`.
 */
export function TagsField({
  value,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  ...field
}: TagsFieldProps) {
  const [draft, setDraft] = useState('');
  const tags = value ?? [];

  const commit = () => {
    const next = draft.trim();
    setDraft('');
    if (!next || tags.includes(next)) return;
    onChange([...tags, next]);
  };

  return (
    <Field {...field}>
      <div className="space-y-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  aria-label={removeLabel(tag)}
                  className="rounded-full text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onChange(tags.filter((t) => t !== tag))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            id={field.htmlFor}
            value={draft}
            placeholder={placeholder}
            {...errorAria(field.htmlFor, field.error)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              // Enter aqui adiciona uma tag; não deve submeter o form ao redor.
              e.preventDefault();
              commit();
            }}
          />
          <Button type="button" variant="outline" onClick={commit}>
            {addLabel}
          </Button>
        </div>
      </div>
    </Field>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm test src/components/form/TagsField.test.tsx`
Expected: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/components/form/TagsField.tsx src/components/form/TagsField.test.tsx
git commit -m "feat(form): add TagsField replacing hand-rolled string arrays"
```

---

## Task 9: Repeater

**Files:**
- Create: `src/components/form/Repeater.tsx`
- Test: `src/components/form/Repeater.test.tsx`

**Interfaces:**
- Consumes: `Card`, `CardContent` de `@/components/ui/card`; `Button`; `Trash2`, `Plus` de `lucide-react`; `nanoid`.
- Produces:

```ts
interface RepeaterProps<T> {
  items: T[] | undefined;
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  itemLabel: (index: number) => string;
  addLabel: string;
  removeLabel: string;
  emptyLabel?: string;
}
```

Consumido pelos 7 arrays de objeto (Tasks 16–24).

**Por que existe uma lista de keys interna:** `CampaignKpi`, `ChannelPerformance` e `Competitor` não têm campo `id` (ver `src/types/business-context.ts:37,82,157`). Usar o índice como `key` faz o React remontar os inputs quando um item do meio é removido, e o texto do usuário salta de linha. O `Repeater` mantém uma lista paralela de keys geradas com `nanoid`, sincronizada nas operações que ele mesmo executa e re-sincronizada por tamanho quando `items` é substituído de fora — que é o que a IA vai fazer no sub-projeto C.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/components/form/Repeater.test.tsx`:

```tsx
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Repeater } from './Repeater';

interface Row {
  name: string;
}

function Harness({ initial = [] as Row[] }: { initial?: Row[] }) {
  const [items, setItems] = useState<Row[]>(initial);
  return (
    <Repeater<Row>
      items={items}
      onChange={setItems}
      newItem={() => ({ name: '' })}
      itemLabel={(i) => `Item ${i + 1}`}
      addLabel="Adicionar"
      removeLabel="Remover"
      emptyLabel="Nada aqui"
      renderItem={(item, update, index) => (
        <input
          aria-label={`nome ${index}`}
          value={item.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      )}
    />
  );
}

describe('Repeater', () => {
  it('shows the empty label when there are no items', () => {
    render(<Harness />);
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });

  it('appends an item built by newItem', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByLabelText('nome 0')).toHaveValue('');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('patches only the edited item', async () => {
    render(<Harness initial={[{ name: 'a' }, { name: 'b' }]} />);
    await userEvent.type(screen.getByLabelText('nome 0'), 'x');
    expect(screen.getByLabelText('nome 0')).toHaveValue('ax');
    expect(screen.getByLabelText('nome 1')).toHaveValue('b');
  });

  it('removes the clicked row, not the first one', async () => {
    render(<Harness initial={[{ name: 'a' }, { name: 'b' }, { name: 'c' }]} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1]!);
    expect(screen.getByLabelText('nome 0')).toHaveValue('a');
    expect(screen.getByLabelText('nome 1')).toHaveValue('c');
    expect(screen.queryByLabelText('nome 2')).not.toBeInTheDocument();
  });

  it('keeps stable keys so removing a row does not remount the others', async () => {
    render(<Harness initial={[{ name: 'a' }, { name: 'b' }]} />);
    const first = screen.getByLabelText('nome 0');
    await userEvent.click(screen.getAllByRole('button', { name: 'Remover' })[1]!);
    // Mesmo nó de DOM: a linha sobrevivente não foi remontada.
    expect(screen.getByLabelText('nome 0')).toBe(first);
  });

  it('treats an undefined items list as empty', () => {
    render(
      <Repeater<Row>
        items={undefined}
        onChange={() => {}}
        newItem={() => ({ name: '' })}
        itemLabel={(i) => `Item ${i + 1}`}
        addLabel="Adicionar"
        removeLabel="Remover"
        emptyLabel="Nada aqui"
        renderItem={() => null}
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `pnpm test src/components/form/Repeater.test.tsx`
Expected: FAIL — `Failed to resolve import "./Repeater"`.

- [ ] **Step 3: Implementar**

Criar `src/components/form/Repeater.tsx`:

```tsx
import { useRef, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface RepeaterProps<T> {
  items: T[] | undefined;
  onChange: (items: T[]) => void;
  /** Fábrica do item vazio. Use as constantes EMPTY_* de types/business-context. */
  newItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  itemLabel: (index: number) => string;
  addLabel: string;
  removeLabel: string;
  emptyLabel?: string;
}

/**
 * Array de objetos editável. Três tipos do domínio (CampaignKpi,
 * ChannelPerformance, Competitor) não têm `id`, então o índice seria a única
 * `key` disponível — e índice como key remonta os inputs quando um item do meio
 * é removido, fazendo o texto do usuário saltar de linha. Por isso o Repeater
 * mantém sua própria lista de keys estáveis.
 */
export function Repeater<T>({
  items,
  onChange,
  newItem,
  renderItem,
  itemLabel,
  addLabel,
  removeLabel,
  emptyLabel,
}: RepeaterProps<T>) {
  const list = items ?? [];
  const keys = useRef<string[]>([]);

  // Re-sincroniza quando a lista é substituída de fora (ex.: preenchimento por IA).
  while (keys.current.length < list.length) keys.current.push(nanoid());
  if (keys.current.length > list.length) keys.current.length = list.length;

  const add = () => {
    keys.current.push(nanoid());
    onChange([...list, newItem()]);
  };

  const removeAt = (index: number) => {
    keys.current.splice(index, 1);
    onChange(list.filter((_, i) => i !== index));
  };

  const updateAt = (index: number, patch: Partial<T>) => {
    onChange(list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-4">
      {list.length === 0 && emptyLabel && (
        <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      {list.map((item, index) => (
        <Card key={keys.current[index]}>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold">{itemLabel(index)}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={removeLabel}
                onClick={() => removeAt(index)}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                {removeLabel}
              </Button>
            </div>
            {renderItem(item, (patch) => updateAt(index, patch), index)}
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full gap-1.5">
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm test src/components/form/Repeater.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 5: Rodar toda a suíte e o typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS em tudo. As 7 primitivas estão prontas.

- [ ] **Step 6: Commit**

```bash
git add src/components/form/Repeater.tsx src/components/form/Repeater.test.tsx
git commit -m "feat(form): add Repeater with stable keys for id-less items"
```

---

## Task 10: Contrato do backend — union discriminada por seção

**Files (repo `aurea/back`):**
- Modify: `src/http/api/business/update-section/update-section.schema.ts`
- Modify: `src/http/api/business/update-section/update-section.controller.ts:22-71`
- Modify: `src/http/api/business/update-section/update-section.service.ts`
- Test: `src/http/api/business/update-section/update-section.schema.test.ts`

**Interfaces:**
- Consumes: `businessContextDataSchema` de `../business-context-data.schema.js`.
- Produces: `updateSectionBody` como `z.discriminatedUnion('section', …)`; tipo `UpdateSectionBody` como union discriminada. `UpdateSectionInput.data` deixa de ser `unknown`. Consumido pela Task 11 (geração do Zod do frontend).

**Por que:** hoje o schema da rota declara `data: z.unknown()` e o controller faz `.parse()` dentro do handler (`:34-63`). O `ZodError` cru que isso lança não casa com `hasZodFastifySchemaValidationErrors` em `src/plugins/error-handler.ts:21`, não é `AppError`, e cai no fallback da linha 42 — **payload de seção inválido devolve HTTP 500 em vez de 400**. Mover a validação para o schema da rota conserta o status e faz o OpenAPI carregar a forma real.

- [ ] **Step 1: Escrever o teste que falha**

Criar `back/src/http/api/business/update-section/update-section.schema.test.ts`. É o primeiro teste do repo `back`; `vitest` já está em devDependencies e `pnpm test` já roda `vitest run`.

```ts
import { describe, expect, it } from 'vitest';
import { updateSectionBody } from './update-section.schema.js';

describe('updateSectionBody', () => {
  it('accepts a valid company payload', () => {
    const parsed = updateSectionBody.parse({
      section: 'company',
      data: { mission: 'Democratizar crescimento', values: ['foco'] },
    });
    expect(parsed.section).toBe('company');
  });

  it('rejects a company payload with a wrongly typed field', () => {
    const result = updateSectionBody.safeParse({
      section: 'company',
      data: { foundedYear: 'mil novecentos' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a products payload that is not an array', () => {
    const result = updateSectionBody.safeParse({
      section: 'products',
      data: { name: 'Plano Pro' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a product without the required name', () => {
    const result = updateSectionBody.safeParse({
      section: 'products',
      data: [{ id: 'p1', description: 'sem nome' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown section', () => {
    const result = updateSectionBody.safeParse({ section: 'finance', data: {} });
    expect(result.success).toBe(false);
  });

  it('narrows data by section on the inferred type', () => {
    const parsed = updateSectionBody.parse({
      section: 'products',
      data: [{ id: 'p1', name: 'Pro', description: 'plano' }],
    });
    if (parsed.section === 'products') {
      // Se `data` ainda fosse `unknown`, esta linha não compilaria.
      expect(parsed.data[0]!.name).toBe('Pro');
    }
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `cd /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/back && pnpm test`
Expected: FAIL. Os casos de rejeição passam vazio porque `z.unknown()` aceita tudo, e o último caso não compila.

- [ ] **Step 3: Reescrever o schema**

Substituir todo o conteúdo de `src/http/api/business/update-section/update-section.schema.ts` por:

```ts
import { z } from 'zod';
import { businessContextDataSchema } from '../business-context-data.schema.js';

const shape = businessContextDataSchema.shape;

/**
 * Corpo de PUT /business/context/section.
 *
 * A união discriminada faz a validação acontecer na camada de schema do Fastify,
 * não dentro do handler. Isso importa por dois motivos: um ZodError lançado no
 * handler não casa com `hasZodFastifySchemaValidationErrors` no error handler e
 * viraria HTTP 500, e o OpenAPI passa a carregar a forma real de cada seção —
 * que é o que permite gerar os schemas Zod do frontend com o Kubb.
 */
export const updateSectionBody = z.discriminatedUnion('section', [
  z.object({ section: z.literal('company'), data: shape.companyProfile }),
  z.object({ section: z.literal('products'), data: shape.products }),
  z.object({ section: z.literal('competitive'), data: shape.competitiveLandscape }),
  z.object({ section: z.literal('market'), data: shape.marketContext }),
  z.object({ section: z.literal('constraints'), data: shape.constraints }),
  z.object({ section: z.literal('performance'), data: shape.currentPerformance }),
  z.object({ section: z.literal('activities'), data: shape.currentActivities }),
  z.object({ section: z.literal('projects'), data: shape.projects }),
  z.object({ section: z.literal('campaigns'), data: shape.campaigns }),
]);

export type UpdateSectionBody = z.infer<typeof updateSectionBody>;
export type ContextSectionKey = UpdateSectionBody['section'];
```

Os 9 `*SectionSchema` envelopados saem — o envelope existia só para o controller desembrulhar em seguida.

- [ ] **Step 4: Enxugar o controller**

Substituir todo o conteúdo de `src/http/api/business/update-section/update-section.controller.ts` por:

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createBusinessRepository } from '../business.repository.js';
import { presentContextVersion } from '../business.presenter.js';
import { contextVersionResponse } from '../business.schema.js';
import { updateSectionService } from './update-section.service.js';
import { updateSectionBody } from './update-section.schema.js';

export const updateSectionRoute: FastifyPluginAsync = async (app) => {
  app.withTypeProvider<ZodTypeProvider>().put(
    '/business/context/section',
    {
      schema: {
        tags: ['business'],
        operationId: 'updateBusinessContextSection',
        body: updateSectionBody,
        response: { 200: contextVersionResponse },
      },
    },
    async (req, reply) => {
      // Nada de .parse() aqui: o schema da rota já validou e estreitou o body,
      // e um erro nele volta como 400 VALIDATION com details por campo.
      const service = updateSectionService({ repo: createBusinessRepository(app.prisma) });
      const version = await service({
        workspaceId: req.tenant.workspaceId,
        userId: req.tenant.userId,
        body: req.body,
      });

      return reply.send({ version: presentContextVersion(version) });
    },
  );
};
```

`InvalidSectionError` deixa de ser importada aqui — a union já rejeita seção desconhecida antes do handler. Deixar a classe em `src/lib/errors.ts` intocada; o service ainda a referencia no caso impossível.

- [ ] **Step 5: Estreitar o service**

Substituir todo o conteúdo de `src/http/api/business/update-section/update-section.service.ts` por:

```ts
import type { ContextSource, ConfidenceLevel } from '@prisma/client';
import { NotFoundError } from '../../../../lib/errors.js';
import type { BusinessRepository } from '../business.repository.js';
import type { BusinessContextData } from '../business-context-data.schema.js';
import type { UpdateSectionBody } from './update-section.schema.js';

export type UpdateSectionDeps = { repo: BusinessRepository };
export type UpdateSectionInput = {
  workspaceId: string;
  userId: string;
  body: UpdateSectionBody;
};

/** Em qual campo do contexto cada seção grava. */
const SECTION_FIELD = {
  company: 'companyProfile',
  products: 'products',
  competitive: 'competitiveLandscape',
  market: 'marketContext',
  constraints: 'constraints',
  performance: 'currentPerformance',
  activities: 'currentActivities',
  projects: 'projects',
  campaigns: 'campaigns',
} as const satisfies Record<UpdateSectionBody['section'], keyof BusinessContextData>;

export function updateSectionService(deps: UpdateSectionDeps) {
  return async ({ workspaceId, userId, body }: UpdateSectionInput) => {
    const business = await deps.repo.getByWorkspace(workspaceId);
    if (!business) throw new NotFoundError('No business in this workspace');

    const context = await deps.repo.getContext(business.id);
    const currentData = (context?.currentVersion?.data as BusinessContextData) ?? {};

    const updatedData: BusinessContextData = {
      ...currentData,
      [SECTION_FIELD[body.section]]: body.data,
      lastReviewedAt: new Date().toISOString(),
    };

    return deps.repo.addContextVersion(business.id, {
      data: updatedData,
      source: 'USER' as ContextSource,
      confidence: 'MEDIUM' as ConfidenceLevel,
      createdBy: userId,
    });
  };
}
```

O `switch` de 9 casos com cast `as` por caso vira uma indexação, e o `updatedData.lastReviewedAt = …` que mutava o objeto vira parte do literal.

- [ ] **Step 6: Rodar o teste**

Run: `pnpm test`
Expected: PASS, 6 testes.

- [ ] **Step 7: Typecheck do backend**

Run: `pnpm typecheck`
Expected: sem erro. Se `addContextVersion` reclamar do tipo de `data`, é o `Prisma.InputJsonValue` — envolver com `as Prisma.InputJsonValue` importando `Prisma` de `@prisma/client`, nunca com `as any`.

- [ ] **Step 8: Verificar o status HTTP na prática**

Run (com a infra local de pé, `pnpm infra:up`, e um token válido em `$TOKEN`):
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PUT http://localhost:3333/business/context/section \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"section":"company","data":{"foundedYear":"mil novecentos"}}'
```
Expected: `400`. Antes desta task o mesmo request devolvia `500`.

- [ ] **Step 9: Commit**

```bash
git add src/http/api/business/update-section/
git commit -m "fix(business): validate context section at the route schema

O payload da seção era validado dentro do handler com .parse(). O ZodError
cru não casa com hasZodFastifySchemaValidationErrors no error handler e caía
no fallback de 500, então payload inválido devolvia HTTP 500 em vez de 400
sem detalhe de campo.

Trocado por union discriminada em `section` no schema da rota: o Fastify
passa a produzir o erro, o cliente recebe 400 VALIDATION com details, e o
OpenAPI passa a carregar a forma real de cada seção."
```

---

## Task 11: Gerar os schemas Zod do frontend

**Files (repo `aurea/web`):**
- Modify: `kubb.config.ts`
- Modify: `api.json` (regerado)
- Modify: `package.json` (dep `@kubb/plugin-zod`)
- Create (gerado): `src/api/generated/zod/**`

**Interfaces:**
- Consumes: o OpenAPI produzido pela Task 10.
- Produces: schemas Zod gerados para o corpo de `updateBusinessContextSection`. As Tasks 15–24 consomem o schema da seção que estão migrando. **O nome exato do export é descoberto no Step 5** — o Kubb deriva de `operationId` e do nome do schema, e adivinhar aqui seria plantar uma referência quebrada.

**Risco conhecido:** o back usa zod 3, o web usa zod 4. Se a saída do `plugin-zod` não compilar contra zod 4, o Step 6 documenta o fallback.

- [ ] **Step 1: Regerar o OpenAPI no backend**

```bash
cd /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/back
pnpm openapi:dump
```

- [ ] **Step 2: Confirmar que a forma da seção apareceu**

Run:
```bash
node -e "const s=require('./api.json');const b=s.paths['/business/context/section'].put.requestBody.content['application/json'].schema;console.log(JSON.stringify(b).slice(0,300))"
```
Expected: `anyOf` (ou `oneOf`) com 9 alternativas. Se ainda aparecer `{}` ou `data` sem tipo, a Task 10 não foi aplicada.

- [ ] **Step 3: Copiar o OpenAPI para o web**

```bash
cp /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/back/api.json \
   /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/web/api.json
```

- [ ] **Step 4: Adicionar o plugin Zod ao Kubb**

```bash
cd /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/web
pnpm add -D @kubb/plugin-zod
```

Substituir `kubb.config.ts` por:

```ts
import { defineConfig } from '@kubb/core';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginReactQuery } from '@kubb/plugin-react-query';
import { pluginTs } from '@kubb/plugin-ts';
import { pluginZod } from '@kubb/plugin-zod';

// Gera types + schemas Zod + hooks TanStack Query a partir do OpenAPI do backend.
// Fluxo: `pnpm openapi:dump` no repo aurea/back -> copiar api.json para cá ->
// `pnpm api:generate`.
export default defineConfig({
  root: '.',
  input: { path: 'api.json' },
  output: { path: './src/api/generated', clean: true },
  plugins: [
    pluginOas(),
    pluginTs({ output: { path: './types' }, dateType: 'date', enumType: 'asConst' }),
    pluginZod({ output: { path: './zod' }, typed: true }),
    pluginReactQuery({
      output: { path: './hooks' },
      client: { importPath: '@/api/client', dataReturnType: 'data' },
      query: { methods: ['get'], importPath: '@tanstack/react-query' },
      mutation: { methods: ['post', 'put', 'patch', 'delete'] },
      group: { type: 'tag', name: ({ group }) => `${group}Hooks` },
    }),
  ],
});
```

- [ ] **Step 5: Gerar e descobrir os nomes dos exports**

```bash
pnpm api:generate
ls src/api/generated/zod | head -40
grep -rl "updateBusinessContextSection" src/api/generated/zod
```

Anotar o nome exato do export do corpo da mutation e dos 9 objetos de seção. As tasks seguintes usam esses nomes.

- [ ] **Step 6: Typecheck — este é o ponto de decisão do risco**

Run: `pnpm typecheck`

Se passar: seguir para o Step 7.

Se falhar com erro de API do zod (`z.string().min` não existe, `ZodType` incompatível, etc.), a saída do plugin não casa com zod 4. Nesse caso:

1. Tentar a opção de versão do plugin: `pluginZod({ output: { path: './zod' }, typed: true, version: '4' })`, regerar, typecheck de novo.
2. Se ainda falhar, **executar o fallback**: remover `pluginZod` do `kubb.config.ts`, regerar, e escrever à mão `src/schemas/business-context.ts` espelhando `back/src/http/api/business/business-context-data.schema.ts` — 9 schemas exportados como `companySectionSchema`, `productsSectionSchema`, `competitiveSectionSchema`, `marketSectionSchema`, `constraintsSectionSchema`, `performanceSectionSchema`, `activitiesSectionSchema`, `projectsSectionSchema`, `campaignsSectionSchema`, cada um validando a fatia crua (não envelopada). Registrar no commit que é duplicação consciente e por quê.

Nos dois caminhos as tasks seguintes têm 9 schemas de seção para consumir; só muda a origem.

- [ ] **Step 7: Rodar a suíte**

Run: `pnpm test`
Expected: PASS — nada foi quebrado pelos arquivos gerados.

- [ ] **Step 8: Commit**

```bash
git add kubb.config.ts package.json pnpm-lock.yaml api.json src/api/generated src/schemas
git commit -m "feat(api): generate zod schemas for business context sections"
```

---

## Task 12: IcpNewPage — primitivas e fim do CSV

**Files:**
- Modify: `src/pages/IcpNewPage.tsx`
- Modify: `src/schemas/icps.ts`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `TextField` (Task 4), `TagsField` (Task 8).
- Produces: nada consumido por tasks seguintes. `IcpFormValues.painPoints` deixa de ser `string` e passa a ser `string[]`.

**Por que:** `IcpNewPage.tsx:43-46` faz `.split(',')` no campo `painPoints`. Uma dor de cliente com vírgula ("preço alto, sem previsibilidade") vira dois itens errados.

- [ ] **Step 1: Ler o schema atual**

Run: `cat src/schemas/icps.ts`

Anotar o formato das mensagens de erro — o page passa `errors.name.message` para `t()`, então as mensagens são chaves de i18n.

- [ ] **Step 2: Trocar painPoints para array no schema**

Em `src/schemas/icps.ts`, o campo `painPoints` passa de string para `z.array(z.string().min(1)).default([])`. Manter as mensagens de erro como chaves de i18n, no mesmo formato das existentes.

- [ ] **Step 3: Reescrever o form usando as primitivas**

Em `src/pages/IcpNewPage.tsx`, substituir o `<form>` (linhas 60-85) por campos com `Controller` do react-hook-form. Trecho central:

```tsx
<form onSubmit={onSubmit} className="space-y-5">
  <div className="grid gap-5 sm:grid-cols-2">
    <Controller
      control={control}
      name="name"
      render={({ field, fieldState }) => (
        <TextField
          htmlFor="icp-name"
          label={t('pages.icps.name')}
          help={t('pages.icps.nameHelp')}
          placeholder={t('pages.icps.namePh')}
          value={field.value}
          onChange={field.onChange}
          error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
        />
      )}
    />
    <Controller
      control={control}
      name="description"
      render={({ field }) => (
        <TextField
          htmlFor="icp-desc"
          label={t('pages.icps.description')}
          optional
          optionalLabel={t('common.optional')}
          value={field.value}
          onChange={field.onChange}
        />
      )}
    />
  </div>

  <Controller
    control={control}
    name="painPoints"
    render={({ field }) => (
      <TagsField
        htmlFor="icp-pain"
        label={t('pages.icps.painPoints')}
        help={t('pages.icps.painPointsHelp')}
        placeholder={t('pages.icps.painPointsPh')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        value={field.value}
        onChange={field.onChange}
      />
    )}
  />
  {/* botões inalterados */}
</form>
```

E o `onSubmit` (linhas 38-49) perde o `.split(',')`:

```tsx
const onSubmit = handleSubmit((values) => {
  create.mutate({
    data: {
      name: values.name,
      description: values.description || undefined,
      painPoints: values.painPoints,
    },
  });
});
```

Ajustar `defaultValues` para `{ name: '', description: '', painPoints: [] }` e trocar `register` por `control` no `useForm`.

- [ ] **Step 4: Adicionar as chaves de i18n novas**

Nos 3 locales, adicionar: `common.add`, `common.removeItem` (com interpolação `{{item}}`), `pages.icps.nameHelp`, `pages.icps.painPointsHelp`. As duas chaves de help satisfazem a regra 2 de `CLAUDE.md` — "ICP" e "dores" são termos de domínio.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: sem erro.

- [ ] **Step 6: Verificar a paridade dos locales**

Run: o mesmo comando do Step 6 da Task 6.
Expected: três contagens idênticas e `iguais: true`.

- [ ] **Step 7: Verificar no navegador**

Run: `pnpm dev`, abrir `http://localhost:5173/app/icps/new`. Criar um ICP com uma dor que contém vírgula ("preço alto, sem previsibilidade"). Confirmar que salva como **um** item na lista, não dois.

- [ ] **Step 8: Commit**

```bash
git add src/pages/IcpNewPage.tsx src/schemas/icps.ts src/i18n/locales
git commit -m "refactor(icps): use form primitives; pain points are a tag list, not CSV"
```

---

## Task 13: GoalNewPage — primitivas

**Files:**
- Modify: `src/pages/GoalNewPage.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `TextField` (Task 4), `NumberField` (Task 5).
- Produces: nada consumido adiante.

- [ ] **Step 1: Substituir os campos pelas primitivas**

Em `src/pages/GoalNewPage.tsx`, trocar os 4 blocos `space-y-2` + `Label` + `Input` (linhas 63-85) por `Controller` + primitiva. `targetValue` usa `NumberField` — hoje é `Input type="number"` registrado como string e convertido no submit (`:45`), o que espalha a coerção.

Trecho central:

```tsx
<Controller
  control={control}
  name="name"
  render={({ field, fieldState }) => (
    <TextField
      htmlFor="goal-name"
      label={t('pages.goals.name')}
      placeholder={t('pages.goals.namePh')}
      value={field.value}
      onChange={field.onChange}
      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
    />
  )}
/>

<div className="grid gap-5 sm:grid-cols-3">
  <Controller
    control={control}
    name="metric"
    render={({ field, fieldState }) => (
      <TextField
        htmlFor="goal-metric"
        label={t('pages.goals.metric')}
        help={t('pages.goals.metricHelp')}
        helpTitle={t('pages.goals.metricHelpTitle')}
        placeholder={t('pages.goals.metricPh')}
        value={field.value}
        onChange={field.onChange}
        error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
      />
    )}
  />
  <Controller
    control={control}
    name="targetValue"
    render={({ field }) => (
      <NumberField
        htmlFor="goal-target"
        label={t('pages.goals.target')}
        optional
        optionalLabel={t('common.optional')}
        placeholder="1000"
        value={field.value}
        onChange={field.onChange}
      />
    )}
  />
  <Controller
    control={control}
    name="unit"
    render={({ field }) => (
      <TextField
        htmlFor="goal-unit"
        label={t('pages.goals.unit')}
        optional
        optionalLabel={t('common.optional')}
        placeholder={t('pages.goals.unitPh')}
        value={field.value}
        onChange={field.onChange}
      />
    )}
  />
</div>
```

- [ ] **Step 2: Ajustar o schema e o submit**

Em `src/schemas/goals.ts`, `targetValue` passa de `string` para `z.number().positive().optional()`. Em `GoalNewPage.tsx`, `defaultValues.targetValue` passa a ser `undefined`, e o submit (linha 45) perde o `? Number(...) : undefined` — o valor já chega número.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: sem erro.

- [ ] **Step 4: Verificar no navegador**

Run: `pnpm dev`, `http://localhost:5173/app/goals/new`. Criar goal sem `targetValue` (deve salvar), depois com valor, depois digitar e apagar o valor (deve salvar como vazio, não como 0).

- [ ] **Step 5: Commit**

```bash
git add src/pages/GoalNewPage.tsx src/schemas/goals.ts
git commit -m "refactor(goals): use form primitives; target value is a real number"
```

---

## Task 14: StrategyNewPage — fim do select cru

**Files:**
- Modify: `src/pages/StrategyNewPage.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `TextField` (Task 4), `SelectField` (Task 7), `Select` (Task 2).
- Produces: nada consumido adiante.

**Por que:** `StrategyNewPage.tsx:79-90` é um `<select>` cru com classes duplicadas do `Input`. É a segunda variante divergente do padrão (a outra está em `ProductsStep.tsx:148`, sem focus ring).

- [ ] **Step 1: Trocar o select cru por SelectField**

O select de goal é dinâmico (vem de `useListGoals`), não é enum — então as opções são montadas na hora em vez de vir de `lib/enums.ts`:

```tsx
<Controller
  control={control}
  name="goalId"
  render={({ field, fieldState }) => (
    <SelectField
      htmlFor="strategy-goal"
      label={t('pages.strategies.goal')}
      help={t('pages.strategies.goalHelp')}
      placeholder={t('pages.strategies.goalSelect')}
      value={field.value || undefined}
      onChange={(v) => field.onChange(v ?? '')}
      options={goals.map((g) => ({ value: g.id, labelKey: g.name }))}
      translate={(label) => label}
      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
    />
  )}
/>
```

`translate` é identidade aqui porque `g.name` já é texto do usuário, não chave.

- [ ] **Step 2: Trocar os dois campos de texto**

`name` e `growthMechanism` viram `TextField` com `Controller`, seguindo o padrão da Task 13. `growthMechanism` mantém o `Help` que já existe (`:96-98`).

- [ ] **Step 3: Adicionar as chaves de i18n**

Nos 3 locales: `pages.strategies.goalSelect` (o placeholder, hoje o literal `—` na linha 84) e `pages.strategies.goalHelp`.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: sem erro.

- [ ] **Step 5: Verificar no navegador, incluindo teclado e dark mode**

Run: `pnpm dev`, `http://localhost:5173/app/strategies/new`. Abrir o select só com teclado (Tab até ele, Enter, setas, Enter). Alternar o tema e confirmar que o menu aberto tem contraste nos dois.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StrategyNewPage.tsx src/i18n/locales
git commit -m "refactor(strategies): replace raw select with SelectField"
```

---

## Task 15: BusinessContextSectionPage sobre react-hook-form

**Files:**
- Modify: `src/pages/BusinessContextSectionPage.tsx`

**Interfaces:**
- Consumes: os schemas de seção da Task 11.
- Produces: **contrato de props dos steps, inalterado** — `{ data: BusinessContextData; onChange: (patch: Partial<BusinessContextData>) => void; errors?: FieldErrors }`. As Tasks 16–24 dependem disso.

**Por que agora, antes dos steps:** a página passa a ser a dona do form. Se os steps fossem migrados primeiro e a página depois, cada step seria reescrito duas vezes. Mantendo o contrato de props idêntico, cada step migra numa passada só.

- [ ] **Step 1: Trocar o useState do draft por useForm**

Substituir `draft`/`setDraft`/`dirty` (linhas 63-64) por `useForm` com o schema da seção atual. `watch()` alimenta `data`; `setValue` implementa `onChange`; `formState.isDirty` substitui `dirty`; `formState.errors` desce para o step.

```tsx
const form = useForm<BusinessContextData>({
  resolver: zodResolver(sectionSchemaFor(section)),
  defaultValues: EMPTY_CONTEXT_DATA,
});
const draft = form.watch();

const onChange = (patch: Partial<BusinessContextData>) => {
  for (const [key, value] of Object.entries(patch)) {
    form.setValue(key as keyof BusinessContextData, value, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }
};
```

`sectionSchemaFor` é um mapa local de `ContextSection` para o schema da Task 11 — nomes exatos vêm do Step 5 daquela task.

- [ ] **Step 2: Semear o form com o contexto salvo**

O `useEffect` de `loaded` (linhas 69-73) passa a chamar `form.reset({ ...EMPTY_CONTEXT_DATA, ...remote })`. O comentário das linhas 84-85 ("Step components seed their own state from `data` on mount") é apagado — deixa de ser verdade a partir da Task 16 e manter o comentário obsoleto é pior que não ter comentário.

- [ ] **Step 3: Validar antes de salvar**

`persist` (linhas 106-108) passa a rodar por `form.handleSubmit`, para o save ser bloqueado por dado inválido em vez de virar 400:

```tsx
const persist = () =>
  new Promise<void>((resolve, reject) => {
    void form.handleSubmit(
      async (values) => {
        await save.mutateAsync({
          data: { section, data: values[SECTION_FIELD[section]] },
        });
        resolve();
      },
      () => reject(new Error('validation')),
    )();
  });
```

`saveAndGo` (linhas 110-117) já engole a exceção e não navega — comportamento correto para dado inválido, mantido.

- [ ] **Step 4: Passar os erros para o step**

Cada `<XStep data={draft} onChange={onChange} />` no `renderStep` (linhas 119-140) ganha `errors={form.formState.errors}`.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: sem erro. Os steps ainda têm `useState` interno neste ponto — funciona, porque nada altera o draft de fora ainda.

- [ ] **Step 6: Verificar que nada regrediu**

Run: `pnpm dev`. Abrir 3 seções diferentes, preencher, salvar, recarregar. Comportamento igual ao de antes.

- [ ] **Step 7: Commit**

```bash
git add src/pages/BusinessContextSectionPage.tsx
git commit -m "refactor(business): drive context section page with react-hook-form"
```

---

## Tasks 16–24: migrar os 9 steps

As nove tasks seguem a **mesma receita**. Cada uma é independente e commitável sozinha; um step migrado conviver com oito não migrados funciona, porque o contrato de props não muda.

**Por que estas nove tasks são especificadas em vez de codificadas:** ao escrever
este plano só `CompanyStep.tsx` e `ProductsStep.tsx` foram lidos por inteiro. Colar
TSX literal para os outros sete seria invenção, não plano — o código divergiria do
arquivo real e o implementador acabaria depurando a diferença. Em vez disso cada
task nomeia exatamente quais campos usam qual primitiva, qual lista de enum, quais
props tem o subcomponente extraído, e o que verificar. As interfaces das primitivas
estão inteiras nas Tasks 3–9, com tipos de prop exatos. O **Step 0 abaixo é
obrigatório**: ler o arquivo antes de mexer nele.

**Receita por step:**

0. **Ler o arquivo inteiro** e o slice correspondente em `src/types/business-context.ts`. Anotar quais campos existem, quais têm `Help`, e quais chaves de i18n são usadas. Nada de editar às cegas.
1. Remover o `useState` e a função `update` local. Ler de `data.<slice>`, escrever com `onChange({ <slice>: { ...data.<slice>, ...patch } })`.
2. Trocar cada bloco `space-y-2` + `Label` + `Help` + input pela primitiva: `TextField`, `TextAreaField`, `NumberField`, `SelectField`, `TagsField`.
3. Trocar cada `<select>` cru por `SelectField` com a lista de `src/lib/enums.ts`.
4. Trocar cada array de string escrito à mão por `TagsField`.
5. Trocar cada array de objeto por `Repeater`, extraindo o corpo do item para um componente próprio quando passar de ~40 linhas.
0b. **Dois fatos novos, descobertos depois do plano original, que mudam como o step lê dados e erros:**

   - **Mensagem de erro é chave + params.** As mensagens não vêm mais do schema (que agora é
     gerado e não carrega i18n). O `zodIssuesToErrors` mapeia o *código* da issue do Zod para
     chave, e anexa `params` com o detalhe (mínimo, máximo, tipo esperado). Então o step chama
     `t(message, params)`, **não** `t(message)`. Sem os params, uma mensagem como "no mínimo
     {{minimum}}" aparece com o placeholder cru na tela.
   - **Arrays podem ser `undefined`.** Os schemas gerados não têm o `.default([])` que os
     escritos à mão tinham, porque espelham o contrato do backend. `TagsField` e `Repeater` já
     tratam `undefined` como lista vazia, então isso não quebra — mas não presuma array
     presente ao ler `data.<slice>`.

6. Aceitar `errors?: FieldErrors<BusinessContextData>` e passar `error` para **cada** primitiva.
   **Sem exceção**, mesmo em campo cujo schema hoje não produz erro alcançável. A Task 13
   provou o custo de pular: o snippet do brief omitiu `fieldState` no `targetValue`, o
   schema ganhou `.positive()`, e o resultado foi botão de salvar que não faz nada — sem
   mensagem, sem mutation. Se a primitiva não recebe `error`, o `zodResolver` rejeita em
   silêncio. Todo campo com constraint numérica também recebe `min`/`max`, para o controle
   impedir a entrada inválida antes da validação.
7. Remover as chaves de i18n que ficaram órfãs (as `wizard.*.pricingModel*` etc. viraram `enums.*` na Task 6) nos 3 locales.
8. `pnpm typecheck` && `pnpm test`, verificar a seção no navegador, commitar.

**Gate comum a todas:** o arquivo resultante fica abaixo de ~120 linhas. Se não ficar, falta extrair subcomponente.

### Task 16: CompanyStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/CompanyStep.tsx` (209 linhas)
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `TextField`, `TextAreaField`, `NumberField`, `SelectField`, `TagsField`, `FUNDING_STAGE_OPTIONS`.
- Produces: nada.

Campos: `foundedYear` (NumberField, min 1900 max 2099), `headquarters` (TextField), `employeeCount` (NumberField, min 1), `fundingStage` (SelectField + `FUNDING_STAGE_OPTIONS`), `mission`/`vision`/`brandVoice` (TextAreaField), `values` (TagsField). `LogoUpload` e `FileUpload` ficam como estão.

- [ ] **Step 1: Remover o `useState` e o `addValue`** (linhas 18-31). O bloco `values` (linhas 157-200) vira um `TagsField` — isso é o que mata o `document.getElementById` das linhas 191-195.
- [ ] **Step 2: Migrar os 8 campos** para as primitivas, seguindo a receita.
- [ ] **Step 3: Remover as chaves `wizard.company.fundingStage*`** dos 3 locales (as opções agora vêm de `enums.fundingStage.*`). Manter `wizard.company.fundingStage` (o rótulo) e `wizard.company.fundingStageSelect` (o placeholder).
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 5:** Run `pnpm dev`, `/app/business/context/company`. Adicionar 2 valores, remover o primeiro, salvar, recarregar, confirmar. Verificar dark mode no select de estágio.
- [ ] **Step 6:** Verificar a paridade dos locales com o comando do Step 6 da Task 6.
- [ ] **Step 7: Commit** — `git commit -m "refactor(wizard): migrate CompanyStep to form primitives"`

### Task 17: ProductsStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/ProductsStep.tsx` (204 linhas)
- Create: `src/components/BusinessContextWizard/steps/ProductCard.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `Repeater`, `TextField`, `TextAreaField`, `SelectField`, `PRICING_MODEL_OPTIONS`, `PRODUCT_STATUS_OPTIONS`, `EMPTY_PRODUCT`, `nanoid`.
- Produces: `ProductCard` com props `{ product: Product; update: (patch: Partial<Product>) => void; index: number }`.

- [ ] **Step 1:** `ProductsStep` fica sendo só o `Repeater` e o texto de intro. `newItem` = `() => ({ id: nanoid(), ...EMPTY_PRODUCT })`.
- [ ] **Step 2:** Extrair os 7 campos do produto para `ProductCard.tsx`. Os dois `<select>` (linhas 140-157 e 177-187) viram `SelectField` com `PRICING_MODEL_OPTIONS` e `PRODUCT_STATUS_OPTIONS`.
- [ ] **Step 3: Remover o `dangerouslySetInnerHTML`** (linha 199). A string `wizard.products.tip` tem `<strong>`; substituir por `<Trans i18nKey="wizard.products.tip" components={{ strong: <strong /> }} />` e ajustar a string nos 3 locales para usar `<strong>` como tag de componente do `<Trans>`.
- [ ] **Step 4: Remover as chaves `wizard.products.pricingModel*` e `wizard.products.status*`** dos 3 locales (viraram `enums.*`), mantendo os rótulos e placeholders.
- [ ] **Step 5:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 6:** Run `pnpm dev`, `/app/business/context/products`. Adicionar 3 produtos, digitar nome em cada, remover o do meio, e **confirmar que os nomes dos outros dois não saltaram de linha** — é o comportamento que as keys estáveis do `Repeater` garantem.
- [ ] **Step 7: Commit** — `git commit -m "refactor(wizard): migrate ProductsStep to Repeater + primitives"`

### Task 18: CompetitiveStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/CompetitiveStep.tsx` (243 linhas)
- Create: `src/components/BusinessContextWizard/steps/CompetitorCard.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `Repeater`, `TextField`, `TextAreaField`, `SelectField`, `TagsField`, `MARKET_SHARE_OPTIONS`, `MARKET_POSITION_OPTIONS`, `EMPTY_COMPETITOR`.
- Produces: `CompetitorCard` com props `{ competitor: Competitor; update: (patch: Partial<Competitor>) => void; index: number }`.

- [ ] **Step 1:** Nível do step: `ourDifferentiator` (TextAreaField), `marketPosition` (SelectField), `competitiveAdvantages` e `threatsFromCompetitors` (TagsField), e o `Repeater` de `competitors`.
- [ ] **Step 2:** `CompetitorCard`: `name`, `url` (TextField), `pricing`, `positioning` (TextField), `marketShare` (SelectField), `strengths` e `weaknesses` (TagsField).
- [ ] **Step 3:** Remover as chaves de opção órfãs dos 3 locales.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 5:** Run `pnpm dev`, `/app/business/context/competitive`. Adicionar concorrente com 2 forças e 2 fraquezas, salvar, recarregar.
- [ ] **Step 6: Commit** — `git commit -m "refactor(wizard): migrate CompetitiveStep to Repeater + primitives"`

### Task 19: MarketStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/MarketStep.tsx` (233 linhas)
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `NumberField`, `SelectField`, `TagsField`, `MATURITY_OPTIONS`.
- Produces: nada.

- [ ] **Step 1:** `tam`, `sam`, `som`, `marketGrowthRate` viram `NumberField`. TAM/SAM/SOM são termos de domínio — cada um mantém ou ganha `Help` (regra 2 de `CLAUDE.md`).
- [ ] **Step 2:** `trends`, `opportunities`, `threats` viram `TagsField`. `maturity` vira `SelectField`.
- [ ] **Step 3:** Remover chaves de opção órfãs dos 3 locales; adicionar as chaves de help que faltarem para TAM/SAM/SOM.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 5:** Run `pnpm dev`, `/app/business/context/market`. Preencher TAM, apagar, confirmar que salva vazio e não como 0.
- [ ] **Step 6: Commit** — `git commit -m "refactor(wizard): migrate MarketStep to form primitives"`

### Task 20: ConstraintsStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/ConstraintsStep.tsx` (215 linhas)
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `NumberField`, `SelectField`, `TagsField`, `URGENCY_OPTIONS`.
- Produces: nada.

- [ ] **Step 1:** `monthlyGrowthBudget`, `teamSize`, `growthTeamSize` viram `NumberField`. `urgency` vira `SelectField`.
- [ ] **Step 2:** `technicalCapabilities`, `limitations`, `regulatoryConstraints` viram `TagsField`.
- [ ] **Step 3:** Remover chaves de opção órfãs dos 3 locales.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 5:** Run `pnpm dev`, `/app/business/context/constraints`. Preencher, salvar, recarregar.
- [ ] **Step 6: Commit** — `git commit -m "refactor(wizard): migrate ConstraintsStep to form primitives"`

### Task 21: PerformanceStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/PerformanceStep.tsx` (331 linhas — o maior)
- Create: `src/components/BusinessContextWizard/steps/ChannelsRepeater.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `NumberField`, `TextField`, `Repeater`.
- Produces: `ChannelsRepeater` com props `{ channels: ChannelPerformance[]; onChange: (channels: ChannelPerformance[]) => void }`.

- [ ] **Step 1:** As 11 métricas escalares (`mrr`, `arr`, `totalCustomers`, `activeCustomers`, `churnRate`, `monthlySignups`, `cac`, `ltv`, `ltvCacRatio`, `conversionRate`, `timeToConvert`) viram `NumberField` em grid. CAC, LTV e a razão LTV:CAC são termos de domínio e mantêm `Help`.
- [ ] **Step 2:** Extrair `channels` para `ChannelsRepeater.tsx` usando `Repeater`. `ChannelPerformance` **não tem `id`** (`types/business-context.ts:82`) — é exatamente o caso que as keys internas do `Repeater` resolvem. `newItem` = `() => ({ channel: '' })`.
- [ ] **Step 3:** `baselineDate` vira `TextField type="date"` (a prop existe desde a Task 4).
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 5:** Confirmar o tamanho: `wc -l src/components/BusinessContextWizard/steps/PerformanceStep.tsx src/components/BusinessContextWizard/steps/ChannelsRepeater.tsx` — Expected: ambos abaixo de ~120.
- [ ] **Step 6:** Run `pnpm dev`, `/app/business/context/performance`. Adicionar 2 canais, editar o primeiro, remover o segundo, salvar, recarregar.
- [ ] **Step 7: Commit** — `git commit -m "refactor(wizard): split PerformanceStep and extract ChannelsRepeater"`

### Task 22: ActivitiesStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/ActivitiesStep.tsx` (271 linhas)
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `NumberField`, `TagsField`.
- Produces: nada.

- [ ] **Step 1:** `activeChannels`, `partnerships`, `other` viram `TagsField`. `paidAdvertising.platforms` também.
- [ ] **Step 2:** `contentProduction.{blogPostsPerMonth,socialPostsPerWeek,emailCampaignsPerMonth}` e `paidAdvertising.monthlySpend` viram `NumberField`. Atenção: são objetos aninhados opcionais — o patch precisa preservar o irmão, ex. `onChange({ currentActivities: { ...activities, contentProduction: { ...activities.contentProduction, blogPostsPerMonth: v } } })`.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 4:** Run `pnpm dev`, `/app/business/context/activities`. Preencher um campo de `contentProduction` e um de `paidAdvertising`, salvar, recarregar, **confirmar que os dois persistiram** — é onde o patch aninhado erra com facilidade.
- [ ] **Step 5: Commit** — `git commit -m "refactor(wizard): migrate ActivitiesStep to form primitives"`

### Task 23: ProjectsStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/ProjectsStep.tsx` (290 linhas)
- Create: `src/components/BusinessContextWizard/steps/ProjectCard.tsx`
- Create: `src/components/BusinessContextWizard/steps/ObjectivesRepeater.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `Repeater`, `TextField`, `TextAreaField`, `NumberField`, `SelectField`, `PROJECT_TYPE_OPTIONS`, `PROJECT_STATUS_OPTIONS`, `OBJECTIVE_STATUS_OPTIONS`, `EMPTY_PROJECT`, `EMPTY_PROJECT_OBJECTIVE`, `nanoid`.
- Produces: `ProjectCard` com props `{ project: Project; update: (patch: Partial<Project>) => void; index: number }`; `ObjectivesRepeater` com props `{ objectives: ProjectObjective[]; onChange: (objectives: ProjectObjective[]) => void }`.

- [ ] **Step 1:** `ProjectsStep` fica sendo o `Repeater` de projetos. `newItem` = `() => ({ id: nanoid(), ...EMPTY_PROJECT })`.
- [ ] **Step 2:** `ProjectCard`: `name`, `description`, `type`, `status`, `startDate`, `endDate`, `budget`, `owner`, e dentro dele o `ObjectivesRepeater` — é um `Repeater` aninhado, o único do escopo.
- [ ] **Step 3:** `ObjectivesRepeater`: `description`, `metric`, `baseline`, `target`, `unit`, `deadline`, `status`. `newItem` = `() => ({ id: nanoid(), ...EMPTY_PROJECT_OBJECTIVE })`.
- [ ] **Step 4:** Remover chaves de opção órfãs dos 3 locales.
- [ ] **Step 5:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 6:** Run `pnpm dev`, `/app/business/context/projects`. Criar 2 projetos, adicionar 2 objetivos ao primeiro, remover o primeiro objetivo, **confirmar que o segundo projeto não foi afetado** — é o teste do aninhamento.
- [ ] **Step 7: Commit** — `git commit -m "refactor(wizard): split ProjectsStep into ProjectCard + ObjectivesRepeater"`

### Task 24: CampaignsStep

**Files:**
- Modify: `src/components/BusinessContextWizard/steps/CampaignsStep.tsx` (262 linhas)
- Create: `src/components/BusinessContextWizard/steps/CampaignCard.tsx`
- Create: `src/components/BusinessContextWizard/steps/KpisRepeater.tsx`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `Repeater`, `TextField`, `TextAreaField`, `NumberField`, `SelectField`, `CAMPAIGN_STATUS_OPTIONS`, `EMPTY_CAMPAIGN`, `EMPTY_CAMPAIGN_KPI`, `nanoid`.
- Produces: `CampaignCard` com props `{ campaign: Campaign; projects: Project[]; update: (patch: Partial<Campaign>) => void; index: number }`; `KpisRepeater` com props `{ kpis: CampaignKpi[]; onChange: (kpis: CampaignKpi[]) => void }`.

- [ ] **Step 1:** `CampaignsStep` fica sendo o `Repeater` de campanhas. `newItem` = `() => ({ id: nanoid(), ...EMPTY_CAMPAIGN })`.
- [ ] **Step 2:** `CampaignCard`: `name`, `description`, `channel`, `budget`, `startDate`, `endDate`, `status` (SelectField), `targetAudience`, e `projectId` como `SelectField` cujas opções vêm de `projects` — select dinâmico, `translate` identidade, igual ao goal na Task 14.
- [ ] **Step 3:** `KpisRepeater`: `name`, `target`, `current`, `unit`. `CampaignKpi` **não tem `id`** (`types/business-context.ts:157`) — keys internas do `Repeater`.
- [ ] **Step 4:** Remover chaves de opção órfãs dos 3 locales.
- [ ] **Step 5:** Run `pnpm typecheck && pnpm test` — Expected: PASS.
- [ ] **Step 6:** Run `pnpm dev`, `/app/business/context/campaigns`. Criar campanha, vincular a um projeto, adicionar 2 KPIs, salvar, recarregar.
- [ ] **Step 7: Commit** — `git commit -m "refactor(wizard): split CampaignsStep into CampaignCard + KpisRepeater"`

---

## Task 25: Registry de seções

**Files:**
- Modify: `src/types/business-context.ts:212-285`
- Modify: `src/pages/BusinessContextSectionPage.tsx:29-44,119-140`

**Interfaces:**
- Consumes: os 9 componentes de step (Tasks 16–24).
- Produces: `ContextSectionInfo` ganha `field: keyof BusinessContextData` e `Component: ComponentType<StepProps>`. `SECTION_FIELD` e o `switch` de `renderStep` deixam de existir.

**Por que só agora:** o registry importa os 9 componentes. Fazê-lo antes das migrações significaria mexer nele de novo a cada step.

- [ ] **Step 1: Estender o tipo do registry**

Em `src/types/business-context.ts`, `ContextSectionInfo` passa a ser:

```ts
export interface StepProps {
  data: BusinessContextData;
  onChange: (patch: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export interface ContextSectionInfo {
  key: ContextSection;
  /** Campo do contexto que esta seção grava. */
  field: keyof BusinessContextData;
  icon: string;
  Component: ComponentType<StepProps>;
}
```

`label` e `description` saem: são texto inglês hardcoded (linhas 234-235 e irmãos) que ninguém lê — a página usa `t('wizard.steps.${section}.label')` (`BusinessContextSectionPage.tsx:150-151`). Código morto que parecia vivo.

- [ ] **Step 2: Preencher as 9 entradas** com `field`, `icon` e `Component`, importando os steps.

- [ ] **Step 3: Apagar o mapa e o switch da página**

Remover `SECTION_FIELD` (linhas 30-40) e `renderStep` (linhas 119-140). O corpo do card vira:

```tsx
<Card>
  <CardContent className="p-6">
    <info.Component data={draft} onChange={onChange} errors={form.formState.errors} />
  </CardContent>
</Card>
```

E os dois usos de `SECTION_FIELD[section]` passam a ser `info.field`.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: sem erro. Se acusar `info` possivelmente undefined, é o `noUncheckedIndexedAccess` — o guard `isContextSection` (linhas 42-44, 95) já garante que existe; usar `CONTEXT_SECTIONS.find(...)` com early return em vez de indexar por posição.

- [ ] **Step 5: Verificar as 9 seções**

Run: `pnpm dev`. Abrir as 9, confirmar que cada uma renderiza o step certo e que "Salvar e próxima" percorre na ordem.

- [ ] **Step 6: Commit**

```bash
git add src/types/business-context.ts src/pages/BusinessContextSectionPage.tsx
git commit -m "refactor(business): replace section switch with a registry"
```

---

## Task 26: Limpar o resto dos `dangerouslySetInnerHTML`

**Files:**
- Modify: os arquivos remanescentes que ainda usam `dangerouslySetInnerHTML`
- Modify: `src/i18n/locales/{en,pt,es}.json`

**Interfaces:**
- Consumes: `Trans` de `react-i18next`.
- Produces: nada. Invariante: zero ocorrências de `dangerouslySetInnerHTML` em `src/`.

A Task 17 removeu a de `ProductsStep`. Esta remove as restantes.

- [ ] **Step 1: Localizar o que sobrou**

Run: `grep -rn "dangerouslySetInnerHTML" src/`
Expected: as ocorrências fora dos steps já migrados. Se o resultado for vazio, esta task já está feita pelas Tasks 16–24 — marcar como concluída e seguir.

- [ ] **Step 2: Substituir cada uma por `<Trans>`**

Padrão:

```tsx
<Trans i18nKey="a.chave.aqui" components={{ strong: <strong /> }} />
```

A string traduzida mantém `<strong>…</strong>`, mas o `<Trans>` o resolve como componente React em vez de injetar HTML.

- [ ] **Step 3: Confirmar que nenhuma string tem HTML sem componente correspondente**

Run:
```bash
grep -o '<[a-z]*>' src/i18n/locales/pt.json | sort -u
```
Toda tag que aparecer precisa estar mapeada em algum `components={{ … }}`, ou ser removida da string nos 3 locales.

- [ ] **Step 4: Verificar a invariante**

Run: `grep -rn "dangerouslySetInnerHTML" src/ | wc -l`
Expected: `0`.

- [ ] **Step 5: Paridade dos locales**

Run: o comando do Step 6 da Task 6.
Expected: três contagens idênticas e `iguais: true`.

- [ ] **Step 6: Commit**

Listar explicitamente os arquivos que o Step 1 encontrou, mais os 3 locales. Nunca
`git add src` — a constraint global manda commitar só o que a task nomeia.

```bash
git add <arquivos do Step 1> src/i18n/locales/en.json src/i18n/locales/pt.json src/i18n/locales/es.json
git commit -m "refactor(i18n): render emphasis with Trans instead of raw HTML"
```

---

## Task 27: Verificação final

**Files:** nenhum alterado, salvo correções que aparecerem.

**Interfaces:**
- Consumes: tudo.
- Produces: confirmação de que o sub-projeto A está pronto e o B pode começar.

- [ ] **Step 1: Gate automático dos dois repos**

```bash
cd /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/back && pnpm typecheck && pnpm test
cd /home/mauricio.oliveira/Documentos/Coding/futuro/aurea/web && pnpm typecheck && pnpm test && pnpm build
```
Expected: PASS em todos. Nada é declarado pronto antes desta saída existir.

- [ ] **Step 2: Confirmar a meta de tamanho**

```bash
wc -l src/pages/IcpNewPage.tsx src/pages/GoalNewPage.tsx src/pages/StrategyNewPage.tsx \
      src/pages/BusinessContextSectionPage.tsx \
      src/components/BusinessContextWizard/steps/*.tsx \
      src/components/form/*.tsx | sort -n
```
Expected: nenhum arquivo acima de ~120 linhas (exceto os `*.test.tsx`, que não têm limite). Total dos forms bem abaixo das 3.860 linhas iniciais.

- [ ] **Step 3: Confirmar que os anti-padrões saíram**

```bash
grep -rn "dangerouslySetInnerHTML" src/ | wc -l     # esperado: 0
grep -rn "getElementById" src/ | wc -l              # esperado: 0
grep -rn "<select" src/ | wc -l                     # esperado: 0
grep -rn ": any\|as any" src/ | wc -l               # esperado: 0
```

- [ ] **Step 4: Walkthrough manual**

Com `pnpm dev` no web e a API de pé:

- [ ] Os 3 forms simples: criar um de cada, confirmar que aparece na listagem
- [ ] As 9 seções: preencher pelo menos 2 campos em cada, salvar, recarregar, confirmar persistência
- [ ] Dark mode: alternar o tema e percorrer as 9 seções procurando contraste quebrado, com atenção aos menus de `Select` abertos
- [ ] Teclado: numa seção com `TagsField` e `Repeater`, chegar em todo controle só com Tab; Enter no `TagsField` adiciona sem salvar a seção; Escape fecha o `Select`
- [ ] Erro de validação: pôr texto num campo numérico, tentar salvar, confirmar mensagem no campo e que **não** navegou
- [ ] Sair no meio: preencher uma seção sem salvar, navegar para outra, voltar — confirmar que não há estado fantasma (o bug de §2.1 do spec)
- [ ] Os 3 idiomas: trocar para EN e ES e confirmar que nenhum rótulo aparece como chave crua (`enums.urgency.low` na tela)

- [ ] **Step 5: Registrar o resultado**

Se algo do Step 4 falhar, corrigir e recomeçar o Step 1. Só declarar o A pronto com a saída dos comandos em mãos.

- [ ] **Step 6: Commit final se houve correção**

Listar os arquivos corrigidos por nome. Nunca `git add -A`.

```bash
git add <arquivos corrigidos>
git commit -m "fix: address findings from final verification walkthrough"
```

---

## Notas de sequenciamento

- **Tasks 1–9** (web) e **Task 10** (back) são independentes entre si e podem ser paralelizadas por repo.
- **Task 11** depende da Task 10 e é o **ponto de decisão do risco zod v3/v4**. Se o fallback do Step 6 for acionado, as Tasks 15–24 seguem iguais, mudando apenas a origem dos schemas.
- **Tasks 12–14** dependem das Tasks 1–9 e são independentes entre si.
- **Task 15** depende da Task 11.
- **Tasks 16–24** dependem da Task 15 e são independentes entre si — nove tasks paralelizáveis.
- **Task 25** depende das Tasks 16–24 (importa os nove componentes).
- **Tasks 26–27** vêm por último.
