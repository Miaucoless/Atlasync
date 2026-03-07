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
  supabase, fetchTrip, updateTrip, deleteTrip, upsertLocations, deleteLocation, deleteLocationsByDayIds, insertTripDays,
} from '../../utils/supabaseClient';
import {
  optimizeRoute, routeToGeoJSON,
} from '../../utils/routeOptimizer';
import { getCachedTrip, cacheTrip, removeCachedTrip, isOnline } from '../../utils/offlineCache';

const MapView = dynamic(() => import('../../components/Map'), { ssr: false });

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
const INTEREST_OPTIONS = ['Culture', 'Food & drink', 'Nature', 'Photography', 'Nightlife', 'History', 'Shopping', 'Adventure', 'Relaxation'];
const PACE_OPTIONS = [
  { value: 'relaxed', label: 'Relaxed', desc: '~3 stops/day' },
  { value: 'balanced', label: 'Balanced', desc: '~4 stops/day' },
  { value: 'packed', label: 'Packed', desc: '~6 stops/day' },
];

function AIItineraryModal({ trip, onClose, onApply }) {
  const [destination, setDestination] = useState('');
  const [numDays, setNumDays] = useState(3);
  const [pace, setPace] = useState('balanced');
  const [startDate, setStartDate] = useState('');
  const [interests, setInterests] = useState([]);
  const [userIdeas, setUserIdeas] = useState('');
  const [mapsListUrl, setMapsListUrl] = useState('');
  const [placesFromLink, setPlacesFromLink] = useState([]);
  const [loadingLink, setLoadingLink] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [pastedPlaces, setPastedPlaces] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (trip?.name) setDestination(trip.name);
    if (trip?.destinations?.[0]) setDestination((d) => d || trip.destinations[0]);
  }, [trip?.name, trip?.destinations]);

  function toggleInterest(tag) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleLoadMapsList() {
    const url = mapsListUrl.trim();
    if (!url) return setLinkError('Paste a Google Maps list or place link first.');
    setLoadingLink(true);
    setLinkError(null);
    setPlacesFromLink([]);
    try {
      const res = await fetch('/api/places/parse-google-maps-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) {
        setLinkError(data.error);
        return;
      }
      const list = Array.isArray(data.places) ? data.places : [];
      setPlacesFromLink(list);
      if (list.length === 0) setLinkError('No places found. Paste place names below (one per line) instead.');
    } catch (err) {
      setLinkError('Could not load that link. Try pasting place names below.');
    } finally {
      setLoadingLink(false);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!destination?.trim()) return setError('Destination is required.');
    setGenerating(true);
    setGenProgress(0);
    setError(null);
    setResult(null);
    const steps = [8, 18, 28, 40, 52, 65, 78, 88];
    let si = 0;
    const progressInterval = setInterval(() => {
      if (si < steps.length) setGenProgress(steps[si++]);
      else clearInterval(progressInterval);
    }, 800);
    const existingPlacesWithCoords = placesFromLink.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ name: p.name || 'Place', lat: p.lat, lng: p.lng }));
    const existingLocationsStr = pastedPlaces.trim()
      ? pastedPlaces.trim().split(/\n+/).map((s) => s.trim()).filter(Boolean).join('\n')
      : undefined;
    try {
      const res = await fetch('/api/ai/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim(),
          numDays: Math.max(1, Math.min(14, Number(numDays) || 3)),
          pace: pace || 'balanced',
          interests: interests.length ? interests : undefined,
          startDate: startDate || undefined,
          userIdeas: userIdeas.trim() || undefined,
          existingLocations: existingLocationsStr,
          existingPlacesWithCoords: existingPlacesWithCoords.length > 0 ? existingPlacesWithCoords : undefined,
        }),
      });
      const data = await res.json();
      clearInterval(progressInterval);
      setGenProgress(100);
      if (!res.ok) throw new Error(data.error || 'Failed to generate itinerary');
      if (!Array.isArray(data?.days)) throw new Error('Invalid response from AI');
      setResult(data);
    } catch (err) {
      clearInterval(progressInterval);
      setGenProgress(0);
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

  const totalStops = result?.days?.reduce((n, d) => n + (d.locations?.length ?? 0), 0) ?? 0;
  const hasRecs = Array.isArray(result?.recommended_additions) && result.recommended_additions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl border border-white/[0.08] shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(8,12,24,0.98) 100%)',
          animation: 'slide-up 0.3s ease both',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10">
              <SparkleIcon />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">AI Itinerary</h2>
              <p className="text-xs text-slate-400">Generate a day-by-day plan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {generating ? (
            <div className="p-5 flex flex-col items-center justify-center min-h-[280px]">
              <p className="text-sm font-medium text-slate-300 mb-4">Generating your itinerary…</p>
              <div className="w-full max-w-xs h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-3">{genProgress}%</p>
            </div>
          ) : !result ? (
            <form onSubmit={handleGenerate} className="p-5 space-y-5">
              {/* Trip basics */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Trip basics</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Destination</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="e.g. Lisbon, Portugal"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Number of days</label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={numDays}
                        onChange={(e) => setNumDays(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Start date (optional)</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Pace */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pace</h3>
                <div className="grid grid-cols-3 gap-2">
                  {PACE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPace(opt.value)}
                      className={`px-3 py-2.5 rounded-xl text-left border transition-all ${
                        pace === opt.value
                          ? 'bg-blue-500/15 border-blue-500/40 text-white'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-medium">{opt.label}</span>
                      <span className="block text-[10px] opacity-80">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Interests */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Interests (optional)</h3>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        interests.includes(tag)
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/[0.06] text-slate-400 border border-transparent hover:border-white/10 hover:text-slate-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </section>

              {/* Preferences */}
              <section>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Preferences (optional)</label>
                <textarea
                  value={userIdeas}
                  onChange={(e) => setUserIdeas(e.target.value)}
                  placeholder="e.g. focus on food, avoid crowds, kid-friendly..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none resize-none transition-all"
                />
              </section>

              {/* Places from Google Maps */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Places to include</h3>
                <p className="text-xs text-slate-500">Paste a Google Maps list or place link; we’ll include the best fits in your itinerary and suggest the rest on the map.</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={mapsListUrl}
                    onChange={(e) => { setMapsListUrl(e.target.value); setLinkError(null); }}
                    placeholder="https://maps.google.com/... or maps.app.goo.gl/..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLoadMapsList}
                    disabled={loadingLink || !mapsListUrl.trim()}
                    className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white/[0.08] border border-white/[0.1] text-slate-300 hover:bg-white/[0.12] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                  >
                    {loadingLink ? 'Loading…' : 'Load list'}
                  </button>
                </div>
                {linkError && <p className="text-xs text-amber-400 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">{linkError}</p>}
                {placesFromLink.length > 0 && (
                  <p className="text-xs text-emerald-400/90">{placesFromLink.length} place{placesFromLink.length !== 1 ? 's' : ''} loaded. The AI will include the best fits and add the rest as recommended stops.</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Or paste place names (one per line)</label>
                  <textarea
                    value={pastedPlaces}
                    onChange={(e) => setPastedPlaces(e.target.value)}
                    placeholder={'Eiffel Tower\nLouvre Museum\nCafé de Flore'}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 outline-none resize-none"
                  />
                </div>
              </section>

              {error && (
                <p className="text-xs text-red-400 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">{error}</p>
              )}
              <button type="submit" disabled={generating} className="btn-glow w-full py-3.5 text-sm">
                <span>{generating ? 'Generating your itinerary…' : 'Generate itinerary'}</span>
              </button>
            </form>
          ) : (
            <div className="p-5 space-y-4">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
                <p className="text-sm font-medium text-white mb-1">{result.days.length} days · {totalStops} stops</p>
                {hasRecs && (
                  <p className="text-xs text-slate-400">{result.recommended_additions.length} extra place{result.recommended_additions.length !== 1 ? 's' : ''} saved as recommended additions on your map.</p>
                )}
              </div>
              <p className="text-xs text-slate-500">Review the full itinerary below before adding to your trip.</p>
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {result.days.map((d) => (
                  <div key={d.day_number} className="rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                      <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-semibold flex items-center justify-center">Day {d.day_number}</span>
                      <span className="text-sm font-medium text-white">{d.theme || `Day ${d.day_number}`}</span>
                    </div>
                    <ul className="divide-y divide-white/[0.06]">
                      {(d.locations || []).map((loc, idx) => (
                        <li key={idx} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-white">{loc.name || 'Unnamed'}</span>
                            <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-slate-500 bg-white/[0.06] px-2 py-0.5 rounded">{loc.type || 'attraction'}</span>
                          </div>
                          {loc.address && <p className="text-xs text-slate-500 mt-0.5">{loc.address}</p>}
                          {loc.notes && <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{loc.notes}</p>}
                          <p className="text-xs text-slate-500 mt-1">{loc.duration_minutes ?? 60} min</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {error && (
                <p className="text-xs text-red-400 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setResult(null); setError(null); }} className="btn-ghost flex-1">
                  Back
                </button>
                <button type="button" onClick={handleApply} disabled={applying} className="btn-glow flex-1">
                  <span>{applying ? 'Applying…' : 'Apply to trip'}</span>
                </button>
              </div>
            </div>
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
      .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number' && Number.isFinite(l.lat) && Number.isFinite(l.lng) && !(l.lat === 0 && l.lng === 0));
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
    const norm = (n) => (n === undefined || n === null ? null : Number(n));
    const existingNumbers = new Set(existingDays.map((d) => norm(d.day_number)).filter((n) => n != null));
    const toInsert = (itinerary.days || []).filter((d) => !existingNumbers.has(norm(d.day_number))).map((d) => ({
      day_number: norm(d.day_number) ?? 1,
      title: d.theme || `Day ${d.day_number}`,
    }));

    if (isOnline()) {
      if (toInsert.length > 0) await insertTripDays(prev.id, toInsert);
      const fetched = await fetchTrip(prev.id);
      if (!fetched) throw new Error('Could not load trip after adding days');
      const dayIdByNumber = new Map((fetched.trip_days ?? []).map((d) => [norm(d.day_number), d.id]));
      const dayIdsToFill = (itinerary.days || []).map((d) => dayIdByNumber.get(norm(d.day_number))).filter(Boolean);
      if (dayIdsToFill.length > 0) await deleteLocationsByDayIds(dayIdsToFill);
      const locations = (itinerary.days || []).flatMap((genDay) =>
        (genDay.locations || []).map((loc, order) => ({
          trip_id: prev.id,
          day_id: dayIdByNumber.get(norm(genDay.day_number)),
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
      if (locations.length > 0) await upsertLocations(locations);
      if (Array.isArray(itinerary.recommended_additions) && itinerary.recommended_additions.length > 0) {
        await updateTrip(prev.id, { sections: { ...(prev.sections || {}), recommended_additions: itinerary.recommended_additions } });
      }
      const updated = await fetchTrip(prev.id);
      if (updated) {
        const hasRecs = Array.isArray(itinerary.recommended_additions) && itinerary.recommended_additions.length > 0;
        const finalTrip = hasRecs ? { ...updated, sections: { ...(updated.sections || {}), recommended_additions: itinerary.recommended_additions } } : updated;
        setTrip(finalTrip);
        cacheTrip(finalTrip);
      }
    } else {
      const ts = Date.now();
      const newDays = toInsert.map((d, i) => ({
        id: `local-day-${ts}-${d.day_number}`,
        trip_id: prev.id,
        day_number: d.day_number,
        title: d.title || `Day ${d.day_number}`,
        trip_locations: [],
      }));
      const mergedDays = [...existingDays, ...newDays].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
      const dayIdByNumber = new Map(mergedDays.map((d) => [norm(d.day_number), d.id]));
      const locsByDay = {};
      (itinerary.days || []).forEach((genDay) => {
        const dayId = dayIdByNumber.get(norm(genDay.day_number));
        if (!dayId) return;
        const dayLocs = (genDay.locations || []).map((loc, order) => ({
          id: `local-${ts}-${genDay.day_number}-${order}`,
          trip_id: prev.id,
          day_id: dayId,
          name: loc.name || 'Unknown',
          type: loc.type || 'attraction',
          address: loc.address || null,
          lat: loc.lat ?? null,
          lng: loc.lng ?? null,
          notes: loc.notes || null,
          duration_minutes: loc.duration_minutes ?? 60,
          visit_order: order,
        }));
        locsByDay[dayId] = dayLocs;
      });
      const updatedDays = mergedDays.map((d) => ({ ...d, trip_locations: locsByDay[d.id] ?? [] }));
      const finalTrip = {
        ...prev,
        trip_days: updatedDays,
        sections: Array.isArray(itinerary.recommended_additions) && itinerary.recommended_additions.length > 0
          ? { ...(prev.sections || {}), recommended_additions: itinerary.recommended_additions }
          : prev.sections,
      };
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

  async function handleAddLocationFromMap(dayId, location) {
    if (!trip?.id) return;
    const day = (trip.trip_days ?? []).find((d) => d.id === dayId);
    if (!day) return;
    const visit_order = (day.trip_locations ?? []).length;
    const notes = [location.notes, location.description].filter(Boolean).join('\n\n') || null;
    const payload = {
      trip_id: trip.id,
      day_id: dayId,
      name: location.name || 'Place',
      type: location.type || 'attraction',
      address: location.address ?? null,
      lat: location.lat ?? null,
      lng: location.lng ?? null,
      notes,
      duration_minutes: location.duration_minutes ?? 60,
      visit_order,
    };
    try {
      if (isOnline()) {
        const [inserted] = await upsertLocations([payload]);
        if (inserted) handleLocationAdded(inserted);
      } else {
        const tempId = `local-${Date.now()}-${dayId}`;
        handleLocationAdded({ ...payload, id: tempId });
      }
    } catch (e) {
      console.error(e);
    }
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

  const mapInitialCenter = useMemo(() => {
    const first = allLocations[0];
    if (first && Number.isFinite(first.lat) && Number.isFinite(first.lng) && !(first.lat === 0 && first.lng === 0)) {
      return [first.lng, first.lat];
    }
    return [-74.006, 40.7128];
  }, [allLocations]);

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
                  <p className="text-atlas-text-muted text-sm mb-4">Add days via the API or import from Google Maps.</p>
                  <button
                    type="button"
                    onClick={() => setShowItineraryGen(true)}
                    className="btn-glow px-5 py-2.5 text-sm flex items-center gap-2 mx-auto"
                  >
                    <span className="opacity-90">✨</span>
                    Generate with AI
                  </button>
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
              <MapView
                locations={mapLocations}
                routeGeoJSON={routeGeoJSON}
                activeId={activeLocId}
                onMarkerClick={(loc) => {
                  setActiveLocId(loc.id === activeLocId ? null : loc.id);
                  const dayNum = loc._day_number ?? loc.day_number;
                  if (dayNum != null) setMapDayFilter(dayNum);
                }}
                onMapClick={() => setActiveLocId(null)}
                days={daysSorted}
                onAddLocationToDay={handleAddLocationFromMap}
                className="w-full h-full"
                initialCenter={mapInitialCenter}
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

      {showItineraryGen && trip && (
        <AIItineraryModal
          trip={trip}
          onClose={() => setShowItineraryGen(false)}
          onApply={handleApplyItinerary}
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
