import { useCallback, useEffect, useRef, useState } from 'react';
import { DetailSheet } from './components/DetailSheet';
import { PinnedSlot } from './components/pinnedSlot';
import { useStore } from './data/store';
import { activeItems, matchesFilter, soldItems, soldPrice, sum } from './lib/stats';
import type { GroupFilter } from './lib/types';
import { ActiveScreen } from './screens/ActiveScreen';
import { emptyDraft, type NewDraft } from './screens/newDraft';
import { NewScreen } from './screens/NewScreen';
import { startSell, type LeftMode, type SellState } from './screens/sell';
import { SoldScreen } from './screens/SoldScreen';
import { TotalScreen } from './screens/TotalScreen';

type Tab = 'new' | 'active' | 'sold' | 'total';

const TABS: [Tab, string][] = [
  ['new', 'New'],
  ['active', 'Active'],
  ['sold', 'Sold'],
  ['total', 'Total'],
];

const LEFT_MODE_KEY = 'resale-prep:leftMode';

function readLeftMode(): LeftMode {
  try {
    return localStorage.getItem(LEFT_MODE_KEY) === 'photo' ? 'photo' : 'days';
  } catch {
    return 'days';
  }
}

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('new');
  const [draft, setDraft] = useState<NewDraft>(emptyDraft);
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('all');
  const [soldFilter, setSoldFilter] = useState<GroupFilter>('all');
  const [leftMode, setLeftModeState] = useState<LeftMode>(readLeftMode);
  const [sell, setSell] = useState<SellState | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pinnedSlot, setPinnedSlot] = useState<HTMLDivElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Any save that fails (no connection, database rule, server error) and isn't
  // handled on the spot shows its message here instead of failing silently.
  useEffect(() => {
    const onFail = (e: PromiseRejectionEvent) => {
      flash(e.reason instanceof Error ? e.reason.message : 'Something went wrong. Try again.');
    };
    window.addEventListener('unhandledrejection', onFail);
    return () => window.removeEventListener('unhandledrejection', onFail);
  }, [flash]);

  const go = (t: Tab) => {
    setTab(t);
    setSell(null);
    setDetailId(null);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const setLeftMode = (m: LeftMode) => {
    setLeftModeState(m);
    try {
      localStorage.setItem(LEFT_MODE_KEY, m);
    } catch {
      /* private mode — the choice just won't stick */
    }
  };

  const closeDetail = useCallback(() => setDetailId(null), []);

  const markSoldFromDetail = (id: string) => {
    const item = store.items.find((i) => i.id === id);
    if (!item) return;
    setDetailId(null);
    setTab('active');
    if (!matchesFilter(item, activeFilter)) setActiveFilter('all');
    setSell(startSell(item));
  };

  const revenue = sum(soldItems(store.items), soldPrice);
  const hero: Record<Tab, string> = {
    new: 'New listing',
    active: `${activeItems(store.items).length} for sale`,
    sold: `${soldItems(store.items).length} sold`,
    total: store.money(revenue),
  };

  return (
    <PinnedSlot.Provider value={pinnedSlot}>
      <div className="app">
        <main className="scroll" ref={scrollRef}>
          <div className="hero-row">
            <h1 className={`hero ${tab === 'total' ? 'big' : ''}`} style={{ margin: 0 }}>
              {store.loaded ? hero[tab] : ' '}
            </h1>
            {tab === 'active' && (
              <div className="seg" role="group" aria-label="Left column">
                {(['days', 'photo'] as const).map((m) => (
                  <button key={m} type="button" className={leftMode === m ? 'on' : ''} onClick={() => setLeftMode(m)}>
                    {m === 'days' ? 'Days' : 'Photo'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!store.loaded ? (
            <div className="loading" role="status">
              {store.loadError ? (
                <>
                  <span className="loading-error">{store.loadError}</span>
                  <button type="button" className="retry" onClick={() => void store.reload()}>
                    Retry
                  </button>
                </>
              ) : store.waking ? (
                <>
                  <span>Waking up</span>
                  <span>the database</span>
                  <span>…</span>
                </>
              ) : (
                '…'
              )}
            </div>
          ) : (
            <>
              {tab === 'new' && (
                <NewScreen
                  draft={draft}
                  setDraft={setDraft}
                  onSaved={() => {
                    setActiveFilter('all');
                    go('active');
                    flash('Saved →');
                  }}
                />
              )}
              {tab === 'active' && (
                <ActiveScreen
                  filter={activeFilter}
                  onFilter={setActiveFilter}
                  leftMode={leftMode}
                  sell={sell}
                  onSell={setSell}
                  onOpen={setDetailId}
                  onSold={(price) => flash(`+${store.money(price)}`)}
                />
              )}
              {tab === 'sold' && <SoldScreen filter={soldFilter} onFilter={setSoldFilter} onOpen={setDetailId} />}
              {tab === 'total' && <TotalScreen onOpen={setDetailId} onToast={flash} />}
            </>
          )}
          <div className="bottom-space" />
        </main>

        {/* Bottom dock: toast (floats just above it), pinned action band, tab bar. */}
        <div className="dock">
          {/* The free database sleeps after an hour; say so while it resumes. */}
          {(toast || (store.loaded && store.waking)) && (
            <div className="toast" role="status">
              {toast ?? 'Waking up the database…'}
            </div>
          )}
          <div ref={setPinnedSlot} />
          <nav className="tabbar">
            <div className="tabpill">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tab === id ? 'on' : ''}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => go(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {detailId && (
          <DetailSheet itemId={detailId} onClose={closeDetail} onMarkSold={markSoldFromDetail} onToast={flash} />
        )}
      </div>
    </PinnedSlot.Provider>
  );
}
