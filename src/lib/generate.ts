// The AI suggestion call: POSTs to the Azure Functions API at /api/generate,
// which calls Gemini server-side — the API key never reaches the browser.
import type { Condition, Estimate, Platform } from './types';

export interface GenerateInput {
  name: string;
  condition: Condition;
  /** Only these platforms get a category suggestion. */
  platforms: Platform[];
  photos: Blob[];
}

export interface Suggestion {
  /** Swedish. */
  title: string;
  /** Swedish. */
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
  const body = (await res.json().catch(() => null)) as (Suggestion & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new GenerateError(
      body?.error ?? 'Generate failed. Try again.',
    );
  }
  return body;
}
