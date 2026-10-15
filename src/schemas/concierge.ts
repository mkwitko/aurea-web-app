import { z } from 'zod';
import { BUSINESS_LIMITS } from './business';

/**
 * The concierge's only form: the two facts that let AUREA start researching
 * — name and website. Unlike `businessFormSchema` (the general business-form
 * schema, where `website` is optional because a business can exist without
 * one), the concierge's whole first stage is "research this website", so a
 * website is required here — `propose-business-profile` needs one to do
 * anything.
 */
export const conciergeStartSchema = z.object({
  name: z.string().min(1, 'validation.required').max(BUSINESS_LIMITS.name, 'validation.tooLong'),
  website: z
    .string()
    .min(1, 'validation.required')
    .refine((value) => /^https?:\/\/.+/.test(value), 'validation.url'),
});

export type ConciergeStartValues = z.infer<typeof conciergeStartSchema>;
