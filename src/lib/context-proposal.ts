import type { FillQuestion } from '@/schemas/fill-proposal';
import { CONTEXT_SECTIONS } from '@/components/BusinessContextWizard/sectionRegistry';
import type { ContextSection } from '@/types/business-context';

export interface ProposalCoverage {
  /** Seções com dados propostos prontos para revisar. */
  filledSections: ContextSection[];
  /** Seções que a proposta só alcança por pergunta — nada preenchido nelas. */
  askedSections: ContextSection[];
  questionCount: number;
}

/**
 * O que uma proposta de contexto inteiro tem, por seção.
 *
 * Existe porque um run de `propose-business-context` não grava nada: ele
 * devolve `filled` e `questions`, e isso só vira contexto quando o fundador
 * abre cada seção com `?fillRun=` e salva. Sem contar o que a proposta cobre,
 * a tela do negócio não tem como dizer "sua proposta está pronta, revise estas
 * seis seções" — foi exatamente assim que um run pago de 5 créditos ficou
 * invisível atrás de um botão de "gerar de novo".
 *
 * `currentPerformance` é o caso que obriga a separar os dois grupos: o agente
 * nunca preenche métrica de fundador (MRR, churn), ele pergunta — a seção está
 * coberta, mas não há slice para aplicar.
 */
export function proposalCoverage(filled: unknown, questions: readonly FillQuestion[]): ProposalCoverage {
  const data = typeof filled === 'object' && filled !== null ? (filled as Record<string, unknown>) : {};
  const filledSections: ContextSection[] = [];
  const askedSections: ContextSection[] = [];

  for (const section of CONTEXT_SECTIONS) {
    if (!section.field) continue;
    if (data[section.field] !== undefined) {
      filledSections.push(section.key);
      continue;
    }
    if (questions.some((question) => question.fills.startsWith(`${section.field}.`))) {
      askedSections.push(section.key);
    }
  }

  return { filledSections, askedSections, questionCount: questions.length };
}

/** Toda seção que a proposta alcança, preenchendo ou perguntando. */
export function coveredSections(coverage: ProposalCoverage): ContextSection[] {
  return [...coverage.filledSections, ...coverage.askedSections];
}
