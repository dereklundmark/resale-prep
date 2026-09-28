// Data model. Mirrors the SQL tables planned for layer 3 (see
// docs/design/README.md "Data model") so the storage swap is mechanical:
// items ↔ Item, groups ↔ Group, photos ↔ Photo.

export type Platform = 'tradera' | 'blocket' | 'facebook';

export type Condition =
  | 'Ny'
  | 'Nyskick'
  | 'Mycket bra skick'
  | 'Bra skick'
  | 'Använt skick'
  | 'Renoveringsobjekt';

export type ItemStatus = 'active' | 'sold';

/** A calendar date as YYYY-MM-DD (local time, no time-of-day). */
export type IsoDate = string;

export interface Estimate {
  low: number;
  high: number;
  reasoning: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  /** null for backfilled sales, where it was never recorded. */
  condition: Condition | null;
  groupId: string | null;
  platforms: Platform[];
  categories: Partial<Record<Platform, string>>;
  priceListed: number | null;
  priceSold: number | null;
  status: ItemStatus;
  /** null for backfilled sales — so days-to-sell is unknown. */
  dateListed: IsoDate | null;
  /** For backfilled sales this is the 1st of the month entered. */
  dateSold: IsoDate | null;
  isBackfill: boolean;
  /** First photo is the thumbnail. */
  photoIds: string[];
  aiEstimate: Estimate | null;
  notes: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Photo {
  id: string;
  /** Compressed full-size JPEG (long edge ≤ 1280 px). */
  full: Blob;
  /** Square 160 px JPEG for list rows. */
  thumb: Blob;
  createdAt: string;
}

/** Filter used by the Active and Sold group rows. */
export type GroupFilter = 'all' | 'ungrouped' | { groupId: string };
