import { dropBlankFields } from './blank-fields';

describe('dropBlankFields', () => {
  it('drops a property whose value is an empty string', () => {
    expect(dropBlankFields({ name: 'Acme', url: '' })).toEqual({ name: 'Acme' });
  });

  it('drops a property whose value is only whitespace', () => {
    expect(dropBlankFields({ url: '   ' })).toEqual({});
  });

  it('keeps a non-empty string exactly as typed, without trimming it', () => {
    expect(dropBlankFields({ mission: '  grow fast  ' })).toEqual({ mission: '  grow fast  ' });
  });

  it('keeps falsy values that are not blank strings', () => {
    expect(dropBlankFields({ budget: 0, active: false, note: null })).toEqual({
      budget: 0,
      active: false,
      note: null,
    });
  });

  it('recurses into nested objects', () => {
    expect(
      dropBlankFields({ contentProduction: { blogPostsPerMonth: 3, note: '' } }),
    ).toEqual({ contentProduction: { blogPostsPerMonth: 3 } });
  });

  it('cleans objects inside arrays', () => {
    expect(dropBlankFields({ competitors: [{ name: 'A', url: '' }, { name: 'B', url: 'x' }] })).toEqual({
      competitors: [{ name: 'A' }, { name: 'B', url: 'x' }],
    });
  });

  it('never removes array elements, so indices stay aligned', () => {
    // A blank tag would shift every later index if dropped, and string arrays
    // carry no format constraint, so the element survives.
    expect(dropBlankFields({ values: ['a', '', 'b'] })).toEqual({ values: ['a', '', 'b'] });
  });

  it('leaves a Date instance intact rather than spreading its properties', () => {
    const date = new Date('2026-07-27T00:00:00.000Z');
    expect(dropBlankFields({ baselineDate: date }).baselineDate).toBe(date);
  });

  it('makes an empty-url competitor pass a schema that requires a valid url when present', async () => {
    // The regression this exists to prevent: the server models `url` as
    // `z.string().url().optional()`, so `''` is rejected while an absent key
    // is accepted.
    const { z } = await import('zod');
    const schema = z.object({ name: z.string(), url: z.optional(z.url()) });

    expect(schema.safeParse({ name: 'A', url: '' }).success).toBe(false);
    expect(schema.safeParse(dropBlankFields({ name: 'A', url: '' })).success).toBe(true);
  });
});
