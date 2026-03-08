"use client";
/**
 * offlineCache.js
 * Offline-first caching layer using localStorage (with a graceful
 * IndexedDB upgrade path).  All trips and their associated data are
 * serialised as JSON so the app works fully without an internet connection.
 *
 * Usage:
 *   import { cacheTrips, getCachedTrips, cacheTrip, removeCachedTrip } from '../utils/offlineCache';
 */

const PREFIX      = 'atlasync:';
const TRIPS_KEY   = `${PREFIX}trips`;
const USER_KEY    = `${PREFIX}user`;
const VERSION_KEY = `${PREFIX}cache_version`;
const CACHE_VERSION = '1';

/* ── Safe localStorage helpers ──────────────────────────────────────── */

function ls() {
  // localStorage is not available in SSR / Node environments
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; }
  catch { return null; }
}

function lsGet(key) {
  try {
    const raw = ls()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    ls()?.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // Quota exceeded or private-mode restriction
    console.warn('[offlineCache] Could not write to localStorage:', e.message);
    return false;
  }
}

function lsDel(key) {
  try { ls()?.removeItem(key); } catch {}
}

/* ── Version management ──────────────────────────────────────────────── */

/** Clear stale cache if the schema version changed */
export function initCache() {
  const stored = lsGet(VERSION_KEY);
  if (stored !== CACHE_VERSION) {
    clearAll();
    lsSet(VERSION_KEY, CACHE_VERSION);
  }
}

/* ── Trip cache ──────────────────────────────────────────────────────── */

/**
 * Store the full trips array (replaces existing cache).
 * @param {Array} trips
 */
export function cacheTrips(trips) {
  lsSet(TRIPS_KEY, { trips, cachedAt: Date.now() });
}

/**
 * Return cached trips, or null if nothing is cached.
 * @returns {{ trips: Array, cachedAt: number } | null}
 */
export function getCachedTrips() {
  return lsGet(TRIPS_KEY);
}

/**
 * Cache (or update) a single trip inside the trips list.
 * @param {object} trip
 */
export function cacheTrip(trip) {
  const cache    = getCachedTrips();
  const existing = cache?.trips ?? [];
  const idx      = existing.findIndex((t) => t.id === trip.id);

  const updated =
    idx >= 0
      ? existing.map((t) => (t.id === trip.id ? trip : t))
      : [trip, ...existing];

  cacheTrips(updated);
}

/**
 * Remove a single trip from the cache by id.
 * @param {string} tripId
 */
export function removeCachedTrip(tripId) {
  const cache = getCachedTrips();
  if (!cache) return;
  cacheTrips(cache.trips.filter((t) => t.id !== tripId));
}

/**
 * Get a single trip from the cache by id.
 * @param {string} tripId
 * @returns {object | null}
 */
export function getCachedTrip(tripId) {
  const cache = getCachedTrips();
  return cache?.trips?.find((t) => t.id === tripId) ?? null;
}

/* ── User cache ──────────────────────────────────────────────────────── */

export function cacheUser(user) {
  lsSet(USER_KEY, user);
}

export function getCachedUser() {
  return lsGet(USER_KEY);
}

export function clearCachedUser() {
  lsDel(USER_KEY);
}

/* ── Demo / seed data ────────────────────────────────────────────────── */

/** Seed the cache with example trips so the UI looks great on first load */
export function seedDemoData() {
  const existing = getCachedTrips();
  if (existing?.trips?.length) return; // already have data

  const demoTrips = [
    {
      id: 'demo-1',
      name: 'Tokyo Adventure',
      description: 'Cherry blossoms, ramen, and neon lights',
      cover_image: null,
      start_date: '2025-04-01',
      end_date:   '2025-04-10',
      destinations: ['Tokyo', 'Kyoto', 'Osaka'],
      created_at: new Date().toISOString(),
      trip_days: [
        {
          id: 'day-1',
          day_number: 1,
          date: '2025-04-01',
          title: 'Arrival & Shinjuku',
          trip_locations: [
            { id: 'loc-1', name: 'Shinjuku Gyoen', type: 'attraction', lat: 35.6858, lng: 139.7100, visit_order: 0 },
            { id: 'loc-2', name: 'Ichiran Ramen',   type: 'restaurant', lat: 35.6938, lng: 139.7034, visit_order: 1 },
            { id: 'loc-3', name: 'Tokyo Skytree',   type: 'attraction', lat: 35.7101, lng: 139.8107, visit_order: 2 },
          ],
        },
      ],
    },
    {
      id: 'demo-2',
      name: 'Paris Getaway',
      description: 'Art, cuisine, and the City of Light',
      cover_image: null,
      start_date: '2025-06-15',
      end_date:   '2025-06-22',
      destinations: ['Paris'],
      created_at: new Date().toISOString(),
      trip_days: [
        {
          id: 'day-2',
          day_number: 1,
          date: '2025-06-15',
          title: 'Eiffel & Louvre',
          trip_locations: [
            { id: 'loc-4', name: 'Eiffel Tower', type: 'attraction', lat: 48.8584, lng: 2.2945, visit_order: 0 },
            { id: 'loc-5', name: 'Louvre Museum', type: 'attraction', lat: 48.8606, lng: 2.3376, visit_order: 1 },
            { id: 'loc-6', name: 'Le Jules Verne', type: 'restaurant', lat: 48.8583, lng: 2.2945, visit_order: 2 },
          ],
        },
      ],
    },
    {
      id: 'demo-3',
      name: 'New York City',
      description: 'The city that never sleeps',
      cover_image: null,
      start_date: '2025-09-05',
      end_date:   '2025-09-12',
      destinations: ['New York'],
      created_at: new Date().toISOString(),
      trip_days: [],
    },
  ];

  cacheTrips(demoTrips);
}

/* ── Queue for offline mutations ──────────────────────────────────────── */

const QUEUE_KEY = `${PREFIX}mutation_queue`;

/**
 * Add a pending mutation to the offline queue (to sync when back online).
 * @param {{ type: 'create'|'update'|'delete', entity: string, payload: object }} mutation
 */
export function enqueueOfflineMutation(mutation) {
  const queue = lsGet(QUEUE_KEY) ?? [];
  queue.push({ ...mutation, enqueuedAt: Date.now() });
  lsSet(QUEUE_KEY, queue);
}

/**
 * Return all queued offline mutations.
 * @returns {Array}
 */
export function getOfflineQueue() {
  return lsGet(QUEUE_KEY) ?? [];
}

/**
 * Clear the offline mutation queue (call after successful sync).
 */
export function clearOfflineQueue() {
  lsDel(QUEUE_KEY);
}

/* ── Housekeeping ──────────────────────────────────────────────────── */

/** Clear all Atlasync data from localStorage */
export function clearAll() {
  const store = ls();
  if (!store) return;
  try {
    Object.keys(store)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => store.removeItem(k));
  } catch {
    // Quota or permission errors — silently ignore
  }
}

/**
 * Check if the app is currently online.
 * @returns {boolean}
 */
export function isOnline() {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
}
