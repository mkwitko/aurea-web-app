import { z } from 'zod';

/**
 * Mirrors `back/src/http/api/learnings/create-learning/create-learning.schema.ts`.
 *
 * Both fields are required because a learning with only a title is a label, and
 * one with only a statement cannot be scanned in a list. The status is not here
 * at all: the backend always creates a CANDIDATE, whatever a client asks for.
 */
export const learningFormSchema = z.object({
  title: z.string().min(1, 'validation.required').max(200, 'validation.tooLong'),
  statement: z.string().min(1, 'validation.required').max(2000, 'validation.tooLong'),
});

export type LearningFormValues = z.infer<typeof learningFormSchema>;
