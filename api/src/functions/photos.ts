// GET /api/photos/{id}?size=thumb|full: one stored photo as a JPEG.
// A photo's bytes never change for a given id, so the browser may cache it
// for good ("immutable"); "private" keeps shared caches from storing it.
import { app } from '@azure/functions';
import { sql, withDb } from '../lib/db.js';
import { HttpError, handler } from '../lib/http.js';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.http('photos', {
  route: 'photos/{id}',
  methods: ['GET'],
  authLevel: 'anonymous', // Static Web Apps already requires the owner role on /api/*
  handler: handler(async (req) => {
    const id = req.params.id;
    if (!id || !GUID.test(id)) throw new HttpError(400, 'Bad photo id');
    const column = req.query.get('size') === 'thumb' ? 'thumb_jpeg' : 'full_jpeg';
    const r = await withDb((pool) =>
      pool.request().input('id', sql.UniqueIdentifier, id).query(`SELECT ${column} AS jpeg FROM dbo.photos WHERE id = @id;`),
    );
    const jpeg: Buffer | undefined = r.recordset[0]?.jpeg;
    if (!jpeg) throw new HttpError(404, 'Photo not found');
    return {
      status: 200,
      body: jpeg,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
    };
  }),
});
