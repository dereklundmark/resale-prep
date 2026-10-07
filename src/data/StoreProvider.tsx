import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UNKNOWN_PLATFORM_COLORS } from '../lib/constants';
import { today } from '../lib/dates';
import { money } from '../lib/format';
import { newId } from '../lib/id';
import type { Catalog, Group, Item, Market, PlatformInfo } from '../lib/types';
import { ApiError, api, blobToBase64, onWaking } from './api';
import { StoreContext, type ImportBatch, type NewListing, type PastSale, type Store } from './store';

const EMPTY_CATALOG: Catalog = { markets: [], platforms: [], conditions: [] };

/** Used only until the catalog has loaded (nothing is shown before then). */
const FALLBACK_MARKET: Market = {
  code: 'SE',
  name: 'Sweden',
  listingLanguage: 'sv',
  currencyCode: 'SEK',
  locale: 'sv-SE',
  isCurrent: true,
};

interface Loaded {
  catalog: Catalog;
  items: Item[];
  groups: Group[];
}

function fetchAll(): Promise<Loaded> {
  return Promise.all([
    api.get<Catalog>('/api/config'),
    api.get<{ items: Item[]; groups: Group[] }>('/api/items'),
  ]).then(([catalog, data]) => ({ catalog, ...data }));
}

async function photoPayload(id: string, full: Blob, thumb: Blob) {
  return { id, full: await blobToBase64(full), thumb: await blobToBase64(thumb) };
}

// Every write goes to the API (Azure SQL) first, and only then into React
// state, so the screen never shows something that wasn't actually saved.
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const apply = useCallback((d: Loaded) => {
    setCatalog(d.catalog);
    setItems(d.items);
    setGroups(d.groups);
    setLoaded(true);
    setLoadError(null);
  }, []);
  const fail = useCallback((e: unknown) => {
    setLoadError(e instanceof ApiError ? e.message : 'Could not load your items.');
  }, []);

  useEffect(() => {
    onWaking(setWaking);
    void fetchAll().then(apply, fail);
  }, [apply, fail]);

  const reload = useCallback(() => {
    setLoadError(null);
    return fetchAll().then(apply, fail);
  }, [apply, fail]);

  const store = useMemo<Store>(() => {
    const market = catalog.markets.find((m) => m.isCurrent) ?? catalog.markets[0] ?? FALLBACK_MARKET;
    const byCode = new Map(catalog.platforms.map((p) => [p.code, p]));
    const conditions = [...catalog.conditions].sort((a, b) => a.sortOrder - b.sortOrder);

    const upsert = (item: Item) => setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
    const put = async (item: Item) => upsert(await api.put<Item>(`/api/items/${item.id}`, item));
    const marketFields = () => ({
      marketCode: market.code,
      currencyCode: market.currencyCode,
      listingLanguage: market.listingLanguage,
    });

    const addGroup = async (name: string): Promise<Group> => {
      const group = await api.post<Group>('/api/groups', { id: newId(), name: name.trim() });
      setGroups((prev) => (prev.some((g) => g.id === group.id) ? prev : [...prev, group]));
      return group;
    };

    return {
      loaded,
      loadError,
      waking,
      catalog,
      market,
      activePlatforms: catalog.platforms
        .filter((p) => p.isEnabled && p.marketCode === market.code)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      conditions,
      platform(code): PlatformInfo {
        return (
          byCode.get(code) ?? {
            code,
            marketCode: market.code,
            name: code,
            sortOrder: 99,
            isEnabled: false,
            ...UNKNOWN_PLATFORM_COLORS,
          }
        );
      },
      conditionLabel(code) {
        if (!code) return '—';
        const c = conditions.find((x) => x.code === code);
        return c?.labels[market.listingLanguage] ?? c?.labels.en ?? code;
      },
      money(amount, currency = market.currencyCode) {
        return money(amount, currency, market.locale);
      },

      items,
      groups,
      reload,
      addGroup,

      async saveListing({ photos, ...l }: NewListing) {
        const item: Item = {
          id: newId(),
          ...marketFields(),
          ...l,
          photoIds: photos.map((p) => p.id),
          priceSold: null,
          status: 'active',
          dateListed: today(),
          dateSold: null,
          isBackfill: false,
          notes: null,
          createdAt: new Date().toISOString(),
        };
        const uploads = await Promise.all(photos.map((p) => photoPayload(p.id, p.full, p.thumb)));
        const saved = await api.post<Item>('/api/items', { ...item, photos: uploads });
        upsert(saved);
        return saved;
      },

      async markSold(id, priceSold, dateSold) {
        const item = items.find((i) => i.id === id);
        if (item) await put({ ...item, status: 'sold', priceSold, dateSold });
      },

      async addPastSale({ title, priceSold, month, groupId }: PastSale) {
        const item: Item = {
          id: newId(),
          ...marketFields(),
          title,
          description: '',
          condition: null,
          groupId,
          platforms: [],
          categories: {},
          priceListed: null,
          priceSold,
          status: 'sold',
          dateListed: null,
          dateSold: `${month}-01`,
          isBackfill: true,
          photoIds: [],
          aiEstimate: null,
          notes: null,
          createdAt: new Date().toISOString(),
        };
        upsert(await api.post<Item>('/api/items', item));
      },

      updateItem: put,

      async deleteItem(id) {
        await api.del(`/api/items/${id}`);
        setItems((prev) => prev.filter((i) => i.id !== id));
      },

      async importItems({ items: incoming, groups: incomingGroups, photos }: ImportBatch) {
        // Groups are matched by name: the database may already have one
        // called "Garage Cleanout" under a different id.
        const groupIdMap = new Map<string, string>();
        for (const g of incomingGroups) groupIdMap.set(g.id, (await addGroup(g.name)).id);

        const known = new Set(items.map((i) => i.id));
        let added = 0;
        for (const it of incoming) {
          if (known.has(it.id)) continue;
          const uploads = [];
          for (const pid of it.photoIds) {
            const p = photos.get(pid);
            if (p) uploads.push(await photoPayload(pid, p.full, p.thumb));
          }
          try {
            const saved = await api.post<Item>('/api/items', {
              ...it,
              groupId: it.groupId ? (groupIdMap.get(it.groupId) ?? null) : null,
              photos: uploads,
            });
            upsert(saved);
            added++;
          } catch (e) {
            if (e instanceof ApiError && e.status === 409) continue; // already there
            throw e;
          }
        }
        return added;
      },
    };
  }, [loaded, loadError, waking, catalog, items, groups, reload]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
