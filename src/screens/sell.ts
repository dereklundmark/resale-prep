import { today } from '../lib/dates';
import type { IsoDate, Item } from '../lib/types';

export type LeftMode = 'days' | 'photo';

/** The open inline "Sold for" bar on ACTIVE. */
export interface SellState {
  id: string;
  price: string;
  date: IsoDate;
}

export function startSell(item: Item): SellState {
  return { id: item.id, price: String(item.priceListed ?? ''), date: today() };
}
