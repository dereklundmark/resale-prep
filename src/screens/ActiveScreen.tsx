import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { GroupFilterRow } from '../components/GroupFilterRow';
import { PhotoImg } from '../components/PhotoImg';
import { useStore } from '../data/store';
import { PLATFORM_STRONG, STALE_DAYS } from '../lib/constants';
import { today } from '../lib/dates';
import { dayMonth, digitsOnly, kr } from '../lib/format';
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

export function ActiveScreen({ filter, onFilter, leftMode, sell, onSell, onOpen, onSold }: Props) {
  const { items, groups, markSold } = useStore();
  const onDay = today();
  const rows = sortActive(activeItems(items).filter((i) => matchesFilter(i, filter)), onDay);
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? 'Ungrouped';

  // Swipe-to-mark-sold: only one row open at a time. A swipe snaps the row open
  // or closed on release (no live follow), like the prototype; touch-action:
  // pan-y on the row keeps vertical scrolling native.
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; horizontal: boolean } | null>(null);
  const swallowClick = useRef(false);

  const onPointerDown = (item: Item) => (e: PointerEvent) => {
    drag.current = { id: item.id, x: e.clientX, y: e.clientY, horizontal: false };
    // Touch browsers often send no click after a swipe, so reset per gesture
    // rather than relying on that click to clear the flag.
    swallowClick.current = false;
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.horizontal) return;
    const dx = Math.abs(e.clientX - d.x);
    if (dx > 8 && dx > Math.abs(e.clientY - d.y)) d.horizontal = true;
  };
  const onPointerUp = (item: Item) => (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== item.id || !d.horizontal) return;
    swallowClick.current = true; // the click that follows a swipe isn't a tap
    const dx = e.clientX - d.x;
    if (dx < -SWIPE_THRESHOLD) setSwipeId(item.id);
    else if (dx > SWIPE_THRESHOLD) setSwipeId(null);
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
      {rows.map((item) => {
        const days = daysListed(item, onDay);
        const stale = days >= STALE_DAYS;
        const open = swipeId === item.id;
        return (
          <div key={item.id} className="inv-item">
            <div className="swipe">
              <button
                type="button"
                className="swipe-action"
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
                style={{ transform: open ? 'translateX(-116px)' : undefined }}
                onPointerDown={onPointerDown(item)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp(item)}
                onPointerCancel={() => {
                  drag.current = null;
                }}
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
                  </span>
                  <div className="stripes">
                    {item.platforms.map((p) => (
                      <span key={p} style={{ background: PLATFORM_STRONG[p] }} />
                    ))}
                  </div>
                </div>
                <div className="row-right">
                  <span className="row-price">{kr(item.priceListed ?? 0)}</span>
                </div>
              </div>
            </div>
            {sell?.id === item.id && <SellBar sell={sell} onChange={onSell} onConfirm={() => void confirm()} />}
          </div>
        );
      })}
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
