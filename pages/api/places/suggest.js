/**
 * pages/api/places/suggest.js
 * GET /api/places/suggest?q=...&category=...&lng=...&lat=...&limit=20&radius=...
 * Proxy to Geoapify Places API with two-level cache. Server-only.
 */

import { rateLimit } from '../../../lib/rate-limit';
import { getSearchCache, setSearchCache } from '../../../lib/cache';
import { toPlaceBasic, toFeatureCollection } from '../../../lib/normalizeGeoapify';

const GEOAPIFY_BASE = 'https://api.geoapify.com/v2/places';

function round4(n) {
  return n != null && Number.isFinite(n) ? Number(Number(n).toFixed(4)) : '';
}

function buildCacheKey(q, category, lng, lat, radius, limit) {
  return `suggest|${(q || '').trim().toLowerCase()}|${category || ''}|${round4(lng)},${round4(lat)}|${radius || ''}|${limit || ''}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const allowed = await rateLimit(req, res, { maxPerMinute: 60 });
  if (!allowed) return;

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ type: 'FeatureCollection', features: [] });
  }

  const q = (req.query.q || '').trim();
  const category = (req.query.category || '').trim();
  const lng = parseFloat(req.query.lng);
  const lat = parseFloat(req.query.lat);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  let radius = parseInt(req.query.radius, 10);
  if (!Number.isFinite(radius) || radius < 100) radius = 0;
  if (radius > 5000) radius = 5000;

  if (!q && !category) {
    return res.status(400).json({ error: 'Provide q or category' });
  }

  const cacheKey = buildCacheKey(q, category, lng, lat, radius, limit);
  const cached = await getSearchCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const params = new URLSearchParams();
  params.set('apiKey', apiKey);
  params.set('limit', String(limit));
  params.set('lang', 'en');

  if (category) {
    params.set('categories', category);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      if (radius >= 100) {
        params.set('filter', `circle:${lng},${lat},${radius}`);
      } else {
        params.set('bias', `proximity:${lng},${lat}`);
      }
    }
  } else {
    params.set('name', q);
    params.set('categories', 'commercial,catering,entertainment,tourism');
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      params.set('bias', `proximity:${lng},${lat}`);
    }
  }

  const url = `${GEOAPIFY_BASE}?${params.toString()}`;

  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Geoapify ${r.status}`);
    const data = await r.json();

    const features = data.features || [];
    const basics = features.map((f) => toPlaceBasic(f));
    const fc = toFeatureCollection(basics);

    await setSearchCache(cacheKey, fc, 604800);
    return res.status(200).json(fc);
  } catch (e) {
    console.error('[places/suggest]', e.message);
    return res.status(200).json({ type: 'FeatureCollection', features: [] });
  }
}
