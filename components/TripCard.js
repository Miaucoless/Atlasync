/**
 * TripCard.js — Enhanced
 *
 * Enhancements:
 *  ✦ 3-D tilt effect — card tilts toward the cursor using mousemove + CSS transform
 *  ✦ Shine sweep — highlight stripe glides across the card on hover
 *  ✦ Parallax cover image — image shifts slightly as cursor moves
 *  ✦ Entrance animation — card slides up on mount (supports stagger via animationDelay prop)
 *  ✦ Smooth delete confirmation — inline confirm row animates in
 */

import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';

const GRADIENTS = [
  'from-blue-600 to-cyan-500',
  'from-purple-600 to-pink-500',
  'from-emerald-600 to-teal-500',
  'from-orange-600 to-rose-500',
  'from-indigo-600 to-blue-500',
  'from-fuchsia-600 to-violet-500',
];

function formatDateRange(start, end) {
  if (!start) return null;
  const opts  = { month: 'short', day: 'numeric' };
  const optsY = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  if (!e) return s.toLocaleDateString('en-US', optsY);
  if (s.getFullYear() === e.getFullYear())
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', optsY)}`;
  return `${s.toLocaleDateString('en-US', optsY)} – ${e.toLocaleDateString('en-US', optsY)}`;
}

function getTripDuration(start, end) {
  if (!start || !end) return null;
  const diff = Math.round((new Date(end) - new Date(start)) / 86400000);
  return diff > 0 ? `${diff} day${diff !== 1 ? 's' : ''}` : null;
}

export default function TripCard({ trip, onDelete, className = '', animationDelay = 0 }) {
  const cardRef      = useRef(null);
  const imgRef       = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [hovered,    setHovered]    = useState(false);

  const gradientClass =
    GRADIENTS[Math.abs((trip.id?.charCodeAt(0) ?? 97) - 97) % GRADIENTS.length];

  const dateRange     = formatDateRange(trip.start_date, trip.end_date);
  const duration      = getTripDuration(trip.start_date, trip.end_date);
  const locationCount = trip.trip_days?.reduce((n, d) => n + (d.trip_locations?.length ?? 0), 0) ?? 0;

  /* ── 3-D tilt on mousemove ──────────────────────────────────── */
  const onMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect   = card.getBoundingClientRect();
    const cx     = e.clientX - rect.left;
    const cy     = e.clientY - rect.top;
    const xPct   = (cx / rect.width  - 0.5) * 2;  // -1 → +1
    const yPct   = (cy / rect.height - 0.5) * 2;
    const tiltX  = -yPct * 6;   // degrees of X rotation
    const tiltY  =  xPct * 6;
    card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-8px) scale(1.012)`;

    // Parallax image shift (±6 px)
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${-xPct * 6}px, ${-yPct * 6}px) scale(1.05)`;
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = '';
    if (imgRef.current) imgRef.current.style.transform = 'scale(1)';
    setHovered(false);
  }, []);

  const onMouseEnter = useCallback(() => setHovered(true), []);

  /* ── Delete helpers ─────────────────────────────────────────── */
  function handleDeleteClick(e) {
    e.preventDefault(); e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    onDelete?.(trip.id);
    setConfirming(false);
  }
  function cancelDelete(e) {
    e.preventDefault(); e.stopPropagation();
    setConfirming(false);
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`trip-card group ${className}`}
      style={{
        animation:      `slide-up 0.45s cubic-bezier(0.25,0.46,0.45,0.94) ${animationDelay}ms both`,
        transition:     'transform 0.35s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.35s ease, border-color 0.3s ease',
        willChange:     'transform',
        transformStyle: 'preserve-3d',
      }}
    >
      <Link href={`/trips/${trip.id}`} className="block focus:outline-none" tabIndex={0}>

        {/* Cover area */}
        <div className={`relative h-44 bg-gradient-to-br ${gradientClass} overflow-hidden`}>
          {trip.cover_image && (
            <img
              ref={imgRef}
              src={trip.cover_image}
              alt={trip.name}
              className="absolute inset-0 w-full h-full object-cover opacity-70"
              style={{ transition: 'transform 0.15s ease-out' }}
            />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

          {/* Duration badge */}
          {duration && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full glass text-xs font-bold text-white/90 backdrop-blur-sm">
              {duration}
            </div>
          )}

          {/* Destination chips */}
          {trip.destinations?.length > 0 && (
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              {trip.destinations.slice(0, 3).map((dest) => (
                <span
                  key={dest}
                  className="px-2 py-0.5 rounded-full bg-black/40 text-white/85 text-xs font-medium backdrop-blur-sm border border-white/10"
                >
                  {dest}
                </span>
              ))}
              {trip.destinations.length > 3 && (
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-white/60 text-xs">
                  +{trip.destinations.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Hover glow overlay */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.15), transparent 70%)', opacity: hovered ? 1 : 0 }}
          />
        </div>

        {/* Card body */}
        <div className="p-5">
          <h3 className="font-bold text-white text-base leading-tight line-clamp-1 mb-1.5 group-hover:text-gradient-blue transition-all duration-300">
            {trip.name}
          </h3>

          {trip.description && (
            <p className="text-atlas-text-secondary text-xs leading-relaxed line-clamp-2 mb-3">
              {trip.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-atlas-text-muted">
            {dateRange && (
              <span className="flex items-center gap-1">
                <CalendarIcon />
                {dateRange}
              </span>
            )}
            {locationCount > 0 && (
              <span className="flex items-center gap-1">
                <PinIcon />
                {locationCount} stop{locationCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Action row */}
      <div className="flex items-center justify-between px-5 pb-4 pt-0">
        <Link
          href={`/trips/${trip.id}`}
          className="group/link text-xs text-atlas-blue hover:text-blue-300 font-semibold transition-all duration-200 flex items-center gap-1"
        >
          View Itinerary
          <span className="transition-transform duration-200 group-hover/link:translate-x-1 inline-block">
            <ArrowIcon />
          </span>
        </Link>

        {onDelete && (
          confirming ? (
            <div className="flex items-center gap-2 animate-slide-in-right">
              <span className="text-xs text-atlas-text-muted">Delete?</span>
              <button onClick={handleDeleteClick} className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors">Yes</button>
              <button onClick={cancelDelete}      className="text-xs text-atlas-text-muted hover:text-white font-semibold transition-colors">No</button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-lg text-atlas-text-muted hover:text-red-400 hover:bg-red-500/12 transition-all duration-200"
              title="Delete trip"
            >
              <TrashIcon />
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Micro icons ─────────────────────────────────────────────── */
function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function PinIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}
