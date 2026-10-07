// Markets, platforms and conditions: the rows that make the app scale by
// data (adding Vinted is an INSERT into dbo.platforms). Cached for a few
// minutes per Functions instance, since they almost never change.
import { withDb } from './db.js';

export interface Market {
  code: string;
  name: string;
  listingLanguage: string;
  currencyCode: string;
  locale: string;
  isCurrent: boolean;
}

export interface PlatformInfo {
  code: string;
  marketCode: string;
  name: string;
  categoryHint: string;
  colorStrong: string;
  colorTint: string;
  colorText: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface ConditionInfo {
  code: string;
  sortOrder: number;
  /** language → label, e.g. { sv: 'Mycket bra skick', en: 'Very good' } */
  labels: Record<string, string>;
}

export interface Catalog {
  markets: Market[];
  platforms: PlatformInfo[];
  conditions: ConditionInfo[];
}

const TTL_MS = 5 * 60_000;
let cached: { at: number; catalog: Catalog } | null = null;

export async function loadCatalog(): Promise<Catalog> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.catalog;
  const catalog = await withDb(async (pool) => {
    const r = await pool.request().query(`
      SELECT code, name, listing_language, currency_code, locale, is_current FROM dbo.markets ORDER BY code;
      SELECT code, market_code, name, category_hint, color_strong, color_tint, color_text, sort_order, is_enabled
        FROM dbo.platforms ORDER BY sort_order, code;
      SELECT c.code, c.sort_order, l.language, l.label
        FROM dbo.conditions AS c LEFT JOIN dbo.condition_labels AS l ON l.condition_code = c.code
        ORDER BY c.sort_order, c.code;`);
    const [markets, platforms, conditionRows] = r.recordsets as any[][];

    const conditions = new Map<string, ConditionInfo>();
    for (const row of conditionRows) {
      const c: ConditionInfo = conditions.get(row.code) ?? { code: row.code, sortOrder: row.sort_order, labels: {} };
      if (row.language) c.labels[row.language] = row.label;
      conditions.set(row.code, c);
    }

    return {
      markets: markets.map((m) => ({
        code: m.code,
        name: m.name,
        listingLanguage: m.listing_language,
        currencyCode: m.currency_code,
        locale: m.locale,
        isCurrent: m.is_current,
      })),
      platforms: platforms.map((p) => ({
        code: p.code,
        marketCode: p.market_code,
        name: p.name,
        categoryHint: p.category_hint,
        colorStrong: p.color_strong,
        colorTint: p.color_tint,
        colorText: p.color_text,
        sortOrder: p.sort_order,
        isEnabled: p.is_enabled,
      })),
      conditions: [...conditions.values()],
    };
  });
  cached = { at: Date.now(), catalog };
  return catalog;
}

/** The market new items are created in. */
export function currentMarket(c: Catalog): Market {
  const m = c.markets.find((x) => x.isCurrent) ?? c.markets[0];
  if (!m) throw new Error('No market configured. Run sql/003_seed.sql.');
  return m;
}
