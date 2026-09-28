import { usePhotoUrl } from '../data/usePhotoUrl';

/** A stored photo, or nothing while it loads / if it's missing. */
export function PhotoImg({ id, variant, alt = '' }: { id: string | undefined; variant: 'full' | 'thumb'; alt?: string }) {
  const url = usePhotoUrl(id, variant);
  return url ? <img src={url} alt={alt} draggable={false} /> : null;
}
