// The AI suggestion call. In normal dev (`npm run dev`) and on Azure this
// POSTs to the Azure Functions API at /api/generate, which calls Gemini
// server-side — the API key never reaches the browser. `npm run dev:mock`
// swaps in a local placeholder so the UI can be worked on without the API.
import { PLATFORM_LABEL } from './constants';
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
  return import.meta.env.VITE_GENERATE === 'mock' ? mockGenerate(input) : apiGenerate(input);
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
    throw new GenerateError('Could not reach the API. Is `npm run dev` running?');
  }
  const body = (await res.json().catch(() => null)) as (Suggestion & { error?: string }) | null;
  if (!res.ok || !body) {
    throw new GenerateError(
      body?.error ?? (res.status === 404 ? 'No API here — start the app with `npm run dev`.' : 'Generate failed. Try again.'),
    );
  }
  return body;
}

const MOCK_CATEGORIES: Record<Platform, string[]> = {
  tradera: ['Hem & Hushåll › Möbler › Övrigt', 'Hem & Hushåll › Inredning', 'Övrigt'],
  blocket: ['För hemmet › Möbler & heminredning', 'För hemmet › Övrigt', 'Övrigt'],
  facebook: ['Home & Garden › Furniture', 'Home & Garden', 'Miscellaneous'],
};

function mockGenerate({ name, condition, platforms, photos }: GenerateInput): Promise<Suggestion> {
  const thing = name.trim() || 'Föremål';
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          title: `${thing} – ${condition.toLowerCase()}`,
          description:
            `Säljer ${thing.toLowerCase()} i ${condition.toLowerCase()}. ` +
            `Fungerar som den ska, inga större skador. ${photos.length > 1 ? 'Se bilderna för detaljer. ' : ''}` +
            'Rökfritt hem. Hämtas eller skickas mot fraktkostnad.',
          categories: Object.fromEntries(platforms.map((p) => [p, MOCK_CATEGORIES[p]])),
          estimate: {
            low: 300,
            high: 500,
            reasoning: `Mock estimate for ${platforms.map((p) => PLATFORM_LABEL[p]).join(', ') || 'these platforms'} (dev:mock mode).`,
          },
        }),
      1300,
    ),
  );
}
