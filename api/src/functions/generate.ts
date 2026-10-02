// POST /api/generate — photo(s) + item name → Swedish listing draft from Gemini.
// The Gemini key only exists here, server-side (local.settings.json locally,
// app settings on Azure), so it never reaches the browser.
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { ApiError, GoogleGenAI } from '@google/genai';

const PLATFORMS = ['tradera', 'blocket', 'facebook'] as const;
type Platform = (typeof PLATFORMS)[number];

const CONDITIONS = ['Ny', 'Nyskick', 'Mycket bra skick', 'Bra skick', 'Använt skick', 'Renoveringsobjekt'];

const MAX_PHOTOS = 4;
const MAX_PHOTO_BASE64 = 3_000_000; // ~2.2 MB per photo; the app sends ~150 KB

interface GenerateRequest {
  name: string;
  condition: string;
  platforms: Platform[];
  /** Base64 JPEGs, no data: prefix. */
  photos: string[];
}

function parseRequest(body: unknown): GenerateRequest | string {
  if (typeof body !== 'object' || body === null) return 'Body must be JSON';
  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 200) : '';
  const condition = typeof b.condition === 'string' && CONDITIONS.includes(b.condition) ? b.condition : null;
  const platforms = Array.isArray(b.platforms) ? b.platforms.filter((p): p is Platform => PLATFORMS.includes(p)) : [];
  const photos = Array.isArray(b.photos) ? b.photos.filter((p): p is string => typeof p === 'string') : [];
  if (!condition) return 'Unknown condition';
  if (platforms.length === 0) return 'Pick at least one platform';
  if (!name && photos.length === 0) return 'Give a name or a photo';
  if (photos.length > MAX_PHOTOS) return `At most ${MAX_PHOTOS} photos`;
  if (photos.some((p) => p.length > MAX_PHOTO_BASE64)) return 'Photo too large';
  return { name, condition, platforms: [...new Set(platforms)], photos };
}

const PLATFORM_HINT: Record<Platform, string> = {
  tradera: 'Tradera (Swedish category path, e.g. "Hem & Hushåll › Möbler › Fåtöljer")',
  blocket: 'Blocket (Swedish category path, e.g. "För hemmet › Möbler & heminredning")',
  facebook: 'Facebook Marketplace (category path as shown to users in Sweden)',
};

function buildPrompt(r: GenerateRequest): string {
  return [
    'You help a private person in Sweden sell second-hand items.',
    `Item as described by the seller: "${r.name || '(no name given — identify it from the photos)'}".`,
    `Condition (Swedish scale): ${r.condition}.`,
    r.photos.length ? `${r.photos.length} photo(s) attached. Use them to identify brand, model, colour, material and visible wear.` : 'No photos.',
    '',
    'Write:',
    '- title: a Swedish listing title, max ~60 characters. Brand + model + key attribute. No emojis, no ALL CAPS.',
    '- description: 2–4 short sentences in Swedish. Factual and friendly: what it is, condition and any visible flaws, what is included. Do not invent facts you cannot see or were not told; leave out measurements unless known. Do not mention a price.',
    `- categories: for each of these platforms, the 3 most likely categories, best first: ${r.platforms.map((p) => PLATFORM_HINT[p]).join('; ')}.`,
    '- estimate: realistic second-hand asking price range in whole SEK on Swedish marketplaces (low, high), plus 1–2 sentences of reasoning in English (e.g. new price and typical depreciation).',
  ].join('\n');
}

function responseSchema(platforms: Platform[]) {
  const cats = { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 };
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      categories: {
        type: 'object',
        properties: Object.fromEntries(platforms.map((p) => [p, cats])),
        required: platforms,
      },
      estimate: {
        type: 'object',
        properties: {
          low: { type: 'integer' },
          high: { type: 'integer' },
          reasoning: { type: 'string' },
        },
        required: ['low', 'high', 'reasoning'],
      },
    },
    required: ['title', 'description', 'categories', 'estimate'],
  };
}

const json = (status: number, body: unknown): HttpResponseInit => ({ status, jsonBody: body });

export async function generate(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('PASTE')) {
    return json(500, { error: 'GEMINI_API_KEY is not set. Put your key in api/local.settings.json.' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }
  const parsed = parseRequest(body);
  if (typeof parsed === 'string') return json(400, { error: parsed });

  const ai = new GoogleGenAI({ apiKey });
  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          ...parsed.photos.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
          { text: buildPrompt(parsed) },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: responseSchema(parsed.platforms),
      temperature: 0.4,
    },
  };

  // Free-tier models regularly answer 503 "high demand" for a few seconds.
  // Try the main model twice, then the fallback model once.
  const attempts = [MODEL, MODEL, FALLBACK_MODEL];
  let lastError: unknown;
  for (const [i, model] of attempts.entries()) {
    try {
      const res = await ai.models.generateContent({ model, ...request });
      const suggestion = JSON.parse(res.text ?? '');
      const { low, high } = suggestion.estimate;
      suggestion.estimate.low = Math.max(0, Math.round(Math.min(low, high)));
      suggestion.estimate.high = Math.max(0, Math.round(Math.max(low, high)));
      if (i > 0) ctx.log(`Gemini answered on attempt ${i + 1} (${model})`);
      return json(200, suggestion);
    } catch (e) {
      lastError = e;
      if (e instanceof ApiError && e.status === 429) {
        return json(429, { error: 'Gemini free-tier limit reached. Wait a minute and try again.' });
      }
      if (!(e instanceof ApiError && RETRYABLE.has(e.status))) break;
      ctx.warn(`Gemini ${model} busy (${e.status}), retrying`);
      await sleep(1500);
    }
  }
  ctx.error('Gemini call failed', lastError);
  if (lastError instanceof ApiError && RETRYABLE.has(lastError.status)) {
    return json(503, { error: 'Gemini is busy right now. Try again in a minute.' });
  }
  return json(502, { error: 'Gemini call failed. Try again.' });
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash';
const RETRYABLE = new Set([500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

app.http('generate', { methods: ['POST'], authLevel: 'anonymous', handler: generate });
