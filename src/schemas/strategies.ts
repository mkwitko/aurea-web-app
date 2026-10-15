import { z } from 'zod';

export const strategyFormSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  goalId: z.string().min(1, 'validation.required'),
  growthMechanism: z.string().optional(),
});

export type StrategyFormValues = z.infer<typeof strategyFormSchema>;
