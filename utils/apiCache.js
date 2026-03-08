"use client";
/**
 * utils/apiCache.js
 *
 * Lightweight in-memory TTL cache for API responses.
 * Optionally persists to sessionStorage so cache survives component remounts
 * but is cleared when the tab closes.
 *
 * Usage:
 *   import { getCached, setCached, clearCache } from '../utils/apiCache';
 *
 *   const cached = getCached('places:Tokyo:attractions');
 *   if (cached) return cached;
 *   const data = await fetchSomething();
 *   setCached('places:Tokyo:attractions', data, 5 * 60 * 1000); // 5 min
 */

const MEMORY = new Map(); // { key → { data, expiresAt } }

function now() { return Date.now(); }

/* ── In-memory ─────────────────────────────────────────────────────────── */

export function getCached(key) {
  const entry = MEMORY.get(key);
  if (!entry) return null;
  if (now() > entry.expiresAt) { MEMORY.delete(key); return null; }
  return entry.data;
}

export function setCached(key, data, ttlMs = 5 * 60 * 1000) {
  MEMORY.set(key, { data, expiresAt: now() + ttlMs });

  // Mirror to sessionStorage (best-effort — SSR safe)
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(
        `atlas:${key}`,
        JSON.stringify({ data, expiresAt: now() + ttlMs })
      );
    } catch {
      // Storage quota exceeded — skip
    }
  }
}

export function clearCache(prefix = '') {
  if (prefix) {
    for (const k of MEMORY.keys()) {
      if (k.startsWith(prefix)) MEMORY.delete(k);
    }
  } else {
    MEMORY.clear();
  }
}

/* ── Hydrate from sessionStorage on first import (client only) ─────────── */

if (typeof window !== 'undefined') {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageKey = sessionStorage.key(i);
      if (!storageKey?.startsWith('atlas:')) continue;
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) continue;
      const { data, expiresAt } = JSON.parse(raw);
      if (now() < expiresAt) {
        MEMORY.set(storageKey.slice(6), { data, expiresAt });
      } else {
        sessionStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Session storage unavailable — memory-only mode
  }
}

/* ── Utility: deduplicate in-flight requests (request deduplication) ───── */

const IN_FLIGHT = new Map();

/**
 * Wraps an async fetcher so simultaneous calls with the same key share
 * one promise instead of firing multiple identical requests.
 *
 * @param {string}            key     Cache key
 * @param {() => Promise<*>}  fetcher Async function to call on miss
 * @param {number}            ttlMs   TTL in ms (default 5 min)
 */
export async function fetchWithCache(key, fetcher, ttlMs = 5 * 60 * 1000) {
  const cached = getCached(key);
  if (cached !== null) return cached;

  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = fetcher().then((data) => {
    if (data !== null && data !== undefined) setCached(key, data, ttlMs);
    IN_FLIGHT.delete(key);
    return data;
  }).catch((err) => {
    IN_FLIGHT.delete(key);
    throw err;
  });

  IN_FLIGHT.set(key, promise);
  return promise;
}
