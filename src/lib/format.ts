const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1200 → "1 200" (sv-SE grouping). */
export function num(n: number): string {
  return Math.round(n).toLocaleString('sv-SE');
}

/** 1200 → "1 200 kr". */
export function kr(n: number): string {
  return `${num(n)} kr`;
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
