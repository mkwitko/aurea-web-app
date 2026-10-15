import { formatCents } from './money';

describe('formatCents', () => {
  it('formats Brazilian currency in Portuguese', () => {
    // The separator between symbol and digits is a non-breaking space in ICU —
    // matching it literally is how this test breaks on a different Node build.
    expect(formatCents(29_700, 'BRL', 'pt')).toMatch(/^R\$\s?297,00$/);
  });

  it('keeps the currency when the locale changes', () => {
    // Same `\s?` as above: whether ICU puts a separator after the symbol is a
    // build detail, while the currency staying BRL under an English locale is
    // the actual requirement — the regex must pin the second, not the first.
    expect(formatCents(29_700, 'BRL', 'en')).toMatch(/^R\$\s?297\.00$/);
  });

  it('formats a whole thousand', () => {
    expect(formatCents(249_700, 'BRL', 'pt')).toMatch(/2\.497,00/);
  });

  it('formats zero', () => {
    expect(formatCents(0, 'BRL', 'pt')).toMatch(/^R\$\s?0,00$/);
  });
});
