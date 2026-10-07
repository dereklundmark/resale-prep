import { photoUrl } from '../data/api';

/** A stored photo, loaded from the API (the browser caches it). */
export function PhotoImg({ id, variant, alt = '' }: { id: string | undefined; variant: 'full' | 'thumb'; alt?: string }) {
  return id ? <img src={photoUrl(id, variant)} alt={alt} loading="lazy" draggable={false} /> : null;
}
