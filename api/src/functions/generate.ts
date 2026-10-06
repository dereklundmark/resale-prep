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
    return json(500, {
      error: 'GEMINI_API_KEY is not set. Add it under Static Web App → Settings → Environment variables.',
    });
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

  // Free-tier models often answer 503 "high demand" (slowly), and each model
  // has its own quota. So: try each model in turn, each with a short timeout,
  // all inside a total budget that stays under Static Web Apps' ~45 s limit
  // on API requests (past that, Azure kills the request with a bare error).
  const started = Date.now();
  const failures: { model: string; kind: 'busy' | 'quota' | 'fatal'; detail: string }[] = [];
  for (const model of modelChain()) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 3_000) break;
    const timeoutMs = Math.min(ATTEMPT_TIMEOUT_MS, remaining);
    try {
      const res = await ai.models.generateContent({
        model,
        ...request,
        config: { ...request.config, abortSignal: AbortSignal.timeout(timeoutMs) },
      });
      const suggestion = JSON.parse(res.text ?? '');
      const { low, high } = suggestion.estimate;
      suggestion.estimate.low = Math.max(0, Math.round(Math.min(low, high)));
      suggestion.estimate.high = Math.max(0, Math.round(Math.max(low, high)));
      if (failures.length) ctx.log(`Gemini answered with ${model} after: ${failures.map((f) => f.detail).join(' · ')}`);
      return json(200, suggestion);
    } catch (e) {
      const failure = classify(model, e, timeoutMs);
      failures.push(failure);
      ctx.warn(`Gemini attempt failed: ${failure.detail}`);
      // A bad key or a bad request won't get better with another model.
      if (failure.kind === 'fatal') break;
    }
  }

  const detail = failures.map((f) => f.detail).join(' · ') || 'no attempt fit in the time budget';
  ctx.error(`Gemini call failed: ${detail}`);
  if (failures.length && failures.every((f) => f.kind === 'quota')) {
    return json(429, { error: 'Gemini free-tier limit reached. Wait a minute and try again.', detail });
  }
  if (failures.length && failures.every((f) => f.kind !== 'fatal')) {
    return json(503, { error: 'Gemini is busy right now. Try again in a minute.', detail });
  }
  return json(502, { error: 'Gemini call failed.', detail });
}

const TOTAL_BUDGET_MS = 38_000;
const ATTEMPT_TIMEOUT_MS = 12_000;

/**
 * GEMINI_MODEL first, then GEMINI_FALLBACK_MODEL (comma-separated list allowed),
 * then Flash-Lite as a last resort — it's usually the least busy.
 */
function modelChain(): string[] {
  const main = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const fallbacks = (process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([main, ...fallbacks, 'gemini-3.5-flash-lite'])];
}

function classify(model: string, e: unknown, timeoutMs: number) {
  if (e instanceof ApiError) {
    // The SDK's message is Google's JSON error; pull out the human part.
    const msg = /"message":\s*"([^"]+)"/.exec(e.message)?.[1] ?? e.message;
    const detail = `${model}: ${e.status} ${msg.slice(0, 140)}`;
    if (e.status === 429) return { model, kind: 'quota' as const, detail };
    if (e.status === 400 || e.status === 401 || e.status === 403) return { model, kind: 'fatal' as const, detail };
    return { model, kind: 'busy' as const, detail }; // 404 (retired model), 5xx: try the next model
  }
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return { model, kind: 'busy' as const, detail: `${model}: no answer within ${Math.round(timeoutMs / 1000)} s` };
  }
  // e.g. the model returned something that isn't the JSON we asked for
  return { model, kind: 'busy' as const, detail: `${model}: ${String(e).slice(0, 140)}` };
}

app.http('generate', { methods: ['POST'], authLevel: 'anonymous', handler: generate });
