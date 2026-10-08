// Data model. Mirrors the SQL tables (sql/001_schema.sql) and the JSON the
// API sends (api/src/functions/items.ts): items ↔ Item, groups ↔ Group.
//
// Platforms, conditions and markets are data, not code: they come from
// GET /api/config, so adding a marketplace or a country needs no app change.

/** A platform code from dbo.platforms, e.g. 'tradera'. */
export type Platform = string;

/** A condition code from dbo.conditions, e.g. 'very_good'. */
export type Condition = string;

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
  /** Market, currency and listing language the item was made in. */
  marketCode: string;
  currencyCode: string;
  listingLanguage: string;
  title: string;
  description: string;
  /** null for backfilled sales, where it was never recorded. */
  condition: Condition | null;
  groupId: string | null;
  platforms: Platform[];
  categories: Partial<Record<Platform, string>>;
  /**
   * Day the listing went live on each platform. A platform in `platforms`
   * but missing here is picked but not posted yet (the ACTIVE checklist).
   */
  posted: Partial<Record<Platform, IsoDate>>;
  priceListed: number | null;
  priceSold: number | null;
  status: ItemStatus;
  /** null for backfilled sales — so days-to-sell is unknown. */
  dateListed: IsoDate | null;
  /** For backfilled sales this is the 1st of the month entered. */
  dateSold: IsoDate | null;
  isBackfill: boolean;
  /** First photo is the thumbnail. Served by GET /api/photos/{id}. */
  photoIds: string[];
  aiEstimate: Estimate | null;
  notes: string | null;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  /** What the group's money is for, e.g. 'Photo gear fund'. null = no purpose. */
  purpose: string | null;
  createdAt: string;
}

/** Something bought with a group's earnings (the group works as a fund). */
export interface Purchase {
  id: string;
  groupId: string;
  /** What was bought. */
  title: string;
  amount: number;
  currencyCode: string;
  date: IsoDate;
  notes: string | null;
  createdAt: string;
}

/** A photo picked in the app, not uploaded yet. */
export interface PhotoUpload {
  id: string;
  /** Compressed full-size JPEG (long edge ≤ 1280 px). */
  full: Blob;
  /** Square 160 px JPEG for list rows. */
  thumb: Blob;
}

// ---------- catalog (GET /api/config) ----------

export interface Market {
  code: string;
  name: string;
  /** Language listings are written in, e.g. 'sv'. */
  listingLanguage: string;
  /** ISO 4217, e.g. 'SEK'. */
  currencyCode: string;
  /** Number/date formatting, e.g. 'sv-SE'. */
  locale: string;
  isCurrent: boolean;
}

export interface PlatformInfo {
  code: Platform;
  marketCode: string;
  name: string;
  /** Stripe / bar colour. */
  colorStrong: string;
  /** Pill / toggle background. */
  colorTint: string;
  /** Text on the tint. */
  colorText: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface ConditionInfo {
  code: Condition;
  sortOrder: number;
  /** language → label, e.g. { sv: 'Mycket bra skick', en: 'Very good' } */
  labels: Record<string, string>;
}

export interface Catalog {
  markets: Market[];
  platforms: PlatformInfo[];
  conditions: ConditionInfo[];
}

/** Filter used by the Active and Sold group rows. */
export type GroupFilter = 'all' | 'ungrouped' | { groupId: string };
