const NON_SECTION_KEYS = new Set(['completeness', 'lastReviewedAt', 'notes']);

/**
 * How many sections of a loaded business context actually hold something.
 *
 * Mirrors `filledSectionCount` in `back/src/ai/agents/fill/propose-icp.ts`
 * exactly: a section counts when it is an object with at least one key or an
 * array with at least one entry, and `completeness`, `lastReviewedAt` and
 * `notes` are not sections at all. The two repositories share no code, so
 * this is a deliberate copy — the server refuses `propose-icp` below three
 * filled sections, and a disabled button on `IcpNewPage` (Task 16's
 * `BusinessContextSectionPage` reuses it too) must give the same answer
 * *before* the founder pays for a run the server would refuse anyway.
 */
export function filledSectionCount(data: Record<string, unknown> | null | undefined): number {
  if (!data) return 0;
  return Object.entries(data).filter(([key, value]) => {
    if (NON_SECTION_KEYS.has(key)) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return false;
  }).length;
}
