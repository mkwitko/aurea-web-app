import { describe, expect, it } from 'vitest';
import { conciergeStartSchema } from './concierge';

const valid = { name: 'Acme', website: 'https://acme.example' };

describe('conciergeStartSchema', () => {
  it('accepts a name and an http(s) website', () => {
    expect(conciergeStartSchema.safeParse(valid).success).toBe(true);
  });

  it('requires a website, unlike the general business form', () => {
    const result = conciergeStartSchema.safeParse({ ...valid, website: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a website with no scheme', () => {
    const result = conciergeStartSchema.safeParse({ ...valid, website: 'acme.example' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.url');
  });

  it('requires a name', () => {
    expect(conciergeStartSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });
});
