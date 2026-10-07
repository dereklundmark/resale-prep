// Export / import of everything as one JSON file, photos inlined as data
// URLs. The database is the real home of the data; this is a personal copy
// you can keep, and import adds back anything from it that's missing.
import type { Group, Item } from '../lib/types';
import { photoUrl } from './api';
import type { ImportBatch } from './store';

interface BackupFile {
  app: 'resale-prep';
  /** 2 = from the database (version 1 files were pre-database test data). */
  version: 2;
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

/** Reads a backup file into items ready to add to the database. */
export async function readBackup(file: Blob): Promise<ImportBatch> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data?.app !== 'resale-prep' || data.version !== 2 || !Array.isArray(data.items) || !Array.isArray(data.groups)) {
    throw new Error('Not a backup file');
  }
  const photos = new Map<string, { full: Blob; thumb: Blob }>();
  for (const p of data.photos ?? []) {
    photos.set(p.id, { full: await dataUrlToBlob(p.full), thumb: await dataUrlToBlob(p.thumb) });
  }
  return {
    items: data.items,
    groups: data.groups,
    photos,
  };
}
