// Small HTTP helpers shared by the endpoints.
import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/** An error with an HTTP status; its message is shown in the app. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const json = (status: number, body: unknown): HttpResponseInit => ({ status, jsonBody: body });

export async function readJson(req: HttpRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

/**
 * Wraps a handler: HttpErrors become their status + {error}; SQL rule
 * violations become 400/409; anything else is logged and becomes a 500.
 */
export function handler(fn: (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit>): HttpHandler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message, ...e.extra });
      const number = (e as { number?: number }).number;
      if (number === 547) return json(400, { error: 'That change breaks a data rule.', detail: (e as Error).message });
      if (number === 2627 || number === 2601) return json(409, { error: 'That already exists.', detail: (e as Error).message });
      ctx.error(e);
      return json(500, { error: 'Something went wrong on the server.', detail: String(e).slice(0, 200) });
    }
  };
}
