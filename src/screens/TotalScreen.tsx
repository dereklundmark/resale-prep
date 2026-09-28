import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../data/backup';
import { useStore } from '../data/store';
import { GROUP_SHADES } from '../lib/constants';
import { today } from '../lib/dates';
import { kr } from '../lib/format';
import { activeItems, groupSummaries, soldItems } from '../lib/stats';

interface Props {
  onOpen(itemId: string): void;
  onToast(msg: string): void;
}

const UNGROUPED_KEY = '__ungrouped__';

export function TotalScreen({ onOpen, onToast }: Props) {
  const { items, groups, reload } = useStore();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const sold = soldItems(items);
  const total = items.length;
  const pct = total ? Math.round((sold.length / total) * 100) : 0;
  const summaries = groupSummaries(items, groups);
  const revenue = summaries.reduce((a, g) => a + g.revenue, 0);

  const doExport = async () => {
    const blob = await exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `resale-prep-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (!window.confirm('Replace everything in this browser with the backup? This cannot be undone.')) return;
    try {
      await importBackup(file);
      await reload();
      onToast('Imported');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Import failed');
    }
  };

  return (
    <div className="dash">
      <div className="dash-sub">
        kr earned · {sold.length} of {total} items sold
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
                  <span className="r">{kr(g.revenue)}</span>
                  <span className="caret">{open ? '–' : '+'}</span>
                </button>
                {open && (
                  <div className="grp-body">
                    <div>
                      <div className="grp-sub-head">
                        <span>Sold · {g.sold.length}</span>
                        <span>{kr(g.revenue)}</span>
                      </div>
                      {g.sold.map((x) => (
                        <button key={x.id} type="button" className="grp-line" onClick={() => onOpen(x.id)}>
                          <span>{x.title}</span>
                          <span className="p">{kr(x.priceSold ?? 0)}</span>
                        </button>
                      ))}
                      {g.sold.length === 0 && <div className="grp-empty">Nothing sold yet</div>}
                    </div>
                    <div>
                      <div className="grp-sub-head muted">
                        <span>Still for sale · {g.active.length}</span>
                        <span>{kr(g.askTotal)} asking</span>
                      </div>
                      {g.active.map((x) => (
                        <button key={x.id} type="button" className="grp-line muted" onClick={() => onOpen(x.id)}>
                          <span>{x.title}</span>
                          <span className="p">{kr(x.priceListed ?? 0)}</span>
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
            <span className="v">{kr(revenue)}</span>
          </div>
        </div>
      </div>

      <div className="housekeeping">
        <span>Backup · data lives in this browser only</span>
        <div className="links">
          <button type="button" onClick={() => void doExport()}>
            Export
          </button>
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
          v{__APP_VERSION__} · {__APP_BUILD__} · {__APP_BUILT_ON__}
        </span>
      </div>
    </div>
  );
}
