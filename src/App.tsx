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

// Per-tab view choices, remembered on this device.
const PREF_KEYS = {
  leftMode: 'resale-prep:leftMode', // ACTIVE: 'days' | 'photo'
  soldPhotos: 'resale-prep:soldPhotos', // SOLD: '1' = photos on
  totalPhotos: 'resale-prep:totalPhotos', // TOTAL: '1' = photos on
};

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — the choice just won't stick */
  }
}

/** The List / Photo (or Days / Photo) pill on the hero row. */
function ViewSwitch({ labels, photo, onChange }: { labels: [string, string]; photo: boolean; onChange(photo: boolean): void }) {
  return (
    <div className="seg" role="group" aria-label="View">
      {labels.map((label, i) => (
        <button key={label} type="button" className={photo === (i === 1) ? 'on' : ''} onClick={() => onChange(i === 1)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('new');
  const [draft, setDraft] = useState<NewDraft>(emptyDraft);
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('all');
  const [soldFilter, setSoldFilter] = useState<GroupFilter>('all');
  const [leftMode, setLeftModeState] = useState<LeftMode>(() =>
    readPref(PREF_KEYS.leftMode) === 'photo' ? 'photo' : 'days',
  );
  const [soldPhotos, setSoldPhotosState] = useState(() => readPref(PREF_KEYS.soldPhotos) === '1');
  const [totalPhotos, setTotalPhotosState] = useState(() => readPref(PREF_KEYS.totalPhotos) === '1');
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
    writePref(PREF_KEYS.leftMode, m);
  };
  const setSoldPhotos = (on: boolean) => {
    setSoldPhotosState(on);
    writePref(PREF_KEYS.soldPhotos, on ? '1' : '0');
  };
  const setTotalPhotos = (on: boolean) => {
    setTotalPhotosState(on);
    writePref(PREF_KEYS.totalPhotos, on ? '1' : '0');
  };

  // A filter on a group that was just deleted falls back to "All".
  const valid = (f: GroupFilter): GroupFilter =>
    typeof f === 'string' || store.groups.some((g) => g.id === f.groupId) ? f : 'all';

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
              <ViewSwitch
                labels={['Days', 'Photo']}
                photo={leftMode === 'photo'}
                onChange={(photo) => setLeftMode(photo ? 'photo' : 'days')}
              />
            )}
            {tab === 'sold' && <ViewSwitch labels={['List', 'Photo']} photo={soldPhotos} onChange={setSoldPhotos} />}
            {tab === 'total' && <ViewSwitch labels={['List', 'Photo']} photo={totalPhotos} onChange={setTotalPhotos} />}
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
                  filter={valid(activeFilter)}
                  onFilter={setActiveFilter}
                  leftMode={leftMode}
                  sell={sell}
                  onSell={setSell}
                  onOpen={setDetailId}
                  onSold={(price) => flash(`+${store.money(price)}`)}
                />
              )}
              {tab === 'sold' && (
                <SoldScreen photos={soldPhotos} filter={valid(soldFilter)} onFilter={setSoldFilter} onOpen={setDetailId} />
              )}
              {tab === 'total' && <TotalScreen photos={totalPhotos} onOpen={setDetailId} onToast={flash} />}
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
