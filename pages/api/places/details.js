/**
 * pages/api/places/details.js
 * GET /api/places/details?id=PLACE_ID
 *
 * Returns full place details (opening hours, website, phone, photos).
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: '`id` is required' });

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) {
    return res.status(200).json({ result: null, available: false });
  }

  const FIELDS = [
    'place_id', 'name', 'formatted_address', 'geometry',
    'rating', 'user_ratings_total', 'types',
    'editorial_summary', 'photos',
    'opening_hours', 'website', 'international_phone_number',
    'price_level',
  ].join(',');

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}&fields=${FIELDS}&language=en&key=${googleKey}`;
    const r   = await fetch(url);
    if (!r.ok) throw new Error(`Google ${r.status}`);
    const data = await r.json();

    return res.status(200).json({
      result:    data.result ?? null,
      status:    data.status,
      available: data.status === 'OK',
    });
  } catch (e) {
    console.error('[places/details]', e.message);
    return res.status(200).json({ result: null, available: false, error: e.message });
  }
}
