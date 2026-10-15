import { readFileSync } from 'node:fs';
import path from 'node:path';
import en from './locales/en.json';

type Tree = Record<string, unknown>;

/**
 * `locales.test.ts` only compares the three locale files against each other —
 * a key missing from all three passes that test cleanly while the founder
 * sees a raw key path like `pages.research.strengthsLabel` on screen. This
 * file guards the other direction: it reads the components that actually call
 * `t('pages.research....')` and asserts every key they use resolves in the
 * English bundle, so a component and its copy can never drift apart silently
 * again the way `dimensionHelp`, `confidenceHelp`, `strengthsLabel`,
 * `weaknessesLabel`, `acceptLabel`, and the opportunity help pair once did.
 */
const FILES = [
  'src/components/research/FindingCard.tsx',
  'src/components/research/OpportunityCard.tsx',
  'src/components/research/ResearchDeck.tsx',
  'src/components/research/ResearchRunTabs.tsx',
  'src/components/research/ResearchPanel.tsx',
  'src/pages/ResearchPage.tsx',
];

/** Every literal `pages.research.*` key passed to `t(...)` in this source. */
function literalKeys(source: string): string[] {
  const matches = source.matchAll(/\bt\(\s*['"](pages\.research(?:\.[A-Za-z0-9_]+)+)['"]/g);
  return [...matches].map((m) => m[1]!);
}

/**
 * Every `pages.research.*` prefix used as the static part of a template-literal
 * key, e.g. `` t(`pages.research.dimension.${finding.dimension}`) `` yields
 * `pages.research.dimension` — the object whose *values* (not the object
 * itself) the component actually renders.
 */
function dynamicPrefixes(source: string): string[] {
  const matches = source.matchAll(/\bt\(\s*`(pages\.research(?:\.[A-Za-z0-9_]+)+)\.\$\{[^}]+\}`/g);
  return [...matches].map((m) => m[1]!);
}

function get(tree: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree);
}

// Mirrors the enums in `src/schemas/research-findings.ts` — `dimension` and
// `confidence` are the only two dynamic `pages.research.*` lookups any
// component makes today. A future dynamic lookup must be added here too: an
// unrecognized prefix fails the suite below instead of silently passing.
const DYNAMIC_ENUMS: Record<string, string[]> = {
  'pages.research.dimension': ['MARKET', 'COMPETITOR', 'CUSTOMER', 'TREND'],
  'pages.research.confidence': ['LOW', 'MEDIUM', 'HIGH'],
  // Mirrors the three buckets `ResearchRunTabs.state` maps run status onto.
  'pages.research.runStatus': ['running', 'ready', 'failed'],
};

describe('pages.research keys the research components actually use', () => {
  const bySource = FILES.map((file) => ({
    file,
    source: readFileSync(path.join(process.cwd(), file), 'utf8'),
  }));

  // A regex that stopped matching (a quoting style change, a rename of `t`)
  // would make every assertion below vacuously pass — nothing to check means
  // nothing to fail. Pinning a floor keeps that failure mode loud instead of
  // silent; today's components use well over 30 literal keys between them.
  it('extracted a non-trivial number of keys from the components', () => {
    const total = bySource.reduce((sum, { source }) => sum + literalKeys(source).length, 0);
    expect(total).toBeGreaterThan(20);
  });

  for (const { file, source } of bySource) {
    for (const key of literalKeys(source)) {
      it(`${file} — ${key} resolves in en.json`, () => {
        const value = get(en, key);
        expect(typeof value, `${key} is missing from en.json`).toBe('string');
        expect((value as string).trim().length, `${key} resolves to an empty string in en.json`).toBeGreaterThan(0);
      });
    }

    for (const prefix of dynamicPrefixes(source)) {
      it(`${file} — every value ${prefix} is indexed with resolves in en.json`, () => {
        const values = DYNAMIC_ENUMS[prefix];
        expect(values, `unrecognized dynamic key prefix "${prefix}" — extend DYNAMIC_ENUMS in this test`).toBeDefined();
        for (const value of values ?? []) {
          const resolved = get(en, `${prefix}.${value}`);
          expect(typeof resolved, `${prefix}.${value} is missing from en.json`).toBe('string');
        }
      });
    }
  }
});
