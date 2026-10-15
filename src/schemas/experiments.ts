import { z } from 'zod';

/**
 * Mirrors `back/src/http/api/experiments/create-experiment/create-experiment.schema.ts`.
 *
 * The lengths are the backend's own, so an over-long name is caught here as a
 * field error instead of coming back as a 400 the user has to guess at.
 *
 * `description` is also a field `propose-experiment` can fill, and
 * `baselineValue`/`targetValue`/`startDate`/`endDate` are the four it asks
 * for instead (`back/src/ai/agents/fill/propose-experiment.ts`) — without a
 * place on this form to land in, an AI-filled or AI-answered value would be
 * applied to form state the submit handler never reads, and the founder
 * would lose it under a success message. The two dates are plain strings
 * here, same as the rest of the app's date inputs (`TextField`'s
 * `type="date"`); the page converts them to `Date` right before
 * `create.mutate`.
 */
export const experimentFormSchema = z.object({
  hypothesisId: z.string().min(1, 'validation.required'),
  name: z.string().min(1, 'validation.required').max(200, 'validation.tooLong'),
  metric: z.string().min(1, 'validation.required').max(160, 'validation.tooLong'),
  description: z.string().max(2000, 'validation.tooLong').optional(),
  objective: z.string().max(1000, 'validation.tooLong').optional(),
  channel: z.string().max(160, 'validation.tooLong').optional(),
  audience: z.string().max(500, 'validation.tooLong').optional(),
  baselineValue: z.number().optional(),
  targetValue: z.number().optional(),
  successCriteria: z.string().max(1000, 'validation.tooLong').optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ExperimentFormValues = z.infer<typeof experimentFormSchema>;
