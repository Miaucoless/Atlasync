/**
 * services/travel.js
 *
 * Client-side service for travel routes and transit options.
 *
 * Mapbox Directions — driving / walking / cycling routes (uses public token)
 * Rome2Rio          — multi-modal route discovery (requires ROME2RIO_API_KEY)
 *
 * Normalized route shape:
 *   {
 *     mode: 'drive' | 'walk' | 'cycle' | 'flight' | 'train' | 'bus' | 'ferry',
 *     emoji, label,
 *     duration,      // minutes
 *     distance,      // km
 *     price,         // string or null
 *     operator,      // string or null
 *     segments,      // array of step strings (optional)
 *     geojson,       // GeoJSON LineString (optional, Mapbox only)
 *   }
 */

import { fetchWithCache } from '../utils/apiCache';

const MODE_META = {
  drive:  { emoji: '🚗', label: 'Drive'  },
  walk:   { emoji: '🚶', label: 'Walk'   },
  cycle:  { emoji: '🚴', label: 'Cycle'  },
  flight: { emoji: '✈️', label: 'Fly'   },
  train:  { emoji: '🚆', label: 'Train'  },
  bus:    { emoji: '🚌', label: 'Bus'    },
  ferry:  { emoji: '⛴️', label: 'Ferry' },
};

/**
 * Get a single Mapbox route between two coordinate pairs.
 * Uses the public Mapbox token — no server proxy needed.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @param {'driving'|'walking'|'cycling'} profile
 * @returns {Promise<Object|null>}
 */
export async function getMapboxRoute(origin, destination, profile = 'driving') {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !origin?.lat || !destination?.lat) return null;

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const key = `route:mapbox:${coords}:${profile}`;

  return fetchWithCache(key, async () => {
    const url = [
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}`,
      `?geometries=geojson&overview=full&steps=true&access_token=${token}`,
    ].join('');

    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const modeKey = profile === 'driving' ? 'drive' : profile === 'walking' ? 'walk' : 'cycle';
    return {
      ...MODE_META[modeKey],
      mode:     modeKey,
      duration: Math.round(route.duration / 60),
      distance: +(route.distance / 1000).toFixed(1),
      price:    null,
      operator: 'Mapbox',
      segments: (route.legs?.[0]?.steps ?? []).slice(0, 5).map((s) => s.maneuver?.instruction ?? ''),
      geojson:  route.geometry,
    };
  }, 30 * 60 * 1000); // 30 min
}

/**
 * Get all available travel options between two places (multi-modal).
 * Combines Mapbox (drive/walk/cycle) + Rome2Rio (flight/train/bus).
 *
 * @param {{ lat, lng, name }} origin
 * @param {{ lat, lng, name }} destination
 * @returns {Promise<Array>} Sorted by duration
 */
export async function getRouteOptions(origin, destination) {
  const key = `routes:multi:${origin.lat?.toFixed(2)},${origin.lng?.toFixed(2)}:${destination.lat?.toFixed(2)},${destination.lng?.toFixed(2)}`;

  return fetchWithCache(key, async () => {
    const results = [];

    // Always try Mapbox routes
    const [drive, walk] = await Promise.all([
      getMapboxRoute(origin, destination, 'driving'),
      getMapboxRoute(origin, destination, 'walking'),
    ]);
    if (drive) results.push(drive);
    if (walk && walk.duration < 60) results.push(walk); // only show walk if < 1hr

    // Try Rome2Rio for multi-modal
    try {
      const res = await fetch('/api/travel/routes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oName: origin.name || `${origin.lat},${origin.lng}`,
          dName: destination.name || `${destination.lat},${destination.lng}`,
        }),
      });
      if (res.ok) {
        const { routes, available } = await res.json();
        if (available && Array.isArray(routes)) {
          results.push(...routes);
        }
      }
    } catch {
      // Rome2Rio unavailable — Mapbox routes only
    }

    return results.sort((a, b) => (a.duration ?? 9999) - (b.duration ?? 9999));
  }, 30 * 60 * 1000);
}

/**
 * Format a duration in minutes to a human-readable string.
 * e.g. 90 → "1h 30m",  45 → "45 min"
 */
export function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
