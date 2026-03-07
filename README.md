# Atlasync

Travel itinerary app with Mapbox map, day-based planning, and place search.

## Geoapify provider & routing

Place search and details are powered by **Geoapify** (Places API and Routing API). All Geoapify requests are made from **server-side API routes** so the API key is never exposed to the client.

### Environment variables

Create `.env.local` (do not commit; it is gitignored):

```bash
# Server-only (never exposed to the browser)
GEOAPIFY_API_KEY=your_geoapify_key_from_dashboard

# Mapbox (used for map tiles; token may be public)
NEXT_PUBLIC_MAPBOX_TOKEN=pk....

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://....
NEXT_PUBLIC_SUPABASE_ANON_KEY=....
```

- **GEOAPIFY_API_KEY** — From [Geoapify MyProjects](https://myprojects.geoapify.com/). Used by `/api/places/*` and `/api/routes`.
- Ensure `.gitignore` includes `.env`, `.env.local`, and `.env.*.local`.

### Rate limiting

All Geoapify-backed API routes use a per-IP token bucket in `lib/rate-limit.js` (default 60 requests/minute). Configure via the `rateLimit(req, res, { maxPerMinute: 60 })` options in each route.

### Caching (TTLs)

- **Search/suggest/category** — In-memory + Supabase `place_search_cache`. TTL 7 days (604800 s). Cache key: query + category + rounded lng,lat + radius + limit.
- **Place details** — In-memory + Supabase `place_details_cache`. TTL 30 days (2592000 s). Cache key: Geoapify `place_id`.

Supabase tables: run `supabase/migrations/003_place_cache.sql` (after 001 and 002).

### Local test steps

1. Set `GEOAPIFY_API_KEY` in `.env.local`.
2. Run migrations 001, 002, 003 in Supabase.
3. `npm run dev` — open a trip, add a day and locations.
4. **Search** — Use search/autocomplete; results come from `GET /api/places/suggest` or `GET /api/places/category`. Same map layers and popups as before.
5. **Marker click** — Opens details from `GET /api/places/details?id=...`; second click uses cache.
6. **Route this day** — Toolbar “Route this day” calls `POST /api/routes` with the day’s coords and draws the line (layer `day-route`). “Clear route” removes it.
7. Confirm no `GEOAPIFY_API_KEY` (or `GOOGLE_*`) in client bundles: build and search built JS for the key string.
