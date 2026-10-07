// Every call from the app to the API goes through here.
//
// The free database pauses after about an hour of no use; the API then
// answers 503 {waking: true} while it resumes (up to a minute). apiFetch
// retries those for a while and reports it via onWaking, so the screen can
// say "Waking up the database…" instead of failing.

/** Shown to the user as-is. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type WakingListener = (waking: boolean) => void;
let wakingListener: WakingListener = () => {};
export function onWaking(fn: WakingListener): void {
  wakingListener = fn;
}

const WAKE_RETRIES = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(path, {
        ...init,
        headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
      });
    } catch {
      wakingListener(false);
      throw new ApiError('Could not reach the server. Check your connection.', 0);
    }
    const body = (await res.json().catch(() => null)) as (T & { error?: string; waking?: boolean }) | null;

    // Azure's own timeout (no JSON) also usually means the database was asleep.
    const waking = body?.waking === true || ((res.status === 500 || res.status === 504) && !body?.error);
    if (waking && attempt < WAKE_RETRIES) {
      wakingListener(true);
      await sleep(3_000);
      continue;
    }
    wakingListener(false);

    if (res.status === 401 || res.status === 403) {
      throw new ApiError('Your sign-in has expired. Reload the app to sign in again.', res.status);
    }
    if (!res.ok) throw new ApiError(body?.error ?? `Request failed (HTTP ${res.status}).`, res.status);
    return body as T;
  }
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, data: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path: string) => apiFetch<null>(path, { method: 'DELETE' }),
};

export function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',', 2)[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Where the app loads a stored photo from. */
export function photoUrl(id: string, size: 'full' | 'thumb'): string {
  return `/api/photos/${id}?size=${size}`;
}
