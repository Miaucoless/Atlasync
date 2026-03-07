/**
 * services/places.js
 *
 * Client-side service for place search and details.
 * Calls Next.js API routes (Geoapify behind /api/places/*).
 *
 * Normalized shape (unchanged for UI):
 *   { id, name, type, address, lat, lng, rating, reviews, description, duration, photo, opening_hours?, primaryType? }
 */

import { fetchWithCache } from '../utils/apiCache';

const CATEGORY_BY_TYPE = {
  attraction: 'tourism.attraction,entertainment.museum',
  restaurant: 'catering.restaurant,catering.cafe',
  hotel:      'accommodation.hotel',
  activity:   'entertainment,natural',
};

function geoapifyCategoryToType(category) {
  if (!category) return 'attraction';
  const c = category.toLowerCase();
  if (c.includes('catering') || c.includes('restaurant') || c.includes('cafe') || c.includes('food')) return 'restaurant';
  if (c.includes('accommodation') || c.includes('hotel') || c.includes('lodging')) return 'hotel';
  if (c.includes('natural') || c.includes('park') || c.includes('sport')) return 'activity';
  return 'attraction';
}

function guessDefaultDuration(category) {
  if (!category) return 60;
  const c = category.toLowerCase();
  if (c.includes('museum') || c.includes('gallery')) return 120;
  if (c.includes('restaurant') || c.includes('cafe') || c.includes('catering')) return 60;
  if (c.includes('park') || c.includes('natural')) return 90;
  if (c.includes('hotel') || c.includes('accommodation')) return 0;
  return 60;
}

function featureToPlace(f) {
  const p = f.properties || {};
  const coords = f.geometry?.coordinates || [];
  const lng = coords[0];
  const lat = coords[1];
  return {
    id:            p.place_id || '',
    name:          p.name || 'Unknown place',
    type:          geoapifyCategoryToType(p.category),
    primaryType:   p.category,
    address:       p.address || '',
    lat:           Number.isFinite(lat) ? lat : null,
    lng:           Number.isFinite(lng) ? lng : null,
    rating:        null,
    reviews:       0,
    description:   p.address ? `${p.name} — ${p.address}` : (p.name || ''),
    duration:      guessDefaultDuration(p.category),
    photo:         null,
    opening_hours: null,
  };
}

function normalizeGeoapifyDetails(raw) {
  const coords = raw.coords || [];
  const lng = coords[0];
  const lat = coords[1];
  return {
    id:            raw.place_id || '',
    name:          raw.name || 'Unknown place',
    type:          geoapifyCategoryToType(raw.category),
    primaryType:   raw.category,
    address:       raw.address || '',
    lat:           Number.isFinite(lat) ? lat : null,
    lng:           Number.isFinite(lng) ? lng : null,
    rating:        null,
    reviews:       0,
    description:   (typeof raw.description === 'string' && raw.description.trim()) ? raw.description.trim() : (raw.address ? `${raw.name} — ${raw.address}` : (raw.name || '')),
    duration:      guessDefaultDuration(raw.category),
    photo:         raw.photos?.[0]?.url || null,
    opening_hours: raw.opening_hours ?? null,
    website:       raw.website,
    phone:         raw.phone,
  };
}

/**
 * Search for places by free-form query (Geoapify via /api/places/suggest).
 */
export async function searchPlaces(query, lat, lng) {
  if (!query?.trim()) return [];
  const params = new URLSearchParams({ q: query.trim(), limit: '20' });
  if (Number.isFinite(lat)) params.set('lat', String(lat));
  if (Number.isFinite(lng)) params.set('lng', String(lng));
  const res = await fetch(`/api/places/suggest?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const features = data.features || [];
  return features.map(featureToPlace);
}

/**
 * Search for POIs in a city (Geoapify category search).
 */
export async function searchCityPOIs(cityName, query, type, lat, lng) {
  const key = `places:pois:${cityName}:${type}`;
  return fetchWithCache(key, async () => {
    const category = CATEGORY_BY_TYPE[type] || CATEGORY_BY_TYPE.attraction;
    const params = new URLSearchParams({ category: category.split(',')[0], limit: '20', radius: '5000' });
    if (Number.isFinite(lat)) params.set('lat', String(lat));
    if (Number.isFinite(lng)) params.set('lng', String(lng));
    const res = await fetch(`/api/places/category?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const features = data.features || [];
    return features.map(featureToPlace);
  }, 10 * 60 * 1000);
}

/**
 * Get full details for a single place by ID (Geoapify place_id).
 */
export async function getPlaceDetails(placeId) {
  return fetchWithCache(`place:${placeId}`, async () => {
    const res = await fetch(`/api/places/details?id=${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;
    const { result, available } = await res.json();
    if (!available || !result) return null;
    return normalizeGeoapifyDetails(result);
  }, 30 * 60 * 1000);
}

/**
 * Get place details by coordinates (map-click popups).
 */
export async function getPlaceDetailsByLocation(lat, lng, hintName = '') {
  const key = `place:loc:${Math.round(lat * 1000)}:${Math.round(lng * 1000)}:${hintName.slice(0, 30)}`;
  return fetchWithCache(key, async () => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (hintName) params.set('name', hintName);
    const res = await fetch(`/api/places/details-by-location?${params}`);
    if (!res.ok) return null;
    const { result, available } = await res.json();
    if (!available || !result) return null;
    return normalizeGeoapifyDetails(result);
  }, 10 * 60 * 1000);
}

/**
 * Geocode a city name to coordinates (Mapbox, client-safe).
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
  }, 60 * 60 * 1000);
}
