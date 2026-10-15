/**
 * Formats a catalog price. Cents in, localized currency out — the backend
 * publishes integers so no float ever crosses the wire.
 */
export function formatCents(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
