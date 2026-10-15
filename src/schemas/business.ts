import { z } from 'zod';

const optionalUrl = z
  .string()
  .optional()
  .refine((v) => !v || /^https?:\/\/.+/.test(v), 'validation.url');

/**
 * Os tetos são os do `businessCreateBody` do backend: sem eles, um texto longo
 * — colado pelo fundador ou proposto pela IA — só falha no POST, e o erro volta
 * como um AUR-T0002 cru em vez de uma mensagem no campo.
 *
 * Exportados porque o formulário também os usa, no `maxLength` do controle e no
 * contador ao lado dele: um só número por campo, aqui.
 */
export const BUSINESS_LIMITS = {
  name: 160,
  industry: 160,
  description: 4000,
  businessModel: 160,
  revenueModel: 160,
  valueProposition: 2000,
  positioning: 2000,
} as const;

export const businessFormSchema = z.object({
  name: z.string().min(1, 'validation.required').max(BUSINESS_LIMITS.name, 'validation.tooLong'),
  website: optionalUrl,
  industry: z.string().max(BUSINESS_LIMITS.industry, 'validation.tooLong').optional(),
  description: z.string().max(BUSINESS_LIMITS.description, 'validation.tooLong').optional(),
  businessModel: z.string().max(BUSINESS_LIMITS.businessModel, 'validation.tooLong').optional(),
  revenueModel: z.string().max(BUSINESS_LIMITS.revenueModel, 'validation.tooLong').optional(),
  valueProposition: z.string().max(BUSINESS_LIMITS.valueProposition, 'validation.tooLong').optional(),
  positioning: z.string().max(BUSINESS_LIMITS.positioning, 'validation.tooLong').optional(),
});

export type BusinessFormValues = z.infer<typeof businessFormSchema>;
