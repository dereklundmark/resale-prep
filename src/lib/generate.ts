// The AI suggestion call: POSTs to the Azure Functions API at /api/generate,
// which calls Gemini server-side — the API key never reaches the browser.
import type { Condition, Estimate, Platform } from './types';

export interface GenerateInput {
  name: string;
  /** A condition code, e.g. 'very_good'. */
  condition: Condition;
  /** Platform codes; only these get a category suggestion. */
  platforms: Platform[];
  photos: Blob[];
}

export interface Suggestion {
  /** In the market's listing language (Swedish for Sweden). */
  title: string;
  /** In the market's listing language. */
  description: string;
  /** Best match first; the UI adds "Other…" at the end. */
  categories: Partial<Record<Platform, string[]>>;
  /** Reasoning in English. */
  estimate: Estimate;
}

/** Shown to the user as-is. */
export class GenerateError extends Error {}

/** The API accepts up to 4; the first photos are the most informative anyway. */
const MAX_PHOTOS = 4;

export function generateSuggestion(input: GenerateInput): Promise<Suggestion> {
  return apiGenerate(input);
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',', 2)[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function apiGenerate({ name, condition, platforms, photos }: GenerateInput): Promise<Suggestion> {
  let res: Response;
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        condition,
        platforms,
        photos: await Promise.all(photos.slice(0, MAX_PHOTOS).map(blobToBase64)),
      }),
    });
  } catch {
    throw new GenerateError('Could not reach the API. Check your connection.');
  }
  const body = (await res.json().catch(() => null)) as (Suggestion & { error?: string; detail?: string }) | null;
  if (!res.ok || !body) {
    // No JSON error means Azure answered, not our API — usually its ~45 s
    // request timeout (504/500). Show the status so it's diagnosable.
    if (!body?.error) throw new GenerateError(`Generate failed (HTTP ${res.status}). Try again.`);
    throw new GenerateError(body.detail ? `${body.error} [${body.detail}]` : body.error);
  }
  return body;
}
