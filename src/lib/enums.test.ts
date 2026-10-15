import * as enums from './enums';

const ALL = Object.entries(enums).filter(([name]) => name.endsWith('_OPTIONS')) as [
  string,
  { value: string; labelKey: string }[],
][];

describe('enum option catalogue', () => {
  it('exports every expected list', () => {
    expect(ALL.map(([name]) => name).sort()).toEqual(
      [
        'CAMPAIGN_STATUS_OPTIONS',
        'FUNDING_STAGE_OPTIONS',
        'MARKET_POSITION_OPTIONS',
        'MARKET_SHARE_OPTIONS',
        'MATURITY_OPTIONS',
        'OBJECTIVE_STATUS_OPTIONS',
        'PRICING_MODEL_OPTIONS',
        'PRODUCT_STATUS_OPTIONS',
        'PROJECT_STATUS_OPTIONS',
        'PROJECT_TYPE_OPTIONS',
        'URGENCY_OPTIONS',
      ].sort(),
    );
  });

  it.each(ALL)('%s is non-empty with unique values and i18n keys', (_name, options) => {
    expect(options.length).toBeGreaterThan(0);
    expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
    for (const o of options) {
      expect(o.value).not.toBe('');
      expect(o.labelKey).toMatch(/^enums\./);
    }
  });
});
