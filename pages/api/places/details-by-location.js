/**
 * pages/api/places/details-by-location.js
 * GET /api/places/details-by-location?lat=...&lng=...&name=...
 * Finds nearest place via Geoapify (bias proximity), then returns place details. Server-only.
 */

import { rateLimit } from '../../../lib/rate-limit';
import { getDetailsCache, setDetailsCache } from '../../../lib/cache';
import { toPlaceBasic, toPlaceDetails } from '../../../lib/normalizeGeoapify';

const GEOAPIFY_PLACES = 'https://api.geoapify.com/v2/places';
const GEOAPIFY_DETAILS = 'https://api.geoapify.com/v2/place-details';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const allowed = await rateLimit(req, res, { maxPerMinute: 60 });
  if (!allowed) return;

  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const name = (req.query.name || '').trim();

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ result: null, available: false });
  }

  try {
    const params = new URLSearchParams();
    params.set('apiKey', apiKey);
    params.set('limit', '5');
    params.set('lang', 'en');
    params.set('bias', `proximity:${lng},${lat}`);
    if (name) {
      params.set('name', name);
      params.set('categories', 'commercial,catering,entertainment,tourism');
    } else {
      params.set('categories', 'commercial,catering,entertainment,tourism,accommodation');
    }

    const searchUrl = `${GEOAPIFY_PLACES}?${params.toString()}`;
    const searchRes = await fetch(searchUrl, { cache: 'no-store' });
    if (!searchRes.ok) throw new Error(`Geoapify Search ${searchRes.status}`);
    const searchData = await searchRes.json();

    const features = searchData.features || [];
    if (features.length === 0) {
      return res.status(200).json({ result: null, available: true });
    }

    const withDist = features.map((f) => {
      const c = f.geometry?.coordinates || [];
      const dist = Math.hypot((c[0] - lng), (c[1] - lat));
      return { feature: f, dist };
    });
    withDist.sort((a, b) => a.dist - b.dist);
    const nearest = withDist[0].feature;
    const placeId = nearest.properties?.place_id;
    if (!placeId) {
      const basic = toPlaceBasic(nearest);
      return res.status(200).json({ result: { ...basic, source: 'geoapify' }, available: true });
    }

    const cached = await getDetailsCache(placeId);
    if (cached) {
      return res.status(200).json({ result: cached, available: true });
    }

    const detailsUrl = `${GEOAPIFY_DETAILS}?id=${encodeURIComponent(placeId)}&apiKey=${apiKey}`;
    const detailsRes = await fetch(detailsUrl, { cache: 'no-store' });
    if (!detailsRes.ok) throw new Error(`Geoapify Details ${detailsRes.status}`);
    const detailsData = await detailsRes.json();

    const details = toPlaceDetails(detailsData);
    await setDetailsCache(placeId, details, 2592000);
    return res.status(200).json({ result: details, available: true });
  } catch (e) {
    console.error('[places/details-by-location]', e.message);
    return res.status(200).json({ result: null, available: false, error: e.message });
  }
}
