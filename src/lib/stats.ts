// Everything derived at render time — nothing here is ever stored.
import { daysBetween } from './dates';
import type { Group, GroupFilter, IsoDate, Item, Purchase } from './types';

export function daysListed(item: Item, onDay: IsoDate): number {
  return item.dateListed ? daysBetween(item.dateListed, onDay) : 0;
}

/** null when unknown (backfilled sales have no listing date). */
export function daysToSell(item: Item): number | null {
  return item.dateListed && item.dateSold ? daysBetween(item.dateListed, item.dateSold) : null;
}

export function matchesFilter(item: Item, filter: GroupFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ungrouped') return item.groupId === null;
  return item.groupId === filter.groupId;
}

export function sameFilter(a: GroupFilter, b: GroupFilter): boolean {
  return typeof a === 'string' || typeof b === 'string' ? a === b : a.groupId === b.groupId;
}

export function filterLabel(filter: GroupFilter, groups: Group[]): string {
  if (filter === 'all') return 'All groups';
  if (filter === 'ungrouped') return 'Ungrouped';
  return groups.find((g) => g.id === filter.groupId)?.name ?? 'Group';
}

export const soldPrice = (i: Item) => i.priceSold ?? 0;
export const askPrice = (i: Item) => i.priceListed ?? 0;
export const sum = (items: Item[], f: (i: Item) => number) => items.reduce((a, i) => a + f(i), 0);

export function activeItems(items: Item[]): Item[] {
  return items.filter((i) => i.status === 'active');
}

export function soldItems(items: Item[]): Item[] {
  return items.filter((i) => i.status === 'sold');
}

/** Active rows: longest-listed first. */
export function sortActive(items: Item[], onDay: IsoDate): Item[] {
  return [...items].sort((a, b) => daysListed(b, onDay) - daysListed(a, onDay) || b.createdAt.localeCompare(a.createdAt));
}

/** Sold rows: newest sale first. */
export function sortSold(items: Item[]): Item[] {
  return [...items].sort(
    (a, b) => (b.dateSold ?? '').localeCompare(a.dateSold ?? '') || b.createdAt.localeCompare(a.createdAt),
  );
}

export interface GroupSummary {
  /** null = the Ungrouped bucket. */
  groupId: string | null;
  name: string;
  sold: Item[];
  active: Item[];
  /** Earned: sum of sold prices. */
  revenue: number;
  askTotal: number;
  // Fund (design v3): a group's earnings minus what was bought with them.
  purpose: string | null;
  /** Newest first. */
  purchases: Purchase[];
  spent: number;
  /** revenue - spent; negative when overspent. */
  left: number;
  /** Shows the fund UI: a purpose is set or something was bought. */
  hasFund: boolean;
}

/** One entry per group in creation order, then Ungrouped (always present). */
export function groupSummaries(items: Item[], groups: Group[], purchases: Purchase[] = []): GroupSummary[] {
  const buckets: { groupId: string | null; name: string; purpose: string | null }[] = [
    ...groups.map((g) => ({ groupId: g.id, name: g.name, purpose: g.purpose ?? null })),
    { groupId: null, name: 'Ungrouped', purpose: null },
  ];
  return buckets.map(({ groupId, name, purpose }) => {
    const mine = items.filter((i) => i.groupId === groupId);
    const sold = sortSold(soldItems(mine));
    const active = activeItems(mine);
    const bought = purchases
      .filter((p) => groupId !== null && p.groupId === groupId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const revenue = sum(sold, soldPrice);
    const spent = bought.reduce((a, p) => a + p.amount, 0);
    return {
      groupId,
      name,
      sold,
      active,
      revenue,
      askTotal: sum(active, askPrice),
      purpose,
      purchases: bought,
      spent,
      left: revenue - spent,
      hasFund: groupId !== null && (purpose !== null || bought.length > 0),
    };
  });
}
