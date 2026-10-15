import { businessFormSchema, BUSINESS_LIMITS } from './business';

const valid = { name: 'Acme' };

describe('businessFormSchema limits', () => {
  it('mirrors the API ceilings so a long field fails in the form, not in the POST', () => {
    const result = businessFormSchema.safeParse({
      ...valid,
      positioning: 'x'.repeat(BUSINESS_LIMITS.positioning + 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.tooLong');
  });

  it('accepts a field exactly at the ceiling', () => {
    const result = businessFormSchema.safeParse({
      ...valid,
      positioning: 'x'.repeat(BUSINESS_LIMITS.positioning),
      valueProposition: 'x'.repeat(BUSINESS_LIMITS.valueProposition),
      description: 'x'.repeat(BUSINESS_LIMITS.description),
    });
    expect(result.success).toBe(true);
  });
});
