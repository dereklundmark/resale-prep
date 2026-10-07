import { useRef, useState } from 'react';
import { exportBackup, readBackup } from '../data/backup';
import { useStore } from '../data/store';
import { GROUP_SHADES } from '../lib/constants';
import { today } from '../lib/dates';
import { currencySymbol } from '../lib/format';
import { activeItems, groupSummaries, soldItems } from '../lib/stats';

interface Props {
  onOpen(itemId: string): void;
  onToast(msg: string): void;
}

const UNGROUPED_KEY = '__ungrouped__';

export function TotalScreen({ onOpen, onToast }: Props) {
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
                  <div className="grp-body">
                    <div>
                      <div className="grp-sub-head sold">
                        <span>Sold · {money(g.revenue)}</span>
                        <span>{g.sold.length} items</span>
                      </div>
                      {g.sold.map((x) => (
                        <button key={x.id} type="button" className="grp-line" onClick={() => onOpen(x.id)}>
                          <span className="t">
                            <span className="status-tag sold">sold</span>
                            {x.title}
                          </span>
                          <span className="p">{money(x.priceSold ?? 0)}</span>
                        </button>
                      ))}
                      {g.sold.length === 0 && <div className="grp-empty">Nothing sold yet</div>}
                    </div>
                    <div>
                      <div className="grp-sub-head muted">
                        <span>For sale · {money(g.askTotal)} asking</span>
                        <span>{g.active.length} items</span>
                      </div>
                      {g.active.map((x) => (
                        <button key={x.id} type="button" className="grp-line muted" onClick={() => onOpen(x.id)}>
                          <span className="t">
                            <span className="status-tag">for sale</span>
                            {x.title}
                          </span>
                          <span className="p">{money(x.priceListed ?? 0)}</span>
                        </button>
                      ))}
                      {g.active.length === 0 && <div className="grp-empty">All sold</div>}
                    </div>
                  </div>
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
