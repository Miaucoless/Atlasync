/**
 * services/ratings.js
 *
 * Client-side service that fetches and aggregates ratings from multiple sources.
 *
 * Sources (all server-proxied to protect API keys):
 *   - Yelp Fusion     (requires YELP_API_KEY)
 *   - TripAdvisor     (requires TRIPADVISOR_API_KEY)
 *
 * When a source is not configured, it is excluded from the aggregate.
 * When no sources are available, falls back to the provided base rating.
 *
 * Returned shape:
 *   {
 *     aggregate: number,   // weighted average 0–5
 *     totalReviews: number,
 *     sources: [
 *       { source: 'google' | 'yelp' | 'tripadvisor', label, color, rating, reviews, available }
 *     ]
 *   }
 */

import { fetchWithCache } from '../utils/apiCache';

const SOURCE_META = {
  google:      { label: 'G',  title: 'Google',      color: '#4285F4', weight: 1.0 },
  yelp:        { label: 'Y',  title: 'Yelp',         color: '#FF1A1A', weight: 0.85 },
  tripadvisor: { label: 'TA', title: 'Tripadvisor',  color: '#00AA6C', weight: 0.9  },
  foursquare:  { label: 'FS', title: 'Foursquare',   color: '#F94877', weight: 0.75 },
};

/**
 * Fetch and aggregate ratings for a location.
 *
 * @param {string}  name       Place name
 * @param {number}  lat
 * @param {number}  lng
 * @param {number}  baseRating Fallback rating from curated data (used if no APIs respond)
 * @param {string}  baseId     Stable ID used for deterministic mock offset
 * @returns {Promise<Object>}
 */
export async function getAggregatedRatings(name, lat, lng, baseRating = 4.5, baseId = '') {
  const key = `ratings:${name}:${lat?.toFixed(2)}:${lng?.toFixed(2)}`;

  return fetchWithCache(key, async () => {
    // Call server-side aggregation endpoint
    let liveData = null;
    try {
      const res = await fetch('/api/ratings/aggregate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lat, lng }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.available) liveData = json;
      }
    } catch {
      // Fallback silently
    }

    if (liveData?.sources?.length > 0) {
      return liveData;
    }

    // No live data — return deterministic mock sourced from base rating
    return buildMockRatings(baseRating, baseId);
  }, 15 * 60 * 1000); // 15 min
}

/**
 * Build mock multi-source ratings from a single base rating.
 * Uses a deterministic hash of the ID so values are stable across renders.
 */
export function buildMockRatings(baseRating = 4.5, id = '') {
  const clamp = (v) => Math.min(5.0, Math.max(3.0, +v.toFixed(1)));

  // Deterministic hash offset
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const offsets = [0, -0.2, 0.1, -0.1, 0.2];
  const getOffset = (i) => offsets[(h + i) % offsets.length];

  const sources = [
    { source: 'google',      ...SOURCE_META.google,      rating: clamp(baseRating + getOffset(0)), reviews: Math.round(1200 + (h % 3) * 800) },
    { source: 'yelp',        ...SOURCE_META.yelp,        rating: clamp(baseRating + getOffset(1)), reviews: Math.round(400  + (h % 4) * 300) },
    { source: 'tripadvisor', ...SOURCE_META.tripadvisor, rating: clamp(baseRating + getOffset(2)), reviews: Math.round(800  + (h % 5) * 600) },
  ].map((s) => ({ ...s, available: false })); // mark as mock

  const aggregate = computeWeightedAverage(sources);
  const totalReviews = sources.reduce((s, x) => s + x.reviews, 0);

  return { aggregate, totalReviews, sources, isMock: true };
}

/**
 * Build aggregated rating from live API sources.
 * @param {Array} sources  Array of { source, rating, reviews }
 */
export function computeWeightedAverage(sources) {
  const valid = sources.filter((s) => s.rating && s.reviews > 0);
  if (!valid.length) return null;

  const totalWeight = valid.reduce((sum, s) => {
    const meta = SOURCE_META[s.source] ?? { weight: 1.0 };
    return sum + meta.weight * Math.log1p(s.reviews);
  }, 0);

  const weightedSum = valid.reduce((sum, s) => {
    const meta = SOURCE_META[s.source] ?? { weight: 1.0 };
    return sum + s.rating * meta.weight * Math.log1p(s.reviews);
  }, 0);

  return totalWeight > 0 ? +(weightedSum / totalWeight).toFixed(1) : null;
}

/**
 * Format a ratings object for display in UI components.
 * Returns an array of source badges ready to render.
 */
export function formatSourceBadges(ratingsData) {
  if (!ratingsData?.sources) return [];
  return ratingsData.sources.map((s) => ({
    key:     s.source,
    label:   s.label,
    title:   s.title,
    color:   s.color,
    rating:  s.rating,
    reviews: s.reviews,
    isMock:  s.available === false,
  }));
}
