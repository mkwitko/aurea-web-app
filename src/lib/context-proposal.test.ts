import { coveredSections, proposalCoverage } from './context-proposal';
import type { FillQuestion } from '@/schemas/fill-proposal';

const question = (fills: string): FillQuestion => ({
  id: fills,
  ask: 'ask',
  why: 'why',
  answerType: 'count',
  fills,
  impact: 3,
});

describe('proposalCoverage', () => {
  // O caso real: run aaee7bac cobrou 5 créditos, preencheu seis seções e
  // perguntou seis coisas — e a tela do negócio não sabia disso.
  it('separa seção preenchida de seção que só foi perguntada', () => {
    const coverage = proposalCoverage(
      {
        companyProfile: { mission: 'x' },
        products: [{ name: 'y' }],
        competitiveLandscape: { marketPosition: 'niche' },
        marketContext: { tam: 1 },
        constraints: { regulatoryConstraints: [] },
        currentActivities: { activeChannels: [] },
      },
      [question('currentPerformance.mrr'), question('currentPerformance.churnRate')],
    );

    expect(coverage.filledSections).toEqual([
      'company',
      'products',
      'competitive',
      'market',
      'constraints',
      'activities',
    ]);
    // `currentPerformance` não tem slice por design — métrica de fundador vira
    // pergunta, não pesquisa.
    expect(coverage.askedSections).toEqual(['performance']);
    expect(coverage.questionCount).toBe(2);
    expect(coveredSections(coverage)).toHaveLength(7);
  });

  it('não conta uma seção duas vezes quando ela vem preenchida e com pergunta', () => {
    const coverage = proposalCoverage({ marketContext: { tam: 1 } }, [question('marketContext.sam')]);

    expect(coverage.filledSections).toEqual(['market']);
    expect(coverage.askedSections).toEqual([]);
  });

  it('não cobre projetos nem campanhas, mesmo que o output invente as chaves', () => {
    const coverage = proposalCoverage({ projects: [{ name: 'p' }], campaigns: [{ name: 'c' }] }, []);

    expect(coveredSections(coverage)).toEqual([]);
  });

  it('aceita output degenerado sem estourar', () => {
    expect(coveredSections(proposalCoverage(null, []))).toEqual([]);
    expect(coveredSections(proposalCoverage('nope', []))).toEqual([]);
  });
});
