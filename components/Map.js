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

const TYPE_CONFIG = {
  attraction: { color: '#3B82F6', label: 'Attraction' },
  restaurant:  { color: '#F59E0B', label: 'Restaurant'  },
  hotel:       { color: '#8B5CF6', label: 'Hotel'       },
  transport:   { color: '#06B6D4', label: 'Transport'   },
  activity:    { color: '#10B981', label: 'Activity'    },
};

const STREET_ZOOM = 18;

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/** Pin marker with name label above the pin (no numbers). */
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
  locations     = [],
  routeGeoJSON  = null,
  activeId      = null,
  onMarkerClick = () => {},
  className     = '',
  style         = 'mapbox://styles/mapbox/dark-v11',
  initialCenter = [-74.0060, 40.7128],
  initialZoom   = 2,
}) {
  const mapContainer   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const dashOffsetRef  = useRef(null);
  const [mapReady,    setMapReady]    = useState(false);
  const [error,       setError]       = useState(null);
  const [detailLoc,   setDetailLoc]   = useState(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [locationDescription, setLocationDescription] = useState(null);
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  /* ── Initialise Mapbox ──────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!MAPBOX_TOKEN) {
      setError('Mapbox token missing. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local');
      return;
    }

    import('mapbox-gl').then((mod) => {
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:    mapContainer.current,
        style,
        center:       initialCenter,
        zoom:         initialZoom,
        projection:   'globe',
        antialias:    true,
        logoPosition: 'bottom-right',
      });

      map.on('style.load', () => {
        map.setFog({
          color:           'rgb(5, 8, 16)',
          'high-color':    'rgb(10, 20, 50)',
          'horizon-blend':  0.04,
          'space-color':   'rgb(5, 8, 16)',
          'star-intensity': 0.1,
        });
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

  /* ── Update markers (no activeId in deps so click does not recreate markers) ── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      locations.forEach((loc, idx) => {
        if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;

        const el = createPinWithLabelEl(loc.name, loc.type, idx * 80);

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([loc.lng, loc.lat])
          .addTo(mapRef.current);

        el.addEventListener('click', () => {
          onMarkerClick(loc);
          setDetailLoc(loc);
          setPanelVisible(true);
          if (mapRef.current) {
            mapRef.current.flyTo({
              center: [loc.lng, loc.lat],
              zoom: STREET_ZOOM,
              duration: 800,
              curve: 1.2,
            });
          }
        });

        markersRef.current.push(marker);
      });
    });
  }, [locations, mapReady, onMarkerClick]);

  /* ── Fetch place description when detailLoc changes (avoid generic labels) ── */
  useEffect(() => {
    if (!detailLoc?.name || typeof detailLoc.lat !== 'number') {
      setLocationDescription(null);
      setDescriptionLoading(false);
      return;
    }
    setDescriptionLoading(true);
    setLocationDescription(null);
    searchPlaces(detailLoc.name, detailLoc.lat, detailLoc.lng)
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
  }, [detailLoc?.id, detailLoc?.name, detailLoc?.lat, detailLoc?.lng]);

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
  }, [routeGeoJSON, mapReady]);

  /* ── Fly to active marker (street-level zoom) ───────────────────── */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeId) return;
    const loc = locations.find((l) => l.id === activeId);
    if (!loc || typeof loc.lat !== 'number') return;

    mapRef.current.flyTo({
      center:   [loc.lng, loc.lat],
      zoom:     STREET_ZOOM,
      duration: 1200,
      curve:    1.4,
      easing:   (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    });
  }, [activeId, locations, mapReady]);

  /* ── Fit bounds to all locations ────────────────────────────────── */
  useEffect(() => {
    if (!mapReady || !mapRef.current || locations.length < 2 || activeId) return;

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach((l) => {
        if (typeof l.lat === 'number') bounds.extend([l.lng, l.lat]);
      });
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 1000 });
      }
    });
  }, [locations, mapReady, activeId]);

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

      {/* ── Location detail panel (single close button) ─────────────────────── */}
      {detailLoc && (
        <div
          className="absolute bottom-4 left-4 right-16 pointer-events-none"
          style={{
            transform:  panelVisible ? 'translateY(0)' : 'translateY(110%)',
            opacity:    panelVisible ? 1 : 0,
            transition: 'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.25s ease',
          }}
        >
          <div
            className="glass-heavy rounded-xl px-4 py-3 flex items-start justify-between gap-3 pointer-events-auto shadow-card"
            style={{ borderLeft: `3px solid ${(TYPE_CONFIG[detailLoc.type] || TYPE_CONFIG.attraction).color}` }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: (TYPE_CONFIG[detailLoc.type] || TYPE_CONFIG.attraction).color }}
                >
                  {(TYPE_CONFIG[detailLoc.type] || TYPE_CONFIG.attraction).label}
                </span>
              </div>
              <p className="text-white font-semibold text-sm leading-tight truncate">{detailLoc.name}</p>
              {detailLoc.address && (
                <p className="text-atlas-text-muted text-xs mt-0.5 truncate">{detailLoc.address}</p>
              )}
              {descriptionLoading && (
                <p className="text-atlas-text-muted text-xs mt-1 italic">Loading description…</p>
              )}
              {!descriptionLoading && locationDescription && (
                <p className="text-atlas-text-secondary text-xs mt-1 line-clamp-3">{locationDescription}</p>
              )}
              {!descriptionLoading && !locationDescription && detailLoc.notes && (
                <p className="text-atlas-text-secondary text-xs mt-1 line-clamp-2">{detailLoc.notes}</p>
              )}
              {typeof detailLoc.lat === 'number' && typeof detailLoc.lng === 'number' && (
                <a
                  href={`https://www.google.com/maps?layer=c&cbll=${detailLoc.lat},${detailLoc.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-atlas-blue hover:text-atlas-blue-light transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Open in Street View
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setPanelVisible(false); setDetailLoc(null); setLocationDescription(null); }}
              className="flex-shrink-0 p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/10 transition-all"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
