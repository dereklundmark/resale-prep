import type { IsoDate } from './types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's local date as YYYY-MM-DD. */
export function today(now: Date = new Date()): IsoDate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Current local month as YYYY-MM. */
export function thisMonth(now: Date = new Date()): string {
  return today(now).slice(0, 7);
}

function toUtcDay(d: IsoDate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). Never negative. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.max(0, Math.round(toUtcDay(to) - toUtcDay(from)));
}
