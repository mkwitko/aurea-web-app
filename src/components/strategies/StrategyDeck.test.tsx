import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { StrategyDeck } from './StrategyDeck';
import type { Proposal } from '@/schemas/strategy-proposal';

// O rascunho tem de ter dado para o editor renderizar de verdade: com
// `data: undefined` a tela nunca sai do "Building the combined plan…" e a
// asserção de índice original vira um `not.toHaveBeenCalledWith` que passa
// mesmo se a reindexação estiver quebrada — não protege nada.
const draftStrategy = {
  name: 'Plano combinado',
  strategicThesis: 'T',
  growthMechanism: 'M',
  expectedOutcome: 'O',
  channels: ['Email'],
  assumptions: ['A'],
  risks: ['R'],
  hypotheses: [
    { statement: 'S', rationale: 'R', targetMetric: 'reply_rate', expectedOutcome: 'O', confidence: 'MEDIUM' as const },
  ],
};

vi.mock('@/api/generated/hooks/strategiesHooks/useGetProposalDraft', () => ({
  useGetProposalDraft: () => ({ data: { strategy: draftStrategy }, isError: false, refetch: vi.fn() }),
}));

const option = (name: string) => ({
  name,
  strategicThesis: 'T',
  growthMechanism: 'M',
  expectedOutcome: 'O',
  channels: ['Email'],
  assumptions: ['A'],
  risks: ['R'],
  tradeoffs: 'X',
  hypotheses: [],
});

const proposal = {
  options: [option('Outbound'), option('Conteúdo'), option('Parcerias')],
  recommendedIndex: 0,
  rationale: 'Mais barato para aprender.',
} as unknown as Proposal;

describe('StrategyDeck', () => {
  it('não mostra a opção já adotada', () => {
    renderWithProviders(
      <StrategyDeck runId="r-1" proposal={proposal} saving={false} error={null} usedOptionIndexes={[0]} onAdopt={vi.fn()} />,
    );

    expect(screen.queryByText('Outbound')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('adota com o índice original, não com a posição na tela', async () => {
    const onAdopt = vi.fn();
    renderWithProviders(
      <StrategyDeck runId="r-1" proposal={proposal} saving={false} error={null} usedOptionIndexes={[0]} onAdopt={onAdopt} />,
    );

    // A primeira opção visível é a de índice 1 na proposta (a 0 já está gasta).
    // `renderWithProviders` fixa o idioma em inglês (convenção dos testes deste
    // repo), então os rótulos aqui casam com o texto en.json, não pt.json.
    await userEvent.click(screen.getByLabelText(/include in this plan/i));
    await userEvent.click(screen.getByRole('button', { name: /review and create plan/i }));

    // O editor precisa aparecer de verdade — é ele que chama `onAdopt` ao
    // criar o plano.
    await userEvent.click(await screen.findByRole('button', { name: /^create plan$/i }));

    // O contrato que protege este teste: a seleção enviada ao servidor é o
    // índice original (1), nunca a posição na tela (0).
    expect(onAdopt).toHaveBeenCalledWith([1], expect.anything());
    expect(onAdopt).not.toHaveBeenCalledWith([0], expect.anything());
  });
});
