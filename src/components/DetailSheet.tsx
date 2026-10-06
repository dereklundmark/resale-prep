import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { PLATFORM_LABEL, PLATFORM_TEXT, PLATFORM_TINT, STALE_DAYS } from '../lib/constants';
import { today } from '../lib/dates';
import { dayMonthYear, kr, monthYear } from '../lib/format';
import { daysListed } from '../lib/stats';
import { EditItemForm } from './EditItemForm';
import { PhotoImg } from './PhotoImg';

interface Props {
  itemId: string;
  onClose(): void;
  onMarkSold(itemId: string): void;
  onToast(msg: string): void;
}

export function DetailSheet({ itemId, onClose, onMarkSold, onToast }: Props) {
  const { items, groups, deleteItem } = useStore();
  const item = items.find((i) => i.id === itemId);
  const [editing, setEditing] = useState(false);
  // Delete needs two taps: the first turns the link into "Tap again to delete".
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!item) return null;

  const active = item.status === 'active';
  const days = daysListed(item, today());
  const groupName = groups.find((g) => g.id === item.groupId)?.name ?? 'Ungrouped';
  // Backfilled sales only know the month ("Jun 2025"); others have a day ("14 Sep 2026").
  const soldOn = item.dateSold ? (item.isBackfill ? monthYear(item.dateSold) : dayMonthYear(item.dateSold)) : '—';
  const facts = active
    ? [
        ['Asking', kr(item.priceListed ?? 0)],
        ['Condition', item.condition ?? '—'],
        ['Group', groupName],
      ]
    : [
        ['Sold for', kr(item.priceSold ?? 0)],
        ['Condition', item.condition ?? '—'],
        ['Sold', soldOn],
      ];
  const categories = item.platforms.filter((p) => item.categories[p]);

  const status = editing ? 'Editing' : active ? `For sale · ${days} days` : 'Sold';
  const statusColor = editing
    ? 'var(--ink)'
    : active
      ? days >= STALE_DAYS
        ? 'var(--stale)'
        : 'var(--grey)'
      : 'var(--sold)';

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteItem(item.id);
    onClose();
    onToast('Deleted');
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className={`sheet-photos ${editing ? 'small' : ''}`}>
          {item.photoIds.length > 0 ? (
            <>
              <div className="track">
                {item.photoIds.map((id) => (
                  <PhotoImg key={id} id={id} variant="full" />
                ))}
              </div>
              {item.photoIds.length > 1 && <span className="count">{item.photoIds.length} photos · swipe</span>}
            </>
          ) : (
            <span className="none">no photo</span>
          )}
          <button type="button" className="close-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="stack8" style={{ gap: 6 }}>
            <span className="label" style={{ color: statusColor }}>
              {status}
            </span>
            {!editing && <span className="sheet-title">{item.title}</span>}
          </div>
          {editing ? (
            <EditItemForm
              item={item}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                onToast('Saved');
              }}
            />
          ) : (
            <>
              <div className="facts">
                {facts.map(([l, v]) => (
                  <div key={l} className="f">
                    <span className="fl">{l}</span>
                    <span className="fv">{v}</span>
                  </div>
                ))}
              </div>
              {item.platforms.length > 0 && (
                <div className="pills">
                  {item.platforms.map((p) => (
                    <span key={p} className="pill" style={{ background: PLATFORM_TINT[p], color: PLATFORM_TEXT[p] }}>
                      {PLATFORM_LABEL[p]}
                    </span>
                  ))}
                </div>
              )}
              <div className="stack8" style={{ gap: 4 }}>
                <span className="label">Description</span>
                <span className="sheet-desc">
                  {item.description ||
                    (item.isBackfill ? 'No description saved. This sale was backfilled.' : 'No description.')}
                </span>
              </div>
              {categories.length > 0 && (
                <div className="stack8" style={{ gap: 4 }}>
                  <span className="label">Categories</span>
                  <div className="sheet-cats">
                    {categories.map((p) => (
                      <span key={p}>
                        {PLATFORM_LABEL[p]}: {item.categories[p]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {active && (
                <button type="button" className="sheet-sell" onClick={() => onMarkSold(item.id)}>
                  Mark sold
                </button>
              )}
              <div className="sheet-links">
                <button
                  type="button"
                  className="edit-link"
                  onClick={() => {
                    setConfirmDelete(false);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="delete-link" onClick={() => void remove()}>
                  {confirmDelete ? 'Tap again to delete' : 'Delete item'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
