import { z } from 'zod';

/**
 * O que o agente `propose-social-post` devolve, validado no cliente antes de
 * tocar no formulário.
 *
 * Sem `.default()` em nada: um run que voltou sem `filled` não é um run que
 * propôs texto vazio, e preencher o campo com string vazia apagaria o que o
 * fundador já tinha escrito.
 */
export const proposeSocialPostOutput = z.object({
  filled: z.object({
    name: z.string().optional(),
    payload: z.object({ content: z.string().optional() }).optional(),
    /**
     * As redes que o agente sugere. Filtradas contra as conectadas antes de tocar
     * no formulário: o modelo não sabe o que o cliente autorizou desde o run.
     */
    platforms: z.array(z.string()).optional(),
  }),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export type ProposeSocialPostOutput = z.infer<typeof proposeSocialPostOutput>;
