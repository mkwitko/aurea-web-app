import { describe, expect, it } from 'vitest';
import { parseFillProposal, sortByImpact } from './fill-proposal';
import { CONTEXT_FILL_PATHS, NO_FILL_PATHS } from '@/lib/fill-paths';

const question = {
  id: 'mrr',
  ask: 'Quanto a empresa faturou no último mês?',
  why: 'É a base de tudo que a AUREA calcula depois.',
  answerType: 'currency',
  fills: 'currentPerformance.mrr',
  impact: 3,
};

const output = {
  filled: { marketContext: { tam: 4_000_000_000 } },
  questions: [question],
  confidence: 'MEDIUM',
};

describe('parseFillProposal', () => {
  it('parses a well-formed proposal', () => {
    const result = parseFillProposal(output, CONTEXT_FILL_PATHS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.questions[0]?.fills).toBe('currentPerformance.mrr');
  });

  it('refuses a fills path outside the entity', () => {
    // The panel calls setValue with this string. Keeping the enum on the
    // client means a bad path shows the "unreadable result" card instead of
    // writing junk into the form.
    const result = parseFillProposal(
      { ...output, questions: [{ ...question, fills: 'currentPerformance.arr' }] },
      CONTEXT_FILL_PATHS,
    );
    expect(result.ok).toBe(false);
  });

  it('refuses the whole result rather than dropping one bad question', () => {
    const result = parseFillProposal(
      { ...output, questions: [question, { ...question, id: 'x', fills: 'nope' }] },
      CONTEXT_FILL_PATHS,
    );
    expect(result.ok).toBe(false);
  });

  it('accepts an empty question list', () => {
    expect(parseFillProposal({ ...output, questions: [] }, CONTEXT_FILL_PATHS).ok).toBe(true);
  });

  it('accepts a proposal from an agent that asks nothing', () => {
    const result = parseFillProposal(
      { filled: { industry: 'SaaS' }, questions: [], confidence: 'HIGH' },
      NO_FILL_PATHS,
    );
    expect(result.ok).toBe(true);
  });

  it('refuses a question when the agent has no legal destinations', () => {
    expect(
      parseFillProposal({ filled: {}, questions: [question], confidence: 'HIGH' }, NO_FILL_PATHS).ok,
    ).toBe(false);
  });

  it('refuses a null output — a run that never completed', () => {
    expect(parseFillProposal(null, CONTEXT_FILL_PATHS).ok).toBe(false);
    expect(parseFillProposal(undefined, CONTEXT_FILL_PATHS).ok).toBe(false);
  });

  it('refuses an unknown confidence', () => {
    expect(parseFillProposal({ ...output, confidence: 'VERIFIED' }, CONTEXT_FILL_PATHS).ok).toBe(false);
  });

  it('requires choices when answerType is choice', () => {
    expect(
      parseFillProposal(
        { ...output, questions: [{ ...question, answerType: 'choice' }] },
        CONTEXT_FILL_PATHS,
      ).ok,
    ).toBe(false);
  });
});

describe('sortByImpact', () => {
  it('puts the highest impact first', () => {
    const ordered = sortByImpact([
      { ...question, id: 'a', impact: 1 },
      { ...question, id: 'b', impact: 3 },
      { ...question, id: 'c', impact: 2 },
    ] as never);
    expect(ordered.map((q) => q.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps the agent\'s own order among equals', () => {
    // A stable sort: two questions the agent rated the same stay in the order
    // it wrote them, which is the only ranking information left.
    const ordered = sortByImpact([
      { ...question, id: 'a', impact: 2 },
      { ...question, id: 'b', impact: 2 },
    ] as never);
    expect(ordered.map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('does not mutate its input', () => {
    const input = [
      { ...question, id: 'a', impact: 1 },
      { ...question, id: 'b', impact: 3 },
    ] as never;
    sortByImpact(input);
    expect((input as { id: string }[]).map((q) => q.id)).toEqual(['a', 'b']);
  });
});

describe('answerType corrigido pelo destino', () => {
  // Caso real do run aaee7bac: o modelo pediu `constraints.teamSize` como
  // `text`, a resposta "1" entrou como string e `z.int()` reprovou o Salvar da
  // seção inteira — a resposta seguinte, um orçamento válido, morreu junto.
  it('promove text a count num campo inteiro', () => {
    const result = parseFillProposal(
      {
        filled: {},
        questions: [{ ...question, id: 'team', fills: 'constraints.teamSize', answerType: 'text' }],
        confidence: 'LOW',
      },
      CONTEXT_FILL_PATHS,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.questions[0]?.answerType).toBe('count');
  });

  it('promove number a currency onde o campo é dinheiro', () => {
    const result = parseFillProposal(
      {
        filled: {},
        questions: [{ ...question, id: 'budget', fills: 'constraints.monthlyGrowthBudget', answerType: 'number' }],
        confidence: 'LOW',
      },
      CONTEXT_FILL_PATHS,
    );

    if (result.ok) expect(result.value.questions[0]?.answerType).toBe('currency');
  });

  it('deixa em paz o destino que é texto de verdade', () => {
    const result = parseFillProposal(
      {
        filled: {},
        questions: [{ ...question, id: 'date', fills: 'currentPerformance.baselineDate', answerType: 'text' }],
        confidence: 'LOW',
      },
      CONTEXT_FILL_PATHS,
    );

    if (result.ok) expect(result.value.questions[0]?.answerType).toBe('text');
  });

  it('não desmancha uma pergunta de escolha — as choices vêm do modelo', () => {
    const result = parseFillProposal(
      {
        filled: {},
        questions: [
          {
            ...question,
            id: 'urgency',
            fills: 'constraints.urgency',
            answerType: 'choice',
            choices: ['LOW', 'HIGH'],
          },
        ],
        confidence: 'LOW',
      },
      CONTEXT_FILL_PATHS,
    );

    if (result.ok) expect(result.value.questions[0]?.answerType).toBe('choice');
  });
});
