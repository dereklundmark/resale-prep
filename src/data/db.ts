// Layer 1 storage: IndexedDB in this browser only. Everything the app reads
// or writes goes through these functions, so layer 3 swaps this file for
// calls to the Azure Functions API (backed by Azure SQL) and nothing else
// needs to change.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Group, Item, Photo } from '../lib/types';

interface ResaleDB extends DBSchema {
  items: { key: string; value: Item };
  groups: { key: string; value: Group };
  photos: { key: string; value: Photo };
}

const DB_NAME = 'resale-prep';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ResaleDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ResaleDB>> {
  dbPromise ??= openDB<ResaleDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('items', { keyPath: 'id' });
      db.createObjectStore('groups', { keyPath: 'id' });
      db.createObjectStore('photos', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function loadAll(): Promise<{ items: Item[]; groups: Group[] }> {
  const db = await getDb();
  const [items, groups] = await Promise.all([db.getAll('items'), db.getAll('groups')]);
  groups.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { items, groups };
}

export async function putItem(item: Item): Promise<void> {
  await (await getDb()).put('items', item);
}

/** Deletes the item and its photos. */
export async function deleteItem(item: Item): Promise<void> {
  const tx = (await getDb()).transaction(['items', 'photos'], 'readwrite');
  await Promise.all([
    tx.objectStore('items').delete(item.id),
    ...item.photoIds.map((id) => tx.objectStore('photos').delete(id)),
    tx.done,
  ]);
}

export async function putGroup(group: Group): Promise<void> {
  await (await getDb()).put('groups', group);
}

export async function putPhotos(photos: Photo[]): Promise<void> {
  const tx = (await getDb()).transaction('photos', 'readwrite');
  await Promise.all([...photos.map((p) => tx.store.put(p)), tx.done]);
}

export async function getPhoto(id: string): Promise<Photo | undefined> {
  return (await getDb()).get('photos', id);
}

export async function getAllPhotos(): Promise<Photo[]> {
  return (await getDb()).getAll('photos');
}

/** Wipes everything and writes the given data — used by backup import. */
export async function replaceAll(items: Item[], groups: Group[], photos: Photo[]): Promise<void> {
  const tx = (await getDb()).transaction(['items', 'groups', 'photos'], 'readwrite');
  const [is, gs, ps] = [tx.objectStore('items'), tx.objectStore('groups'), tx.objectStore('photos')];
  await Promise.all([is.clear(), gs.clear(), ps.clear()]);
  await Promise.all([
    ...items.map((i) => is.put(i)),
    ...groups.map((g) => gs.put(g)),
    ...photos.map((p) => ps.put(p)),
    tx.done,
  ]);
}
