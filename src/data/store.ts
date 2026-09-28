import { createContext, useContext } from 'react';
import type { Condition, Estimate, Group, IsoDate, Item, Photo, Platform } from '../lib/types';

export interface NewListing {
  title: string;
  description: string;
  condition: Condition;
  groupId: string | null;
  platforms: Platform[];
  categories: Partial<Record<Platform, string>>;
  priceListed: number;
  aiEstimate: Estimate | null;
  photos: Photo[];
}

export interface PastSale {
  title: string;
  priceSold: number;
  /** YYYY-MM */
  month: string;
  groupId: string | null;
}

export interface Store {
  loaded: boolean;
  items: Item[];
  groups: Group[];
  addGroup(name: string): Promise<Group>;
  saveListing(listing: NewListing): Promise<Item>;
  markSold(id: string, priceSold: number, dateSold: IsoDate): Promise<void>;
  addPastSale(sale: PastSale): Promise<void>;
  deleteItem(id: string): Promise<void>;
  reload(): Promise<void>;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
