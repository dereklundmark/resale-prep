import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { UNKNOWN_PLATFORM_COLORS } from '../lib/constants';
import { today } from '../lib/dates';
import { money } from '../lib/format';
import { newId } from '../lib/id';
import type { Catalog, Group, Item, Market, PlatformInfo, Purchase } from '../lib/types';
import { ApiError, api, blobToBase64, onWaking, warmThumbs } from './api';
import { StoreContext, type ImportBatch, type NewListing, type NewPurchase, type PastSale, type Store } from './store';

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
  purchases: Purchase[];
}

function fetchAll(): Promise<Loaded> {
  return Promise.all([
    api.get<Catalog>('/api/config'),
    api.get<{ items: Item[]; groups: Group[]; purchases?: Purchase[] }>('/api/items'),
  ]).then(([catalog, data]) => ({ catalog, ...data, purchases: data.purchases ?? [] }));
}

async function photoPayload(id: string, full: Blob, thumb: Blob) {
  return { id, full: await blobToBase64(full), thumb: await blobToBase64(thumb) };
}

// Every write goes to the API (Azure SQL) first, and only then into React
// state, so the screen never shows something that wasn't actually saved.
// The exception is quick checklist taps (posted ticks, adding or removing a
// platform): they show at once and save in the background, one at a time and
// in order; if a save fails, the app reloads from the database.
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  // Latest items for the instant edits (a quick second tap must build on the
  // first even before React re-renders), and the queue their saves wait in.
  const itemsRef = useRef<Item[]>([]);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const apply = useCallback((d: Loaded) => {
    setCatalog(d.catalog);
    setItems(d.items);
    setGroups(d.groups);
    setPurchases(d.purchases);
    setLoaded(true);
    setLoadError(null);
  }, []);
  const fail = useCallback((e: unknown) => {
    setLoadError(e instanceof ApiError ? e.message : 'Could not load your items.');
  }, []);

  useEffect(() => {
    onWaking(setWaking);
    void fetchAll().then((d) => {
      apply(d);
      // Each list row shows the first photo's thumbnail; have them ready.
      void warmThumbs(d.items.flatMap((i) => i.photoIds.slice(0, 1)));
    }, fail);
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
    // An edit never changes photos, so keep the photo list we already have
    // even if a reply ever comes back without it.
    const put = async (item: Item) => {
      await saveQueue.current.catch(() => undefined); // after any instant edit still saving
      const saved = await api.put<Item>(`/api/items/${item.id}`, item);
      upsert({ ...saved, photoIds: saved.photoIds?.length ? saved.photoIds : item.photoIds });
    };
    /** Shows the change at once, then saves it after any earlier instant edit. */
    const editNow = (id: string, change: (item: Item) => Item): Promise<void> => {
      const current = itemsRef.current.find((i) => i.id === id);
      if (!current) return Promise.resolve();
      const next = change(current);
      itemsRef.current = itemsRef.current.map((i) => (i.id === id ? next : i));
      setItems((prev) => prev.map((i) => (i.id === id ? next : i)));
      const job = saveQueue.current.catch(() => undefined).then(() => api.put<Item>(`/api/items/${id}`, next));
      saveQueue.current = job;
      return job.then(
        () => undefined,
        (e: unknown) => {
          void reload(); // put the screen back in line with the database
          throw e;
        },
      );
    };
    // A group can be deleted while a form still points at it; save such
    // items as Ungrouped rather than failing on the database's foreign key.
    const existingGroup = (id: string | null) => (id && groups.some((g) => g.id === id) ? id : null);
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

      async renameGroup(id, name) {
        const group = await api.put<Group>(`/api/groups/${id}`, { name: name.trim() });
        setGroups((prev) => prev.map((g) => (g.id === id ? group : g)));
      },

      async setGroupPurpose(id, purpose) {
        const group = await api.put<Group>(`/api/groups/${id}`, { purpose: purpose?.trim() || null });
        setGroups((prev) => prev.map((g) => (g.id === id ? group : g)));
      },

      async deleteGroup(id, moveTo) {
        await api.del(`/api/groups/${id}${moveTo ? `?moveTo=${moveTo}` : ''}`);
        setGroups((prev) => prev.filter((g) => g.id !== id));
        // Mirror what the database did: items moved (or Ungrouped), purchases
        // moved (or deleted along with the group).
        setItems((prev) => prev.map((i) => (i.groupId === id ? { ...i, groupId: moveTo } : i)));
        setPurchases((prev) =>
          moveTo ? prev.map((p) => (p.groupId === id ? { ...p, groupId: moveTo } : p)) : prev.filter((p) => p.groupId !== id),
        );
      },

      purchases,

      async addPurchase({ groupId, title, amount, date }: NewPurchase) {
        const purchase: Purchase = {
          id: newId(),
          groupId,
          title: title.trim(),
          amount,
          currencyCode: market.currencyCode,
          date,
          notes: null,
          createdAt: new Date().toISOString(),
        };
        const saved = await api.post<Purchase>('/api/purchases', purchase);
        setPurchases((prev) => [saved, ...prev]);
        return saved;
      },

      async updatePurchase(p) {
        const saved = await api.put<Purchase>(`/api/purchases/${p.id}`, p);
        setPurchases((prev) => prev.map((x) => (x.id === p.id ? saved : x)));
      },

      async deletePurchase(id) {
        await api.del(`/api/purchases/${id}`);
        setPurchases((prev) => prev.filter((x) => x.id !== id));
      },

      async saveListing({ photos, ...l }: NewListing) {
        const item: Item = {
          id: newId(),
          ...marketFields(),
          ...l,
          groupId: existingGroup(l.groupId),
          posted: {}, // ticked on ACTIVE once it's actually live
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
        const item = itemsRef.current.find((i) => i.id === id);
        if (item) await put({ ...item, status: 'sold', priceSold, dateSold });
      },

      setPosted(id, platform, posted) {
        return editNow(id, (item) => {
          const next = { ...item.posted };
          if (posted) next[platform] = today();
          else delete next[platform];
          return { ...item, posted: next };
        });
      },

      setPlatform(id, platform, listed) {
        return editNow(id, (item) => {
          const posted = { ...item.posted };
          const categories = { ...item.categories };
          let platforms = item.platforms.filter((p) => p !== platform);
          if (listed) {
            const order = (p: string) => byCode.get(p)?.sortOrder ?? 99;
            platforms = [...platforms, platform].sort((a, b) => order(a) - order(b));
          } else {
            delete posted[platform];
            delete categories[platform];
          }
          return { ...item, platforms, posted, categories };
        });
      },

      async addPastSale({ title, priceSold, month, groupId }: PastSale) {
        const item: Item = {
          id: newId(),
          ...marketFields(),
          title,
          description: '',
          condition: null,
          groupId: existingGroup(groupId),
          platforms: [],
          categories: {},
          posted: {},
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

      async importItems({ items: incoming, groups: incomingGroups, purchases: incomingPurchases, photos }: ImportBatch) {
        // Groups are matched by name: the database may already have one
        // called "Garage Cleanout" under a different id.
        const groupIdMap = new Map<string, string>();
        for (const g of incomingGroups) {
          const group = await addGroup(g.name);
          groupIdMap.set(g.id, group.id);
          if (g.purpose && !group.purpose) {
            const withPurpose = await api.put<Group>(`/api/groups/${group.id}`, { purpose: g.purpose });
            setGroups((prev) => prev.map((x) => (x.id === group.id ? withPurpose : x)));
          }
        }

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

        const knownPurchases = new Set(purchases.map((p) => p.id));
        for (const p of incomingPurchases) {
          const groupId = groupIdMap.get(p.groupId);
          if (knownPurchases.has(p.id) || !groupId) continue;
          try {
            const saved = await api.post<Purchase>('/api/purchases', { ...p, groupId });
            setPurchases((prev) => [saved, ...prev]);
          } catch (e) {
            if (e instanceof ApiError && e.status === 409) continue;
            throw e;
          }
        }
        return added;
      },
    };
  }, [loaded, loadError, waking, catalog, items, groups, purchases, reload]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
