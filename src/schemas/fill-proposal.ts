import { z } from 'zod';
import { FILL_PATH_ANSWER_TYPE } from '@/lib/fill-paths';

/**
 * Espelha o contrato de saída de `back/src/ai/agents/fill/contract.ts`.
 *
 * O `output` de um AgentRun é `unknown` no contrato, o que é honesto: ele
 * guarda o que aquele taskType produziu. A tela parseia em vez de castar — um
 * cast transforma um run malformado em crash no meio de um render.
 *
 * `filled` fica como `unknown` de propósito: cada tela sabe a forma do próprio
 * formulário, e repetir sete schemas aqui só criaria sete lugares para
 * divergir do backend, que já validou a forma antes de persistir. O que este
 * parser guarda é o que o painel de fato usa para decidir algo: o tipo da
 * resposta, o destino da escrita e a ordem das perguntas.
 */
const questionSchema = z
  .object({
    id: z.string(),
    ask: z.string(),
    why: z.string(),
    answerType: z.enum(['text', 'number', 'currency', 'percent', 'count', 'choice']),
    choices: z.array(z.string()).optional(),
    fills: z.string(),
    impact: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .refine((question) => (question.answerType === 'choice') === (question.choices !== undefined), {
    message: 'choices is required when answerType is choice, and forbidden otherwise',
    path: ['choices'],
  });

export type FillQuestion = z.infer<typeof questionSchema>;

export interface FillProposal {
  filled: unknown;
  questions: FillQuestion[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export function parseFillProposal(
  output: unknown,
  allowedPaths: readonly string[],
): { ok: true; value: FillProposal } | { ok: false } {
  const allowed = new Set(allowedPaths);

  const schema = z.object({
    filled: z.unknown(),
    // Um `fills` fora do enum reprova o resultado inteiro em vez de descartar
    // a pergunta: descartar em silêncio esconderia que o run que o fundador
    // pagou saiu errado.
    questions: z.array(questionSchema.refine((question) => allowed.has(question.fills))),
    confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  });

  const parsed = schema.safeParse(output);
  if (!parsed.success) return { ok: false };

  const value = parsed.data as FillProposal;
  return { ok: true, value: { ...value, questions: value.questions.map(withFormAnswerType) } };
}

/**
 * Corrige o `answerType` que o modelo escolheu quando o formulário só aceita
 * número naquele destino.
 *
 * Um `text` num campo `z.int()` não é uma pergunta mal formatada: é uma
 * resposta que entra no formulário como string, reprova a validação da seção e
 * derruba o Salvar — junto com todas as outras respostas daquela tela. Aqui,
 * porque este é o único ponto por onde as perguntas de qualquer run passam
 * antes de virar campo na tela.
 */
function withFormAnswerType(question: FillQuestion): FillQuestion {
  const expected = FILL_PATH_ANSWER_TYPE[question.fills];
  // `choice` é intocável: as `choices` vêm do modelo e um número não as
  // substitui.
  if (!expected || question.answerType === expected || question.answerType === 'choice') return question;
  return { ...question, answerType: expected };
}

/** Maior impacto primeiro, estável entre iguais. Não muta a entrada. */
export function sortByImpact(questions: readonly FillQuestion[]): FillQuestion[] {
  return [...questions].sort((a, b) => b.impact - a.impact);
}
