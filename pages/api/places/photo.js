/**
 * pages/api/places/photo.js
 * GET /api/places/photo?ref=PHOTO_REFERENCE&maxwidth=600
 *
 * Proxies Google Places photo requests to avoid CORS and keep API key hidden.
 * Streams the image bytes directly to the client.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { ref, maxwidth = '600' } = req.query;
  if (!ref) return res.status(400).end();

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) return res.status(503).end();

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${ref}&key=${googleKey}`;
    const r   = await fetch(url);
    if (!r.ok) return res.status(r.status).end();

    const contentType = r.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

    const buffer = await r.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error('[places/photo]', e.message);
    res.status(500).end();
  }
}
