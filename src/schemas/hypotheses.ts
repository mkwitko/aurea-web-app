import { z } from 'zod';

/**
 * Mirrors `back/src/http/api/hypotheses/create-hypothesis/create-hypothesis.schema.ts`.
 * `strategyId` is not here: it comes from the page, never from the user.
 */
export const hypothesisFormSchema = z.object({
  statement: z.string().min(1, 'validation.required').max(2000, 'validation.tooLong'),
  rationale: z.string().max(2000, 'validation.tooLong').optional(),
  expectedOutcome: z.string().max(1000, 'validation.tooLong').optional(),
  targetMetric: z.string().max(160, 'validation.tooLong').optional(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERIFIED']).optional(),
});

export type HypothesisFormValues = z.infer<typeof hypothesisFormSchema>;
