import { ZOD_ERROR_FALLBACK_KEY, errorMessage, zodIssuesToErrors, type ZodLikeIssue } from './zod-errors';

/**
 * `zodIssuesToErrors` is the highest-risk hand-rolled function on
 * `BusinessContextSectionPage` — it reshapes Zod's flat issue list into the
 * nested tree react-hook-form expects, and until now had zero tests. These
 * cover the three failure modes a review flagged: a nested/array path not
 * reaching the right leaf, a root-level issue vanishing instead of
 * surfacing, and an unmapped code leaking raw English instead of falling
 * back to a generic key.
 */
describe('zodIssuesToErrors', () => {
  it('reaches a nested/array path leaf', () => {
    const issues: ZodLikeIssue[] = [
      { path: ['channels', 0, 'cac'], code: 'too_small', message: 'Too small', minimum: 0 },
    ];

    const tree = zodIssuesToErrors(issues) as {
      channels: { 0: { cac: { type: string; message: string; params?: { minimum: unknown } } } };
    };

    expect(tree.channels[0].cac.message).toBe('errors.zod.tooSmall');
    expect(tree.channels[0].cac.type).toBe('too_small');
    expect(tree.channels[0].cac.params).toEqual({ minimum: 0 });
  });

  it('does not drop an empty-path issue — files it under root', () => {
    const issues: ZodLikeIssue[] = [{ path: [], code: 'custom', message: 'nope' }];

    const tree = zodIssuesToErrors(issues) as { root: { type: string; message: string } };

    expect(tree.root).toBeDefined();
    expect(tree.root.type).toBe('custom');
    expect(tree.root.message).toBe('errors.zod.custom');
  });

  it('falls back to the generic key for an unmapped code, never raw English', () => {
    const issues: ZodLikeIssue[] = [
      { path: ['companyProfile', 'mission'], code: 'invalid_key', message: 'Some future zod message' },
    ];

    const tree = zodIssuesToErrors(issues) as {
      companyProfile: { mission: { message: string } };
    };

    expect(tree.companyProfile.mission.message).toBe(ZOD_ERROR_FALLBACK_KEY);
    expect(tree.companyProfile.mission.message).not.toBe('Some future zod message');
  });

  it('maps every documented code to its own key and carries the right params', () => {
    const cases: [ZodLikeIssue, string, Record<string, unknown> | undefined][] = [
      [{ path: ['a'], code: 'invalid_type', message: 'x', expected: 'number' }, 'errors.zod.invalidType', { expected: 'number' }],
      [{ path: ['a'], code: 'too_small', message: 'x', minimum: 1 }, 'errors.zod.tooSmall', { minimum: 1 }],
      [{ path: ['a'], code: 'too_big', message: 'x', maximum: 100 }, 'errors.zod.tooBig', { maximum: 100 }],
      [{ path: ['a'], code: 'invalid_format', message: 'x', format: 'url' }, 'errors.zod.invalidFormat', { format: 'url' }],
      [{ path: ['a'], code: 'invalid_value', message: 'x', values: ['a', 'b'] }, 'errors.zod.invalidValue', { values: 'a, b' }],
      [{ path: ['a'], code: 'unrecognized_keys', message: 'x', keys: ['extra'] }, 'errors.zod.unrecognizedKeys', { keys: 'extra' }],
      [{ path: ['a'], code: 'not_multiple_of', message: 'x', divisor: 3 }, 'errors.zod.notMultipleOf', { divisor: 3 }],
      [{ path: ['a'], code: 'invalid_union', message: 'x' }, 'errors.zod.invalidUnion', undefined],
      [{ path: ['a'], code: 'custom', message: 'x' }, 'errors.zod.custom', undefined],
    ];

    for (const [issue, expectedKey, expectedParams] of cases) {
      const tree = zodIssuesToErrors([issue]) as { a: { message: string; params?: unknown } };
      expect(tree.a.message).toBe(expectedKey);
      expect(tree.a.params).toEqual(expectedParams);
    }
  });

  it('keeps duck-typed issues independent of zod version — no zod import here', () => {
    // A bespoke issue shape (not actually produced by zod) still round-trips,
    // proving this module has no hidden coupling to zod's runtime types.
    const issues: ZodLikeIssue[] = [{ path: ['x', 'y'], code: 'too_big', message: 'irrelevant', maximum: 5 }];
    const tree = zodIssuesToErrors(issues) as { x: { y: { message: string } } };
    expect(tree.x.y.message).toBe('errors.zod.tooBig');
  });
});

/**
 * `errorMessage` is the three-line `leaf?.message ? t(leaf.message, leaf.params) : undefined`
 * lookup every wizard step/card needs to turn an error-tree leaf into the
 * string a primitive's `error` prop expects — previously duplicated
 * verbatim in `CompanyStep`, `ProductCard`, `CompetitiveStep` and
 * `CompetitorCard`. `t` is faked here as a spy so these tests assert on
 * exactly what was passed to it, without pulling in i18next.
 */
describe('errorMessage', () => {
  it('forwards message and params to t when the leaf has both', () => {
    const t = vi.fn((key: string, params?: Record<string, unknown>) => `${key}:${JSON.stringify(params)}`);
    const result = errorMessage(t, { message: 'errors.zod.tooSmall', params: { minimum: 1 } });

    expect(t).toHaveBeenCalledWith('errors.zod.tooSmall', { minimum: 1 });
    expect(result).toBe('errors.zod.tooSmall:{"minimum":1}');
  });

  it('calls t with undefined params when the leaf has a message but no params', () => {
    const t = vi.fn((key: string) => key);
    const result = errorMessage(t, { message: 'errors.zod.custom' });

    expect(t).toHaveBeenCalledWith('errors.zod.custom', undefined);
    expect(result).toBe('errors.zod.custom');
  });

  it('returns undefined without calling t when the leaf is undefined', () => {
    const t = vi.fn((key: string) => key);
    const result = errorMessage(t, undefined);

    expect(t).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('returns undefined when the leaf has no message', () => {
    const t = vi.fn((key: string) => key);
    const result = errorMessage(t, { params: { minimum: 1 } });

    expect(t).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
