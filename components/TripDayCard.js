/**
 * TripDayCard.js
 * Expandable day-of-trip card showing all locations with type icons,
 * order numbers, estimated travel times, and inline edit/delete.
 */

import { useState } from 'react';
import { estimateTravelTime, haversineDistance } from '../utils/routeOptimizer';

/* Location type config */
const TYPE_CONFIG = {
  attraction: { label: 'Attraction', color: 'badge-blue',   icon: '🏛️'  },
  restaurant:  { label: 'Restaurant',  color: 'badge-cyan',   icon: '🍽️' },
  hotel:       { label: 'Hotel',       color: 'badge-purple', icon: '🏨' },
  transport:   { label: 'Transport',   color: 'badge-cyan',   icon: '✈️' },
  activity:    { label: 'Activity',    color: 'badge-green',  icon: '🎯' },
};

export default function TripDayCard({
  day,
  isExpanded      = true,
  onToggle        = () => {},
  onLocationClick = () => {},
  onDeleteLocation = () => {},
  onAddLocation   = () => {},
  activeLocationId = null,
  showAddButton   = true,
  className       = '',
}) {
  const locations = day.trip_locations ?? [];
  const sorted    = [...locations].sort((a, b) => (a.visit_order ?? 0) - (b.visit_order ?? 0));

  function getDistanceToNext(idx) {
    if (idx >= sorted.length - 1) return null;
    const a = sorted[idx];
    const b = sorted[idx + 1];
    if (typeof a.lat !== 'number' || typeof b.lat !== 'number') return null;
    return haversineDistance(a.lat, a.lng, b.lat, b.lng);
  }

  return (
    <div className={`glass rounded-2xl overflow-hidden transition-all duration-300 ${className}`}>
      {/* Day header */}
      <button
        onClick={() => onToggle(day.id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-3">
          {/* Day number bubble */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-atlas-blue to-atlas-cyan flex items-center justify-center text-white font-bold text-sm shadow-glow-sm flex-shrink-0">
            {day.day_number}
          </div>
          <div className="text-left">
            <div className="font-semibold text-white text-sm leading-tight">
              {day.title || `Day ${day.day_number}`}
            </div>
            {day.date && (
              <div className="text-xs text-atlas-text-muted mt-0.5">
                {new Date(day.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {locations.length > 0 && (
            <span className="text-xs text-atlas-text-muted">
              {locations.length} stop{locations.length !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronIcon open={isExpanded} />
        </div>
      </button>

      {/* Expandable locations list */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-0">
          {sorted.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-atlas-text-muted text-sm">No stops yet for this day</p>
              {showAddButton && (
                <button
                  onClick={() => onAddLocation(day)}
                  className="mt-3 btn-ghost text-xs py-2"
                >
                  + Add first stop
                </button>
              )}
            </div>
          ) : (
            sorted.map((loc, idx) => {
              const cfg       = TYPE_CONFIG[loc.type] || TYPE_CONFIG.attraction;
              const distNext  = getDistanceToNext(idx);
              const isActive  = loc.id === activeLocationId;

              return (
                <div key={loc.id}>
                  {/* Location row */}
                  <div
                    onClick={() => onLocationClick(loc)}
                    className={`
                      relative flex items-start gap-3 py-3 pl-3 pr-3 rounded-xl cursor-pointer
                      transition-all duration-200 group/loc
                      ${isActive
                        ? 'bg-atlas-blue/10 border border-atlas-blue/25'
                        : 'hover:bg-white/[0.04] border border-transparent'}
                    `}
                  >
                    {/* Order number */}
                    <div
                      className={`
                        w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        transition-all duration-200
                        ${isActive
                          ? 'bg-atlas-blue text-white shadow-glow-sm'
                          : 'bg-white/[0.08] text-atlas-text-secondary'}
                      `}
                    >
                      {idx + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-white leading-tight line-clamp-1">
                            {cfg.icon} {loc.name}
                          </span>
                          {loc.address && (
                            <p className="text-xs text-atlas-text-muted mt-0.5 line-clamp-1">
                              {loc.address}
                            </p>
                          )}
                        </div>
                        <span className={`badge ${cfg.color} text-[10px] flex-shrink-0`}>
                          {cfg.label}
                        </span>
                      </div>

                      {loc.notes && (
                        <p className="text-xs text-atlas-text-secondary mt-1 line-clamp-2 italic">
                          "{loc.notes}"
                        </p>
                      )}

                      {loc.duration_minutes && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-atlas-text-muted mt-1.5">
                          <ClockIcon /> {loc.duration_minutes} min
                        </span>
                      )}
                    </div>

                    {/* Delete button (appears on hover) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteLocation(loc.id); }}
                      className="p-1 rounded-lg opacity-0 group-hover/loc:opacity-100 text-atlas-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
                      title="Remove stop"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  {/* Travel time connector between stops */}
                  {distNext !== null && (
                    <div className="flex items-center gap-2 ml-3 my-0.5">
                      <div className="w-7 flex justify-center">
                        <div className="w-px h-6 bg-white/10" />
                      </div>
                      <span className="text-[10px] text-atlas-text-muted flex items-center gap-1">
                        <CarIcon />
                        {estimateTravelTime(distNext, 'driving')} drive
                        <span className="text-atlas-text-muted/50">·</span>
                        {distNext.toFixed(1)} km
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add stop button */}
          {showAddButton && sorted.length > 0 && (
            <button
              onClick={() => onAddLocation(day)}
              className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-white/10 text-xs text-atlas-text-muted hover:text-white hover:border-atlas-blue/40 hover:bg-atlas-blue/5 transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <PlusIcon /> Add stop to Day {day.day_number}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Micro icons ─────────────────────────────────────────────────── */

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-atlas-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 17H3v-5l2-5h14l2 5v5h-2m-9 0h4" />
      <circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6m4-6v6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
