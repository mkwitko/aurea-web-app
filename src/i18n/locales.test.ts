import en from './locales/en.json';
import pt from './locales/pt.json';
import es from './locales/es.json';

type Tree = Record<string, unknown>;

/**
 * Every leaf path in a locale tree, e.g. `pages.experiments.action.plan`.
 *
 * Arrays are walked by index, because the landing-page copy holds arrays of
 * objects and a locale missing an entry there is just as broken as one missing
 * a key.
 */
function paths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => paths(item, `${prefix}[${index}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Tree).flatMap(([key, child]) =>
      paths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

const LOCALES = { pt, es };

describe('locale files', () => {
  // en is the reference: it is the one every feature is written in first.
  const reference = paths(en).sort();

  for (const [name, tree] of Object.entries(LOCALES)) {
    it(`${name} has exactly the keys en has`, () => {
      const actual = paths(tree).sort();

      // Reported as two explicit lists rather than a boolean, so a failure says
      // which keys to add and which to delete instead of "not equal". Missing
      // keys make i18next fall back to printing the raw key path at the user;
      // extra ones are dead copy that reads as coverage.
      const missing = reference.filter((path) => !actual.includes(path));
      const extra = actual.filter((path) => !reference.includes(path));

      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }

  it('has no empty strings', () => {
    // An empty translation renders as nothing at all, which looks like a layout
    // bug rather than a missing string.
    for (const [name, tree] of Object.entries({ en, ...LOCALES })) {
      const empties = paths(tree).filter((path) => {
        const value = path
          .replace(/\[(\d+)\]/g, '.$1')
          .split('.')
          .reduce<unknown>((node, key) => (node as Tree)?.[key], tree);
        return typeof value === 'string' && value.trim() === '';
      });
      expect(empties, `${name} has empty strings`).toEqual([]);
    }
  });
});
