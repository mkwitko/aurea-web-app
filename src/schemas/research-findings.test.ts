import { describe, expect, it } from 'vitest';
import { parseResearch } from './research-findings';

const finding = (overrides: Record<string, unknown> = {}) => ({
  dimension: 'MARKET',
  statement: 'Demand grew.',
  evidence: 'Interest rose 40%.',
  sourceUrl: 'https://example.test/report',
  sourceTitle: 'State of Ops 2026',
  confidence: 'MEDIUM',
  target: 'TREND',
  ...overrides,
});

const valid = {
  summary: 'Growing market.',
  findings: [finding()],
  opportunities: [{ statement: 'Own it.', rationale: 'r', supportingFindings: [0], confidence: 'HIGH' }],
};

describe('parseResearch', () => {
  it('reads a well-formed result', () => {
    const parsed = parseResearch(valid);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.value.findings[0]!.sourceUrl).toBe('https://example.test/report');
  });

  it('reports unreadable output rather than throwing', () => {
    expect(parseResearch({ findings: 'nope' }).ok).toBe(false);
  });

  it('reports a null output rather than throwing', () => {
    expect(parseResearch(null).ok).toBe(false);
  });

  it('reads a competitor finding', () => {
    const competitor = { name: 'Rival', strengths: [], weaknesses: [] };
    const parsed = parseResearch({ ...valid, findings: [finding({ target: 'COMPETITOR', competitor })] });
    expect(parsed.ok).toBe(true);
    const parsedCompetitor = parsed.ok ? parsed.value.findings[0]!.competitor : undefined;
    expect(parsedCompetitor?.name).toBe('Rival');
    expect(Array.isArray(parsedCompetitor?.strengths)).toBe(true);
    expect(Array.isArray(parsedCompetitor?.weaknesses)).toBe(true);
  });
});
