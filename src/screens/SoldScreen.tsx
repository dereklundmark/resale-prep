import { useState } from 'react';
import { GroupFilterRow } from '../components/GroupFilterRow';
import { GroupSelect } from '../components/GroupSelect';
import { useStore } from '../data/store';
import { thisMonth } from '../lib/dates';
import { digitsOnly, kr, monthYear } from '../lib/format';
import { daysToSell, filterLabel, matchesFilter, soldItems, soldPrice, sortSold, sum } from '../lib/stats';
import type { GroupFilter } from '../lib/types';

interface Props {
  filter: GroupFilter;
  onFilter(f: GroupFilter): void;
  onOpen(itemId: string): void;
}

export function SoldScreen({ filter, onFilter, onOpen }: Props) {
  const { items, groups, addPastSale } = useStore();
  const [pastOpen, setPastOpen] = useState(false);
  const [pastCount, setPastCount] = useState(0);
  const [past, setPast] = useState({ title: '', price: '', month: thisMonth(), groupId: null as string | null });

  const rows = sortSold(soldItems(items).filter((i) => matchesFilter(i, filter)));
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? 'Ungrouped';
  const canSavePast = past.title.trim() !== '' && past.price !== '' && /^\d{4}-\d{2}$/.test(past.month);

  const savePast = async () => {
    if (!canSavePast) return;
    await addPastSale({ title: past.title.trim(), priceSold: Number(past.price), month: past.month, groupId: past.groupId });
    // Group and month stay filled for fast backlog entry.
    setPast((p) => ({ ...p, title: '', price: '' }));
    setPastCount((n) => n + 1);
  };

  return (
    <div className="sold">
      <button
        type="button"
        className={`past-band ${pastOpen ? 'open' : ''}`}
        aria-expanded={pastOpen}
        onClick={() => {
          setPastOpen(!pastOpen);
          setPastCount(0);
        }}
      >
        <span>+ Past sale</span>
        <span className="count">{pastCount ? `${pastCount} added` : 'backlog'}</span>
      </button>
      {pastOpen && (
        <form
          className="past-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void savePast();
          }}
        >
          <input
            className="dark-input title"
            placeholder="Item"
            value={past.title}
            autoFocus
            onChange={(e) => setPast({ ...past, title: e.target.value })}
          />
          <div className="grid2" style={{ gap: 12 }}>
            <input
              className="dark-input kr"
              placeholder="kr"
              inputMode="numeric"
              pattern="[0-9]*"
              value={past.price}
              onChange={(e) => setPast({ ...past, price: digitsOnly(e.target.value) })}
            />
            <input
              className="dark-input"
              type="month"
              placeholder="yyyy-mm"
              value={past.month}
              max={thisMonth()}
              aria-label="Month sold"
              onChange={(e) => setPast({ ...past, month: e.target.value })}
            />
          </div>
          <div className="past-actions">
            <div className="group-pick">
              <GroupSelect dark value={past.groupId} onChange={(groupId) => setPast({ ...past, groupId })} />
            </div>
            <button type="submit" className="chip-light" disabled={!canSavePast}>
              Save + next
            </button>
          </div>
        </form>
      )}

      <GroupFilterRow className="filters-sold" value={filter} onChange={onFilter} />
      {rows.length === 0 && <div className="empty">Nothing sold yet.</div>}
      {rows.map((item) => {
        const dts = daysToSell(item);
        return (
          <button key={item.id} type="button" className="sold-row" onClick={() => onOpen(item.id)}>
            <div className="left">
              <span className="t">{item.title}</span>
              <span className="meta">
                {groupName(item.groupId)} · {item.dateSold ? monthYear(item.dateSold) : '—'} ·{' '}
                {dts === null ? 'backfilled' : `${dts} days to sell`}
              </span>
            </div>
            <span className="row-price">{kr(soldPrice(item))}</span>
          </button>
        );
      })}
      <div className="footer-total">
        <span className="label">
          {filterLabel(filter, groups)} · {rows.length} items
        </span>
        <span className="row-price">{kr(sum(rows, soldPrice))}</span>
      </div>
    </div>
  );
}
