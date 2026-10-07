const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1200 → "1 200" (grouping per locale; sv-SE uses a space). */
export function num(n: number, locale = 'sv-SE'): string {
  return Math.round(n).toLocaleString(locale);
}

/**
 * 1200, 'SEK', 'sv-SE' → "1 200 kr"; 1200, 'EUR', 'de-DE' → "1.200 €".
 * Whole amounts show no decimals; amounts with cents show them.
 */
export function money(n: number, currency = 'SEK', locale = 'sv-SE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** 'SEK', 'sv-SE' → "kr"; 'EUR', 'de-DE' → "€". */
export function currencySymbol(currency = 'SEK', locale = 'sv-SE'): string {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? currency;
}

/** "2026-09-14" or "2026-09" → "Sep 2026". */
export function monthYear(date: string): string {
  const [y, m] = date.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "2026-10-03" → "3 Oct". */
export function dayMonth(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "2026-09-14" → "14 Sep 2026". */
export function dayMonthYear(date: string): string {
  return `${dayMonth(date)} ${date.slice(0, 4)}`;
}

/** Keeps digits only — for the kr inputs. */
export function digitsOnly(s: string): string {
  return s.replace(/[^0-9]/g, '');
}
