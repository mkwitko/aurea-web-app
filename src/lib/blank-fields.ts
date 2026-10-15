/**
 * Drops object properties whose value is a blank string.
 *
 * Text inputs report `''` for "the user left this empty", but `''` is not a
 * domain value — it is a UI artifact. The API models an unset optional field as
 * absent, and a field with a format constraint rejects `''` outright: the
 * server's `url` is `z.string().url().optional()`, so sending `url: ''` for a
 * competitor whose URL the user never filled would come back as a 400 the user
 * cannot act on. The same applies to any future `.datetime()` or `.email()`
 * field, which is why this runs once at the save boundary rather than being
 * remembered in each of the nine step components.
 *
 * `JSON.stringify` omits keys whose value is `undefined`, so an omitted key is
 * what reaches the wire — exactly what `.optional()` accepts.
 *
 * Array elements are recursed into but never removed: dropping one would shift
 * every later index, and a blank string inside a string array is harmless
 * because those fields carry no format constraint.
 */
export function dropBlankFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => dropBlankFields(item)) as T;
  }

  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && item.trim() === '') continue;
    out[key] = dropBlankFields(item);
  }
  return out as T;
}
