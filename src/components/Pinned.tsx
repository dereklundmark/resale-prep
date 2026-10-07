import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PinnedSlot } from './pinnedSlot';

/**
 * Renders its children in the dock above the tab bar instead of in the page,
 * so the screen's main action (Generate / Save / Save + next) is always in
 * thumb reach. Unmounting removes it again.
 */
export function Pinned({ children }: { children: ReactNode }) {
  const slot = useContext(PinnedSlot);
  return slot ? createPortal(children, slot) : null;
}
