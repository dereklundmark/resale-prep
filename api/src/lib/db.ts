// Shared Azure SQL access for every endpoint.
//
// The free database pauses itself after about an hour of no use, and the
// first connection after that fails for up to a minute while it resumes.
// withDb() retries through that, but gives up early enough to answer within
// Static Web Apps' ~45 s request limit; the app then retries the request.
import sql from 'mssql';
import { HttpError } from './http.js';

const WAKE_BUDGET_MS = 30_000;

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function connectionConfig(): sql.config {
  const { SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD } = process.env;
  if (!SQL_SERVER || !SQL_DATABASE || !SQL_USER || !SQL_PASSWORD) {
    throw new HttpError(500, 'Database settings are missing. Add SQL_SERVER, SQL_DATABASE, SQL_USER and SQL_PASSWORD under Static Web App → Environment variables.');
  }
  return {
    server: SQL_SERVER,
    database: SQL_DATABASE,
    user: SQL_USER,
    password: SQL_PASSWORD,
    options: { encrypt: true },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
    requestTimeout: 30_000,
  };
}

function getPool(): Promise<sql.ConnectionPool> {
  poolPromise ??= new sql.ConnectionPool(connectionConfig()).connect().catch((e: unknown) => {
    poolPromise = null; // don't cache a failed connection
    throw e;
  });
  return poolPromise;
}

async function resetPool(): Promise<void> {
  const p = poolPromise;
  poolPromise = null;
  try {
    await (await p)?.close();
  } catch {
    /* already broken; nothing to close */
  }
}

/** True for errors that mean "the database is paused / resuming / briefly unreachable". */
function isTransient(e: unknown): boolean {
  const err = e as { number?: number; code?: string; message?: string; originalError?: { number?: number; message?: string } };
  const number = err.number ?? err.originalError?.number;
  const message = `${err.message ?? ''} ${err.originalError?.message ?? ''}`;
  if (/Login failed/i.test(message) && !/not currently available/i.test(message)) return false; // wrong password: don't retry
  if (number !== undefined && [40613, 40197, 40501, 49918, 49919, 49920, 4060].includes(number)) return true;
  if (err.code && ['ETIMEOUT', 'ESOCKET', 'ECONNRESET', 'ECONNCLOSED', 'ENOTOPEN'].includes(err.code)) return true;
  return /not currently available|is paused|resuming/i.test(message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs fn with a connected pool, retrying while the database wakes up. */
export async function withDb<T>(fn: (pool: sql.ConnectionPool) => Promise<T>): Promise<T> {
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(await getPool());
    } catch (e) {
      if (e instanceof HttpError || !isTransient(e)) throw e;
      await resetPool();
      if (Date.now() - started > WAKE_BUDGET_MS) {
        throw new HttpError(503, 'The database is waking up. Try again in a moment.', { waking: true });
      }
      await sleep(Math.min(2_000 * attempt, 6_000));
    }
  }
}

export { sql };
