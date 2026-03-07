/**
 * pages/api/images/search.js
 * POST /api/images/search
 *
 * Body: { query, orientation?, count? }
 *
 * Tries Unsplash first, falls back to Pexels.
 *
 * Returns:
 *   {
 *     results: [{ url, thumb, credit: { name, link }, source }],
 *     available: boolean
 *   }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, orientation = 'landscape', count = 6 } = req.body;
  if (!query) return res.status(400).json({ error: '`query` is required' });

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pexelsKey   = process.env.PEXELS_API_KEY;

  if (!unsplashKey && !pexelsKey) {
    return res.status(200).json({ results: [], available: false });
  }

  // ── Unsplash ─────────────────────────────────────────────────────────
  if (unsplashKey) {
    try {
      const params = new URLSearchParams({
        query,
        orientation,
        per_page: String(Math.min(count, 30)),
        content_filter: 'high',
      });
      const r = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
      });
      if (!r.ok) throw new Error(`Unsplash ${r.status}`);
      const data = await r.json();

      const results = (data.results ?? []).map((photo) => ({
        url:    `${photo.urls.raw}&w=1400&q=85&fit=crop&auto=format`,
        thumb:  photo.urls.thumb,
        credit: { name: photo.user?.name ?? '', link: photo.user?.links?.html ?? '' },
        source: 'unsplash',
      }));

      return res.status(200).json({ results, available: true, source: 'unsplash' });
    } catch (e) {
      console.error('[images/search] Unsplash error:', e.message);
    }
  }

  // ── Pexels ───────────────────────────────────────────────────────────
  if (pexelsKey) {
    try {
      const orientationMap = { landscape: 'landscape', portrait: 'portrait', squarish: 'square' };
      const params = new URLSearchParams({
        query,
        orientation: orientationMap[orientation] || 'landscape',
        per_page: String(Math.min(count, 80)),
      });
      const r = await fetch(`https://api.pexels.com/v1/search?${params}`, {
        headers: { Authorization: pexelsKey },
      });
      if (!r.ok) throw new Error(`Pexels ${r.status}`);
      const data = await r.json();

      const results = (data.photos ?? []).map((photo) => ({
        url:    photo.src.large2x || photo.src.large,
        thumb:  photo.src.small,
        credit: { name: photo.photographer ?? '', link: photo.photographer_url ?? '' },
        source: 'pexels',
      }));

      return res.status(200).json({ results, available: true, source: 'pexels' });
    } catch (e) {
      console.error('[images/search] Pexels error:', e.message);
    }
  }

  return res.status(200).json({ results: [], available: false });
}
