import { z } from 'zod';

/**
 * Mirrors `back/src/http/api/icps/create-icp/create-icp.schema.ts`. The four
 * list fields below `painPoints` are also every one of them a field
 * `propose-icp` can fill (`back/src/ai/agents/fill/propose-icp.ts`) — without
 * a place on this form to land in, an AI-filled characteristic or objection
 * would be applied to form state the submit handler never reads, and the
 * founder would lose it under a success message.
 */
export const icpFormSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  painPoints: z.array(z.string().min(1)),
  characteristics: z.array(z.string().min(1)),
  customerGoals: z.array(z.string().min(1)),
  buyingTriggers: z.array(z.string().min(1)),
  objections: z.array(z.string().min(1)),
});

export type IcpFormValues = z.infer<typeof icpFormSchema>;
