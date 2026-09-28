import { useEffect, useRef } from 'react';
import { GroupFilterRow } from '../components/GroupFilterRow';
import { PhotoImg } from '../components/PhotoImg';
import { useStore } from '../data/store';
import { PLATFORM_STRONG, STALE_DAYS } from '../lib/constants';
import { today } from '../lib/dates';
import { digitsOnly, kr } from '../lib/format';
import { activeItems, daysListed, matchesFilter, sortActive } from '../lib/stats';
import type { GroupFilter } from '../lib/types';
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

export function ActiveScreen({ filter, onFilter, leftMode, sell, onSell, onOpen, onSold }: Props) {
  const { items, groups, markSold } = useStore();
  const onDay = today();
  const rows = sortActive(activeItems(items).filter((i) => matchesFilter(i, filter)), onDay);
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? 'Ungrouped';

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
      {rows.map((item) => {
        const days = daysListed(item, onDay);
        const stale = days >= STALE_DAYS;
        return (
          <div key={item.id} className="inv-item">
            <div className="inv-row" role="button" tabIndex={0} onClick={() => onOpen(item.id)}>
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
                <button
                  type="button"
                  className="pill-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSell(sell?.id === item.id ? null : startSell(item));
                  }}
                >
                  Mark sold
                </button>
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
        {isToday ? 'today' : sell.date.slice(5).replace('-', '/')}
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
