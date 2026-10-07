import { DEFAULT_CONDITION } from '../lib/constants';
import type { Condition, Estimate, Platform } from '../lib/types';

export interface DraftPhoto {
  id: string;
  full: Blob;
  thumb: Blob;
  fullUrl: string;
  thumbUrl: string;
}

/**
 * Everything on the NEW screen. It lives in App (not the screen) so switching
 * tabs mid-listing doesn't lose it. `*Ok` flags mark a field as confirmed —
 * i.e. the user has touched it, so it turns black and survives a regenerate.
 */
export interface NewDraft {
  photos: DraftPhoto[];
  name: string;
  condition: Condition;
  groupId: string | null;
  /** Platforms switched off for this listing; every enabled platform starts on. */
  platformsOff: Platform[];
  stage: 'form' | 'generating' | 'result';
  error: string | null;

  title: string;
  titleOk: boolean;
  description: string;
  descriptionOk: boolean;
  categoryOptions: Partial<Record<Platform, string[]>>;
  categories: Partial<Record<Platform, string>>;
  categoriesOk: Partial<Record<Platform, boolean>>;
  /** Platforms where "Other…" was picked and a free-text category is shown. */
  categoriesOther: Partial<Record<Platform, boolean>>;
  estimate: Estimate | null;
  ask: string;
}

export function emptyDraft(): NewDraft {
  return {
    photos: [],
    name: '',
    condition: DEFAULT_CONDITION,
    groupId: null,
    platformsOff: [],
    stage: 'form',
    error: null,
    title: '',
    titleOk: false,
    description: '',
    descriptionOk: false,
    categoryOptions: {},
    categories: {},
    categoriesOk: {},
    categoriesOther: {},
    estimate: null,
    ask: '',
  };
}

export function releaseDraftPhotos(photos: DraftPhoto[]): void {
  for (const p of photos) {
    URL.revokeObjectURL(p.fullUrl);
    URL.revokeObjectURL(p.thumbUrl);
  }
}
