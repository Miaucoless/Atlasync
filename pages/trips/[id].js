/**
 * pages/trips/[id].js — Enhanced
 *
 * Enhancements:
 *  ✦ AI panel — floating fixed bottom-right panel with slide-in-bottom
 *  ✦ Route optimization — animated progress bar while computing
 *  ✦ Day card stagger — each card slides up with increasing delay
 *  ✦ Mobile FAB — fixed "+ Add Stop" button on small screens
 *  ✦ Optimised route banner — animated slide-down reveal
 *  ✦ Header actions — icon-only on mobile, text+icon on desktop
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import TripDayCard from '../../components/TripDayCard';
import AIChat      from '../../components/AIChat';
import {
  supabase, fetchTrip, updateTrip, deleteTrip, upsertLocations, deleteLocation, insertTripDays,
} from '../../utils/supabaseClient';
import {
  optimizeRoute, routeToGeoJSON,
} from '../../utils/routeOptimizer';
import { getCachedTrip, cacheTrip, removeCachedTrip, isOnline } from '../../utils/offlineCache';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

/* ── Google Maps URL parser ─────────────────────────────────────────── */
/**
 * Parse common Google Maps share URL formats to extract name + coordinates.
 *
 * Supported formats:
 *   https://maps.google.com/?q=48.858844,2.294351
 *   https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z/...
 *   https://www.google.com/maps/search/Eiffel+Tower/@48.8584,2.2945,17z
 *   https://maps.google.com/?q=Eiffel+Tower,Paris (name-only, no coords)
 */
function parseGoogleMapsUrl(raw) {
  try {
    const url = raw.trim();
    const result = {};

    // 1. Extract lat/lng from @lat,lng,zoom pattern (most common share format)
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      result.lat = parseFloat(atMatch[1]);
      result.lng = parseFloat(atMatch[2]);
    }

    // 2. Extract lat/lng from ?q=lat,lng format
    if (!result.lat) {
      const qCoords = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (qCoords) {
        result.lat = parseFloat(qCoords[1]);
        result.lng = parseFloat(qCoords[2]);
      }
    }

    // 3. Extract place name from /place/Name/ or /search/Name/ path segments
    const placeMatch = url.match(/\/(?:place|search)\/([^/@?]+)/);
    if (placeMatch) {
      result.name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }

    // 4. Extract name from ?q=Text (only when no coords follow)
    if (!result.name) {
      const qText = url.match(/[?&]q=([^&@\d][^&]*)/);
      if (qText) {
        result.name = decodeURIComponent(qText[1].replace(/\+/g, ' ')).trim();
      }
    }

    return (result.lat !== undefined || result.name) ? result : null;
  } catch {
    return null;
  }
}

/* ── Add location modal ─────────────────────────────────────────────── */
function AddLocationModal({ tripId, dayId, days = [], onClose, onAdded }) {
  const [tab,  setTab]  = useState('manual'); // 'manual' | 'import'
  const [selectedDayId, setSelectedDayId] = useState(dayId || days[0]?.id);
  const [mapsUrl, setMapsUrl] = useState('');
  const [parseError, setParseError] = useState(null);

  const [form, setForm] = useState({
    name: '', type: 'attraction', address: '', lat: '', lng: '',
    notes: '', duration_minutes: '60',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    setSelectedDayId(dayId || days[0]?.id);
  }, [dayId, days]);

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleImport() {
    setParseError(null);
    if (!mapsUrl.trim()) { setParseError('Paste a Google Maps link first.'); return; }
    const parsed = parseGoogleMapsUrl(mapsUrl);
    if (!parsed) {
      setParseError('Could not read that link. Try a link from Google Maps Share → Copy link.');
      return;
    }
    setForm((f) => ({
      ...f,
      name: parsed.name ? parsed.name.replace(/\+/g, ' ') : f.name,
      lat:  parsed.lat  != null ? String(parsed.lat) : f.lat,
      lng:  parsed.lng  != null ? String(parsed.lng) : f.lng,
    }));
    setTab('manual');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Location name is required.');
    setSaving(true); setError(null);

    const loc = {
      id:               `local-${Date.now()}`,
      trip_id:          tripId,
      day_id:           selectedDayId,
      name:             form.name.trim(),
      type:             form.type,
      address:          form.address.trim() || null,
      lat:              form.lat ? parseFloat(form.lat)  : null,
      lng:              form.lng ? parseFloat(form.lng)  : null,
      notes:            form.notes.trim() || null,
      duration_minutes: parseInt(form.duration_minutes, 10) || 60,
      visit_order:      0,
    };

    try {
      if (isOnline()) {
        const saved = await upsertLocations([{ ...loc, id: undefined }]);
        onAdded(saved[0] || loc);
      } else {
        onAdded(loc);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save location.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative glass-heavy rounded-2xl w-full max-w-md p-6 shadow-card"
        style={{ animation: 'slide-up 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Add Stop</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06]">
            <XIcon />
          </button>
        </div>

        {/* Day selector */}
        {days.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-atlas-text-muted mb-1.5">Add to</label>
            <select
              value={selectedDayId ?? ''}
              onChange={(e) => setSelectedDayId(e.target.value)}
              className="atlas-input w-full text-sm"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>Day {d.day_number ?? '?'}{d.title && d.title !== `Day ${d.day_number}` ? ` — ${d.title}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          {[
            { id: 'manual', label: 'Manual' },
            { id: 'import', label: 'Import from Google Maps' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setParseError(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                tab === t.id
                  ? 'bg-atlas-blue text-white shadow-glow-sm'
                  : 'text-atlas-text-muted hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Import tab ── */}
        {tab === 'import' ? (
          <div className="space-y-3">
            <p className="text-xs text-atlas-text-secondary">
              In Google Maps, tap a place → Share → Copy link, then paste it below.
            </p>
            <textarea
              value={mapsUrl}
              onChange={(e) => { setMapsUrl(e.target.value); setParseError(null); }}
              placeholder="https://maps.google.com/... or https://www.google.com/maps/place/..."
              rows={3}
              className="atlas-input resize-none text-xs"
              autoFocus
            />
            {parseError && (
              <p className="text-xs text-amber-400 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {parseError}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
              <button type="button" onClick={handleImport} className="btn-glow flex-1 text-sm py-2">
                <span>Parse Link</span>
              </button>
            </div>
            <p className="text-[10px] text-atlas-text-muted text-center">
              Works with standard Google Maps share links. Shortened goo.gl links are not supported.
            </p>
          </div>
        ) : (
          /* ── Manual tab ── */
          <form onSubmit={handleSubmit} className="space-y-3">
            <input name="name" value={form.name} onChange={onChange} placeholder="Place name *" className="atlas-input" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <select name="type" value={form.type} onChange={onChange} className="atlas-input">
                <option value="attraction">Attraction</option>
                <option value="restaurant">Restaurant</option>
                <option value="hotel">Hotel</option>
                <option value="transport">Transport</option>
                <option value="activity">Activity</option>
              </select>
              <input name="duration_minutes" value={form.duration_minutes} onChange={onChange} placeholder="Duration (min)" type="number" className="atlas-input" />
            </div>
            <input name="address" value={form.address} onChange={onChange} placeholder="Address" className="atlas-input" />
            <div className="grid grid-cols-2 gap-3">
              <input name="lat" value={form.lat} onChange={onChange} placeholder="Latitude" type="number" step="any" className="atlas-input" />
              <input name="lng" value={form.lng} onChange={onChange} placeholder="Longitude" type="number" step="any" className="atlas-input" />
            </div>
            <textarea name="notes" value={form.notes} onChange={onChange} placeholder="Notes (optional)" rows={2} className="atlas-input resize-none" />
            {error && <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-glow flex-1"><span>{saving ? 'Adding…' : 'Add Stop'}</span></button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Route optimisation progress bar ────────────────────────────────── */
function OptimiseProgress({ progress }) {
  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06] mt-1">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
        style={{ width: `${progress}%`, boxShadow: '0 0 8px rgba(16,185,129,0.7)' }}
      />
    </div>
  );
}

/* ── AI Itinerary Generator modal ───────────────────────────────────── */
function AIItineraryModal({ trip, onClose, onApply }) {
  const [destination, setDestination] = useState('');
  const [numDays, setNumDays] = useState(3);
  const [pace, setPace] = useState('balanced');
  const [userIdeas, setUserIdeas] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (trip?.name) setDestination(trip.name);
    if (trip?.destinations?.[0]) setDestination((d) => d || trip.destinations[0]);
  }, [trip?.name, trip?.destinations]);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!destination?.trim()) return setError('Destination is required.');
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim(),
          numDays: Math.max(1, Math.min(14, Number(numDays) || 3)),
          pace: pace || 'balanced',
          interests: [],
          userIdeas: userIdeas.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate itinerary');
      if (!Array.isArray(data?.days)) throw new Error('Invalid response from AI');
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to generate itinerary.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApply() {
    if (!result?.days?.length || !trip?.id) return;
    setApplying(true);
    setError(null);
    try {
      await onApply(result);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to apply itinerary.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative glass-heavy rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-card"
        style={{ animation: 'slide-up 0.3s ease both' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] flex-shrink-0">
          <h2 className="text-base font-bold text-white">Generate with AI</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06]">
            <XIcon />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {!result ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-atlas-text-muted mb-1.5">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Lisbon, Portugal"
                  className="atlas-input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-atlas-text-muted mb-1.5">Days</label>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={numDays}
                    onChange={(e) => setNumDays(e.target.value)}
                    className="atlas-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-atlas-text-muted mb-1.5">Pace</label>
                  <select value={pace} onChange={(e) => setPace(e.target.value)} className="atlas-input w-full">
                    <option value="relaxed">Relaxed</option>
                    <option value="balanced">Balanced</option>
                    <option value="packed">Packed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-atlas-text-muted mb-1.5">Preferences (optional)</label>
                <textarea
                  value={userIdeas}
                  onChange={(e) => setUserIdeas(e.target.value)}
                  placeholder="e.g. focus on food, avoid crowds..."
                  rows={2}
                  className="atlas-input w-full resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
              <button type="submit" disabled={generating} className="btn-glow w-full">
                {generating ? 'Generating itinerary…' : 'Generate itinerary'}
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-atlas-text-secondary">
                {result.days.length} days, {result.days.reduce((n, d) => n + (d.locations?.length ?? 0), 0)} stops
              </p>
              {error && <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setResult(null); setError(null); }} className="btn-ghost flex-1">
                  Back
                </button>
                <button type="button" onClick={handleApply} disabled={applying} className="btn-glow flex-1">
                  {applying ? 'Applying…' : 'Apply to trip'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Trip detail page ───────────────────────────────────────────────── */
export default function TripDetailPage() {
  const router = useRouter();
  const { id }  = router.query;

  const [trip,           setTrip]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [expandedDays,   setExpandedDays]   = useState({});
  const [activeLocId,    setActiveLocId]    = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [addingToDay,    setAddingToDay]    = useState(null);
  const [showAI,         setShowAI]         = useState(false);
  const [optimising,     setOptimising]     = useState(false);
  const [optProgress,    setOptProgress]    = useState(0);
  const [optimisedRoute, setOptimisedRoute] = useState(null);
  const [routeGeoJSON,   setRouteGeoJSON]   = useState(null);
  const [offlineMode,    setOfflineMode]    = useState(false);
  const [editing,        setEditing]        = useState(false);
  const [editName,       setEditName]       = useState('');
  const [showItineraryGen, setShowItineraryGen] = useState(false);

  /* Load trip */
  const loadTrip = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      let data;
      if (isOnline()) {
        data = await fetchTrip(id);
      } else {
        data = getCachedTrip(id);
        setOfflineMode(true);
      }
      if (data) {
        setTrip(data);
        setEditName(data.name);
        setExpandedDays({});
      }
    } catch {
      const cached = getCachedTrip(id);
      if (cached) { setTrip(cached); setOfflineMode(true); }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  /* When landing with ?generate=1, open the AI itinerary modal */
  useEffect(() => {
    if (!trip || !router.isReady) return;
    if (router.query.generate === '1') {
      setShowItineraryGen(true);
      router.replace(`/trips/${id}`, undefined, { shallow: true });
    }
  }, [trip, router.isReady, router.query.generate, id, router]);

  const allLocations = useMemo(() => {
    if (!trip) return [];
    return (trip.trip_days ?? [])
      .flatMap((d) => (d.trip_locations ?? []).map((l) => ({ ...l, _day_number: d.day_number })))
      .filter((l) => typeof l.lat === 'number');
  }, [trip]);

  const daysSorted = useMemo(
    () => (trip?.trip_days ?? []).slice().sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0)),
    [trip?.trip_days]
  );

  const [mapDayFilter, setMapDayFilter] = useState(null);
  useEffect(() => {
    if (daysSorted.length > 0 && mapDayFilter == null) {
      setMapDayFilter(daysSorted[0].day_number ?? null);
    }
  }, [daysSorted, mapDayFilter]);

  /* Optimise with animated progress */
  async function handleOptimise() {
    setOptimising(true);
    setOptProgress(0);

    // Animate progress bar through 0→85% while computing, then jump to 100%
    const steps = [10, 25, 45, 65, 80, 85];
    let si = 0;
    const advance = setInterval(() => {
      if (si < steps.length) { setOptProgress(steps[si++]); }
      else clearInterval(advance);
    }, 120);

    try {
      await new Promise((r) => setTimeout(r, 50)); // tick for UI to update
      const { orderedLocations, totalDistanceKm } = optimizeRoute(allLocations);
      clearInterval(advance);
      setOptProgress(100);
      await new Promise((r) => setTimeout(r, 300));
      setOptimisedRoute({ locations: orderedLocations, totalDistanceKm });
      setRouteGeoJSON(routeToGeoJSON(orderedLocations));
    } finally {
      clearInterval(advance);
      setOptimising(false);
      setOptProgress(0);
    }
  }

  function clearOptimisation() {
    setOptimisedRoute(null);
    setRouteGeoJSON(null);
  }

  async function handleApplyItinerary(itinerary) {
    const prev = trip;
    if (!prev?.id) throw new Error('Trip not loaded');
    const existingDays = (prev.trip_days ?? []).slice().sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
    const existingNumbers = new Set(existingDays.map((d) => d.day_number));
    const toInsert = (itinerary.days || []).filter((d) => !existingNumbers.has(d.day_number)).map((d) => ({
      day_number: d.day_number ?? 0,
      title: d.theme || `Day ${d.day_number}`,
    }));
    if (toInsert.length > 0 && isOnline()) {
      await insertTripDays(prev.id, toInsert);
    }
    let fetched = prev;
    if (isOnline()) {
      const data = await fetchTrip(prev.id);
      if (data) fetched = data;
    }
    const dayIdByNumber = new Map((fetched.trip_days ?? []).map((d) => [d.day_number, d.id]));
    const locations = (itinerary.days || []).flatMap((genDay) =>
      (genDay.locations || []).map((loc, order) => ({
        trip_id: prev.id,
        day_id: dayIdByNumber.get(genDay.day_number),
        name: loc.name || 'Unknown',
        type: loc.type || 'attraction',
        address: loc.address || null,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
        notes: loc.notes || null,
        duration_minutes: loc.duration_minutes ?? 60,
        visit_order: order,
      }))
    ).filter((l) => l.day_id);
    if (locations.length > 0 && isOnline()) {
      await upsertLocations(locations);
    }
    if (Array.isArray(itinerary.recommended_additions) && itinerary.recommended_additions.length > 0 && isOnline()) {
      const sections = { ...(fetched.sections || {}), recommended_additions: itinerary.recommended_additions };
      await updateTrip(prev.id, { sections });
    }
    const updated = isOnline() ? await fetchTrip(prev.id) : { ...fetched, trip_days: fetched.trip_days };
    if (updated) {
      const hasRecs = Array.isArray(itinerary.recommended_additions) && itinerary.recommended_additions.length > 0;
      const finalTrip = hasRecs ? { ...updated, sections: { ...(updated.sections || {}), recommended_additions: itinerary.recommended_additions } } : updated;
      setTrip(finalTrip);
      cacheTrip(finalTrip);
    }
    setShowItineraryGen(false);
  }

  const dayCardRefs = useRef({});

  function toggleDay(dayId) {
    setExpandedDays((prev) => {
      const isOpening = !prev[dayId];
      const next = isOpening ? { [dayId]: true } : { ...prev, [dayId]: false };
      if (isOpening) {
        const day = (trip?.trip_days ?? []).find((d) => d.id === dayId);
        if (day != null) setMapDayFilter(day.day_number ?? null);
        setTimeout(() => {
          const el = dayCardRefs.current[dayId];
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
      }
      return next;
    });
  }

  function handleAddLocation(day) {
    setAddingToDay(day);
    setShowAddModal(true);
  }

  function handleLocationAdded(newLoc) {
    setTrip((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        trip_days: prev.trip_days.map((d) =>
          d.id === newLoc.day_id
            ? { ...d, trip_locations: [...(d.trip_locations ?? []), newLoc] }
            : d
        ),
      };
      cacheTrip(updated); // cache inside updater so we use the freshly-built value
      return updated;
    });
  }

  async function handleDeleteLocation(locId) {
    try {
      if (isOnline()) await deleteLocation(locId);
      setTrip((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          trip_days: prev.trip_days.map((d) => ({
            ...d,
            trip_locations: (d.trip_locations ?? []).filter((l) => l.id !== locId),
          })),
        };
      });
    } catch (e) { console.error(e); }
  }

  async function saveNameEdit() {
    if (!editName.trim()) return setEditing(false);
    try {
      if (isOnline()) await updateTrip(id, { name: editName.trim() });
      setTrip((t) => ({ ...t, name: editName.trim() }));
    } catch (e) { console.error(e); }
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    try {
      if (isOnline()) await deleteTrip(id);
      removeCachedTrip(id);
      router.push('/dashboard');
    } catch (e) { console.error(e); }
  }

  const mapLocations = useMemo(() => {
    if (mapDayFilter == null) return [];
    const base = optimisedRoute?.locations ?? allLocations;
    return base.filter((l) => (l._day_number ?? l.day_number) === mapDayFilter);
  }, [mapDayFilter, optimisedRoute?.locations, allLocations]);

  /* ── Loading ──────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-atlas-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-atlas-text-muted text-sm">Loading your trip…</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-4xl mb-4">🔍</p>
          <h1 className="text-xl font-bold text-white mb-2">Trip not found</h1>
          <p className="text-atlas-text-muted text-sm mb-6">
            {offlineMode ? 'This trip is not in your offline cache.' : 'This trip does not exist or was deleted.'}
          </p>
          <Link href="/dashboard" className="btn-glow px-6 py-2.5"><span>Back to Dashboard</span></Link>
        </div>
      </div>
    );
  }

  const days = trip.trip_days ?? [];

  return (
    <>
      <Head>
        <title>{trip.name} — Atlasync</title>
      </Head>

      <div className="min-h-screen pb-28 lg:pb-20">

        {/* ── Sticky sub-header ────────────────────────────────── */}
        <div className="border-b border-atlas-border bg-atlas-bg/80 backdrop-blur-glass sticky top-16 z-30">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">

            <Link href="/dashboard" className="p-2 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0">
              <BackIcon />
            </Link>

            {/* Trip name (inline edit) */}
            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={saveNameEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  saveNameEdit();
                    if (e.key === 'Escape') { setEditing(false); setEditName(trip.name); }
                  }}
                  className="atlas-input text-base font-bold py-1 w-full max-w-xs"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="text-base font-bold text-white hover:text-gradient-blue transition-all text-left truncate max-w-[260px] block"
                  title="Click to rename"
                >
                  {trip.name}
                </button>
              )}

              <div className="flex items-center gap-3 text-xs text-atlas-text-muted mt-0.5">
                {offlineMode && <span className="badge badge-cyan">Offline</span>}
                {trip.start_date && (
                  <span>{new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                )}
                {allLocations.length > 0 && (
                  <span>{allLocations.length} location{allLocations.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            {/* Header action buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {allLocations.length >= 2 && (
                <button
                  onClick={optimisedRoute ? clearOptimisation : handleOptimise}
                  disabled={optimising}
                  className={`hidden sm:flex items-center gap-1.5 btn-ghost text-xs py-1.5 px-3 ${
                    optimisedRoute ? 'border-emerald-500/30 text-emerald-400' : ''
                  }`}
                >
                  <RouteIcon />
                  <span>{optimising ? 'Optimising…' : optimisedRoute ? 'Clear' : 'Optimise'}</span>
                </button>
              )}

              {/* Mobile optimize icon-only */}
              {allLocations.length >= 2 && (
                <button
                  onClick={optimisedRoute ? clearOptimisation : handleOptimise}
                  disabled={optimising}
                  className={`sm:hidden p-2 rounded-xl transition-all ${
                    optimisedRoute
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-atlas-text-muted hover:text-white hover:bg-white/[0.06]'
                  }`}
                  title={optimisedRoute ? 'Clear route' : 'Optimise route'}
                >
                  <RouteIcon />
                </button>
              )}

              <button
                onClick={() => setShowAI((v) => !v)}
                className={`p-2 rounded-xl transition-all ${
                  showAI
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-atlas-text-muted hover:text-white hover:bg-white/[0.06]'
                }`}
                title="AI Assistant"
              >
                <SparkleIcon />
              </button>

              <button
                onClick={handleDelete}
                className="p-2 rounded-xl text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Delete trip"
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          {/* Optimising progress bar */}
          {optimising && (
            <div className="max-w-7xl mx-auto px-4 pb-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-atlas-text-muted">Computing optimal route…</span>
                <div className="flex-1">
                  <OptimiseProgress progress={optProgress} />
                </div>
              </div>
            </div>
          )}

          {/* Optimised route success banner */}
          {optimisedRoute && !optimising && (
            <div
              className="max-w-7xl mx-auto px-4 pb-2"
              style={{ animation: 'slide-in-bottom 0.3s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
            >
              <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Route optimised — {optimisedRoute.totalDistanceKm} km total. Visit stops in order for the shortest path.
              </div>
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left: Day cards ─────────────────────────────── */}
            <div className="lg:w-[420px] xl:w-[460px] flex-shrink-0 space-y-4">
              {days.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center"
                  style={{ animation: 'fade-in 0.5s both' }}>
                  <p className="text-4xl mb-3">📅</p>
                  <p className="text-white font-semibold mb-1">No days planned yet</p>
                  <p className="text-atlas-text-muted text-sm">Add days via the API or import from Google Maps.</p>
                </div>
              ) : (
                daysSorted.map((day, i) => (
                    <div
                      key={day.id}
                      ref={(el) => { dayCardRefs.current[day.id] = el; }}
                      style={{ animation: `slide-up 0.4s ${i * 80}ms both` }}
                    >
                      <TripDayCard
                        day={day}
                        isExpanded={expandedDays[day.id] === true}
                        onToggle={toggleDay}
                        onLocationClick={(loc) => setActiveLocId(loc.id === activeLocId ? null : loc.id)}
                        onDeleteLocation={handleDeleteLocation}
                        onAddLocation={handleAddLocation}
                        activeLocationId={activeLocId}
                      />
                    </div>
                  ))
              )}
            </div>

            {/* ── Right: Map ──────────────────────────────────── */}
            <div className="relative flex-1 min-h-[500px] lg:min-h-0 lg:h-[calc(100vh-160px)] lg:sticky lg:top-[130px]">
              {daysSorted.length > 0 && (
                <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-1.5">
                  {daysSorted.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setMapDayFilter(d.day_number ?? null);
                        setExpandedDays({ [d.id]: true });
                        setTimeout(() => {
                          const el = dayCardRefs.current[d.id];
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 80);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        mapDayFilter === (d.day_number ?? null)
                          ? 'bg-atlas-blue/90 text-white shadow-md'
                          : 'glass text-atlas-text-secondary hover:text-white hover:bg-white/10'
                      }`}
                    >
                      Day {d.day_number ?? '?'}
                    </button>
                  ))}
                </div>
              )}
              <Map
                locations={mapLocations}
                routeGeoJSON={routeGeoJSON}
                activeId={activeLocId}
                onMarkerClick={(loc) => {
                  setActiveLocId(loc.id === activeLocId ? null : loc.id);
                  const dayNum = loc._day_number ?? loc.day_number;
                  if (dayNum != null) setMapDayFilter(dayNum);
                }}
                className="w-full h-full"
                initialCenter={
                  allLocations[0]
                    ? [allLocations[0].lng, allLocations[0].lat]
                    : [-74.006, 40.7128]
                }
                initialZoom={allLocations.length > 0 ? 11 : 2}
              />

              {/* Location count overlay */}
              {mapLocations.length > 0 && (
                <div className="absolute top-4 left-4 glass px-3 py-1.5 rounded-xl text-xs text-atlas-text-secondary pointer-events-none"
                  style={{ animation: 'fade-in 0.5s 300ms both' }}>
                  {mapLocations.length} location{mapLocations.length !== 1 ? 's' : ''}
                  {optimisedRoute && <span className="text-emerald-400 ml-1.5">· optimised</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── AI Chat — floating fixed panel ───────────────────── */}
        {showAI && (
          <AIChat
            enabled={true}
            floating={true}
            tripName={trip.name}
            cityHint={trip.destinations?.[0]}
            onClose={() => setShowAI(false)}
          />
        )}

        {/* ── Mobile FAB — Add Stop ─────────────────────────────── */}
        {daysSorted.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden">
            <button
              onClick={() => {
                const day = daysSorted.find((d) => (d.day_number ?? null) === mapDayFilter) || daysSorted[0];
                handleAddLocation(day);
              }}
              className="btn-glow px-6 py-3 shadow-glow text-sm flex items-center gap-2"
              style={{ animation: 'slide-in-bottom 0.4s 200ms cubic-bezier(0.34,1.56,0.64,1) both' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Stop
            </button>
          </div>
        )}
      </div>

      {/* Add location modal */}
      {showAddModal && daysSorted.length > 0 && (
        <AddLocationModal
          tripId={trip.id}
          dayId={addingToDay?.id ?? (daysSorted.find((d) => (d.day_number ?? null) === mapDayFilter) || daysSorted[0])?.id}
          days={daysSorted}
          onClose={() => { setShowAddModal(false); setAddingToDay(null); }}
          onAdded={handleLocationAdded}
        />
      )}
    </>
  );
}

/* ── Micro icons ─────────────────────────────────────────────────────── */
function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 1l1.5 4.5H16l-3.75 2.75 1.5 4.5L10 10.25 6.25 12.75l1.5-4.5L4 5.5h4.5L10 1z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  );
}
