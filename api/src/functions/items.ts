// Items and groups:
//   GET    /api/items        everything the app shows: items (with platform and photo ids) + groups
//   POST   /api/items        create an item (new listing, past sale or import), with its photos
//   PUT    /api/items/{id}   replace an item's fields and platforms (edit, mark sold); photos untouched
//   DELETE /api/items/{id}   delete an item; its photos and platform rows go with it (ON DELETE CASCADE)
//   POST   /api/groups       create a group (or return the existing one with that name)
import { app, type HttpRequest } from '@azure/functions';
import { sql, withDb } from '../lib/db.js';
import { HttpError, handler, json, readJson } from '../lib/http.js';

/** The JSON shape the app sends and receives (mirrors src/lib/types.ts Item). */
interface ItemDto {
  id: string;
  marketCode: string;
  currencyCode: string;
  listingLanguage: string;
  title: string;
  description: string;
  condition: string | null;
  groupId: string | null;
  platforms: string[];
  categories: Record<string, string>;
  priceListed: number | null;
  priceSold: number | null;
  status: 'active' | 'sold';
  dateListed: string | null;
  dateSold: string | null;
  isBackfill: boolean;
  photoIds: string[];
  aiEstimate: { low: number; high: number; reasoning: string } | null;
  notes: string | null;
  createdAt: string;
}

interface PhotoUpload {
  id: string;
  /** base64 JPEG, no data: prefix */
  full: string;
  thumb: string;
}

// ---------- validation ----------

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PHOTOS = 10;
const MAX_PHOTO_BASE64 = 3_000_000;

const bad = (msg: string) => new HttpError(400, msg);

function guid(v: unknown, field: string): string {
  if (typeof v !== 'string' || !GUID.test(v)) throw bad(`${field} must be an id`);
  return v.toLowerCase();
}
function text(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  if (v.length > max) throw bad(`${field} is too long (max ${max})`);
  return v;
}
function optText(v: unknown, field: string, max: number): string | null {
  return v === null || v === undefined || v === '' ? null : text(v, field, max);
}
function optMoney(v: unknown, field: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 9_999_999_999) throw bad(`${field} must be an amount`);
  return Math.round(v * 100) / 100;
}
function optDate(v: unknown, field: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !DATE.test(v)) throw bad(`${field} must be YYYY-MM-DD`);
  return v;
}

function parseItem(body: unknown, idFromUrl?: string): ItemDto {
  if (typeof body !== 'object' || body === null) throw bad('Body must be an item');
  const b = body as Record<string, unknown>;
  const id = guid(idFromUrl ?? b.id, 'id');
  if (b.status !== 'active' && b.status !== 'sold') throw bad('status must be active or sold');
  const platforms = Array.isArray(b.platforms) ? b.platforms.map((p) => text(p, 'platform', 30)) : [];
  const categories: Record<string, string> = {};
  if (typeof b.categories === 'object' && b.categories !== null) {
    for (const [k, v] of Object.entries(b.categories)) {
      const c = optText(v, `category for ${k}`, 200);
      if (c) categories[k] = c;
    }
  }
  const e = b.aiEstimate as Record<string, unknown> | null | undefined;
  return {
    id,
    marketCode: text(b.marketCode, 'marketCode', 10),
    currencyCode: text(b.currencyCode, 'currencyCode', 3),
    listingLanguage: text(b.listingLanguage, 'listingLanguage', 10),
    title: text(b.title, 'title', 200).trim(),
    description: text(b.description ?? '', 'description', 4000),
    condition: optText(b.condition, 'condition', 30),
    groupId: b.groupId ? guid(b.groupId, 'groupId') : null,
    platforms: [...new Set(platforms)],
    categories,
    priceListed: optMoney(b.priceListed, 'priceListed'),
    priceSold: optMoney(b.priceSold, 'priceSold'),
    status: b.status,
    dateListed: optDate(b.dateListed, 'dateListed'),
    dateSold: optDate(b.dateSold, 'dateSold'),
    isBackfill: b.isBackfill === true,
    photoIds: [],
    aiEstimate:
      e && typeof e === 'object'
        ? {
            low: optMoney(e.low, 'aiEstimate.low') ?? 0,
            high: optMoney(e.high, 'aiEstimate.high') ?? 0,
            reasoning: text(e.reasoning ?? '', 'aiEstimate.reasoning', 1000),
          }
        : null,
    notes: optText(b.notes, 'notes', 2000),
    createdAt: typeof b.createdAt === 'string' && !Number.isNaN(Date.parse(b.createdAt)) ? b.createdAt : new Date().toISOString(),
  };
}

function parsePhotos(v: unknown): PhotoUpload[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > MAX_PHOTOS) throw bad(`photos must be a list of at most ${MAX_PHOTOS}`);
  return v.map((p, i) => {
    const o = p as Record<string, unknown>;
    if (typeof o?.full !== 'string' || typeof o?.thumb !== 'string') throw bad(`photo ${i + 1} is missing its image`);
    if (o.full.length > MAX_PHOTO_BASE64 || o.thumb.length > MAX_PHOTO_BASE64) throw bad(`photo ${i + 1} is too large`);
    return { id: guid(o.id, `photo ${i + 1} id`), full: o.full, thumb: o.thumb };
  });
}

// ---------- SQL ----------

/** DATE / DATETIME2 values arrive as JS Dates in UTC. */
const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const utcDate = (s: string | null): Date | null => (s ? new Date(`${s}T00:00:00Z`) : null);

function itemInputs(r: sql.Request, it: ItemDto): sql.Request {
  return r
    .input('id', sql.UniqueIdentifier, it.id)
    .input('market_code', sql.VarChar(10), it.marketCode)
    .input('currency_code', sql.Char(3), it.currencyCode)
    .input('listing_language', sql.VarChar(10), it.listingLanguage)
    .input('title', sql.NVarChar(200), it.title)
    .input('description', sql.NVarChar(4000), it.description)
    .input('condition_code', sql.VarChar(30), it.condition)
    .input('group_id', sql.UniqueIdentifier, it.groupId)
    .input('price_listed', sql.Decimal(12, 2), it.priceListed)
    .input('price_sold', sql.Decimal(12, 2), it.priceSold)
    .input('status', sql.VarChar(10), it.status)
    .input('date_listed', sql.Date, utcDate(it.dateListed))
    .input('date_sold', sql.Date, utcDate(it.dateSold))
    .input('is_backfill', sql.Bit, it.isBackfill)
    .input('ai_low', sql.Decimal(12, 2), it.aiEstimate?.low ?? null)
    .input('ai_high', sql.Decimal(12, 2), it.aiEstimate?.high ?? null)
    .input('ai_reasoning', sql.NVarChar(1000), it.aiEstimate?.reasoning ?? null)
    .input('notes', sql.NVarChar(2000), it.notes);
}

async function replacePlatforms(tx: sql.Transaction, it: ItemDto): Promise<void> {
  await new sql.Request(tx)
    .input('id', sql.UniqueIdentifier, it.id)
    .query('DELETE dbo.item_platforms WHERE item_id = @id;');
  for (const code of it.platforms) {
    await new sql.Request(tx)
      .input('id', sql.UniqueIdentifier, it.id)
      .input('code', sql.VarChar(30), code)
      .input('category', sql.NVarChar(200), it.categories[code] ?? null)
      .query('INSERT dbo.item_platforms (item_id, platform_code, category) VALUES (@id, @code, @category);');
  }
}

/** Runs fn in a transaction: all of an item's rows are saved, or none. */
async function inTransaction<T>(pool: sql.ConnectionPool, fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    await tx.rollback().catch(() => undefined);
    throw e;
  }
}

// ---------- endpoints ----------

app.http('items', {
  route: 'items',
  methods: ['GET', 'POST'],
  authLevel: 'anonymous', // Static Web Apps already requires the owner role on /api/*
  handler: handler(async (req: HttpRequest) => {
    if (req.method === 'GET') return json(200, await listAll());

    const body = await readJson(req);
    const item = parseItem(body);
    const photos = parsePhotos((body as Record<string, unknown>).photos);
    await withDb((pool) =>
      inTransaction(pool, async (tx) => {
        await itemInputs(new sql.Request(tx), item)
          .input('created_at', sql.DateTime2(3), new Date(item.createdAt))
          .query(`
            INSERT dbo.items (id, market_code, currency_code, listing_language, title, description,
              condition_code, group_id, price_listed, price_sold, status, date_listed, date_sold,
              is_backfill, ai_estimate_low, ai_estimate_high, ai_estimate_reasoning, notes, created_at)
            VALUES (@id, @market_code, @currency_code, @listing_language, @title, @description,
              @condition_code, @group_id, @price_listed, @price_sold, @status, @date_listed, @date_sold,
              @is_backfill, @ai_low, @ai_high, @ai_reasoning, @notes, @created_at);`);
        await replacePlatforms(tx, item);
        for (const [position, p] of photos.entries()) {
          await new sql.Request(tx)
            .input('id', sql.UniqueIdentifier, p.id)
            .input('item_id', sql.UniqueIdentifier, item.id)
            .input('position', sql.TinyInt, position)
            .input('full_jpeg', sql.VarBinary(sql.MAX), Buffer.from(p.full, 'base64'))
            .input('thumb_jpeg', sql.VarBinary(sql.MAX), Buffer.from(p.thumb, 'base64'))
            .query(`INSERT dbo.photos (id, item_id, position, full_jpeg, thumb_jpeg)
                    VALUES (@id, @item_id, @position, @full_jpeg, @thumb_jpeg);`);
        }
      }),
    );
    return json(201, { ...item, photoIds: photos.map((p) => p.id) });
  }),
});

app.http('item', {
  route: 'items/{id}',
  methods: ['PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: handler(async (req: HttpRequest) => {
    const id = guid(req.params.id, 'id');

    if (req.method === 'DELETE') {
      const r = await withDb((pool) =>
        pool.request().input('id', sql.UniqueIdentifier, id).query('DELETE dbo.items WHERE id = @id;'),
      );
      if (!r.rowsAffected[0]) throw new HttpError(404, 'Item not found');
      return { status: 204 };
    }

    const item = parseItem(await readJson(req), id);
    await withDb((pool) =>
      inTransaction(pool, async (tx) => {
        const r = await itemInputs(new sql.Request(tx), item).query(`
          UPDATE dbo.items SET
            market_code = @market_code, currency_code = @currency_code, listing_language = @listing_language,
            title = @title, description = @description, condition_code = @condition_code, group_id = @group_id,
            price_listed = @price_listed, price_sold = @price_sold, status = @status,
            date_listed = @date_listed, date_sold = @date_sold, is_backfill = @is_backfill,
            ai_estimate_low = @ai_low, ai_estimate_high = @ai_high, ai_estimate_reasoning = @ai_reasoning,
            notes = @notes, updated_at = SYSUTCDATETIME()
          WHERE id = @id;`);
        if (!r.rowsAffected[0]) throw new HttpError(404, 'Item not found');
        await replacePlatforms(tx, item);
      }),
    );
    return json(200, item);
  }),
});

app.http('groups', {
  route: 'groups',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: handler(async (req: HttpRequest) => {
    const b = (await readJson(req)) as Record<string, unknown>;
    const id = guid(b?.id, 'id');
    const name = text(b?.name, 'name', 100).trim();
    if (!name) throw bad('name is required');
    const group = await withDb(async (pool) => {
      // Same name already there (any letter case)? Return it instead of failing.
      const r = await pool
        .request()
        .input('id', sql.UniqueIdentifier, id)
        .input('name', sql.NVarChar(100), name).query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.groups WHERE name = @name)
            INSERT dbo.groups (id, name) VALUES (@id, @name);
          SELECT id, name, description, created_at FROM dbo.groups WHERE name = @name;`);
      return r.recordset[0];
    });
    return json(200, {
      id: String(group.id).toLowerCase(),
      name: group.name,
      description: group.description,
      createdAt: group.created_at.toISOString(),
    });
  }),
});

async function listAll() {
  return withDb(async (pool) => {
    const r = await pool.request().query(`
      SELECT id, market_code, currency_code, listing_language, title, description, condition_code,
             group_id, price_listed, price_sold, status, date_listed, date_sold, is_backfill,
             ai_estimate_low, ai_estimate_high, ai_estimate_reasoning, notes, created_at
        FROM dbo.items;
      SELECT item_id, platform_code, category FROM dbo.item_platforms;
      SELECT id, item_id FROM dbo.photos ORDER BY item_id, position;
      SELECT id, name, description, created_at FROM dbo.groups ORDER BY created_at;`);
    const [items, platformRows, photoRows, groups] = r.recordsets as any[][];

    // GUIDs come back upper-case from SQL Server; the app uses lower-case.
    const low = (v: unknown) => (v === null || v === undefined ? null : String(v).toLowerCase());
    const platformsOf = new Map<string, { codes: string[]; categories: Record<string, string> }>();
    for (const p of platformRows) {
      const key = low(p.item_id)!;
      const entry = platformsOf.get(key) ?? { codes: [], categories: {} };
      entry.codes.push(p.platform_code);
      if (p.category) entry.categories[p.platform_code] = p.category;
      platformsOf.set(key, entry);
    }
    const photosOf = new Map<string, string[]>();
    for (const p of photoRows) {
      const key = low(p.item_id)!;
      photosOf.set(key, [...(photosOf.get(key) ?? []), low(p.id)!]);
    }

    return {
      items: items.map((i): ItemDto => {
        const id = low(i.id)!;
        const plat = platformsOf.get(id);
        return {
          id,
          marketCode: i.market_code,
          currencyCode: i.currency_code,
          listingLanguage: i.listing_language,
          title: i.title,
          description: i.description,
          condition: i.condition_code,
          groupId: low(i.group_id),
          platforms: plat?.codes ?? [],
          categories: plat?.categories ?? {},
          priceListed: i.price_listed,
          priceSold: i.price_sold,
          status: i.status,
          dateListed: isoDate(i.date_listed),
          dateSold: isoDate(i.date_sold),
          isBackfill: i.is_backfill,
          photoIds: photosOf.get(id) ?? [],
          aiEstimate:
            i.ai_estimate_low !== null && i.ai_estimate_high !== null
              ? { low: i.ai_estimate_low, high: i.ai_estimate_high, reasoning: i.ai_estimate_reasoning ?? '' }
              : null,
          notes: i.notes,
          createdAt: i.created_at.toISOString(),
        };
      }),
      groups: groups.map((g) => ({
        id: low(g.id),
        name: g.name,
        description: g.description,
        createdAt: g.created_at.toISOString(),
      })),
    };
  });
}
