import { createContext } from 'react';

/** The element in the bottom dock (just above the tab bar) that holds the pinned action band. */
export const PinnedSlot = createContext<HTMLElement | null>(null);
