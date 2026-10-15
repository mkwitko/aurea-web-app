import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextActionKindEnum, railNodeEnum, recentKindEnum } from '@/api/generated/types/GetDashboard';
import en from './locales/en.json';

type Tree = Record<string, unknown>;

/**
 * `locales.test.ts` only compares the three locale files against each other,
 * so a key missing from all three passes it cleanly while the founder reads
 * `app.dashboard.next.RECORD_OUTCOME` on screen. This guards the other
 * direction for the dashboard, exactly as `research-keys.test.ts` does for
 * research: every key the components actually ask for must resolve in en.
 */
const FILES = [
  'src/pages/DashboardPage.tsx',
  'src/components/dashboard/SetupChecklist.tsx',
  'src/components/dashboard/LoopPanel.tsx',
  'src/components/dashboard/NextActionCard.tsx',
  'src/components/dashboard/RecentActivity.tsx',
];

function literalKeys(source: string): string[] {
  // Matches a quoted `app.dashboard.*` key anywhere inside a `t(...)` call's
  // argument list, not only immediately after the opening paren — e.g.
  // `t(noEndDate ? 'app.dashboard.waitNoDate' : i18nKey, {...})`, where the
  // key is the second (ternary) token, not the first. The `[^'"()]*?`
  // between `t(` and the quote stays clear of other parens/quotes so this
  // does not bleed across separate `t(...)` calls on the same line.
  const matches = source.matchAll(/\bt\([^'"()]*?['"](app\.dashboard(?:\.[A-Za-z0-9_]+)+)['"]/g);
  return [...matches].map((m) => m[1]!);
}

function dynamicPrefixes(source: string): string[] {
  const matches = source.matchAll(/\bt\(\s*`(app\.dashboard(?:\.[A-Za-z0-9_]+)+)\.\$\{[^}]+\}`/g);
  return [...matches].map((m) => m[1]!);
}

function get(tree: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree);
}

/**
 * Derived straight from the generated enums Kubb produces from the backend's
 * OpenAPI schema (`@/api/generated/types/GetDashboard`), not hand-mirrored —
 * a kind or rail node added on the backend changes these lists automatically,
 * so this suite fails the moment its copy is missing instead of passing
 * vacuously against a stale hand-written list.
 */
const DYNAMIC_ENUMS: Record<string, string[]> = {
  'app.dashboard.steps': ['business', 'icp', 'goal', 'research', 'strategy'],
  'app.dashboard.rail': Object.values(railNodeEnum),
  'app.dashboard.railHelp': Object.values(railNodeEnum),
  'app.dashboard.recent': Object.values(recentKindEnum).filter(
    // RESEARCH_COMPLETED is pluralized, so it lives under _one/_other and is
    // asserted separately below, not as a plain `recent.RESEARCH_COMPLETED`.
    (kind) => kind !== recentKindEnum.RESEARCH_COMPLETED,
  ),
};

const NEXT_ACTION_KINDS: string[] = Object.values(nextActionKindEnum);

describe('app.dashboard keys the dashboard components use', () => {
  const bySource = FILES.map((file) => ({ file, source: readFileSync(path.join(process.cwd(), file), 'utf8') }));

  // A regex that stops matching would make every assertion below vacuously
  // pass. Pin a floor so that failure stays loud. The floor is 12, not the
  // original 8: broadening `literalKeys()` to catch ternary-embedded keys
  // (e.g. `waitNoDate` in `NextActionCard.tsx`) raised the true count to 13,
  // so a floor of just-8 would no longer catch a regression back to the
  // narrower pattern.
  it('extracted a non-trivial number of keys', () => {
    const total = bySource.reduce((sum, { source }) => sum + literalKeys(source).length, 0);
    expect(total).toBeGreaterThan(12);
  });

  for (const { file, source } of bySource) {
    for (const key of literalKeys(source)) {
      it(`${file} — ${key} resolves in en.json`, () => {
        const value = get(en, key);
        expect(typeof value, `${key} is missing from en.json`).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      });
    }

    for (const prefix of dynamicPrefixes(source)) {
      it(`${file} — every value ${prefix} is indexed with resolves in en.json`, () => {
        const values = DYNAMIC_ENUMS[prefix];
        expect(values, `unrecognized dynamic prefix "${prefix}" — extend DYNAMIC_ENUMS`).toBeDefined();
        for (const value of values ?? []) {
          expect(typeof get(en, `${prefix}.${value}`), `${prefix}.${value} is missing`).toBe('string');
        }
      });
    }
  }

  // NextActionCard builds its key inside dashboard-actions.ts, so the regexes
  // above cannot see it. Assert the whole enum directly.
  it('every next-action kind has copy', () => {
    for (const kind of NEXT_ACTION_KINDS) {
      expect(typeof get(en, `app.dashboard.next.${kind}`), `next.${kind} is missing`).toBe('string');
    }
  });

  it('the research findings count has both plural forms', () => {
    expect(typeof get(en, 'app.dashboard.recent.RESEARCH_COMPLETED_one')).toBe('string');
    expect(typeof get(en, 'app.dashboard.recent.RESEARCH_COMPLETED_other')).toBe('string');
  });
});
