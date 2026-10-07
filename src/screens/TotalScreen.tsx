import { useRef, useState } from 'react';
import { PhotoImg } from '../components/PhotoImg';
import { Pinned } from '../components/Pinned';
import { exportBackup, readBackup } from '../data/backup';
import { useStore } from '../data/store';
import { GROUP_SHADES } from '../lib/constants';
import { today } from '../lib/dates';
import { currencySymbol, dayMonth, digitsOnly } from '../lib/format';
import { activeItems, groupSummaries, soldItems, type GroupSummary } from '../lib/stats';
import type { Item } from '../lib/types';

interface Props {
  /** List / Photo switch: show a small thumbnail in front of each item. */
  photos: boolean;
  onOpen(itemId: string): void;
  onOpenPurchase(purchaseId: string): void;
  onToast(msg: string): void;
}

const UNGROUPED_KEY = '__ungrouped__';

export function TotalScreen({ photos, onOpen, onOpenPurchase, onToast }: Props) {
  const { items, groups, purchases, market, money, importItems } = useStore();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const sold = soldItems(items);
  const total = items.length;
  const pct = total ? Math.round((sold.length / total) * 100) : 0;
  // Ungrouped is always last, so dropping it when empty doesn't shift the
  // other groups' colours.
  const summaries = groupSummaries(items, groups, purchases).filter(
    (g) => g.groupId !== null || g.sold.length + g.active.length > 0,
  );
  // "kr earned" is sales only; purchases never change it.
  const revenue = summaries.reduce((a, g) => a + g.revenue, 0);

  const doExport = async () => {
    setBusy('Exporting…');
    let blob: Blob;
    try {
      blob = await exportBackup(items, groups, purchases);
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
                  <span className="n">
                    {g.name}
                    {g.hasFund && (
                      <span className={`fund-line ${g.left < 0 ? 'over' : ''}`}>
                        {g.purpose || 'Fund'} · {g.left < 0 ? `${money(-g.left)} over` : `${money(g.left)} left`}
                      </span>
                    )}
                  </span>
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
                    onOpenPurchase={onOpenPurchase}
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
  onOpenPurchase(purchaseId: string): void;
  onToast(msg: string): void;
  onDeleted(): void;
}

/** Which inline panel replaces the link row (only one at a time). */
type Panel = 'none' | 'add' | 'purpose' | 'rename' | 'delete';

/**
 * An opened group: fund indicator (when it's a fund), Sold and For sale
 * (each only when it has items), Bought (fund only), then the link row:
 * + Add purchase · Set purpose · Rename · Delete. Ungrouped gets none of
 * the fund parts or links.
 */
function GroupDetails({ summary: g, photos, onOpen, onOpenPurchase, onToast, onDeleted }: DetailsProps) {
  const { money, groups, renameGroup, setGroupPurpose, deleteGroup, addPurchase } = useStore();
  const [panel, setPanel] = useState<Panel>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // Panel drafts
  const [name, setName] = useState(g.name);
  const [purpose, setPurpose] = useState(g.purpose ?? '');
  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const otherGroups = groups.filter((x) => x.id !== g.groupId);
  const [moveTo, setMoveTo] = useState<string>(''); // '' = Ungrouped

  const itemCount = g.sold.length + g.active.length;
  const isEmpty = itemCount === 0 && g.purchases.length === 0;

  const open = (p: Panel) => {
    setConfirmDelete(false);
    setName(g.name);
    setPurpose(g.purpose ?? '');
    setWhat('');
    setAmount('');
    setDate(today());
    // Purchases need a real group, so default to one when there are purchases.
    setMoveTo(g.purchases.length && otherGroups[0] ? otherGroups[0].id : '');
    setPanel(p);
  };

  // Runs a save, keeping the panel open with a toast if it fails.
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const itemLine = (x: Item, sold: boolean) => (
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

  const amountNum = amount === '' ? 0 : Number(amount);
  const canSavePurchase = what.trim() !== '' && amount !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !busy;
  const afterLeft = g.left - amountNum;

  const savePurchase = () =>
    run(async () => {
      if (!canSavePurchase || !g.groupId) return;
      await addPurchase({ groupId: g.groupId, title: what, amount: amountNum, date });
      setPanel('none');
      onToast(money(-amountNum));
    });

  const savePurpose = (value: string | null) =>
    run(async () => {
      if (!g.groupId) return;
      await setGroupPurpose(g.groupId, value);
      setPanel('none');
    });

  const saveName = () =>
    run(async () => {
      const next = name.trim();
      if (g.groupId && next && next !== g.name) await renameGroup(g.groupId, next);
      setPanel('none');
    });

  const remove = (target: string | null) =>
    run(async () => {
      if (!g.groupId) return;
      await deleteGroup(g.groupId, target);
      onDeleted();
      const where = target ? groups.find((x) => x.id === target)?.name : 'Ungrouped';
      onToast(itemCount ? `Group deleted · ${itemCount} moved to ${where}` : 'Group deleted');
    });

  // Delete: an empty group goes with a second tap; one with items or
  // purchases opens a panel asking where they should go.
  const onDelete = () => {
    if (!isEmpty) return open('delete');
    if (!confirmDelete) return setConfirmDelete(true);
    void remove(null);
  };

  const losesPurchases = moveTo === '' && g.purchases.length > 0;

  return (
    <div className="grp-body">
      {g.hasFund && (
        <div className="fund">
          <div className="bar">
            <div
              style={{
                width: `${g.left < 0 ? 100 : g.revenue ? Math.min(100, (g.spent / g.revenue) * 100) : 0}%`,
                background: g.left < 0 ? 'var(--stale)' : 'var(--ink)',
              }}
            />
          </div>
          <div className="fund-legend">
            <span>Spent {money(g.spent)}</span>
            <span className={g.left < 0 ? 'over' : 'left'}>
              {g.left < 0 ? `Over by ${money(-g.left)}` : `Left ${money(g.left)}`}
            </span>
          </div>
          <div className="fund-of">of {money(g.revenue)} earned</div>
        </div>
      )}

      {g.sold.length > 0 && (
        <div>
          <div className="grp-sub-head sold">
            <span>Sold · {money(g.revenue)}</span>
            <span>{g.sold.length} items</span>
          </div>
          {g.sold.map((x) => itemLine(x, true))}
        </div>
      )}
      {g.active.length > 0 && (
        <div>
          <div className="grp-sub-head muted">
            <span>For sale · {money(g.askTotal)} asking</span>
            <span>{g.active.length} items</span>
          </div>
          {g.active.map((x) => itemLine(x, false))}
        </div>
      )}
      {itemCount === 0 && !g.hasFund && <div className="grp-empty">No items yet</div>}

      {g.hasFund && (
        <div>
          <div className="grp-sub-head">
            <span>Bought · {money(g.spent)}</span>
            <span>
              {g.purchases.length} item{g.purchases.length === 1 ? '' : 's'}
            </span>
          </div>
          {g.purchases.map((p) => (
            <button key={p.id} type="button" className="grp-line" onClick={() => onOpenPurchase(p.id)}>
              <span className="t">
                <span className="status-tag bought">bought</span>
                {p.title}
                <span className="grp-date"> · {dayMonth(p.date)}</span>
              </span>
              <span className="p">{money(-p.amount, p.currencyCode)}</span>
            </button>
          ))}
          {g.purchases.length === 0 && (
            <div className="grp-empty">Nothing bought yet. All {money(g.revenue)} is still in the fund.</div>
          )}
        </div>
      )}

      {g.groupId && panel === 'none' && (
        <div className="fund-links">
          <button type="button" onClick={() => open('add')}>
            + Add purchase
          </button>
          <span className="right">
            <button type="button" onClick={() => open('purpose')}>
              {g.purpose ? 'Purpose' : 'Set purpose'}
            </button>
            <button type="button" onClick={() => open('rename')}>
              Rename
            </button>
            <button type="button" className="danger" onClick={onDelete}>
              {confirmDelete ? 'Tap again' : 'Delete'}
            </button>
          </span>
        </div>
      )}

      {panel === 'add' && (
        <div className="fund-add">
          <span className="label dark-label">Add purchase · {g.name}</span>
          <input
            className="dark-input title"
            placeholder="What did you buy?"
            value={what}
            autoFocus
            onChange={(e) => setWhat(e.target.value)}
          />
          <div className="grid2" style={{ gap: 12 }}>
            <input
              className="dark-input kr"
              placeholder="kr"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={(e) => setAmount(digitsOnly(e.target.value))}
            />
            <input
              className="dark-input"
              type="date"
              value={date}
              max={today()}
              aria-label="Date bought"
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="fund-add-foot">
            <span>After this: {afterLeft < 0 ? `${money(-afterLeft)} over` : `${money(afterLeft)} left`}</span>
            <button type="button" onClick={() => setPanel('none')}>
              Cancel
            </button>
          </div>
          <Pinned>
            <button
              type="button"
              className={`band ${canSavePurchase ? '' : 'band-waiting'}`}
              aria-disabled={!canSavePurchase}
              onClick={() => void savePurchase()}
            >
              <span>Save purchase</span>
              <span>→</span>
            </button>
          </Pinned>
        </div>
      )}

      {panel === 'purpose' && (
        <div className="fund-form">
          <span className="label">Purpose</span>
          <input
            className="fund-input"
            placeholder="e.g. Photo gear fund"
            value={purpose}
            autoFocus
            onChange={(e) => setPurpose(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void savePurpose(purpose.trim() || null)}
          />
          <div className="fund-form-links">
            <span>
              <button type="button" disabled={busy} onClick={() => void savePurpose(purpose.trim() || null)}>
                Save
              </button>
              <button type="button" className="muted" onClick={() => setPanel('none')}>
                Cancel
              </button>
            </span>
            {g.purpose && (
              <button type="button" className="danger" disabled={busy} onClick={() => void savePurpose(null)}>
                Remove purpose
              </button>
            )}
          </div>
        </div>
      )}

      {panel === 'rename' && (
        <div className="fund-form">
          <span className="label">Group name</span>
          <input
            className="fund-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void saveName()}
          />
          <div className="fund-form-links">
            <span>
              <button type="button" disabled={busy} onClick={() => void saveName()}>
                Save
              </button>
              <button type="button" className="muted" onClick={() => setPanel('none')}>
                Cancel
              </button>
            </span>
          </div>
        </div>
      )}

      {panel === 'delete' && (
        <div className="fund-form">
          <span className="label">Delete group · {g.name}</span>
          <p className="delete-note">
            It has{' '}
            {[
              itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'}` : '',
              g.purchases.length ? `${g.purchases.length} purchase${g.purchases.length === 1 ? '' : 's'}` : '',
            ]
              .filter(Boolean)
              .join(' and ')}
            . Where should {itemCount + g.purchases.length === 1 ? 'it' : 'they'} go?
          </p>
          <label className="field">
            <span className="label">Move to</span>
            <select className="line-select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Ungrouped</option>
              {otherGroups.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          {losesPurchases && (
            <p className="delete-warn">
              Purchases can’t be Ungrouped, so {g.purchases.length === 1 ? 'its purchase' : `its ${g.purchases.length} purchases`}{' '}
              will be deleted. Pick a group to keep {g.purchases.length === 1 ? 'it' : 'them'}.
            </p>
          )}
          <div className="fund-form-links">
            <span>
              <button type="button" className="danger" disabled={busy} onClick={() => void remove(moveTo || null)}>
                Delete group
              </button>
              <button type="button" className="muted" onClick={() => setPanel('none')}>
                Cancel
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
