import { useRef, useState } from 'react';
import { PhotoImg } from '../components/PhotoImg';
import { exportBackup, readBackup } from '../data/backup';
import { useStore } from '../data/store';
import { GROUP_SHADES } from '../lib/constants';
import { today } from '../lib/dates';
import { currencySymbol } from '../lib/format';
import { activeItems, groupSummaries, soldItems, type GroupSummary } from '../lib/stats';
import type { Item } from '../lib/types';

interface Props {
  /** List / Photo switch: show a small thumbnail in front of each item. */
  photos: boolean;
  onOpen(itemId: string): void;
  onToast(msg: string): void;
}

const UNGROUPED_KEY = '__ungrouped__';

export function TotalScreen({ photos, onOpen, onToast }: Props) {
  const { items, groups, market, money, importItems } = useStore();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const sold = soldItems(items);
  const total = items.length;
  const pct = total ? Math.round((sold.length / total) * 100) : 0;
  const summaries = groupSummaries(items, groups);
  const revenue = summaries.reduce((a, g) => a + g.revenue, 0);

  const doExport = async () => {
    setBusy('Exporting…');
    let blob: Blob;
    try {
      blob = await exportBackup(items, groups);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Export failed');
      return;
    } finally {
      setBusy(null);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `resale-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  // Adds the backup's items that aren't in the database yet; never deletes.
  const doImport = async (file: File | undefined) => {
    if (!file) return;
    let batch;
    try {
      batch = await readBackup(file);
    } catch {
      onToast('Not a backup file');
      return;
    }
    if (!window.confirm(`Add the items from this backup (${batch.items.length}) that aren't saved yet?`)) return;
    setBusy('Importing…');
    try {
      const added = await importItems(batch);
      onToast(`Backup imported · ${added} added`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dash">
      <div className="dash-sub">
        {currencySymbol(market.currencyCode, market.locale)} earned · {sold.length} of {total} items sold
      </div>

      <div className="stack8">
        <div className="bar" role="img" aria-label={`${pct}% sold`}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="bar-legend">
          <span>{pct}% sold</span>
          <span className="muted">{activeItems(items).length} left</span>
        </div>
      </div>

      <div className="stack10">
        <span className="label">Revenue by group · tap to open</span>
        <div className="bar groups" aria-hidden="true">
          {summaries.map((g, i) =>
            g.revenue > 0 ? (
              <div
                key={g.groupId ?? UNGROUPED_KEY}
                style={{ width: `${(g.revenue / revenue) * 100}%`, background: GROUP_SHADES[i % GROUP_SHADES.length] }}
              />
            ) : null,
          )}
          {revenue === 0 && <div style={{ width: '100%', background: 'var(--track)' }} />}
        </div>

        <div>
          {summaries.map((g, i) => {
            const key = g.groupId ?? UNGROUPED_KEY;
            const open = openKey === key;
            return (
              <div key={key} className="grp">
                <button
                  type="button"
                  className="grp-head"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : key)}
                >
                  <span className="sw" style={{ background: GROUP_SHADES[i % GROUP_SHADES.length] }} />
                  <span className="n">{g.name}</span>
                  <span className="c">
                    {g.sold.length}/{g.sold.length + g.active.length}
                  </span>
                  <span className="r">{money(g.revenue)}</span>
                  <span className="caret">{open ? '–' : '+'}</span>
                </button>
                {open && (
                  <GroupDetails
                    summary={g}
                    photos={photos}
                    onOpen={onOpen}
                    onToast={onToast}
                    onDeleted={() => setOpenKey(null)}
                  />
                )}
              </div>
            );
          })}
          <div className="grand">
            <span className="a">All</span>
            <span className="v">{money(revenue)}</span>
          </div>
        </div>
      </div>

      <div className="housekeeping">
        {busy && <div>{busy}</div>}
        <div className="backup">
          Backup:{' '}
          <button type="button" onClick={() => void doExport()}>
            Export
          </button>{' '}
          ·{' '}
          <button type="button" onClick={() => importInput.current?.click()}>
            Import
          </button>
        </div>
        <input
          ref={importInput}
          className="hidden-file"
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void doImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <span className="ver">
          Resale Prep · version {__APP_VERSION__} · {__APP_BUILD__} · {__APP_BUILT_ON__}
        </span>
      </div>
    </div>
  );
}

interface DetailsProps {
  summary: GroupSummary;
  photos: boolean;
  onOpen(itemId: string): void;
  onToast(msg: string): void;
  onDeleted(): void;
}

/**
 * An opened group: a Sold section and a For sale section, each shown only
 * when it has items, then Rename / Delete group (not for Ungrouped).
 */
function GroupDetails({ summary: g, photos, onOpen, onToast, onDeleted }: DetailsProps) {
  const { money, renameGroup, deleteGroup } = useStore();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(g.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const total = g.sold.length + g.active.length;

  const line = (x: Item, sold: boolean) => (
    <button key={x.id} type="button" className={`grp-line ${sold ? '' : 'muted'}`} onClick={() => onOpen(x.id)}>
      {photos && (
        <span className="grp-thumb">
          <PhotoImg id={x.photoIds[0]} variant="thumb" />
        </span>
      )}
      <span className="t">
        <span className={`status-tag ${sold ? 'sold' : ''}`}>{sold ? 'sold' : 'for sale'}</span>
        {x.title}
      </span>
      <span className="p">{money((sold ? x.priceSold : x.priceListed) ?? 0, x.currencyCode)}</span>
    </button>
  );

  const rename = async () => {
    const next = name.trim();
    if (!g.groupId || !next || next === g.name) return setRenaming(false);
    try {
      await renameGroup(g.groupId, next);
      setRenaming(false);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Rename failed');
    }
  };

  const remove = async () => {
    if (!g.groupId) return;
    if (!confirmDelete) return setConfirmDelete(true);
    await deleteGroup(g.groupId);
    onDeleted();
    onToast('Group deleted');
  };

  return (
    <div className="grp-body">
      {g.sold.length > 0 && (
        <div>
          <div className="grp-sub-head sold">
            <span>Sold · {money(g.revenue)}</span>
            <span>{g.sold.length} items</span>
          </div>
          {g.sold.map((x) => line(x, true))}
        </div>
      )}
      {g.active.length > 0 && (
        <div>
          <div className="grp-sub-head muted">
            <span>For sale · {money(g.askTotal)} asking</span>
            <span>{g.active.length} items</span>
          </div>
          {g.active.map((x) => line(x, false))}
        </div>
      )}
      {total === 0 && <div className="grp-empty">No items yet</div>}

      {g.groupId &&
        (renaming ? (
          <div className="grp-rename">
            <input
              className="line-input"
              autoFocus
              value={name}
              aria-label="Group name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void rename();
                if (e.key === 'Escape') setRenaming(false);
              }}
            />
            <button type="button" className="mini-btn" onClick={() => void rename()}>
              OK
            </button>
            <button type="button" className="mini-btn" aria-label="Cancel" onClick={() => setRenaming(false)}>
              ✕
            </button>
          </div>
        ) : (
          <div className="grp-actions">
            <button
              type="button"
              className="edit-link"
              onClick={() => {
                setName(g.name);
                setConfirmDelete(false);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button type="button" className="delete-link" onClick={() => void remove()}>
              {confirmDelete ? 'Tap again to delete' : 'Delete group'}
            </button>
          </div>
        ))}
      {confirmDelete && (
        <div className="grp-note">
          {total ? `Its ${total} item${total === 1 ? '' : 's'} stay, and move to Ungrouped.` : 'The group is empty.'}
        </div>
      )}
    </div>
  );
}
