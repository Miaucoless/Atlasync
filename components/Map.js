/**
 * Map.js — Enhanced
 *
 * Enhancements:
 *  ✦ Animated route draw — line coordinates reveal incrementally on load
 *  ✦ Moving dash offset animation on the dashed route line
 *  ✦ Staggered marker entry — each marker scales in with a slight delay
 *  ✦ Location detail panel — glass card slides up from bottom on marker click
 *  ✦ Active marker pulse ring synced to card state
 */

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { searchPlaces, getPlaceDetailsByLocation } from '../services/places';
import { debounce, changedKey } from '../lib/async-guards';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Module-level Places cache — faster first layer before services/places cache */
const placesCache = new Map(); // key: "lat.toFixed(4),lng.toFixed(4)" → { data, timestamp }
const PLACES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Category emoji for info card badges */
const CATEGORY_EMOJIS = {
  restaurant:'🍽', cafe:'☕', bar:'🍸', hotel:'🏨', lodging:'🏨',
  museum:'🏛', tourist_attraction:'🗺', art_gallery:'🎨',
  library:'📚', park:'🌿', night_club:'🎵', store:'🛍',
  church:'⛪', hospital:'🏥', school:'🎓',
};
function getCategoryBadge(primaryType) {
  if (!primaryType) return null;
  const key = primaryType.toLowerCase().replace(/ /g, '_');
  const emoji = CATEGORY_EMOJIS[key] || '📍';
  return `${emoji} ${primaryType}`;
}
function getCuisineSubtype(primaryType, rawCategory) {
  // Extract last segment of dotted category (e.g. "catering.restaurant.pizza" → "pizza")
  const raw = rawCategory || primaryType || '';
  const parts = raw.split('.');
  if (parts.length < 2) return '';
  const sub = parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const main = primaryType || '';
  if (sub.toLowerCase() === main.toLowerCase() || sub.length < 3) return '';
  return sub;
}

/** Reverse geocode lng, lat to place name and short description via Mapbox */
async function reverseGeocode(lng, lat) {
  if (!MAPBOX_TOKEN || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=poi,place,address,locality,neighborhood`
    );
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    const name = f.text || f.place_name?.split(',')[0]?.trim() || 'Unknown place';
    const address = f.place_name || '';
    const contextParts = (f.context || []).map((c) => c.text).filter(Boolean);
    const placeType = (f.place_type || [])[0];
    let description = '';
    if (placeType === 'poi') {
      description = contextParts.length ? `Point of interest in ${contextParts.join(', ')}.` : (address && address !== name ? address : 'A place on the map.');
    } else if (placeType === 'address') {
      description = contextParts.length ? `Address in ${contextParts.join(', ')}.` : (address || 'Address location.');
    } else if (placeType === 'place' || placeType === 'locality') {
      description = address && address !== name ? address : (contextParts.length ? `Located in ${contextParts.join(', ')}.` : 'Location on the map.');
    } else {
      description = contextParts.length ? contextParts.join(', ') : (address && address.length > name.length ? address : '');
    }
    return { name: name.trim(), address: address.trim(), description: description.trim() || address.trim() };
  } catch {
    return null;
  }
}

/** Heatmap filter config: UI key → Mapbox search queries */
const HEATMAP_FILTERS = {
  food:           ['restaurant', 'cafe'],
  sightseeing:    ['tourist_attraction', 'museum'],
  nightlife:     ['bar', 'night_club'],
  cultural:       ['museum', 'art_gallery', 'library'],
  shopping:       ['clothing_store', 'shopping_mall', 'store'],
  scenic:         ['park', 'natural_feature', 'viewpoint'],
};

/** Fetch POIs in bbox for heatmap; categories = array of HEATMAP_FILTERS keys (e.g. ['food','sightseeing']). */
async function fetchPoisInBounds(bbox, categories = ['food', 'sightseeing']) {
  if (!MAPBOX_TOKEN || !bbox || bbox.length !== 4) return { type: 'FeatureCollection', features: [] };
  const [west, south, east, north] = bbox;
  const bboxStr = [west, south, east, north].join(',');
  const queries = [...new Set(categories.flatMap((c) => HEATMAP_FILTERS[c] || []))];
  if (queries.length === 0) return { type: 'FeatureCollection', features: [] };
  const allCoords = new Set();
  try {
    const results = await Promise.all(
      queries.map((q) =>
        fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&bbox=${bboxStr}&limit=50&types=poi`
        ).then((r) => r.json())
      )
    );
    for (const data of results) {
      const features = data.features || [];
      for (const f of features) {
        const coords = f.geometry?.coordinates;
        if (coords && coords.length >= 2) allCoords.add(JSON.stringify([coords[0], coords[1]]));
      }
    }
    const features = [...allCoords].map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: JSON.parse(s) },
      properties: {},
    }));
    return { type: 'FeatureCollection', features };
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

const TYPE_CONFIG = {
  attraction: { color: '#3B82F6', label: 'Attraction' },
  restaurant:  { color: '#F59E0B', label: 'Restaurant'  },
  hotel:       { color: '#8B5CF6', label: 'Hotel'       },
  transport:   { color: '#06B6D4', label: 'Transport'   },
  activity:    { color: '#10B981', label: 'Activity'    },
};

const STREET_ZOOM = 18;
const MIN_ZOOM_TO_PAN_ONLY = 17; // when already this zoom or higher, pan to new pin without zooming out
const STYLE_STREET = 'mapbox://styles/mapbox/streets-v12';
const STYLE_DARK   = 'mapbox://styles/mapbox/dark-v11';

/** Returns true if lat/lng are valid and not the null island (0,0) */
function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

/** Normalize location to { ...loc, lat, lng } with numeric coords (supports lat/lng or latitude/longitude). */
function normalizeLocation(loc) {
  if (!loc || typeof loc !== 'object') return null;
  const lat = typeof loc.lat === 'number' ? loc.lat : (typeof loc.latitude === 'number' ? loc.latitude : Number(loc.lat ?? loc.latitude));
  const lng = typeof loc.lng === 'number' ? loc.lng : (typeof loc.longitude === 'number' ? loc.longitude : Number(loc.lng ?? loc.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { ...loc, lat, lng };
}

/** Safe locations list (never undefined for map/effects). */
function safeLocations(locs) {
  return Array.isArray(locs) ? locs : [];
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/** Temporary pulsing hollow ring — placed at the clicked point during exploration popup. */
function createTempPinEl() {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #3B82F6;
    background: rgba(59,130,246,0.15);
    animation: atlas-temp-pin-pulse 1.4s ease-out infinite;
    pointer-events: none;
  `;
  return el;
}

/** Pin-only element (no label) — used when location is selected. */
function createPinOnlyEl(type, delay = 0) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.attraction;
  const el = document.createElement('div');
  el.className = 'atlas-saved-pin';
  el.style.cssText = `
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transform: scale(0);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
  `;
  el.innerHTML = `
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 16 12 16s12-7 12-16C24 5.373 18.627 0 12 0z" fill="${cfg.color}"/>
      <circle cx="12" cy="10" r="5" fill="white"/>
    </svg>
  `;
  setTimeout(() => {
    el.style.transform = 'scale(1)';
    el.style.opacity = '1';
  }, delay);
  el.addEventListener('mouseenter', () => { el.style.filter = 'brightness(1.15)'; });
  el.addEventListener('mouseleave', () => { el.style.filter = 'none'; });
  return el;
}

/** Pin marker with name label above the pin (unselected state). */
function createPinWithLabelEl(name, type, delay = 0) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.attraction;
  const displayName = String(name || 'Place').slice(0, 28);
  const el = document.createElement('div');
  el.style.cssText = `
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transform: scale(0);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
  `;
  el.innerHTML = `
    <span style="
      font-family: system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #F1F5F9;
      background: rgba(15,23,42,0.95);
      padding: 3px 8px;
      border-radius: 6px;
      white-space: nowrap;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid ${cfg.color}66;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      margin-bottom: 2px;
    ">${escapeHtml(displayName)}</span>
    <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 16 12 16s12-7 12-16C24 5.373 18.627 0 12 0z" fill="${cfg.color}"/>
      <circle cx="12" cy="10" r="5" fill="white"/>
    </svg>
  `;
  setTimeout(() => {
    el.style.transform = 'scale(1)';
    el.style.opacity = '1';
  }, delay);
  el.addEventListener('mouseenter', () => { el.style.filter = 'brightness(1.15)'; });
  el.addEventListener('mouseleave', () => { el.style.filter = 'none'; });
  return el;
}

export default function Map({
  locations             = [],
  routeGeoJSON          = null,
  dayRouteGeoJSON       = null,
  activeId              = null,
  onMarkerClick         = () => {},
  onMapClick            = null,
  days                  = [],
  onAddLocationToDay    = null,
  activeCategoryFilters = null,
  className             = '',
  style: styleProp,
  initialCenter         = [-74.0060, 40.7128],
  initialZoom           = 2,
}) {
  const mapContainer   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const popupRef       = useRef(null);
  const placePopupRef  = useRef(null);
  const tempMarkerRef  = useRef(null);
  const dashOffsetRef  = useRef(null);
  const viewModeRef    = useRef('street');
  const currentStyleRef = useRef(styleProp === STYLE_DARK ? STYLE_DARK : STYLE_STREET);
  const lastFittedLocationsKeyRef = useRef(null);
  const [mapReady,    setMapReady]    = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [error,       setError]       = useState(null);
  const [viewMode,    setViewMode]    = useState(styleProp === STYLE_DARK ? 'dark' : 'street');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapFilters, setHeatmapFilters] = useState(['food', 'sightseeing']);
  const [locationDescription, setLocationDescription] = useState(null);
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const heatmapBoundsRef = useRef(null);
  const heatmapMoveEndRef = useRef(null);

  viewModeRef.current = viewMode;
  const locs = safeLocations(locations);
  const activeLoc = activeId ? locs.find((l) => l.id === activeId) : null;

  /* ── Initialise Mapbox (useLayoutEffect so container ref is set and has size) ────────────────── */
  useLayoutEffect(() => {
    const container = mapContainer.current;
    if (!container || mapRef.current) return;

    if (!MAPBOX_TOKEN) {
      setError('Mapbox token missing. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local');
      return;
    }

    const initialStyle = styleProp === STYLE_DARK ? STYLE_DARK : STYLE_STREET;
    viewModeRef.current = styleProp === STYLE_DARK ? 'dark' : 'street';
    currentStyleRef.current = initialStyle;

    import('mapbox-gl').then((mod) => {
      // Guard: if the component unmounted before the import resolved, bail out.
      if (!document.body.contains(container)) return;

      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container,
        style:       initialStyle,
        center:       initialCenter,
        zoom:         initialZoom,
        projection:   initialStyle === STYLE_DARK ? 'globe' : 'mercator',
        antialias:    true,
        logoPosition: 'bottom-right',
      });

      map.on('style.load', () => {
        if (viewModeRef.current === 'dark') {
          map.setFog({
            color:           'rgb(5, 8, 16)',
            'high-color':    'rgb(10, 20, 50)',
            'horizon-blend':  0.04,
            'space-color':   'rgb(5, 8, 16)',
            'star-intensity': 0.1,
          });
        }
        // Resize immediately and again after a tick to ensure container has settled.
        map.resize();
        requestAnimationFrame(() => { map.resize(); });
        setMapReady(true);
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

      mapRef.current = map;
    }).catch((err) => {
      console.error('[Map] Failed to load mapbox-gl:', err);
      setError('Map failed to load. Check your Mapbox token.');
    });

    return () => {
      if (dashOffsetRef.current) cancelAnimationFrame(dashOffsetRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Switch map style (Street / Dark) when user toggles ────────── */
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const url = viewMode === 'dark' ? STYLE_DARK : STYLE_STREET;
    if (currentStyleRef.current === url) return;
    currentStyleRef.current = url;
    const map = mapRef.current;
    map.setStyle(url);
    map.once('style.load', () => {
      if (viewMode === 'dark') {
        map.setFog({
          color:           'rgb(5, 8, 16)',
          'high-color':    'rgb(10, 20, 50)',
          'horizon-blend':  0.04,
          'space-color':   'rgb(5, 8, 16)',
          'star-intensity': 0.1,
        });
      }
      setStyleVersion((v) => v + 1);
    });
  }, [viewMode, mapReady]);

  /* ── Heatmap layer (dark mode only): POI density in viewport ───── */
  const heatmapSourceId = 'atlas-heatmap-pois';
  const heatmapLayerId = 'atlas-heatmap-pois-layer';
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;

    const removeHeatmap = () => {
      try {
        if (map.getLayer(heatmapLayerId)) map.removeLayer(heatmapLayerId);
        if (map.getSource(heatmapSourceId)) map.removeSource(heatmapSourceId);
      } catch (_) { /* style may have removed them */ }
    };

    if (!showHeatmap) {
      removeHeatmap();
      return;
    }

    let cancelled = false;
    const bounds = map.getBounds();
    const bbox = bounds ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] : null;

    const heatmapKeyRef = { current: '' };
    const updateHeatmapData = (b) => {
      if (!map.getSource(heatmapSourceId)) return;
      if (!changedKey(heatmapKeyRef, { b, f: heatmapFilters })) return;
      fetchPoisInBounds(b, heatmapFilters).then((geo) => {
        if (!mapRef.current || !map.getSource(heatmapSourceId)) return;
        map.getSource(heatmapSourceId).setData(geo);
      });
    };

    fetchPoisInBounds(bbox, heatmapFilters).then((geojson) => {
      if (cancelled || !mapRef.current) return;
      removeHeatmap();
      if (geojson.features.length === 0) return;
      map.addSource(heatmapSourceId, { type: 'geojson', data: geojson });
      map.addLayer(
        {
          id: heatmapLayerId,
          type: 'heatmap',
          source: heatmapSourceId,
          maxzoom: 16,
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 0.8,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.12, 'rgba(34, 126, 230, 0.5)',
              0.25, 'rgba(22, 163, 74, 0.55)',
              0.45, 'rgba(234, 179, 8, 0.7)',
              0.65, 'rgba(249, 115, 22, 0.8)',
              0.85, 'rgba(239, 68, 68, 0.9)',
              1, 'rgba(185, 28, 28, 0.95)',
            ],
            'heatmap-radius': 22,
            'heatmap-opacity': 0.75,
          },
        },
        map.getStyle().layers?.find((l) => l.id === 'building') ? 'building' : undefined
      );
      const onMoveEnd = debounce(() => {
        if (!mapRef.current || !map.getSource(heatmapSourceId)) return;
        const b = map.getBounds();
        updateHeatmapData([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }, 350);
      heatmapMoveEndRef.current = onMoveEnd;
      map.on('moveend', onMoveEnd);
    });

    return () => {
      cancelled = true;
      if (heatmapMoveEndRef.current && mapRef.current) {
        mapRef.current.off('moveend', heatmapMoveEndRef.current);
        heatmapMoveEndRef.current = null;
      }
      removeHeatmap();
    };
  }, [mapReady, showHeatmap, heatmapFilters, styleVersion]);

  /* ── Update markers: name+pin when unselected, pin-only when selected ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    map.resize();

    const validLocations = safeLocations(locations)
      .map(normalizeLocation)
      .filter(Boolean)
      .filter((loc) => isValidCoord(loc.lat, loc.lng));

    const addMarkers = () => {
      import('mapbox-gl').then(({ default: mapboxgl }) => {
        if (!mapRef.current) return;
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        const filters = activeCategoryFilters && activeCategoryFilters.length > 0;
        validLocations.forEach((loc, idx) => {
          const isSelected = loc.id === activeId;
          const emphasized = !filters || activeCategoryFilters.includes(loc.type);
          const el = isSelected
            ? createPinOnlyEl(loc.type, idx * 80)
            : createPinWithLabelEl(loc.name, loc.type, idx * 80);
          if (!emphasized) {
            el.style.opacity = '0.4';
            el.style.filter = 'grayscale(0.6)';
          }

          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([loc.lng, loc.lat])
            .addTo(mapRef.current);

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onMarkerClick(loc);
            if (mapRef.current) {
              const m = mapRef.current;
              const currentZoom = m.getZoom();
              const center = [loc.lng, loc.lat];
              if (currentZoom >= MIN_ZOOM_TO_PAN_ONLY) {
                m.easeTo({ center, zoom: currentZoom, duration: 400 });
              } else {
                m.flyTo({ center, zoom: STREET_ZOOM, duration: 800, curve: 1.2 });
              }
            }
          });

          markersRef.current.push(marker);
        });
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(addMarkers);
    });
  }, [locations, mapReady, onMarkerClick, styleVersion, activeId, activeCategoryFilters]);

  /* ── Fetch place description when active location changes (for popup) ── */
  useEffect(() => {
    if (!activeLoc?.name || !isValidCoord(activeLoc.lat, activeLoc.lng)) {
      setLocationDescription(null);
      setDescriptionLoading(false);
      return;
    }
    setDescriptionLoading(true);
    setLocationDescription(null);
    getPlaceDetailsByLocation(activeLoc.lat, activeLoc.lng, activeLoc.name)
      .then((details) => {
        const desc = details?.description;
        if (desc && typeof desc === 'string' && desc.trim().length > 15) {
          const generic = ['point of interest', 'establishment', 'point_of_interest', 'a place to visit', 'a popular place'];
          const lower = desc.trim().toLowerCase();
          const isGeneric = generic.some((x) => lower === x || lower.startsWith(x + ' ') || lower.endsWith(' ' + x));
          setLocationDescription(isGeneric ? null : desc.trim());
        } else {
          return searchPlaces(activeLoc.name, activeLoc.lat, activeLoc.lng).then((results) => {
            const first = results?.[0];
            const fallback = first?.description;
            if (fallback && typeof fallback === 'string' && fallback.trim().length > 20) {
              const g = ['point of interest', 'establishment', 'point_of_interest', 'a place to visit', 'a popular place'];
              const lower = fallback.trim().toLowerCase();
              const isGeneric = g.some((x) => lower === x || lower.startsWith(x + ' ') || lower.endsWith(' ' + x));
              setLocationDescription(isGeneric ? null : fallback.trim());
            } else setLocationDescription(null);
          });
        }
      })
      .catch(() => setLocationDescription(null))
      .finally(() => setDescriptionLoading(false));
  }, [activeLoc?.id, activeLoc?.name, activeLoc?.lat, activeLoc?.lng]);

  /* ── Popup above selected pin: name + description; close on map click or deselect ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (!activeLoc || !isValidCoord(activeLoc.lat, activeLoc.lng)) {
      return () => { if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; } };
    }

    const cfg = TYPE_CONFIG[activeLoc.type] || TYPE_CONFIG.attraction;
    const desc = locationDescription || activeLoc.notes || (descriptionLoading ? 'Loading…' : '') || (activeLoc.address ? `Address: ${activeLoc.address}` : '');
    const container = document.createElement('div');
    container.style.cssText = 'position: relative; font-family: system-ui, -apple-system, sans-serif; min-width: 220px; max-width: 300px; padding: 4px 0; padding-right: 32px; margin: 0;';
    container.innerHTML = `
      <button type="button" class="atlas-popup-close" aria-label="Close" style="
        position: absolute; top: 0; right: 0; width: 28px; height: 28px; padding: 0; margin: 0; border: none; background: rgba(255,255,255,0.08); color: #94A3B8; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.2s, background 0.2s;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${escapeHtml(cfg.color)}; margin-bottom: 8px;">${escapeHtml((TYPE_CONFIG[activeLoc.type] || TYPE_CONFIG.attraction).label)}</div>
      <div style="font-size: 16px; font-weight: 600; color: #F8FAFC; margin-bottom: 10px; line-height: 1.35;">${escapeHtml(activeLoc.name || 'Place')}</div>
      ${desc ? `<div class="atlas-popup-desc" style="font-size: 15px; font-weight: 400; color: #F1F5F9; line-height: 1.65; letter-spacing: 0.02em; margin-bottom: 0;">${escapeHtml(desc.slice(0, 420))}${desc.length > 420 ? '…' : ''}</div>` : ''}
    `;
    const closeBtn = container.querySelector('.atlas-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#F1F5F9'; closeBtn.style.background = 'rgba(255,255,255,0.14)'; });
      closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#94A3B8'; closeBtn.style.background = 'rgba(255,255,255,0.08)'; });
    }

    let cancelled = false;
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled || !mapRef.current) return;
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
        className: 'atlas-map-popup',
      })
        .setLngLat([activeLoc.lng, activeLoc.lat])
        .setDOMContent(container)
        .addTo(mapRef.current);
      popupRef.current = popup;
      if (closeBtn) closeBtn.addEventListener('click', () => { popup.remove(); popupRef.current = null; onMapClick?.(); });
    });

    return () => {
      cancelled = true;
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
    };
  }, [activeId, activeLoc, mapReady, locationDescription, descriptionLoading]);

  /* ── Map click: debounced; reverse geocode + Geoapify Places; one temp popup at a time ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let clickTimeout = null;
    const DEBOUNCE_MS = 200;

    const handler = (e) => {
      const clickedLng = typeof e.lngLat?.lng === 'number' ? e.lngLat.lng : Number(e.lngLat?.lng);
      const clickedLat = typeof e.lngLat?.lat === 'number' ? e.lngLat.lat : Number(e.lngLat?.lat);
      if (!Number.isFinite(clickedLat) || !Number.isFinite(clickedLng)) return;

      onMapClick?.();
      if (placePopupRef.current) {
        placePopupRef.current.remove();
        placePopupRef.current = null;
      }
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
      if (clickTimeout) clearTimeout(clickTimeout);
      clickTimeout = setTimeout(async () => {
        clickTimeout = null;
        const lng = clickedLng;
        const lat = clickedLat;

        // Place a temporary pulsing pin immediately at the clicked location
        import('mapbox-gl').then(({ default: mapboxgl }) => {
          if (!mapRef.current) return;
          tempMarkerRef.current = new mapboxgl.Marker({ element: createTempPinEl(), anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(mapRef.current);
        });

        const place = await reverseGeocode(lng, lat);
        if (!place) {
          if (tempMarkerRef.current) { tempMarkerRef.current.remove(); tempMarkerRef.current = null; }
          return;
        }

        const shortDesc = (text) => {
          if (!text || !text.trim()) return '';
          const t = text.trim();
          const firstSentence = t.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() || t;
          return firstSentence.length <= 140 ? firstSentence : firstSentence.slice(0, 137) + '…';
        };

        // Check module-level cache first (B6), then Geoapify
        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const cached = placesCache.get(cacheKey);
        let placeDetails = null;
        if (cached && (Date.now() - cached.timestamp < PLACES_CACHE_TTL)) {
          placeDetails = cached.data;
        } else {
          try {
            placeDetails = await getPlaceDetailsByLocation(lat, lng, place.name);
            placesCache.set(cacheKey, { data: placeDetails, timestamp: Date.now() });
          } catch (_) { /* use Mapbox fallback */ }
        }

        const p = placeDetails;
        const displayName = p?.name || place.name;
        const displayAddress = p?.address || place.address || '';
        const badge = getCategoryBadge(p?.primaryType);
        const subtype = getCuisineSubtype(p?.primaryType, p?.rawCategory || p?.category);
        const fullDescription = (p?.description || place.description || '').trim();
        const description = shortDesc(fullDescription);
        const hasMore = fullDescription.length > description.length;
        const rating = p?.rating != null ? p.rating : null;
        const reviews = p?.reviews != null ? p.reviews : 0;
        const openNow = typeof p?.opening_hours === 'object' && p?.opening_hours !== null ? p.opening_hours?.open_now : undefined;
        const weekdayText = typeof p?.opening_hours === 'object' && p?.opening_hours !== null ? p.opening_hours?.weekday_text?.[0] : undefined;
        const openingHoursText = typeof p?.opening_hours === 'string' ? p.opening_hours : '';
        const showOpenStatus = openNow !== undefined;
        const hoursHint = weekdayText || openingHoursText || '';

        import('mapbox-gl').then(({ default: mapboxgl }) => {
          if (!mapRef.current) return;
          const container = document.createElement('div');
          container.className = 'atlas-map-popup';
          container.style.cssText = 'position: relative; min-width: 240px; max-width: 320px; font-family: system-ui, -apple-system, sans-serif; padding-right: 32px;';
          container.innerHTML = `
            <button type="button" class="atlas-place-popup-close" aria-label="Close" style="position: absolute; top: 0; right: 0; width: 28px; height: 28px; padding: 0; margin: 0; border: none; background: rgba(255,255,255,0.08); color: #94A3B8; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;"></button>
            <div style="padding: 2px 0;">
              ${badge ? `<div style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; background: rgba(59,130,246,0.12); color: #93C5FD; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(147,197,253,0.2); margin-bottom: 8px;">${escapeHtml(badge)}</div>` : ''}
              <div style="font-size: 16px; font-weight: 600; color: #F8FAFC; margin-bottom: ${subtype ? '2px' : '8px'}; line-height: 1.35;">${escapeHtml(displayName)}</div>
              ${subtype ? `<div style="font-size: 12px; color: #7DD3FC; margin-bottom: 8px;">${escapeHtml(subtype)}</div>` : ''}
              ${rating != null ? `<div style="font-size: 13px; color: #FBBF24; margin-bottom: 4px;">★ ${Number(rating).toFixed(1)}${reviews ? ` · ${reviews} review${reviews !== 1 ? 's' : ''}` : ''}</div>` : ''}
              ${displayAddress ? `<div style="font-size: 12px; color: #94A3B8; margin-bottom: 8px;">${escapeHtml(displayAddress)}</div>` : ''}
              ${description ? `
                <div class="atlas-popup-short-desc" style="font-size: 14px; color: #E2E8F0; line-height: 1.5; margin-bottom: ${hasMore ? '4px' : '10px'};">${escapeHtml(description)}</div>
                ${hasMore ? `
                  <button type="button" class="atlas-read-more-btn" style="font-size: 12px; color: #60A5FA; background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 10px; display: block;">Read more ↓</button>
                  <div class="atlas-popup-full-desc" style="display: none; font-size: 14px; color: #E2E8F0; line-height: 1.5; margin-bottom: 10px;">${escapeHtml(fullDescription)}</div>
                ` : ''}
              ` : ''}
              ${showOpenStatus ? `
                <div style="font-size: 12px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                  <span style="color: ${openNow ? '#10B981' : '#EF4444'}; font-size: 8px;">●</span>
                  <span style="color: ${openNow ? '#10B981' : '#EF4444'}; font-weight: 500;">${openNow ? 'Open now' : 'Closed'}</span>
                  ${hoursHint ? `<span style="color: #64748B;">· ${escapeHtml(hoursHint)}</span>` : ''}
                </div>
              ` : hoursHint ? `<div style="font-size: 12px; color: #64748B; margin-bottom: 8px;">${escapeHtml(hoursHint)}</div>` : ''}
              ${days.length > 0 && onAddLocationToDay ? `
                <div class="atlas-add-section" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                  <button type="button" class="atlas-add-btn" style="width: 100%; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #fff; background: linear-gradient(135deg, #3B82F6, #06B6D4); border: none; border-radius: 8px; cursor: pointer;">Add to itinerary</button>
                  <div class="atlas-add-form" style="display: none; margin-top: 10px;">
                    <label style="display: block; font-size: 11px; font-weight: 600; color: #94A3B8; margin-bottom: 4px; text-transform: uppercase;">Day</label>
                    <select class="atlas-day-select" style="width: 100%; padding: 8px 10px; font-size: 14px; color: #F1F5F9; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; margin-bottom: 10px;"></select>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: #94A3B8; margin-bottom: 4px; text-transform: uppercase;">Notes (optional)</label>
                    <textarea class="atlas-notes-input" placeholder="Add a note..." rows="2" style="width: 100%; padding: 8px 10px; font-size: 14px; color: #F1F5F9; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; resize: vertical; min-height: 56px;"></textarea>
                    <button type="button" class="atlas-confirm-add" style="width: 100%; margin-top: 10px; padding: 8px 12px; font-size: 13px; font-weight: 600; color: #fff; background: rgba(16,185,129,0.9); border: none; border-radius: 8px; cursor: pointer;">Add</button>
                  </div>
                </div>
              ` : ''}
            </div>
          `;
          const placeCloseBtn = container.querySelector('.atlas-place-popup-close');
          if (placeCloseBtn) {
            placeCloseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            placeCloseBtn.addEventListener('mouseenter', () => { placeCloseBtn.style.color = '#F1F5F9'; placeCloseBtn.style.background = 'rgba(255,255,255,0.14)'; });
            placeCloseBtn.addEventListener('mouseleave', () => { placeCloseBtn.style.color = '#94A3B8'; placeCloseBtn.style.background = 'rgba(255,255,255,0.08)'; });
          }
          // Read more expand (B3)
          const readMoreBtn = container.querySelector('.atlas-read-more-btn');
          const fullDescEl  = container.querySelector('.atlas-popup-full-desc');
          const shortDescEl = container.querySelector('.atlas-popup-short-desc');
          if (readMoreBtn && fullDescEl && shortDescEl) {
            readMoreBtn.addEventListener('click', () => {
              shortDescEl.style.display = 'none';
              fullDescEl.style.display  = 'block';
              readMoreBtn.style.display = 'none';
            });
          }
          const addBtn = container.querySelector('.atlas-add-btn');
          const addForm = container.querySelector('.atlas-add-form');
          const daySelect = container.querySelector('.atlas-day-select');
          const notesInput = container.querySelector('.atlas-notes-input');
          const confirmBtn = container.querySelector('.atlas-confirm-add');
          const payload = {
            name: displayName,
            address: displayAddress || null,
            description: fullDescription || null,
            lat: clickedLat,
            lng: clickedLng,
            type: p?.type || 'attraction',
            notes: null,
            duration_minutes: p?.duration ?? 60,
          };
          if (addBtn && addForm && daySelect && confirmBtn && days.length > 0 && onAddLocationToDay) {
            days.forEach((d) => {
              const opt = document.createElement('option');
              opt.value = d.id;
              opt.textContent = `Day ${d.day_number ?? ''}`;
              daySelect.appendChild(opt);
            });
            addBtn.addEventListener('click', () => { addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none'; });
            confirmBtn.addEventListener('click', () => {
              payload.notes = notesInput ? notesInput.value.trim() || null : null;
              onAddLocationToDay(daySelect.value, payload);
              if (placePopupRef.current) { placePopupRef.current.remove(); placePopupRef.current = null; }
              if (tempMarkerRef.current) { tempMarkerRef.current.remove(); tempMarkerRef.current = null; }
            });
          }
          const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false,
            className: 'atlas-map-popup',
          })
            .setLngLat([clickedLng, clickedLat])
            .setDOMContent(container)
            .addTo(mapRef.current);
          placePopupRef.current = popup;
          popup.on('close', () => {
            placePopupRef.current = null;
            if (tempMarkerRef.current) { tempMarkerRef.current.remove(); tempMarkerRef.current = null; }
          });
          if (placeCloseBtn) placeCloseBtn.addEventListener('click', () => { popup.remove(); placePopupRef.current = null; });
        });
      }, DEBOUNCE_MS);
    };

    map.on('click', handler);
    return () => {
      if (clickTimeout) clearTimeout(clickTimeout);
      map.off('click', handler);
      if (placePopupRef.current) {
        placePopupRef.current.remove();
        placePopupRef.current = null;
      }
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
    };
  }, [mapReady, onMapClick, days, onAddLocationToDay]);

  /* ── Animated route draw ────────────────────────────────────────── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Cancel previous dash animation
    if (dashOffsetRef.current) {
      cancelAnimationFrame(dashOffsetRef.current);
      dashOffsetRef.current = null;
    }

    if (map.getLayer('route-line'))  map.removeLayer('route-line');
    if (map.getLayer('route-glow'))  map.removeLayer('route-glow');
    if (map.getSource('route'))      map.removeSource('route');

    if (!routeGeoJSON) return;

    // Extract all coordinates
    const allCoords = routeGeoJSON.features
      ?.flatMap((f) => f.geometry?.coordinates ?? []) ?? [];

    if (allCoords.length < 2) return;

    // Start with empty line, animate coordinates in
    const emptyGeoJSON = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] },
      }],
    };

    map.addSource('route', { type: 'geojson', data: emptyGeoJSON });

    // Glow layer
    map.addLayer({
      id:     'route-glow',
      type:   'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint:  {
        'line-color':   '#3B82F6',
        'line-width':   8,
        'line-opacity': 0.18,
        'line-blur':    4,
      },
    });

    // Main dashed line (line-dash-offset will be animated after draw)
    map.addLayer({
      id:     'route-line',
      type:   'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint:  {
        'line-color':       '#3B82F6',
        'line-width':       2.5,
        'line-opacity':     0.9,
        'line-dasharray':   [4, 2],
        'line-dash-offset': 0,
      },
    });

    // Animate: reveal coordinates one by one
    let step = 0;
    const totalSteps = allCoords.length;
    const stepsPerFrame = Math.max(1, Math.ceil(totalSteps / 60)); // ~1s to draw

    function drawStep() {
      step = Math.min(step + stepsPerFrame, totalSteps);
      if (map.getSource('route')) {
        map.getSource('route').setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: allCoords.slice(0, step) },
          }],
        });
      }
      if (step < totalSteps) {
        dashOffsetRef.current = requestAnimationFrame(drawStep);
      } else {
        // Once drawn, animate line-dash-offset for a flowing marching-ants effect
        let offset = 0;
        function animateDash() {
          offset = (offset - 0.4 + 24) % 24;
          if (map.getLayer('route-line')) {
            map.setPaintProperty('route-line', 'line-dash-offset', -offset);
          }
          dashOffsetRef.current = requestAnimationFrame(animateDash);
        }
        animateDash();
      }
    }

    // Small initial delay so map renders first
    const t = setTimeout(() => { drawStep(); }, 400);
    return () => clearTimeout(t);
  }, [routeGeoJSON, mapReady, styleVersion]);

  /* ── Day route (Geoapify driving/walk line): layer id day-route ─── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer('day-route')) map.removeLayer('day-route');
    if (map.getSource('day-route')) map.removeSource('day-route');

    if (!dayRouteGeoJSON?.features?.length) return;
    const feat = dayRouteGeoJSON.features[0];
    const coords = feat?.geometry?.coordinates;
    if (!coords || coords.length < 2) return;

    const fc = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }],
    };
    map.addSource('day-route', { type: 'geojson', data: fc });
    map.addLayer({
      id: 'day-route',
      type: 'line',
      source: 'day-route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#10B981',
        'line-width': 5,
        'line-opacity': 0.95,
      },
    });

    return () => {
      if (map.getLayer('day-route')) map.removeLayer('day-route');
      if (map.getSource('day-route')) map.removeSource('day-route');
    };
  }, [mapReady, styleVersion, dayRouteGeoJSON]);

  /* ── Fly to active marker (or pan only if already zoomed in) ─────── */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeId) return;
    const loc = locs.find((l) => l.id === activeId);
    if (!loc || !isValidCoord(loc.lat, loc.lng)) return;

    const map = mapRef.current;
    const currentZoom = map.getZoom();
    const center = [loc.lng, loc.lat];
    if (currentZoom >= MIN_ZOOM_TO_PAN_ONLY) {
      map.easeTo({ center, zoom: currentZoom, duration: 500 });
    } else {
      map.flyTo({
        center,
        zoom:   STREET_ZOOM,
        duration: 1200,
        curve:   1.4,
        easing:  (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      });
    }
  }, [activeId, locs, mapReady]);

  /* ── Fit bounds only when the location set changes (e.g. new day); never on deselect ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const valid = locs.filter((l) => isValidCoord(l.lat, l.lng));
    if (valid.length === 0) return;

    const locationsKey = valid.map((l) => l.id).filter(Boolean).sort().join(',') || valid.length;
    if (lastFittedLocationsKeyRef.current === locationsKey) return;
    lastFittedLocationsKeyRef.current = locationsKey;

    const t = setTimeout(() => {
      if (!mapRef.current) return;
      import('mapbox-gl').then(({ default: mapboxgl }) => {
        if (!mapRef.current) return;
        mapRef.current.resize();
        if (valid.length >= 2) {
          const bounds = new mapboxgl.LngLatBounds();
          valid.forEach((l) => bounds.extend([l.lng, l.lat]));
          if (!bounds.isEmpty()) {
            mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 1000 });
          }
        } else {
          mapRef.current.flyTo({
            center: [valid[0].lng, valid[0].lat],
            zoom:   Math.max(13, (mapRef.current.getZoom?.() ?? 11)),
            duration: 800,
          });
        }
      });
    }, 200);

    return () => clearTimeout(t);
  }, [locs, mapReady]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-atlas-surface rounded-2xl ${className}`}>
        <div className="text-center px-8 py-12">
          <div className="text-4xl mb-4">🗺️</div>
          <p className="text-atlas-text-secondary text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} style={{ minHeight: 500, height: '100%' }}>
      {/* height: 100% ensures Mapbox reads a non-zero clientHeight on init */}
      <div ref={mapContainer} className="absolute inset-0 w-full" style={{ minHeight: 500, height: '100%' }} />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-atlas-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-atlas-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-atlas-text-muted">Loading map…</p>
          </div>
        </div>
      )}

      {/* Map style toggle: Street / Dark */}
      {mapReady && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex rounded-lg bg-black/50 backdrop-blur-sm p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('street')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'street' ? 'bg-blue-500/40 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setViewMode('dark')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'dark' ? 'bg-blue-500/40 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              Dark
            </button>
          </div>
        </div>
      )}

      {/* Heatmap toggle + filter chips — bottom-right, above nav controls */}
      {mapReady && (
        <div className="absolute bottom-14 right-3 z-10 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${showHeatmap ? 'bg-amber-500/40 text-amber-200 border-amber-400/50' : 'bg-black/50 backdrop-blur-sm text-slate-400 hover:text-slate-300 border-white/10'}`}
            title="Show popular areas heatmap"
          >
            🔥 Heatmap
          </button>
          {showHeatmap && (
            <div className="flex flex-wrap justify-end gap-1 max-w-[220px]">
              {[
                { key: 'food',        label: '🍽 Food'      },
                { key: 'sightseeing', label: '👁 Sights'    },
                { key: 'nightlife',   label: '🎵 Nightlife' },
                { key: 'cultural',    label: '🏛 Culture'   },
                { key: 'shopping',    label: '🛍 Shopping'  },
                { key: 'scenic',      label: '🌿 Scenic'    },
              ].map(({ key, label }) => {
                const on = heatmapFilters.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHeatmapFilters((f) => on ? f.filter((x) => x !== key) : [...f, key])}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded border transition-colors ${on ? 'bg-amber-500/50 text-amber-100 border-amber-400/50' : 'bg-black/40 text-slate-400 border-white/10 hover:text-slate-300'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
