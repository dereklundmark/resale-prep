// GET /api/config: markets, platforms (with colours) and conditions, so the
// app can draw itself from data instead of hard-coded lists.
import { app } from '@azure/functions';
import { loadCatalog } from '../lib/catalog.js';
import { handler, json } from '../lib/http.js';

app.http('config', {
  methods: ['GET'],
  authLevel: 'anonymous', // Static Web Apps already requires the owner role on /api/*
  handler: handler(async () => {
    const { markets, platforms, conditions } = await loadCatalog();
    // categoryHint is prompt text for Gemini; the app doesn't need it.
    const forApp = platforms.map((p) => ({
      code: p.code,
      marketCode: p.marketCode,
      name: p.name,
      colorStrong: p.colorStrong,
      colorTint: p.colorTint,
      colorText: p.colorText,
      sortOrder: p.sortOrder,
      isEnabled: p.isEnabled,
    }));
    return json(200, { markets, platforms: forApp, conditions });
  }),
});
