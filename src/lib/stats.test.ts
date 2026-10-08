import { describe, expect, it } from 'vitest';
import { daysBetween, today } from './dates';
import { currencySymbol, money, monthYear } from './format';
import { daysListed, daysToSell, groupSummaries, matchesFilter, sortActive, sortSold } from './stats';
import type { Group, Item } from './types';

function item(over: Partial<Item>): Item {
  return {
    id: Math.random().toString(36),
    marketCode: 'SE',
    currencyCode: 'SEK',
    listingLanguage: 'sv',
    title: 'x',
    description: '',
    condition: 'good',
    groupId: null,
    platforms: [],
    categories: {},
    posted: {},
    priceListed: 100,
    priceSold: null,
    status: 'active',
    dateListed: '2026-09-01',
    dateSold: null,
    isBackfill: false,
    photoIds: [],
    aiEstimate: null,
    notes: null,
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  };
}

describe('dates', () => {
  it('counts whole days across a DST change', () => {
    expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10);
  });
  it('never goes negative', () => {
    expect(daysBetween('2026-10-02', '2026-10-01')).toBe(0);
  });
  it('formats local today', () => {
    expect(today(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('format', () => {
  // Intl uses non-breaking spaces; normalise them for the comparison.
  const plain = (s: string) => s.replace(/\s/g, ' ');
  it('formats money per currency and locale', () => {
    expect(plain(money(1200))).toBe('1 200 kr');
    expect(plain(money(1200, 'EUR', 'de-DE'))).toBe('1.200 €');
    expect(plain(money(12.5, 'EUR', 'de-DE'))).toBe('12,50 €');
    expect(currencySymbol('SEK', 'sv-SE')).toBe('kr');
  });
  it('formats month', () => {
    expect(monthYear('2026-09-14')).toBe('Sep 2026');
    expect(monthYear('2025-11')).toBe('Nov 2025');
  });
});

describe('stats', () => {
  it('derives days listed and days to sell', () => {
    expect(daysListed(item({ dateListed: '2026-09-01' }), '2026-09-28')).toBe(27);
    expect(daysToSell(item({ dateListed: '2026-09-01', dateSold: '2026-09-07' }))).toBe(6);
    expect(daysToSell(item({ dateListed: null, dateSold: '2026-09-01', isBackfill: true }))).toBeNull();
  });

  it('filters by group', () => {
    const a = item({ groupId: 'g1' });
    const b = item({ groupId: null });
    expect(matchesFilter(a, 'all')).toBe(true);
    expect(matchesFilter(a, 'ungrouped')).toBe(false);
    expect(matchesFilter(b, 'ungrouped')).toBe(true);
    expect(matchesFilter(a, { groupId: 'g1' })).toBe(true);
  });

  it('sorts active oldest-listed first and sold newest-sold first', () => {
    const old = item({ id: 'old', dateListed: '2026-08-01' });
    const fresh = item({ id: 'new', dateListed: '2026-09-20' });
    expect(sortActive([fresh, old], '2026-09-28').map((i) => i.id)).toEqual(['old', 'new']);
    const s1 = item({ id: 's1', status: 'sold', dateSold: '2025-01-01' });
    const s2 = item({ id: 's2', status: 'sold', dateSold: '2026-09-01' });
    expect(sortSold([s1, s2]).map((i) => i.id)).toEqual(['s2', 's1']);
  });

  it('summarises per group with an Ungrouped bucket', () => {
    const groups: Group[] = [{ id: 'g1', name: 'Garage', description: null, purpose: null, createdAt: '' }];
    const items = [
      item({ groupId: 'g1', status: 'sold', priceSold: 500 }),
      item({ groupId: 'g1', priceListed: 300 }),
      item({ groupId: null, status: 'sold', priceSold: 200 }),
    ];
    const [garage, ungrouped] = groupSummaries(items, groups);
    expect(garage).toMatchObject({ name: 'Garage', revenue: 500, askTotal: 300 });
    expect(garage.sold).toHaveLength(1);
    expect(ungrouped).toMatchObject({ groupId: null, name: 'Ungrouped', revenue: 200, askTotal: 0 });
  });
});


describe('group funds', () => {
  const groups: Group[] = [{ id: 'g1', name: 'Garage Cleanup', description: null, purpose: 'Photo gear fund', createdAt: '' }];
  const sales = [item({ groupId: 'g1', status: 'sold', priceSold: 6020 })];
  const lens = { id: 'p1', groupId: 'g1', title: 'Lens', amount: 3900, currencyCode: 'SEK', date: '2026-09-20', notes: null, createdAt: '' };

  it('left = earned - spent; purchases never change earned', () => {
    const [g] = groupSummaries(sales, groups, [lens]);
    expect(g).toMatchObject({ revenue: 6020, spent: 3900, left: 2120, hasFund: true });
  });
  it('goes negative when overspent', () => {
    const [g] = groupSummaries(sales, groups, [lens, { ...lens, id: 'p2', amount: 3000 }]);
    expect(g.left).toBe(-880);
  });
  it('a group is a fund only with a purpose or purchases; Ungrouped never is', () => {
    const plain = [{ ...groups[0], purpose: null }];
    const [g, ungrouped] = groupSummaries(sales, plain, []);
    expect(g.hasFund).toBe(false);
    expect(ungrouped.hasFund).toBe(false);
  });
});
