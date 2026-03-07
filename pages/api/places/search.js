/**
 * pages/api/places/search.js
 * POST /api/places/search
 *
 * Body: { query, lat, lng, type?, radius? }
 *
 * Tries Google Places Text Search first, falls back to Foursquare v3.
 * Returns: { results: [...], source: 'google'|'foursquare', available: boolean }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, lat, lng, type, radius = 5000 } = req.body;
  if (!query) return res.status(400).json({ error: '`query` is required' });

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const fsqKey    = process.env.FOURSQUARE_API_KEY;

  if (!googleKey && !fsqKey) {
    return res.status(200).json({ results: [], source: null, available: false });
  }

  // ── Google Places Text Search ────────────────────────────────────────
  if (googleKey) {
    try {
      const params = new URLSearchParams({
        query,
        key: googleKey,
        language: 'en',
      });
      if (lat && lng) params.set('location', `${lat},${lng}`);
      if (radius)     params.set('radius', String(radius));
      if (type)       params.set('type', mapToGoogleType(type));

      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
      const r   = await fetch(url);
      if (!r.ok) throw new Error(`Google ${r.status}`);
      const data = await r.json();

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return res.status(200).json({
          results:   data.results ?? [],
          source:    'google',
          available: true,
        });
      }
      // Fall through to Foursquare on error status
    } catch (e) {
      console.error('[places/search] Google error:', e.message);
    }
  }

  // ── Foursquare v3 ────────────────────────────────────────────────────
  if (fsqKey) {
    try {
      const params = new URLSearchParams({
        query,
        limit: '10',
        fields: 'fsq_id,name,categories,geocodes,location,rating,stats,description,photos',
      });
      if (lat && lng) params.set('ll', `${lat},${lng}`);
      if (radius)     params.set('radius', String(radius));

      const r = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
        headers: {
          Authorization: fsqKey,
          Accept: 'application/json',
        },
      });
      if (!r.ok) throw new Error(`Foursquare ${r.status}`);
      const data = await r.json();

      return res.status(200).json({
        results:   data.results ?? [],
        source:    'foursquare',
        available: true,
      });
    } catch (e) {
      console.error('[places/search] Foursquare error:', e.message);
    }
  }

  return res.status(200).json({ results: [], source: null, available: false });
}

function mapToGoogleType(type) {
  const map = {
    attraction: 'tourist_attraction',
    restaurant: 'restaurant',
    hotel:      'lodging',
    activity:   'amusement_park',
  };
  return map[type] ?? 'point_of_interest';
}
