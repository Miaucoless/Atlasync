/**
 * pages/api/places/parse-google-maps-link.js
 * POST body: { url: string }
 *
 * Resolves a Google Maps short link (e.g. maps.app.goo.gl/...), parses the
 * final URL and optional page HTML for coordinates. Uses Mapbox reverse
 * geocode for place names when available.
 *
 * Google does not provide an official API for shared lists; this extracts
 * coordinates from URL encoding and embedded page state. Returns { places, error? }.
 */

function addPlace(places, seen, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (seen.has(key)) return;
  seen.add(key);
  places.push({ name: '', lat, lng });
}

function extractFromDataParam(dataStr, places, seen) {
  if (!dataStr) return;
  // !1dLNG!2dLAT (common in some URLs)
  let m;
  const re1 = /!1d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/g;
  while ((m = re1.exec(dataStr)) !== null) {
    addPlace(places, seen, parseFloat(m[2]), parseFloat(m[1]));
  }
  // !3dLAT!4dLNG (place URLs: !8m2!3d48.8584!4d2.2945)
  const re2 = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/g;
  while ((m = re2.exec(dataStr)) !== null) {
    addPlace(places, seen, parseFloat(m[1]), parseFloat(m[2]));
  }
  // !4dLNG!3dLAT (reversed order)
  const re3 = /!4d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/g;
  while ((m = re3.exec(dataStr)) !== null) {
    addPlace(places, seen, parseFloat(m[2]), parseFloat(m[1]));
  }
  // !2dLNG!3dLAT (some encodings use 2d/3d)
  const re4 = /!2d(-?\d+\.?\d*)!3d(-?\d+\.?\d*)/g;
  while ((m = re4.exec(dataStr)) !== null) {
    addPlace(places, seen, parseFloat(m[2]), parseFloat(m[1]));
  }
}

function extractFromPath(path, places, seen) {
  if (!path) return;
  // @lat,lng or @lat,lng,zoom (e.g. /place/Name/@48.8584,2.2945,17z)
  const atMatch = path.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,\d+z?)?/);
  if (atMatch) {
    addPlace(places, seen, parseFloat(atMatch[1]), parseFloat(atMatch[2]));
  }
}

/** Try to extract place coords from embedded JSON in page HTML (e.g. list view). Capped to avoid noise. */
const MAX_PLACES_FROM_HTML = 60;

function extractFromHtml(html, places, seen) {
  if (!html || typeof html !== 'string') return;
  // "lat"/"lng" object pattern (common in place/list JSON)
  const latLngObjRe = /"lat(?:itude)?"\s*:\s*(-?\d+\.?\d*)[^}]*"lng(?:itude)?"\s*:\s*(-?\d+\.?\d*)/g;
  let m;
  while ((m = latLngObjRe.exec(html)) !== null && places.length < MAX_PLACES_FROM_HTML) {
    addPlace(places, seen, parseFloat(m[1]), parseFloat(m[2]));
  }
  if (places.length >= MAX_PLACES_FROM_HTML) return;
  // Google embedded: latitudeE7 / longitudeE7 (value is coord * 1e7)
  const e7Re = /"latitudeE7"\s*:\s*(-?\d+)[^}]*"longitudeE7"\s*:\s*(-?\d+)/g;
  while ((m = e7Re.exec(html)) !== null && places.length < MAX_PLACES_FROM_HTML) {
    addPlace(places, seen, parseFloat(m[1]) / 1e7, parseFloat(m[2]) / 1e7);
  }
  if (places.length >= MAX_PLACES_FROM_HTML) return;
  // Fallback: [lat,lng] or [lng,lat] arrays (GeoJSON style) — only accept if they look like real coords
  const latLngArrayRe = /\[(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\]/g;
  while ((m = latLngArrayRe.exec(html)) !== null && places.length < MAX_PLACES_FROM_HTML) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (a >= -90 && a <= 90 && b >= -180 && b <= 180) addPlace(places, seen, a, b);
    else if (b >= -90 && b <= 90 && a >= -180 && a <= 180) addPlace(places, seen, b, a);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: '`url` is required' });
  }

  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  try {
    const fetchRes = await fetch(trimmed, {
      method:  'GET',
      redirect: 'follow',
      headers:  {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const finalUrl = fetchRes.url || trimmed;
    const places = [];
    const seen = new Set();

    // 1) Path: @lat,lng (single place or map center)
    try {
      const path = new URL(finalUrl).pathname;
      extractFromPath(path, places, seen);
    } catch (_) {}

    // 2) Query: data=!...
    const dataMatch = finalUrl.match(/[?&]data=([^&]+)/);
    const dataStr = dataMatch ? decodeURIComponent(dataMatch[1].replace(/\+/g, ' ')) : '';
    extractFromDataParam(dataStr, places, seen);

    // 3) If still empty, fetch HTML and parse embedded state (shared lists often load data in JS)
    if (places.length === 0) {
      const html = await fetchRes.text();
      extractFromHtml(html, places, seen);
    }

    if (places.length === 0) {
      return res.status(200).json({
        places: [],
        error: 'No places found in that link. Try pasting your list as text (one place per line) in "Places to include" instead.',
      });
    }

    // Optional: reverse geocode with Mapbox to get names
    if (mapboxToken && places.length <= 50) {
      await Promise.all(
        places.map(async (p, i) => {
          try {
            const r = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${p.lng},${p.lat}.json?types=poi,address,place&limit=1&access_token=${mapboxToken}`
            );
            if (!r.ok) return;
            const data = await r.json();
            const f = data.features?.[0];
            if (f?.text || f?.place_name) {
              places[i].name = f.text || f.place_name?.split(',')[0] || `Stop ${i + 1}`;
            } else {
              places[i].name = `Stop ${i + 1}`;
            }
          } catch {
            places[i].name = `Stop ${i + 1}`;
          }
        })
      );
    } else {
      places.forEach((p, i) => { p.name = p.name || `Stop ${i + 1}`; });
    }

    return res.status(200).json({ places });
  } catch (e) {
    console.error('[parse-google-maps-link]', e.message);
    return res.status(200).json({
      places: [],
      error: 'Could not read that link. Paste your list as text (one place per line) in "Places to include" or export as KML and use Import from Google Maps.',
    });
  }
}
