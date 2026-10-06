import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** The element in the bottom dock (just above the tab bar) that holds the pinned action band. */
export const PinnedSlot = createContext<HTMLElement | null>(null);

/**
 * Renders its children in the dock above the tab bar instead of in the page,
 * so the screen's main action (Generate / Save / Save + next) is always in
 * thumb reach. Unmounting removes it again.
 */
export function Pinned({ children }: { children: ReactNode }) {
  const slot = useContext(PinnedSlot);
  return slot ? createPortal(children, slot) : null;
}
