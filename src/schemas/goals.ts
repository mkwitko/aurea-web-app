import { z } from 'zod';

/**
 * Mirrors `back/src/http/api/goals/create-goal/create-goal.schema.ts`.
 * `description`, `baselineValue` and `priority` are also every field
 * `propose-goal` can fill, and `deadline` is one of the two it asks for
 * (`back/src/ai/agents/fill/propose-goal.ts`) — without a place on this form
 * to land in, an AI-filled value would be applied to form state the submit
 * handler never reads, and the founder would lose it under a success
 * message. `deadline` is a plain date string here, same as the rest of the
 * app's date inputs (see `TextField`'s `type="date"`); the page converts it
 * to a `Date` right before `create.mutate`, the same shape
 * `BusinessContextSectionPage` already uses for `baselineDate`.
 */
export const goalFormSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  metric: z.string().min(1, 'validation.required'),
  baselineValue: z.number().optional(),
  targetValue: z.number().positive('validation.positive').optional(),
  unit: z.string().optional(),
  deadline: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export type GoalFormValues = z.infer<typeof goalFormSchema>;
