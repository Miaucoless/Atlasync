/**
 * pages/api/geoapify/places.js
 * GET /api/geoapify/places?categories=...&lat=...&lng=...&radius=...&limit=...
 *
 * Thin proxy to Geoapify Places API v2.
 * Returns a normalized array from the GeoJSON FeatureCollection response.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { categories, lat, lng, radius = 5000, limit = 6 } = req.query;
  if (!categories) return res.status(400).json({ error: '`categories` is required' });

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ results: [], available: false });
  }

  try {
    const params = new URLSearchParams({
      categories,
      limit: String(limit),
      apiKey,
    });
    if (lat && lng) {
      params.set('filter', `circle:${lng},${lat},${radius}`);
      params.set('bias', `proximity:${lng},${lat}`);
    }

    const url = `https://api.geoapify.com/v2/places?${params}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Geoapify ${r.status}`);
    const data = await r.json();

    const results = (data.features ?? []).map((f) => {
      const p = f.properties ?? {};
      const [pLng, pLat] = f.geometry?.coordinates ?? [null, null];
      return {
        name:       p.name ?? 'Unknown',
        address:    p.address_line2 ?? p.formatted ?? '',
        categories: p.categories ?? [],
        lat:        pLat,
        lng:        pLng,
        website:    p.website ?? null,
        rating:     p.rating ?? null,
        placeId:    p.place_id ?? null,
      };
    });

    return res.status(200).json({ results, available: true });
  } catch (e) {
    console.error('[geoapify/places]', e.message);
    return res.status(200).json({ results: [], available: false });
  }
}
