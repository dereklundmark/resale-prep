import { useEffect, useState } from 'react';
import { getPhoto } from './db';

type Variant = 'full' | 'thumb';

// Object URLs are cached for the life of the page — a few hundred small
// JPEGs at most, so never revoking them is fine.
const cache = new Map<string, Promise<string | null>>();

function load(id: string, variant: Variant): Promise<string | null> {
  const key = `${id}:${variant}`;
  let p = cache.get(key);
  if (!p) {
    p = getPhoto(id).then((photo) => (photo ? URL.createObjectURL(photo[variant]) : null));
    cache.set(key, p);
  }
  return p;
}

export function usePhotoUrl(id: string | undefined, variant: Variant): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);
  const key = id ? `${id}:${variant}` : '';

  useEffect(() => {
    if (!id) return;
    let live = true;
    void load(id, variant).then((url) => live && setLoaded({ key: `${id}:${variant}`, url }));
    return () => {
      live = false;
    };
  }, [id, variant]);

  return loaded?.key === key ? loaded.url : null;
}
