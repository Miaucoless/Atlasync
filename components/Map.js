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

import { useEffect, useRef, useState, useCallback } from 'react';
import { searchPlaces } from '../services/places';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

/** Fetch POIs in bbox via Mapbox Geocoding; returns GeoJSON FeatureCollection of points for heatmap. */
async function fetchPoisInBounds(bbox) {
  if (!MAPBOX_TOKEN || !bbox || bbox.length !== 4) return { type: 'FeatureCollection', features: [] };
  const [west, south, east, north] = bbox;
  const bboxStr = [west, south, east, north].join(',');
  const queries = ['restaurant', 'cafe', 'attraction'];
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

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/** Pin-only element (no label) — used when location is selected. */
function createPinOnlyEl(type, delay = 0) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.attraction;
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
  locations           = [],
  routeGeoJSON        = null,
  activeId            = null,
  onMarkerClick       = () => {},
  onMapClick          = null,
  days                = [],
  onAddLocationToDay  = null,
  className           = '',
  style: styleProp,
  initialCenter       = [-74.0060, 40.7128],
  initialZoom         = 2,
}) {
  const mapContainer   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const popupRef       = useRef(null);
  const placePopupRef  = useRef(null);
  const dashOffsetRef  = useRef(null);
  const viewModeRef    = useRef('street');
  const currentStyleRef = useRef(styleProp === STYLE_DARK ? STYLE_DARK : STYLE_STREET);
  const lastFittedLocationsKeyRef = useRef(null);
  const [mapReady,    setMapReady]    = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  const [error,       setError]       = useState(null);
  const [viewMode,    setViewMode]    = useState(styleProp === STYLE_DARK ? 'dark' : 'street');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [locationDescription, setLocationDescription] = useState(null);
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  viewModeRef.current = viewMode;
  const activeLoc = activeId ? locations.find((l) => l.id === activeId) : null;

  /* ── Initialise Mapbox (street style by default) ────────────────── */
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!MAPBOX_TOKEN) {
      setError('Mapbox token missing. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local');
      return;
    }

    const initialStyle = styleProp === STYLE_DARK ? STYLE_DARK : STYLE_STREET;
    viewModeRef.current = styleProp === STYLE_DARK ? 'dark' : 'street';
    currentStyleRef.current = initialStyle;

    import('mapbox-gl').then((mod) => {
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:    mapContainer.current,
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
    if (viewMode === 'street') setShowHeatmap(false);
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
    if (!mapRef.current || !mapReady || viewMode !== 'dark') return;
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
    fetchPoisInBounds(bbox).then((geojson) => {
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
              0.2, 'rgba(59, 130, 246, 0.4)',
              0.5, 'rgba(6, 182, 212, 0.6)',
              0.8, 'rgba(245, 158, 11, 0.8)',
              1, 'rgba(239, 68, 68, 0.9)',
            ],
            'heatmap-radius': 20,
            'heatmap-opacity': 0.7,
          },
        },
        map.getStyle().layers?.find((l) => l.id === 'building') ? 'building' : undefined
      );
    });

    return () => {
      cancelled = true;
      removeHeatmap();
    };
  }, [mapReady, viewMode, showHeatmap, styleVersion]);

  /* ── Update markers: name+pin when unselected, pin-only when selected ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    map.resize();

    const validLocations = locations.filter((loc) => isValidCoord(loc.lat, loc.lng));

    const addMarkers = () => {
      import('mapbox-gl').then(({ default: mapboxgl }) => {
        if (!mapRef.current) return;
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        validLocations.forEach((loc, idx) => {
          const isSelected = loc.id === activeId;
          const el = isSelected
            ? createPinOnlyEl(loc.type, idx * 80)
            : createPinWithLabelEl(loc.name, loc.type, idx * 80);

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
  }, [locations, mapReady, onMarkerClick, styleVersion, activeId]);

  /* ── Fetch place description when active location changes (for popup) ── */
  useEffect(() => {
    if (!activeLoc?.name || !isValidCoord(activeLoc.lat, activeLoc.lng)) {
      setLocationDescription(null);
      setDescriptionLoading(false);
      return;
    }
    setDescriptionLoading(true);
    setLocationDescription(null);
    searchPlaces(activeLoc.name, activeLoc.lat, activeLoc.lng)
      .then((results) => {
        const first = results?.[0];
        const desc = first?.description || first?.editorial_summary?.overview;
        if (desc && typeof desc === 'string' && desc.trim().length > 20) {
          const g = ['point of interest', 'establishment', 'point_of_interest', 'a place to visit', 'a popular place'];
          const lower = desc.trim().toLowerCase();
          const isGeneric = g.some((x) => lower === x || lower.startsWith(x + ' ') || lower.endsWith(' ' + x));
          setLocationDescription(isGeneric ? null : desc.trim());
        } else {
          setLocationDescription(null);
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
      ${desc ? `<div class="atlas-popup-desc" style="font-size: 15px; font-weight: 400; color: #F1F5F9; line-height: 1.65; letter-spacing: 0.02em; margin-bottom: 0;">${escapeHtml(desc.slice(0, 280))}${desc.length > 280 ? '…' : ''}</div>` : ''}
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

  /* ── Map click: reverse geocode and show place popup with "Add to day" ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const handler = async (e) => {
      onMapClick?.();
      const { lng, lat } = e.lngLat;
      if (placePopupRef.current) {
        placePopupRef.current.remove();
        placePopupRef.current = null;
      }

      const place = await reverseGeocode(lng, lat);
      if (!place) return;

      import('mapbox-gl').then(({ default: mapboxgl }) => {
        if (!mapRef.current) return;

        const container = document.createElement('div');
        container.className = 'atlas-map-popup';
        container.style.cssText = 'position: relative; min-width: 220px; max-width: 300px; font-family: system-ui, -apple-system, sans-serif; padding-right: 32px;';
        container.innerHTML = `
          <button type="button" class="atlas-place-popup-close" aria-label="Close" style="
            position: absolute; top: 0; right: 0; width: 28px; height: 28px; padding: 0; margin: 0; border: none; background: rgba(255,255,255,0.08); color: #94A3B8; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.2s, background 0.2s;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style="padding: 2px 0;">
            <div style="font-size: 16px; font-weight: 600; color: #F8FAFC; margin-bottom: 10px; line-height: 1.35;">${escapeHtml(place.name)}</div>
            ${place.description ? `<div class="atlas-popup-desc" style="font-size: 15px; font-weight: 400; color: #F1F5F9; line-height: 1.65; letter-spacing: 0.02em; margin-bottom: 12px;">${escapeHtml(place.description)}</div>` : ''}
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
          placeCloseBtn.addEventListener('mouseenter', () => { placeCloseBtn.style.color = '#F1F5F9'; placeCloseBtn.style.background = 'rgba(255,255,255,0.14)'; });
          placeCloseBtn.addEventListener('mouseleave', () => { placeCloseBtn.style.color = '#94A3B8'; placeCloseBtn.style.background = 'rgba(255,255,255,0.08)'; });
        }

        const addBtn = container.querySelector('.atlas-add-btn');
        const addForm = container.querySelector('.atlas-add-form');
        const daySelect = container.querySelector('.atlas-day-select');
        const notesInput = container.querySelector('.atlas-notes-input');
        const confirmBtn = container.querySelector('.atlas-confirm-add');

        if (addBtn && addForm && daySelect && confirmBtn && days.length > 0 && onAddLocationToDay) {
          days.forEach((d) => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `Day ${d.day_number ?? ''}`;
            daySelect.appendChild(opt);
          });
          addBtn.addEventListener('click', () => {
            addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
          });
          confirmBtn.addEventListener('click', () => {
            const dayId = daySelect.value;
            const notes = notesInput ? notesInput.value.trim() || null : null;
            onAddLocationToDay(dayId, {
              name: place.name,
              address: place.address || null,
              description: place.description || null,
              lat,
              lng,
              type: 'attraction',
              notes,
              duration_minutes: 60,
            });
            if (placePopupRef.current) {
              placePopupRef.current.remove();
              placePopupRef.current = null;
            }
          });
        }

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false,
          className: 'atlas-map-popup',
        })
          .setLngLat([lng, lat])
          .setDOMContent(container)
          .addTo(mapRef.current);

        placePopupRef.current = popup;
        popup.on('close', () => { placePopupRef.current = null; });
        if (placeCloseBtn) placeCloseBtn.addEventListener('click', () => { popup.remove(); placePopupRef.current = null; });
      });
    };

    map.on('click', handler);
    return () => {
      map.off('click', handler);
      if (placePopupRef.current) {
        placePopupRef.current.remove();
        placePopupRef.current = null;
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

  /* ── Fly to active marker (or pan only if already zoomed in) ─────── */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeId) return;
    const loc = locations.find((l) => l.id === activeId);
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
  }, [activeId, locations, mapReady]);

  /* ── Fit bounds only when the location set changes (e.g. new day); never on deselect ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const valid = locations.filter((l) => isValidCoord(l.lat, l.lng));
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
  }, [locations, mapReady]);

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
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-atlas-surface">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-atlas-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-atlas-text-muted">Loading map…</p>
          </div>
        </div>
      )}

      {/* Map style toggle: Street / Dark; Heatmap (dark only) */}
      {mapReady && (
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
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
          {viewMode === 'dark' && (
            <button
              type="button"
              onClick={() => setShowHeatmap((v) => !v)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border border-white/10 transition-colors ${showHeatmap ? 'bg-amber-500/40 text-white' : 'bg-black/50 text-slate-400 hover:text-slate-300 backdrop-blur-sm'}`}
              title="Show popular areas (restaurants, cafés, attractions)"
            >
              Heatmap
            </button>
          )}
        </div>
      )}
    </div>
  );
}
