/**
 * pages/api/places/category.js
 * GET /api/places/category?category=...&lng=...&lat=...&radius=2000&limit=20
 * Viewport/category search; same as suggest in category mode. Server-only, cached.
 */

import { rateLimit } from '../../../lib/rate-limit';
import { getSearchCache, setSearchCache } from '../../../lib/cache';
import { toPlaceBasic, toFeatureCollection } from '../../../lib/normalizeGeoapify';

const GEOAPIFY_BASE = 'https://api.geoapify.com/v2/places';

function round4(n) {
  return n != null && Number.isFinite(n) ? Number(Number(n).toFixed(4)) : '';
}

function buildCacheKey(category, lng, lat, radius, limit) {
  return `category|${category || ''}|${round4(lng)},${round4(lat)}|${radius || ''}|${limit || ''}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const allowed = await rateLimit(req, res, { maxPerMinute: 60 });
  if (!allowed) return;

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ type: 'FeatureCollection', features: [] });
  }

  const category = (req.query.category || '').trim();
  const lng = parseFloat(req.query.lng);
  const lat = parseFloat(req.query.lat);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  let radius = parseInt(req.query.radius, 10);
  if (!Number.isFinite(radius) || radius < 100) radius = 2000;
  if (radius > 5000) radius = 5000;

  if (!category) return res.status(400).json({ error: 'category is required' });

  const cacheKey = buildCacheKey(category, lng, lat, radius, limit);
  const cached = await getSearchCache(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const params = new URLSearchParams();
  params.set('apiKey', apiKey);
  params.set('categories', category);
  params.set('limit', String(limit));
  params.set('lang', 'en');
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    params.set('filter', `circle:${lng},${lat},${radius}`);
    params.set('bias', `proximity:${lng},${lat}`);
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
    console.error('[places/category]', e.message);
    return res.status(200).json({ type: 'FeatureCollection', features: [] });
  }
}
