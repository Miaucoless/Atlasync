/**
 * pages/api/ratings/aggregate.js
 * POST /api/ratings/aggregate
 *
 * Body: { name, lat, lng }
 *
 * Fetches ratings from configured sources in parallel:
 *   - Yelp Fusion       (YELP_API_KEY)
 *   - TripAdvisor       (TRIPADVISOR_API_KEY)
 *   - Google Places     (GOOGLE_PLACES_API_KEY)
 *
 * Returns:
 *   {
 *     sources: [{ source, label, color, rating, reviews, available }],
 *     aggregate: number,   // weighted average
 *     totalReviews: number,
 *     available: boolean,  // true if at least one source responded
 *   }
 */

const SOURCE_META = {
  google:      { label: 'G',  title: 'Google',     color: '#4285F4', weight: 1.0 },
  yelp:        { label: 'Y',  title: 'Yelp',        color: '#FF1A1A', weight: 0.85 },
  tripadvisor: { label: 'TA', title: 'Tripadvisor', color: '#00AA6C', weight: 0.9  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, lat, lng } = req.body;
  if (!name) return res.status(400).json({ error: '`name` is required' });

  const [yelpResult, taResult, googleResult] = await Promise.allSettled([
    fetchYelp(name, lat, lng),
    fetchTripAdvisor(name, lat, lng),
    fetchGoogle(name, lat, lng),
  ]);

  const sources = [
    yelpResult.status   === 'fulfilled' ? yelpResult.value   : null,
    taResult.status     === 'fulfilled' ? taResult.value     : null,
    googleResult.status === 'fulfilled' ? googleResult.value : null,
  ].filter(Boolean);

  if (sources.length === 0) {
    return res.status(200).json({ sources: [], aggregate: null, totalReviews: 0, available: false });
  }

  const aggregate    = computeWeightedAverage(sources);
  const totalReviews = sources.reduce((s, x) => s + (x.reviews ?? 0), 0);

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
  return res.status(200).json({ sources, aggregate, totalReviews, available: true });
}

/* ── Source fetchers ───────────────────────────────────────────────────── */

async function fetchYelp(name, lat, lng) {
  const key = process.env.YELP_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({ term: name, limit: '3' });
  if (lat && lng) { params.set('latitude', lat); params.set('longitude', lng); }

  const r = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return null;
  const data  = await r.json();
  const biz   = data.businesses?.[0];
  if (!biz)   return null;

  return {
    source:    'yelp',
    ...SOURCE_META.yelp,
    rating:    biz.rating,           // Yelp: 0–5
    reviews:   biz.review_count,
    available: true,
  };
}

async function fetchTripAdvisor(name, lat, lng) {
  const key = process.env.TRIPADVISOR_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({ key, searchQuery: name, language: 'en' });
  if (lat && lng) { params.set('latLong', `${lat},${lng}`); }

  const r = await fetch(`https://api.content.tripadvisor.com/api/v1/location/search?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) return null;
  const data = await r.json();
  const loc  = data.data?.[0];
  if (!loc)  return null;

  const rating  = loc.rating ? parseFloat(loc.rating) : null;
  const reviews = loc.num_reviews ? parseInt(loc.num_reviews, 10) : 0;
  if (!rating) return null;

  return {
    source:    'tripadvisor',
    ...SOURCE_META.tripadvisor,
    rating,
    reviews,
    available: true,
  };
}

async function fetchGoogle(name, lat, lng) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({ query: name, key, fields: 'rating,user_ratings_total' });
  if (lat && lng) { params.set('location', `${lat},${lng}`); params.set('radius', '500'); }

  const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
  if (!r.ok) return null;
  const data  = await r.json();
  const place = data.results?.[0];
  if (!place?.rating) return null;

  return {
    source:    'google',
    ...SOURCE_META.google,
    rating:    place.rating,
    reviews:   place.user_ratings_total ?? 0,
    available: true,
  };
}

/* ── Weighted average ──────────────────────────────────────────────────── */

function computeWeightedAverage(sources) {
  const valid = sources.filter((s) => s?.rating && s?.reviews > 0);
  if (!valid.length) return null;

  const totalW = valid.reduce((s, x) => {
    const w = SOURCE_META[x.source]?.weight ?? 1.0;
    return s + w * Math.log1p(x.reviews);
  }, 0);

  const sumW = valid.reduce((s, x) => {
    const w = SOURCE_META[x.source]?.weight ?? 1.0;
    return s + x.rating * w * Math.log1p(x.reviews);
  }, 0);

  return totalW > 0 ? +(sumW / totalW).toFixed(1) : null;
}
