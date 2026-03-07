/**
 * services/places.js
 *
 * Client-side service for place search and details.
 * Calls Next.js API proxy routes which hold the secret keys.
 *
 * Primary source:  Google Places API
 * Fallback source: Foursquare Places API v3
 *
 * Normalized shape returned:
 *   {
 *     id, name, type, address, lat, lng,
 *     rating, reviews, description, duration, photo
 *   }
 */

import { fetchWithCache } from '../utils/apiCache';

const PLACE_TYPES = {
  tourist_attraction: 'attraction',
  museum:             'attraction',
  art_gallery:        'attraction',
  park:               'activity',
  amusement_park:     'activity',
  restaurant:         'restaurant',
  cafe:               'restaurant',
  bar:                'restaurant',
  food:               'restaurant',
  lodging:            'hotel',
  transit_station:    'transport',
};

function normalizeType(raw = '') {
  const lower = raw.toLowerCase();
  return PLACE_TYPES[lower] || 'attraction';
}

/** Human-readable short description when API returns no overview (avoids "establishment, point_of_interest"). */
function humanPlaceDescription(type) {
  const t = (type || 'attraction').toLowerCase();
  if (t === 'restaurant') return 'A popular spot for food and drink.';
  if (t === 'hotel') return 'A well-rated place to stay.';
  if (t === 'activity') return 'A recommended activity or experience.';
  return 'A popular place to visit.';
}

/**
 * Search for places by free-form query (Google Places API).
 * @param {string}  query  e.g. "Eiffel Tower", "best pizza Rome"
 * @param {number}  [lat]  Optional location bias
 * @param {number}  [lng]  Optional location bias
 * @returns {Promise<Array>} Normalized place array (empty if unavailable)
 */
export async function searchPlaces(query, lat, lng) {
  if (!query?.trim()) return [];
  const res = await fetch('/api/places/search', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.trim(), lat, lng }),
  });
  if (!res.ok) return [];
  const { results, available } = await res.json();
  if (!available || !Array.isArray(results)) return [];
  return results.map(normalizePlaceResult);
}

/**
 * Search for POIs in a city.
 * @param {string}   cityName
 * @param {string}   query     e.g. "top attractions" or "best restaurants"
 * @param {'attraction'|'restaurant'|'hotel'|'activity'} type
 * @param {number}   lat
 * @param {number}   lng
 * @returns {Promise<Array|null>} Normalized POI array, or null if unavailable
 */
export async function searchCityPOIs(cityName, query, type, lat, lng) {
  const key = `places:pois:${cityName}:${type}`;
  return fetchWithCache(key, async () => {
    const res = await fetch('/api/places/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `${query} in ${cityName}`, lat, lng, type }),
    });
    if (!res.ok) return null;
    const { results, available } = await res.json();
    if (!available || !Array.isArray(results)) return null;
    return results.map(normalizePlaceResult);
  }, 10 * 60 * 1000); // 10 min
}

/**
 * Get full details for a single place by ID.
 * @param {string} placeId  Google Place ID or Foursquare fsq_id
 * @returns {Promise<Object|null>}
 */
export async function getPlaceDetails(placeId) {
  return fetchWithCache(`place:${placeId}`, async () => {
    const res = await fetch(`/api/places/details?id=${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;
    const { result, available } = await res.json();
    if (!available || !result) return null;
    return normalizePlaceResult(result);
  }, 30 * 60 * 1000); // 30 min
}

/**
 * Geocode a city name to coordinates using Mapbox (client-side, uses public token).
 * @param {string} cityName
 * @returns {Promise<{lat, lng}|null>}
 */
export async function geocodeCity(cityName) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  return fetchWithCache(`geocode:${cityName}`, async () => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cityName)}.json?types=place&limit=1&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  }, 60 * 60 * 1000); // 1 hour
}

/* ── Normalization ─────────────────────────────────────────────────────── */

function normalizePlaceResult(raw) {
  // Google Places result
  if (raw.place_id) {
    const loc = raw.geometry?.location ?? {};
    const photo = raw.photos?.[0]
      ? `/api/places/photo?ref=${raw.photos[0].photo_reference}&maxwidth=600`
      : null;
    return {
      id:          raw.place_id,
      name:        raw.name || 'Unknown place',
      type:        normalizeType(raw.types?.[0] ?? ''),
      address:     raw.formatted_address || raw.vicinity || '',
      lat:         typeof loc.lat === 'function' ? loc.lat() : (loc.lat ?? null),
      lng:         typeof loc.lng === 'function' ? loc.lng() : (loc.lng ?? null),
      rating:      raw.rating    ?? null,
      reviews:     raw.user_ratings_total ?? 0,
      description: raw.editorial_summary?.overview ?? humanPlaceDescription(normalizeType(raw.types?.[0] ?? '')),
      duration:    guessDefaultDuration(raw.types),
      photo,
    };
  }

  // Foursquare v3 result
  if (raw.fsq_id) {
    const geo = raw.geocodes?.main ?? {};
    const photo = raw.photos?.[0]
      ? `${raw.photos[0].prefix}300x200${raw.photos[0].suffix}`
      : null;
    return {
      id:          raw.fsq_id,
      name:        raw.name || 'Unknown place',
      type:        normalizeFoursquareCategory(raw.categories?.[0]?.name ?? ''),
      address:     raw.location?.formatted_address || raw.location?.address || '',
      lat:         geo.latitude  ?? null,
      lng:         geo.longitude ?? null,
      rating:      raw.rating ? raw.rating / 2 : null, // FS uses 0-10, convert to 0-5
      reviews:     raw.stats?.total_ratings ?? 0,
      description: raw.description || humanPlaceDescription(normalizeFoursquareCategory(raw.categories?.[0]?.name ?? '')),
      duration:    guessDefaultDuration([raw.categories?.[0]?.name]),
      photo,
    };
  }

  // Already-normalized passthrough
  return raw;
}

function normalizeFoursquareCategory(cat = '') {
  const lower = cat.toLowerCase();
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('bar')) return 'restaurant';
  if (lower.includes('hotel') || lower.includes('lodging')) return 'hotel';
  if (lower.includes('park') || lower.includes('tour') || lower.includes('entertain')) return 'activity';
  return 'attraction';
}

function guessDefaultDuration(types = []) {
  const joined = (types || []).join(' ').toLowerCase();
  if (joined.includes('museum') || joined.includes('gallery'))  return 120;
  if (joined.includes('restaurant') || joined.includes('cafe')) return 60;
  if (joined.includes('park'))                                   return 90;
  if (joined.includes('lodging') || joined.includes('hotel'))   return 0;
  return 60;
}
