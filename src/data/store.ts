import { createContext, useContext } from 'react';
import type {
  Catalog,
  Condition,
  ConditionInfo,
  Estimate,
  Group,
  IsoDate,
  Item,
  Market,
  PhotoUpload,
  Platform,
  PlatformInfo,
  Purchase,
} from '../lib/types';

export interface NewListing {
  title: string;
  description: string;
  condition: Condition;
  groupId: string | null;
  platforms: Platform[];
  categories: Partial<Record<Platform, string>>;
  priceListed: number;
  aiEstimate: Estimate | null;
  photos: PhotoUpload[];
}

export interface PastSale {
  title: string;
  priceSold: number;
  /** YYYY-MM */
  month: string;
  groupId: string | null;
}

/** Items to add from a backup file. */
export interface ImportBatch {
  items: Item[];
  groups: Group[];
  purchases: Purchase[];
  photos: Map<string, { full: Blob; thumb: Blob }>;
}

export interface NewPurchase {
  groupId: string;
  title: string;
  amount: number;
  date: IsoDate;
}

export interface Store {
  loaded: boolean;
  /** Set when the first load failed; the app shows it with a Retry button. */
  loadError: string | null;
  /** True while the database is resuming from its pause. */
  waking: boolean;

  catalog: Catalog;
  /** The market new items are created in. */
  market: Market;
  /** Enabled platforms of the current market, in display order. */
  activePlatforms: PlatformInfo[];
  /** Conditions, best first. */
  conditions: ConditionInfo[];
  platform(code: Platform): PlatformInfo;
  /** Label in the market's listing language, e.g. 'Mycket bra skick'; '—' for none. */
  conditionLabel(code: Condition | null): string;
  /** Formats an amount; defaults to the current market's currency. */
  money(amount: number, currency?: string): string;

  items: Item[];
  groups: Group[];
  addGroup(name: string): Promise<Group>;
  renameGroup(id: string, name: string): Promise<void>;
  /** Names the group's fund; null removes it. */
  setGroupPurpose(id: string, purpose: string | null): Promise<void>;
  /**
   * Deletes the group after moving its items and purchases to moveTo.
   * moveTo null: items become Ungrouped and purchases are deleted.
   */
  deleteGroup(id: string, moveTo: string | null): Promise<void>;

  purchases: Purchase[];
  addPurchase(p: NewPurchase): Promise<Purchase>;
  updatePurchase(p: Purchase): Promise<void>;
  deletePurchase(id: string): Promise<void>;
  saveListing(listing: NewListing): Promise<Item>;
  markSold(id: string, priceSold: number, dateSold: IsoDate): Promise<void>;
  addPastSale(sale: PastSale): Promise<void>;
  /** Saves an edited item (same id). */
  updateItem(item: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  /** Adds items (and purchases) that aren't in the database yet; returns how many items were added. */
  importItems(batch: ImportBatch): Promise<number>;
  reload(): Promise<void>;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
