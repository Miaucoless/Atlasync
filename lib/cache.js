/**
 * lib/cache.js
 * Two-level cache: in-memory (LRU + TTL) and Supabase (place_search_cache, place_details_cache).
 * All functions are async; Supabase client is created server-side only.
 */

const MEMORY_MAX = 500;
const MEMORY_TTL_MS = 5 * 60 * 1000; // 5 min default

const searchMemory = new Map(); // key -> { data, expiresAt }
const detailsMemory = new Map();
const searchLru = [];
const detailsLru = [];

function now() {
  return Date.now();
}

function getSupabase() {
  if (typeof window !== 'undefined') return null;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  } catch {
    return null;
  }
}

function pruneMemory(map, lru, max) {
  while (lru.length > max && lru.length > 0) {
    const key = lru.shift();
    map.delete(key);
  }
}

/**
 * @param {string} key
 * @returns {Promise<import('geojson').FeatureCollection | null>}
 */
export async function getSearchCache(key) {
  const mem = searchMemory.get(key);
  if (mem && now() < mem.expiresAt) return mem.data;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from('place_search_cache')
    .select('results, created_at, ttl_seconds')
    .eq('query', key)
    .single();

  if (error || !row) return null;
  const createdAt = new Date(row.created_at).getTime();
  if (now() - createdAt > (row.ttl_seconds || 604800) * 1000) return null;

  const fc = row.results;
  searchMemory.set(key, { data: fc, expiresAt: now() + MEMORY_TTL_MS });
  searchLru.push(key);
  pruneMemory(searchMemory, searchLru, MEMORY_MAX);
  return fc;
}

/**
 * @param {string} key
 * @param {import('geojson').FeatureCollection} data
 * @param {number} [ttlSeconds=604800]
 */
export async function setSearchCache(key, data, ttlSeconds = 604800) {
  searchMemory.set(key, { data, expiresAt: now() + Math.min(MEMORY_TTL_MS, ttlSeconds * 1000) });
  searchLru.push(key);
  pruneMemory(searchMemory, searchLru, MEMORY_MAX);

  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from('place_search_cache').upsert(
    { query: key, results: data, ttl_seconds: ttlSeconds },
    { onConflict: 'query' }
  );
}

/**
 * @param {string} placeId
 * @returns {Promise<object | null>}
 */
export async function getDetailsCache(placeId) {
  const mem = detailsMemory.get(placeId);
  if (mem && now() < mem.expiresAt) return mem.data;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from('place_details_cache')
    .select('details, created_at, ttl_seconds')
    .eq('place_id', placeId)
    .single();

  if (error || !row) return null;
  const createdAt = new Date(row.created_at).getTime();
  if (now() - createdAt > (row.ttl_seconds || 2592000) * 1000) return null;

  const details = row.details;
  detailsMemory.set(placeId, { data: details, expiresAt: now() + MEMORY_TTL_MS });
  detailsLru.push(placeId);
  pruneMemory(detailsMemory, detailsLru, MEMORY_MAX);
  return details;
}

/**
 * @param {string} placeId
 * @param {object} data
 * @param {number} [ttlSeconds=2592000]
 */
export async function setDetailsCache(placeId, data, ttlSeconds = 2592000) {
  detailsMemory.set(placeId, { data, expiresAt: now() + Math.min(MEMORY_TTL_MS, ttlSeconds * 1000) });
  detailsLru.push(placeId);
  pruneMemory(detailsMemory, detailsLru, MEMORY_MAX);

  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from('place_details_cache').upsert(
    { place_id: placeId, details: data, ttl_seconds: ttlSeconds },
    { onConflict: 'place_id' }
  );
}
