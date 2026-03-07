-- Atlasync: server-side place search and details cache for Geoapify (run after 001, 002)
-- No RLS: API routes use anon key to read/write for cache-only access.

CREATE TABLE IF NOT EXISTS public.place_search_cache (
  id          BIGSERIAL PRIMARY KEY,
  query       TEXT NOT NULL UNIQUE,
  results     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_seconds INT NOT NULL DEFAULT 604800
);

CREATE INDEX IF NOT EXISTS idx_place_search_cache_query ON public.place_search_cache (query);

CREATE TABLE IF NOT EXISTS public.place_details_cache (
  place_id    TEXT PRIMARY KEY,
  details     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_seconds INT NOT NULL DEFAULT 2592000
);
