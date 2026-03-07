/**
 * pages/api/places/photo.js
 * GET /api/places/photo?ref=... — no longer used (Geoapify provider).
 * Stub returns 404 so no secret is required.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  return res.status(404).end();
}
