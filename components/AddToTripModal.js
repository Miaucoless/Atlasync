/**
 * AddToTripModal.js — Add Any Location to a Trip
 *
 * When a user clicks "Add to Trip" on any location card across the app,
 * this modal lets them choose a trip, pick a day, and add optional notes.
 * Saves entirely into the offline cache (works without internet).
 *
 * Props:
 *   location   { name, type, address, lat, lng, notes, duration_minutes }
 *   onClose    () => void
 *   onAdded    (tripId, dayId, location) => void  — fires on success
 */

import { useState, useEffect } from 'react';
import { getCachedTrips, cacheTrip } from '../utils/offlineCache';

export default function AddToTripModal({ location, onClose, onAdded }) {
  const [trips,       setTrips]       = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [notes,        setNotes]        = useState(location?.notes || '');
  const [saving,       setSaving]       = useState(false);
  const [success,      setSuccess]      = useState(false);

  /* Load trips from cache on mount */
  useEffect(() => {
    const cached = getCachedTrips();
    const list   = cached?.trips ?? [];
    setTrips(list);
    if (list.length === 1) setSelectedTrip(list[0]);
  }, []);

  /* Auto-select first day when trip changes */
  useEffect(() => {
    if (!selectedTrip) { setSelectedDay(null); return; }
    const days = selectedTrip.trip_days ?? [];
    const sorted = [...days].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
    setSelectedDay(sorted[0] ?? null);
  }, [selectedTrip]);

  /* Close on Escape */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  function handleSave() {
    if (!selectedTrip || !selectedDay) return;
    setSaving(true);

    /* Build the new location object */
    const newLoc = {
      id:               `local-${Date.now()}`,
      trip_id:          selectedTrip.id,
      day_id:           selectedDay.id,
      name:             location.name,
      type:             location.type || 'attraction',
      address:          location.address || null,
      lat:              typeof location.lat === 'number' ? location.lat : null,
      lng:              typeof location.lng === 'number' ? location.lng : null,
      notes:            notes.trim() || null,
      duration_minutes: location.duration_minutes || 60,
      visit_order:      (selectedDay.trip_locations?.length ?? 0),
    };

    /* Merge into the cached trip */
    const updatedTrip = {
      ...selectedTrip,
      trip_days: (selectedTrip.trip_days ?? []).map((d) =>
        d.id === selectedDay.id
          ? { ...d, trip_locations: [...(d.trip_locations ?? []), newLoc] }
          : d
      ),
    };
    cacheTrip(updatedTrip);

    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      onAdded?.(selectedTrip.id, selectedDay.id, newLoc);
      setTimeout(onClose, 900);
    }, 400);
  }

  const days = selectedTrip
    ? [...(selectedTrip.trip_days ?? [])].sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
    : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative glass-heavy rounded-2xl w-full max-w-md p-6 shadow-card"
        style={{ animation: 'slide-up 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">Add to Trip</h2>
            <p className="text-xs text-atlas-text-muted mt-0.5 line-clamp-1">{location?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <XIcon />
          </button>
        </div>

        {success ? (
          /* ── Success state ──────────────────────────────── */
          <div className="text-center py-6" style={{ animation: 'scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
              <CheckIcon />
            </div>
            <p className="text-white font-semibold">Added to {selectedTrip?.name}!</p>
            <p className="text-xs text-atlas-text-muted mt-1">Day {selectedDay?.day_number}</p>
          </div>
        ) : trips.length === 0 ? (
          /* ── No trips state ─────────────────────────────── */
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-white font-semibold mb-1">No trips yet</p>
            <p className="text-xs text-atlas-text-secondary mb-5">
              Create a trip first from the Dashboard, then you can add locations to it.
            </p>
            <button onClick={onClose} className="btn-glow px-6 py-2 text-sm">
              <span>Go to Dashboard</span>
            </button>
          </div>
        ) : (
          <>
            {/* ── Select trip ─────────────────────────────── */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-atlas-text-secondary mb-2 uppercase tracking-wider">
                Choose Trip
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {trips.map((trip) => (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTrip(trip)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                      selectedTrip?.id === trip.id
                        ? 'border-atlas-blue/40 bg-atlas-blue/10 text-white'
                        : 'border-white/[0.06] glass text-atlas-text-secondary hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight line-clamp-1">{trip.name}</p>
                        {trip.destinations?.length > 0 && (
                          <p className="text-[11px] text-atlas-text-muted mt-0.5">
                            {trip.destinations.slice(0, 3).join(', ')}
                          </p>
                        )}
                      </div>
                      {selectedTrip?.id === trip.id && (
                        <div className="w-5 h-5 rounded-full bg-atlas-blue flex items-center justify-center flex-shrink-0 ml-2">
                          <CheckIcon small />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Select day ──────────────────────────────── */}
            {selectedTrip && (
              <div className="mb-4" style={{ animation: 'slide-up 0.25s both' }}>
                <label className="block text-xs font-semibold text-atlas-text-secondary mb-2 uppercase tracking-wider">
                  Choose Day
                </label>
                {days.length === 0 ? (
                  <p className="text-xs text-atlas-text-muted px-3 py-2 glass rounded-xl">
                    This trip has no days yet. You can still add locations — they'll appear when days are created.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {days.map((day) => (
                      <button
                        key={day.id}
                        onClick={() => setSelectedDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                          selectedDay?.id === day.id
                            ? 'bg-atlas-blue text-white shadow-glow-sm'
                            : 'glass text-atlas-text-secondary hover:text-white'
                        }`}
                      >
                        Day {day.day_number}
                        {day.title && day.title !== `Day ${day.day_number}` && (
                          <span className="ml-1 opacity-70">· {day.title.slice(0, 12)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Notes ───────────────────────────────────── */}
            {selectedTrip && (
              <div className="mb-5" style={{ animation: 'slide-up 0.3s 50ms both' }}>
                <label className="block text-xs font-semibold text-atlas-text-secondary mb-2 uppercase tracking-wider">
                  Notes <span className="text-atlas-text-muted normal-case">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Booking reference, opening hours, reminders…"
                  rows={2}
                  className="atlas-input resize-none text-xs"
                />
              </div>
            )}

            {/* ── Actions ─────────────────────────────────── */}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2.5">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedTrip}
                className="btn-glow flex-1 text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{saving ? 'Adding…' : 'Add to Trip'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function CheckIcon({ small }) {
  return (
    <svg className={small ? 'w-3 h-3' : 'w-6 h-6'} fill="none" viewBox="0 0 24 24" stroke={small ? 'white' : '#10b981'} strokeWidth={small ? 3 : 2.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
