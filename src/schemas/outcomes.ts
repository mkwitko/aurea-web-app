import { z } from 'zod';

/**
 * Mirrors `back/src/http/api/outcomes/create-outcome/create-outcome.schema.ts`.
 *
 * `NumberField` emits `undefined` for anything that is not a finite number, so
 * a blank field and a half-typed "-" both land on the required message rather
 * than reaching the server as NaN.
 */
export const outcomeFormSchema = z.object({
  value: z.number({ error: 'validation.required' }).finite('validation.number'),
  unit: z.string().max(40, 'validation.tooLong').optional(),
  // Left blank means "now", which the backend fills in. A date in the future is
  // refused there, and that refusal is what the form reports.
  observedAt: z.string().optional(),
});

export type OutcomeFormValues = z.infer<typeof outcomeFormSchema>;
