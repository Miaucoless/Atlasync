/**
 * services/images.js
 *
 * Client-side service for fetching photos.
 *
 * Primary:  Unsplash API (requires UNSPLASH_ACCESS_KEY)
 * Fallback: Pexels API  (requires PEXELS_API_KEY)
 * Static:   Direct Unsplash photo IDs baked into city data (no key required)
 *
 * Normalized shape:
 *   { url, thumb, credit: { name, link }, source: 'unsplash' | 'pexels' | 'static' }
 */

import { fetchWithCache } from '../utils/apiCache';

/**
 * Search for images matching a query.
 * @param {string} query       e.g. "Tokyo skyline"
 * @param {'landscape'|'portrait'|'squarish'} orientation
 * @param {number} count
 * @returns {Promise<Array|null>}
 */
export async function searchImages(query, orientation = 'landscape', count = 6) {
  const key = `images:${query}:${orientation}:${count}`;
  return fetchWithCache(key, async () => {
    const res = await fetch('/api/images/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, orientation, count }),
    });
    if (!res.ok) return null;
    const { results, available } = await res.json();
    if (!available || !Array.isArray(results)) return null;
    return results;
  }, 15 * 60 * 1000); // 15 min
}

/**
 * Get a single hero image for a city.
 * Falls back gracefully to a static Unsplash URL using the baked-in photo IDs.
 *
 * @param {string} cityName
 * @param {string|null} staticPhotoId  Baked-in Unsplash photo ID (e.g. "photo-1540959733332-eab4deabeeaf")
 * @returns {Promise<string>}          Final image URL to use
 */
export async function getCityHeroImage(cityName, staticPhotoId = null) {
  // Try live API first
  const key = `city-hero:${cityName}`;
  const live = await fetchWithCache(key, async () => {
    const results = await searchImages(`${cityName} city skyline landmark`, 'landscape', 1);
    return results?.[0]?.url ?? null;
  }, 60 * 60 * 1000); // 1 hour

  if (live) return live;

  // Fall back to static Unsplash (direct URL, no key required)
  if (staticPhotoId) {
    const id = staticPhotoId.startsWith('photo-') ? staticPhotoId : `photo-${staticPhotoId}`;
    return `https://images.unsplash.com/${id}?w=1400&q=85&fit=crop&auto=format`;
  }

  return null;
}

/**
 * Get an image for a specific location (POI).
 * @param {string} locationName
 * @param {string} cityName
 * @returns {Promise<string|null>}
 */
export async function getLocationImage(locationName, cityName = '') {
  const query = cityName ? `${locationName} ${cityName}` : locationName;
  const key = `loc-image:${query}`;
  return fetchWithCache(key, async () => {
    const results = await searchImages(query, 'landscape', 1);
    return results?.[0]?.url ?? null;
  }, 30 * 60 * 1000); // 30 min
}
