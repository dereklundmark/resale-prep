// Data from before the database: what the app saved in this browser
// (IndexedDB, layers 1–2) and old Export files. Both are converted to the
// current Item shape so they can be moved into Azure SQL once.
import { openDB, type DBSchema } from 'idb';
import type { Group, Item, Market } from '../lib/types';

/** The item shape stored before the database existed. */
interface LegacyItem extends Omit<Item, 'condition' | 'marketCode' | 'currencyCode' | 'listingLanguage'> {
  condition: string | null; // the Swedish label, e.g. 'Mycket bra skick'
}

interface LegacyPhoto {
  id: string;
  full: Blob;
  thumb: Blob;
  createdAt: string;
}

interface LegacyDB extends DBSchema {
  items: { key: string; value: LegacyItem };
  groups: { key: string; value: Group };
  photos: { key: string; value: LegacyPhoto };
}

const DB_NAME = 'resale-prep';

/** Old items stored the Swedish label; the database stores a code. */
const LABEL_TO_CODE: Record<string, string> = {
  Ny: 'new',
  Nyskick: 'like_new',
  'Mycket bra skick': 'very_good',
  'Bra skick': 'good',
  'Använt skick': 'used',
  Renoveringsobjekt: 'for_parts',
};

/** Converts an old item (or one from an export file) to the current shape. */
export function upgradeItem(raw: Record<string, unknown>, market: Market): Item {
  const it = raw as unknown as Item;
  const condition = typeof raw.condition === 'string' ? (LABEL_TO_CODE[raw.condition] ?? raw.condition) : null;
  return {
    ...it,
    marketCode: it.marketCode ?? market.code,
    currencyCode: it.currencyCode ?? market.currencyCode,
    listingLanguage: it.listingLanguage ?? market.listingLanguage,
    condition,
  };
}

export interface LocalData {
  items: Item[];
  groups: Group[];
  photos: Map<string, { full: Blob; thumb: Blob }>;
}

function open() {
  // Same name and version as before, so this opens the existing data; on a
  // device that never had any, it creates empty stores (harmless).
  return openDB<LegacyDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('items', { keyPath: 'id' });
      db.createObjectStore('groups', { keyPath: 'id' });
      db.createObjectStore('photos', { keyPath: 'id' });
    },
  });
}

/** Items still saved in this browser from before the database. */
export async function readLocal(market: Market): Promise<LocalData> {
  try {
    const db = await open();
    const [items, groups, photos] = await Promise.all([db.getAll('items'), db.getAll('groups'), db.getAll('photos')]);
    db.close();
    return {
      items: items.map((i) => upgradeItem(i as unknown as Record<string, unknown>, market)),
      groups,
      photos: new Map(photos.map((p) => [p.id, { full: p.full, thumb: p.thumb }])),
    };
  } catch {
    return { items: [], groups: [], photos: new Map() };
  }
}

/** Removes the old browser storage once everything is in the database. */
export async function clearLocal(): Promise<void> {
  const db = await open();
  const tx = db.transaction(['items', 'groups', 'photos'], 'readwrite');
  await Promise.all([tx.objectStore('items').clear(), tx.objectStore('groups').clear(), tx.objectStore('photos').clear(), tx.done]);
  db.close();
}
