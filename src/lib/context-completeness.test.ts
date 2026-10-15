import { describe, expect, it } from 'vitest';
import { filledSectionCount } from './context-completeness';

describe('filledSectionCount', () => {
  it('returns 0 for null, undefined and empty data', () => {
    expect(filledSectionCount(null)).toBe(0);
    expect(filledSectionCount(undefined)).toBe(0);
    expect(filledSectionCount({})).toBe(0);
  });

  it('counts an object section only when it has at least one key', () => {
    expect(filledSectionCount({ companyProfile: { mission: 'Grow' } })).toBe(1);
    expect(filledSectionCount({ companyProfile: {} })).toBe(0);
  });

  it('counts an array section only when it has at least one entry', () => {
    expect(filledSectionCount({ products: [{ id: '1', name: 'Widget' }] })).toBe(1);
    expect(filledSectionCount({ products: [] })).toBe(0);
  });

  it('ignores completeness, lastReviewedAt and notes — they are not sections', () => {
    expect(
      filledSectionCount({
        completeness: 80,
        lastReviewedAt: '2026-07-29T00:00:00.000Z',
        notes: 'Some free text',
      }),
    ).toBe(0);
  });

  it('ignores primitive values that are neither arrays nor objects', () => {
    expect(filledSectionCount({ someString: 'x', someNumber: 1, someBool: true })).toBe(0);
  });

  it('sums every filled section and skips the empty and ignored ones', () => {
    // Mirrors the shape a real BusinessContextData carries: some sections
    // filled, some untouched, plus the three non-section keys.
    const data = {
      companyProfile: { mission: 'Grow anvils' },
      products: [{ id: '1', name: 'Anvil' }],
      competitiveLandscape: undefined,
      marketContext: {},
      constraints: undefined,
      currentPerformance: { mrr: 1000 },
      currentActivities: undefined,
      projects: [],
      campaigns: [],
      completeness: 40,
      lastReviewedAt: '2026-07-29T00:00:00.000Z',
      notes: '',
    };
    // Filled: companyProfile, products, currentPerformance = 3.
    expect(filledSectionCount(data)).toBe(3);
  });

  it('counts an object section by its OWN keys, even if every one of them holds an empty value', () => {
    // The rule reads `Object.keys(value).length`, not "recursively non-empty":
    // a section object that already has a key on it (`activeChannels: []`)
    // counts, because the founder recorded something under that section even
    // though the one array inside it is still empty. This is the same reading
    // the server's `filledSectionCount` gives it — a test that expected the
    // opposite would pass here while disagreeing with the backend precheck.
    expect(filledSectionCount({ currentActivities: { activeChannels: [] } })).toBe(1);
  });

  it('matches the server precheck threshold used by propose-icp (< 3 refuses)', () => {
    const twoFilled = { companyProfile: { mission: 'Grow' }, products: [{ id: '1', name: 'Anvil' }] };
    const threeFilled = { ...twoFilled, currentPerformance: { mrr: 1000 } };
    expect(filledSectionCount(twoFilled) < 3).toBe(true);
    expect(filledSectionCount(threeFilled) < 3).toBe(false);
  });
});
