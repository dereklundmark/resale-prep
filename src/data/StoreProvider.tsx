import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { today } from '../lib/dates';
import { newId } from '../lib/id';
import type { Group, Item } from '../lib/types';
import * as db from './db';
import { StoreContext, type NewListing, type PastSale, type Store } from './store';

// Writes go to storage first, then into React state, so the screen never
// shows something that wasn't actually saved.
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const apply = useCallback((data: { items: Item[]; groups: Group[] }) => {
    setItems(data.items);
    setGroups(data.groups);
    setLoaded(true);
  }, []);

  const reload = useCallback(() => db.loadAll().then(apply), [apply]);

  useEffect(() => {
    void db.loadAll().then(apply);
  }, [apply]);

  const store = useMemo<Store>(() => {
    const upsert = async (item: Item) => {
      await db.putItem(item);
      setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
    };

    return {
      loaded,
      items,
      groups,
      reload,

      async addGroup(name) {
        const trimmed = name.trim();
        const existing = groups.find((g) => g.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return existing;
        const group: Group = { id: newId(), name: trimmed, description: null, createdAt: new Date().toISOString() };
        await db.putGroup(group);
        setGroups((prev) => [...prev, group]);
        return group;
      },

      async saveListing({ photos, ...l }: NewListing) {
        await db.putPhotos(photos);
        const item: Item = {
          id: newId(),
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
        await upsert(item);
        return item;
      },

      async markSold(id, priceSold, dateSold) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        await upsert({ ...item, status: 'sold', priceSold, dateSold });
      },

      async addPastSale({ title, priceSold, month, groupId }: PastSale) {
        await upsert({
          id: newId(),
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
        });
      },

      async deleteItem(id) {
        const item = items.find((i) => i.id === id);
        if (!item) return;
        await db.deleteItem(item);
        setItems((prev) => prev.filter((i) => i.id !== id));
      },
    };
  }, [loaded, items, groups, reload]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
