/**
 * pages/api/places/search.js
 * POST /api/places/search — deprecated in favour of GET /api/places/suggest.
 * Kept for backward compatibility; returns empty if called.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({ results: [], source: null, available: false });
}
