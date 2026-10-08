import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { STALE_DAYS } from '../lib/constants';
import { today } from '../lib/dates';
import { dayMonth, dayMonthYear, monthYear } from '../lib/format';
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
  const { items, groups, deleteItem, setPosted, setPlatform, activePlatforms, money, platform, conditionLabel } =
    useStore();
  const item = items.find((i) => i.id === itemId);
  const [editing, setEditing] = useState(false);
  // Delete needs two taps: the first turns the link into "Tap again to delete".
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Removing a platform needs two taps too: the first turns "Remove" into "Sure?".
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

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
        ['Asking', money(item.priceListed ?? 0, item.currencyCode)],
        ['Condition', conditionLabel(item.condition)],
        ['Group', groupName],
      ]
    : [
        ['Sold for', money(item.priceSold ?? 0, item.currencyCode)],
        ['Condition', conditionLabel(item.condition)],
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

  // Ticks and platform changes show at once and save in the background.
  const saving = (p: Promise<void>) => void p.catch(() => onToast("Couldn't save. Try again."));
  const tick = (p: string) => {
    setConfirmRemove(null);
    saving(setPosted(item.id, p, !item.posted[p]));
  };
  const removePlatform = (p: string) => {
    if (confirmRemove !== p) {
      setConfirmRemove(p);
      return;
    }
    setConfirmRemove(null);
    saving(setPlatform(item.id, p, false));
  };
  const addPlatform = (p: string) => {
    setConfirmRemove(null);
    saving(setPlatform(item.id, p, true));
  };
  const notListed = activePlatforms.filter((p) => !item.platforms.includes(p.code));

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
              {active && (
                <div className="stack8" style={{ gap: 4 }}>
                  <span className="label">Posted</span>
                  <div className="post-list">
                    {item.platforms.map((p) => {
                      const on = item.posted[p];
                      return (
                        <div key={p} className={`post-row ${on ? 'on' : ''}`}>
                          <button
                            type="button"
                            className="post-check"
                            role="checkbox"
                            aria-checked={!!on}
                            onClick={() => tick(p)}
                          >
                            <span className="post-stripe" style={{ background: platform(p).colorStrong }} />
                            <span className="post-box">{on ? '✓' : ''}</span>
                            <span className="post-name">{platform(p).name}</span>
                            <span className="post-when">{on ? `live · ${dayMonth(on)}` : 'not posted yet'}</span>
                          </button>
                          <button
                            type="button"
                            className={`post-remove ${confirmRemove === p ? 'sure' : ''}`}
                            aria-label={confirmRemove === p ? `Tap again to remove ${platform(p).name}` : `Remove ${platform(p).name}`}
                            onClick={() => removePlatform(p)}
                          >
                            {confirmRemove === p ? 'Sure?' : 'Remove'}
                          </button>
                        </div>
                      );
                    })}
                    {/* Platforms it isn't listed on: tap to add. */}
                    {notListed.map((p) => (
                      <button key={p.code} type="button" className="post-add" onClick={() => addPlatform(p.code)}>
                        <span className="post-stripe" style={{ background: p.colorStrong }} />
                        <span className="post-name">+ {p.name}</span>
                        <span className="post-when">not listed</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!active && item.platforms.length > 0 && (
                <div className="pills">
                  {item.platforms.map((p) => (
                    <span key={p} className="pill" style={{ background: platform(p).colorTint, color: platform(p).colorText }}>
                      {platform(p).name}
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
                        {platform(p).name}: {item.categories[p]}
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
