// Export/import of everything as one JSON file (photos inlined as base64).
// Browser storage lives only on this device, so this is the way to move data
// between devices — and into Azure SQL in layer 3.
import type { Group, Item, Photo } from '../lib/types';
import { getAllPhotos, loadAll, replaceAll } from './db';

interface BackupFile {
  app: 'resale-prep';
  version: 1;
  exportedAt: string;
  items: Item[];
  groups: Group[];
  photos: { id: string; createdAt: string; full: string; thumb: string }[];
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export async function exportBackup(): Promise<Blob> {
  const [{ items, groups }, photos] = await Promise.all([loadAll(), getAllPhotos()]);
  const file: BackupFile = {
    app: 'resale-prep',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    groups,
    photos: await Promise.all(
      photos.map(async (p) => ({
        id: p.id,
        createdAt: p.createdAt,
        full: await blobToDataUrl(p.full),
        thumb: await blobToDataUrl(p.thumb),
      })),
    ),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function importBackup(file: Blob): Promise<void> {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'resale-prep' || data.version !== 1) throw new Error('Not a Resale Prep backup file');
  const photos: Photo[] = await Promise.all(
    data.photos.map(async (p) => ({
      id: p.id,
      createdAt: p.createdAt,
      full: await dataUrlToBlob(p.full),
      thumb: await dataUrlToBlob(p.thumb),
    })),
  );
  await replaceAll(data.items, data.groups, photos);
}
