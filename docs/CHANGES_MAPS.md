# Map Changes — Atlasync

## What was broken and what was fixed

### 1. Trips page — "Route this day" button (pages/trips/[id].js)

**Root cause (double bug):**
- `handleRouteThisDay` was calling `POST /api/routes` but that handler only accepts `GET`.
- The coords array was built as `[[lng, lat], ...]` (GeoJSON order), but `/api/routes/optimize` expects `[{lat, lng}, ...]` objects — so routing always returned `undefined,undefined` waypoints.

**Fix:** Changed the fetch to call `POST /api/routes/optimize` and fixed the coords to be `locs.map(l => ({ lat: l.lat, lng: l.lng }))`.

---

### 2. Trips page — Map canvas could render at 0×0 (components/Map.js)

**Root cause:**
- The `mapContainer` ref div used `absolute inset-0` (which stretches via top/bottom constraints) but had no explicit `height: 100%`. If a browser evaluates `clientHeight` before the CSS box model fully settles, Mapbox reads 0 and renders an invisible canvas.
- The async `import('mapbox-gl')` callback had no guard for the case where the component unmounts before the import resolves — Mapbox would attach to a detached DOM element.

**Fix:**
- Added `height: 100%` to the mapContainer's inline style (belt-and-suspenders alongside `absolute inset-0`).
- Added `document.body.contains(container)` guard before constructing the map.
- Calling `map.resize()` synchronously in `style.load` (in addition to the rAF call) so the canvas is correctly sized immediately.

---

### 3. World page — "No places in this area" (pages/world.js + pages/api/geoapify/places.js)

**Root cause:**
- The highlights query used the category string `entertainment.attraction`, which is **not a valid Geoapify v2 category**. Geoapify silently returns 0 results for unknown categories, producing the "No places in this area" empty state.

**Fix:** Replaced `entertainment.attraction` with `tourism.attraction` (valid Geoapify category). The full highlights string is now:
```
tourism.sights,entertainment.museum,tourism.attraction
```

---

### 4. World page — Food/places shown in wrong language (pages/world.js + pages/api/geoapify/places.js)

**Root cause:**
- The Geoapify Places API defaults to local language (Japanese for Tokyo, Arabic for Cairo, etc.) when no `lang` parameter is supplied.
- Neither `world.js` nor `pages/api/geoapify/places.js` passed a `lang` parameter to Geoapify.

**Fix:**
- `world.js` now reads `navigator.language` (e.g. `'en-US'`), strips to the primary subtag (`'en'`), and passes it as `&lang=en` in every `/api/geoapify/places` call.
- `pages/api/geoapify/places.js` now accepts a `lang` query param, sanitizes it, and forwards it to Geoapify.

---

## How to maintain / extend

### Adding new Geoapify categories
Valid top-level categories include: `catering`, `commercial`, `education`, `entertainment`, `healthcare`, `leisure`, `natural`, `office`, `pet`, `religion`, `service`, `sport`, `tourism`, `transportation`. Use dotted sub-paths like `catering.restaurant` or `tourism.sights`. See the [Geoapify Places API docs](https://apidocs.geoapify.com/docs/places/) for the full tree.

### Changing place language
The lang flows: `navigator.language` (browser) → `world.js` fetch → `GET /api/geoapify/places?lang=...` → Geoapify `lang` param. Supported values mirror ISO 639-1 codes (`en`, `fr`, `de`, `ja`, etc.).

### Adding new Mapbox layers
In `components/Map.js`, all layer/source work should happen after `mapReady` is true. Use the `styleVersion` state dependency to re-add layers after a style switch (the `style.load` event removes all custom sources/layers). Check `map.getLayer(id)` / `map.getSource(id)` before adding to avoid duplicate errors.

### Route optimization
`POST /api/routes/optimize` expects `{ mode: 'drive'|'walk'|'bike', coords: [{lat, lng}, ...] }` and returns `{ geometry: LineString, summary: { distance_m, duration_s } }`. The day route GeoJSON is then passed as `dayRouteGeoJSON` to `<Map>` which renders it as a green line layer (`day-route`).
