// Export / import of everything as one JSON file, photos inlined as data
// URLs. The database is the real home of the data now; this is a personal
// copy you can keep, and a way to bring old (pre-database) data in.
import type { Group, Item, Market } from '../lib/types';
import { photoUrl } from './api';
import { upgradeItem } from './legacyLocal';
import type { ImportBatch } from './store';

interface BackupFile {
  app: 'resale-prep';
  /** 1 = before the database (browser storage), 2 = from the database. */
  version: 1 | 2;
  exportedAt: string;
  items: Item[];
  groups: Group[];
  photos: { id: string; full: string; thumb: string }[];
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function fetchPhoto(id: string, size: 'full' | 'thumb'): Promise<string> {
  const res = await fetch(photoUrl(id, size));
  if (!res.ok) throw new Error(`Couldn't download a photo (HTTP ${res.status})`);
  return blobToDataUrl(await res.blob());
}

export async function exportBackup(items: Item[], groups: Group[]): Promise<Blob> {
  const photos: BackupFile['photos'] = [];
  for (const id of items.flatMap((i) => i.photoIds)) {
    photos.push({ id, full: await fetchPhoto(id, 'full'), thumb: await fetchPhoto(id, 'thumb') });
  }
  const file: BackupFile = { app: 'resale-prep', version: 2, exportedAt: new Date().toISOString(), items, groups, photos };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

/** Reads a backup file (old or new format) into items ready to add to the database. */
export async function readBackup(file: Blob, market: Market): Promise<ImportBatch> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data?.app !== 'resale-prep' || !Array.isArray(data.items) || !Array.isArray(data.groups)) {
    throw new Error('Not a backup file');
  }
  const photos = new Map<string, { full: Blob; thumb: Blob }>();
  for (const p of data.photos ?? []) {
    photos.set(p.id, { full: await dataUrlToBlob(p.full), thumb: await dataUrlToBlob(p.thumb) });
  }
  return {
    items: data.items.map((i) => upgradeItem(i as unknown as Record<string, unknown>, market)),
    groups: data.groups,
    photos,
  };
}
