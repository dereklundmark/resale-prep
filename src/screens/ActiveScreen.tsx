import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GroupFilterRow } from '../components/GroupFilterRow';
import { PhotoImg } from '../components/PhotoImg';
import { useStore } from '../data/store';
import { STALE_DAYS } from '../lib/constants';
import { today } from '../lib/dates';
import { dayMonth, digitsOnly } from '../lib/format';
import { activeItems, daysListed, matchesFilter, sortActive } from '../lib/stats';
import type { GroupFilter, Item } from '../lib/types';
import { startSell, type LeftMode, type SellState } from './sell';

interface Props {
  filter: GroupFilter;
  onFilter(f: GroupFilter): void;
  leftMode: LeftMode;
  sell: SellState | null;
  onSell(s: SellState | null): void;
  onOpen(itemId: string): void;
  onSold(price: number): void;
}

/** How far (px) a horizontal swipe must travel to open or close a row. */
const SWIPE_THRESHOLD = 30;
/** Width of the Mark sold button behind a row (matches .swipe-action). */
const ACTION_WIDTH = 116;
/** Movement (px) before deciding whether a touch is a swipe or a scroll. */
const DECIDE_AFTER = 6;

interface Gesture {
  id: string;
  x: number;
  y: number;
  dir: 'undecided' | 'swipe' | 'scroll';
}

export function ActiveScreen({ filter, onFilter, leftMode, sell, onSell, onOpen, onSold }: Props) {
  const { items, groups, markSold, money, platform } = useStore();
  const onDay = today();
  const rows = sortActive(activeItems(items).filter((i) => matchesFilter(i, filter)), onDay);
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? 'Ungrouped';

  // Swipe-to-mark-sold: only one row open at a time. The row follows the
  // finger and snaps open or closed on release.
  //
  // Touch uses touch events, not pointer events: iOS cancels a pointer gesture
  // as soon as it starts scrolling, and a thumb's swipe is rarely flat, so most
  // swipes used to turn into a tiny scroll and get dropped. Here a touch that
  // moves more sideways than up/down is claimed as a swipe (preventDefault
  // stops the scroll); anything else scrolls as normal. The mouse uses pointer
  // events, so a laptop can drag a row too.
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dx: number } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const swallowClick = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const start = (id: string, x: number, y: number) => {
    gesture.current = { id, x, y, dir: 'undecided' };
    // Touch browsers often send no click after a swipe, so reset per gesture
    // rather than relying on that click to clear the flag.
    swallowClick.current = false;
  };
  /** True while the gesture is a sideways swipe (the page must not scroll). */
  const move = (x: number, y: number): boolean => {
    const g = gesture.current;
    if (!g || g.dir === 'scroll') return false;
    const dx = x - g.x;
    const dy = y - g.y;
    if (g.dir === 'undecided') {
      if (Math.abs(dx) < DECIDE_AFTER && Math.abs(dy) < DECIDE_AFTER) return false;
      g.dir = Math.abs(dx) >= Math.abs(dy) ? 'swipe' : 'scroll';
      if (g.dir === 'scroll') return false;
    }
    setDragging({ id: g.id, dx });
    return true;
  };
  const end = (x: number) => {
    const g = gesture.current;
    gesture.current = null;
    setDragging(null);
    if (!g || g.dir !== 'swipe') return;
    swallowClick.current = true; // the click that follows a swipe isn't a tap
    const dx = x - g.x;
    if (dx < -SWIPE_THRESHOLD) setSwipeId(g.id);
    else if (dx > SWIPE_THRESHOLD) setSwipeId(null);
  };
  const cancel = () => {
    gesture.current = null;
    setDragging(null);
  };

  // Touch listeners go on the list directly: React's touchmove is passive, and
  // a passive listener can't stop the page from scrolling.
  const handlers = useRef({ start, move, end, cancel });
  useEffect(() => {
    handlers.current = { start, move, end, cancel };
  });
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const h = () => handlers.current;
    const onStart = (e: TouchEvent) => {
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-swipe]') : null;
      const t = e.touches[0];
      if (row?.dataset.swipe && t && e.touches.length === 1) h().start(row.dataset.swipe, t.clientX, t.clientY);
      else h().cancel();
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && h().move(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) h().end(t.clientX);
      else h().cancel();
    };
    const onCancel = () => h().cancel();
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onCancel);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, []);

  const onPointerDown = (item: Item) => (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return; // touch is handled above
    start(item.id, e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') move(e.clientX, e.clientY);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') end(e.clientX);
  };
  const onRowClick = (item: Item) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    if (swipeId) {
      setSwipeId(null); // a tap anywhere closes an open row first
      return;
    }
    onOpen(item.id);
  };

  const confirm = async () => {
    if (!sell) return;
    const item = items.find((i) => i.id === sell.id);
    if (!item) return;
    const price = sell.price === '' ? (item.priceListed ?? 0) : Number(sell.price);
    await markSold(item.id, price, sell.date || onDay);
    onSell(null);
    onSold(price);
  };

  return (
    <div>
      <GroupFilterRow value={filter} onChange={onFilter} />
      {rows.length === 0 && (
        <div className="empty">{filter === 'all' ? 'Nothing for sale. Add something on NEW.' : 'Nothing for sale in this group.'}</div>
      )}
      {rows.length > 0 && <div className="swipe-hint">← Swipe a row left to mark sold</div>}
      <div className="inv-list" ref={listRef}>
        {rows.map((item) => {
          const days = daysListed(item, onDay);
          const stale = days >= STALE_DAYS;
          const open = swipeId === item.id;
          const dragged = dragging?.id === item.id;
          // Open = slid left by the button's width; while dragged, follow the
          // finger (a little past the button, never to the right).
          const offset = dragged
            ? Math.min(0, Math.max(-ACTION_WIDTH - 24, (open ? -ACTION_WIDTH : 0) + dragging.dx))
            : open
              ? -ACTION_WIDTH
              : 0;
          const toPost = item.platforms.filter((p) => !item.posted[p]);
          return (
            <div key={item.id} className="inv-item">
              <div className="swipe">
                <button
                  type="button"
                  className={`swipe-action ${open || dragged ? 'open' : ''}`}
                  tabIndex={open ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSwipeId(null);
                    onSell(startSell(item));
                  }}
                >
                  Mark sold
                </button>
                <div
                  className="inv-row"
                  role="button"
                  tabIndex={0}
                  data-swipe={item.id}
                  style={{
                    transform: offset ? `translateX(${offset}px)` : undefined,
                    transition: dragged ? 'none' : undefined,
                  }}
                  onPointerDown={onPointerDown(item)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={cancel}
                  onClick={() => onRowClick(item)}
                >
                  {leftMode === 'days' ? (
                    <div className="days">
                      <span className={`n ${stale ? 'stale' : ''}`}>{days}</span>
                      <span className="l">days</span>
                    </div>
                  ) : (
                    <div className="thumb64">
                      {item.photoIds[0] ? <PhotoImg id={item.photoIds[0]} variant="thumb" /> : <span>no photo</span>}
                    </div>
                  )}
                  <div className="row-mid">
                    <span className="row-title">{item.title}</span>
                    <span className="meta">
                      {groupName(item.groupId)}
                      {leftMode === 'photo' && <span className={stale ? 'stale' : ''}> · {days} days</span>}
                      {toPost.length > 0 && (
                        <span className="to-post"> · to post: {toPost.map((p) => platform(p).name).join(', ')}</span>
                      )}
                    </span>
                    {/* Solid = live on that platform, outline = still to post. */}
                    <div className="stripes">
                      {item.platforms.map((p) => (
                        <span
                          key={p}
                          className={item.posted[p] ? undefined : 'todo'}
                          style={{ background: item.posted[p] ? platform(p).colorStrong : undefined, borderColor: platform(p).colorStrong }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="row-right">
                    <span className="row-price">{money(item.priceListed ?? 0, item.currencyCode)}</span>
                  </div>
                </div>
              </div>
              {sell?.id === item.id && <SellBar sell={sell} onChange={onSell} onConfirm={() => void confirm()} />}
            </div>
          );
        })}
      </div>
      {rows.length > 0 && <div className="list-end" />}
    </div>
  );
}

function SellBar({ sell, onChange, onConfirm }: { sell: SellState; onChange(s: SellState | null): void; onConfirm(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const isToday = sell.date === today();

  return (
    <div className="sellbar" ref={ref}>
      <span className="label">Sold for</span>
      <input
        className="amount"
        inputMode="numeric"
        pattern="[0-9]*"
        value={sell.price}
        aria-label="Sold price in kr"
        onChange={(e) => onChange({ ...sell, price: digitsOnly(e.target.value) })}
        onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
      />
      <label className="date-chip">
        {isToday ? 'today' : dayMonth(sell.date)}
        <input
          type="date"
          value={sell.date}
          max={today()}
          aria-label="Date sold"
          onChange={(e) => onChange({ ...sell, date: e.target.value || today() })}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              /* iOS opens the picker on its own */
            }
          }}
        />
      </label>
      <button type="button" className="cancel" aria-label="Cancel" onClick={() => onChange(null)}>
        ✕
      </button>
      <button type="button" className="chip-light" onClick={onConfirm}>
        OK
      </button>
    </div>
  );
}
