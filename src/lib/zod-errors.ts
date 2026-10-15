/**
 * Turns a flat list of Zod issues into the nested tree shape react-hook-form's
 * `FieldErrors` expects (one node per path segment, `{ type, message }` —
 * plus `params` when the issue carries detail worth showing — at the
 * leaves). Zod's own issue list is flat (`path: ['channels', 0, 'cac']`);
 * react-hook-form's error objects are nested (`errors.channels[0].cac`).
 *
 * `message` is an **i18n key**, not English text — the same convention
 * `GoalNewPage`/`IcpNewPage`/`StrategyNewPage` already use via
 * `t(fieldState.error.message)`. This module never imports i18next: it is a
 * pure mapping from Zod issue *codes* to keys, kept independent of any
 * particular locale so it can be unit-tested without a translation runtime.
 *
 * Why map by *code* and not forward `issue.message`: Kubb-generated Zod
 * schemas (`src/api/generated/zod/*SectionSchema.ts`) carry no custom
 * messages — every constraint (`min`, `url`, enum membership, ...) falls
 * back to Zod's own English default. Passing `issue.message` through would
 * leak that English into `errors[...].message`, which the wizard steps then
 * feed straight into `t()`. Mapping by `code` instead means the far larger
 * generated surface gets translated messages for free, same as the few
 * hand-authored schemas that remain elsewhere in `src/schemas/`.
 *
 * Zod issue codes were read from the installed `zod` v4.4.3 package's own
 * types (`node_modules/zod/src/v4/core/errors.ts`, the `$ZodIssue` union) and
 * confirmed against real `safeParse` output — v3 renamed several of these
 * (e.g. v3's `invalid_string`/`invalid_enum_value` don't exist in v4;
 * v4 has `invalid_format`/`invalid_value` instead).
 */

/**
 * Minimal shape this module needs from a Zod issue. Kept duck-typed (rather
 * than importing zod's own issue type) so callers don't care which zod
 * version produced the error, and so this file has no import of `zod`
 * itself. The extra fields are only ever present on the issue codes that
 * carry them (e.g. `minimum` on `too_small`) — all optional and typed
 * `unknown` because this module never inspects their shape, only forwards
 * them as i18n interpolation values.
 */
export interface ZodLikeIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly code: string;
  readonly expected?: unknown;
  readonly minimum?: unknown;
  readonly maximum?: unknown;
  readonly format?: unknown;
  readonly values?: unknown;
  readonly keys?: unknown;
  readonly divisor?: unknown;
}

/**
 * One leaf of the error tree: an i18n key plus, when the issue carries
 * detail worth showing (a minimum, a maximum, the accepted values, ...),
 * the interpolation values for it — meant to be consumed as
 * `t(leaf.message, leaf.params)`.
 */
export interface ZodErrorLeaf {
  readonly type: string;
  readonly message: string;
  readonly params?: Record<string, unknown>;
}

/**
 * Every code in zod v4's `$ZodIssue` union that this app's section schemas
 * can plausibly produce, mapped to a key under the `errors.zod` namespace
 * (see `src/i18n/locales/*.json`). Deliberately omits `invalid_key` and
 * `invalid_element` — those only apply to `z.record`/`z.map`/`z.set`, none
 * of which appear anywhere in the business-context sections — so an
 * unexpected future code, not just a typo, is what would ever hit the
 * fallback below.
 */
const CODE_TO_KEY: Record<string, string> = {
  invalid_type: 'errors.zod.invalidType',
  too_small: 'errors.zod.tooSmall',
  too_big: 'errors.zod.tooBig',
  invalid_format: 'errors.zod.invalidFormat',
  invalid_value: 'errors.zod.invalidValue',
  unrecognized_keys: 'errors.zod.unrecognizedKeys',
  not_multiple_of: 'errors.zod.notMultipleOf',
  invalid_union: 'errors.zod.invalidUnion',
  custom: 'errors.zod.custom',
};

/** Never raw English — any code not in `CODE_TO_KEY` lands here instead. */
export const ZOD_ERROR_FALLBACK_KEY = 'errors.zod.generic';

/**
 * The interpolation values worth surfacing for a given issue, if any.
 * Arrays are joined into a display string here (rather than left for the
 * template) because `t()` interpolation stringifies values itself and a
 * joined list reads better than `values.join(',')`'s default comma-only
 * spacing.
 */
function paramsFor(issue: ZodLikeIssue): Record<string, unknown> | undefined {
  switch (issue.code) {
    case 'invalid_type':
      return { expected: issue.expected };
    case 'too_small':
      return { minimum: issue.minimum };
    case 'too_big':
      return { maximum: issue.maximum };
    case 'invalid_format':
      return { format: issue.format };
    case 'invalid_value':
      return { values: Array.isArray(issue.values) ? issue.values.join(', ') : issue.values };
    case 'unrecognized_keys':
      return { keys: Array.isArray(issue.keys) ? issue.keys.join(', ') : issue.keys };
    case 'not_multiple_of':
      return { divisor: issue.divisor };
    default:
      return undefined;
  }
}

/**
 * Structural shape `errorMessage` needs from an error-tree leaf. Deliberately
 * looser than `ZodErrorLeaf`: react-hook-form's own `FieldError` (what a
 * step actually reads off `errors.<slice>.<field>` once it's typed as
 * `FieldErrors<...>`) has `message?: string` but no `params` — and since
 * `params` here is optional, a plain `FieldError` satisfies this type too.
 * Both this module's own `ZodErrorLeaf` and react-hook-form's `FieldError`
 * are assignable to it without a cast.
 */
export interface ErrorLeafLike {
  readonly message?: string;
  readonly params?: Record<string, unknown>;
}

/**
 * Renders an error-tree leaf through `t`, forwarding `params` for
 * interpolation (`t('errors.zod.tooSmall', { minimum: 1 })` →
 * "must be at least 1", not "must be at least {{minimum}}"). Returns
 * `undefined` — not an empty string — when there is no message, so a
 * primitive's `error` prop stays absent rather than rendering an empty
 * error paragraph.
 *
 * Lives here, not in each step component, because every wizard step and
 * card (`CompanyStep`, `ProductCard`, `CompetitiveStep`, `CompetitorCard`,
 * and the steps still to come) needs the exact same three-line lookup —
 * duplicating it per file only pays off once, then just multiplies the
 * next typo.
 */
export function errorMessage(
  t: (key: string, params?: Record<string, unknown>) => string,
  leaf?: ErrorLeafLike,
): string | undefined {
  return leaf?.message ? t(leaf.message, leaf.params) : undefined;
}

/** Sentinel key an empty-path issue (a root-level `.refine()`, a strict-object
 * `unrecognized_keys`) is filed under, instead of being silently dropped.
 * `root` is not an arbitrary choice: react-hook-form's own `FieldErrors<T>`
 * already reserves a `root` slot for exactly this — form-level errors that
 * don't belong to any single field — so a step can read `errors.root` with
 * no shape surprises.
 */
const ROOT_KEY = 'root';

export function zodIssuesToErrors(issues: readonly ZodLikeIssue[]): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  for (const issue of issues) {
    const segments = issue.path.map(String);
    const leaf = segments.length === 0 ? ROOT_KEY : (segments.pop() as string);
    let node = tree;
    for (const segment of segments) {
      node = (node[segment] ??= {}) as Record<string, unknown>;
    }
    const params = paramsFor(issue);
    const entry: ZodErrorLeaf = {
      type: issue.code,
      message: CODE_TO_KEY[issue.code] ?? ZOD_ERROR_FALLBACK_KEY,
      ...(params ? { params } : {}),
    };
    node[leaf] = entry;
  }
  return tree;
}
