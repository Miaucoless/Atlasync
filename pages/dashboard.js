/**
 * pages/dashboard.js — Enhanced
 *
 * Enhancements:
 *  ✦ Filter tabs — All / Upcoming / Past / Local
 *  ✦ Staggered card entrance — each card slides up with increasing delay
 *  ✦ Scroll-aware header — compresses and gains blur as user scrolls
 *  ✦ Animated search — debounced input with slide-down reveal
 *  ✦ AI panel — smooth slide-in from the right edge
 *  ✦ Stats bar — animated trip count chip in header
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import TripCard from '../components/TripCard';
import AIChat   from '../components/AIChat';
import {
  supabase, signInWithGoogle, getCurrentUser,
  fetchTrips, createTrip, deleteTrip,
} from '../utils/supabaseClient';
import {
  getCachedTrips, cacheTrips, cacheTrip, removeCachedTrip, isOnline,
} from '../utils/offlineCache';

/* ── Debounce hook ──────────────────────────────────────────────────── */
function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ── Create trip form modal ─────────────────────────────────────────── */
function CreateTripModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name:         '',
    description:  '',
    start_date:   '',
    end_date:     '',
    destinations: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Trip name is required.');
    setSaving(true);
    setError(null);

    const payload = {
      name:        form.name.trim(),
      description: form.description.trim() || null,
      start_date:  form.start_date || null,
      end_date:    form.end_date   || null,
      destinations: form.destinations
        ? form.destinations.split(',').map((d) => d.trim()).filter(Boolean)
        : [],
    };

    try {
      let trip;
      const user = await getCurrentUser();
      if (user && isOnline()) {
        trip = await createTrip(user.id, payload);
      } else {
        trip = { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString(), trip_days: [] };
      }
      cacheTrip(trip);
      onCreated(trip);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create trip.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-heavy rounded-2xl w-full max-w-md p-6 shadow-card"
        style={{ animation: 'slide-up 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">New Trip</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-atlas-text-muted hover:text-white hover:bg-white/[0.06] transition-all">
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-atlas-text-secondary mb-1.5">Trip name *</label>
            <input name="name" value={form.name} onChange={onChange} placeholder="e.g. Tokyo Adventure" className="atlas-input" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-atlas-text-secondary mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={onChange} placeholder="What's this trip about?" rows={2} className="atlas-input resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-atlas-text-secondary mb-1.5">Start date</label>
              <input type="date" name="start_date" value={form.start_date} onChange={onChange} className="atlas-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-atlas-text-secondary mb-1.5">End date</label>
              <input type="date" name="end_date" value={form.end_date} onChange={onChange} className="atlas-input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-atlas-text-secondary mb-1.5">
              Destinations <span className="text-atlas-text-muted">(comma-separated)</span>
            </label>
            <input name="destinations" value={form.destinations} onChange={onChange} placeholder="Tokyo, Kyoto, Osaka" className="atlas-input" />
          </div>

          {error && (
            <p className="text-xs text-red-400 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-glow flex-1">
              <span>{saving ? 'Creating…' : 'Create Trip'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Tab pill component ─────────────────────────────────────────────── */
function TabPill({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
        active
          ? 'bg-atlas-blue text-white shadow-glow-sm'
          : 'text-atlas-text-muted hover:text-white hover:bg-white/[0.06]'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
          active ? 'bg-white/20 text-white' : 'bg-white/[0.08] text-atlas-text-muted'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Dashboard page ─────────────────────────────────────────────────── */
export default function DashboardPage() {
  const router              = useRouter();
  const [user,          setUser]          = useState(null);
  const [trips,         setTrips]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showCreate,    setShowCreate]    = useState(false);
  const [showAIChat,    setShowAIChat]    = useState(false);
  const [searchInput,   setSearchInput]   = useState('');
  const [activeTab,     setActiveTab]     = useState('all');
  const [signingIn,     setSigningIn]     = useState(false);
  const [offlineMode,   setOfflineMode]   = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);

  const searchRef = useRef(null);
  const searchQuery = useDebounce(searchInput, 250);

  /* Scroll-aware header compression */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Focus search input when opened */
  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  /* Load user and trips */
  const loadTrips = useCallback(async (currentUser) => {
    setLoading(true);
    try {
      if (currentUser && isOnline()) {
        const data = await fetchTrips(currentUser.id);
        setTrips(data);
        cacheTrips(data);
      } else {
        const cached = getCachedTrips();
        setTrips(cached?.trips ?? []);
        setOfflineMode(!isOnline());
      }
    } catch {
      const cached = getCachedTrips();
      setTrips(cached?.trips ?? []);
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      loadTrips(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setUser(session?.user ?? null);
        loadTrips(session?.user ?? null);
      }
    );
    return () => subscription.unsubscribe();
  }, [loadTrips]);

  useEffect(() => {
    const goOnline  = () => { setOfflineMode(false); if (user) loadTrips(user); };
    const goOffline = () => setOfflineMode(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [user, loadTrips]);

  async function handleSignIn() {
    setSigningIn(true);
    try { await signInWithGoogle(); }
    catch (e) { console.error(e); }
    finally { setSigningIn(false); }
  }

  async function handleDelete(tripId) {
    try {
      if (user && isOnline()) await deleteTrip(tripId);
      removeCachedTrip(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }

  function handleCreated(trip) {
    setTrips((prev) => [trip, ...prev]);
  }

  /* ── Tab filtering ──────────────────────────────────────────────── */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tabCounts = {
    all:      trips.length,
    upcoming: trips.filter((t) => t.start_date && new Date(t.start_date) >= today).length,
    past:     trips.filter((t) => t.end_date   && new Date(t.end_date)   <  today).length,
    local:    trips.filter((t) => String(t.id).startsWith('local-')).length,
  };

  const tabFiltered = trips.filter((t) => {
    if (activeTab === 'upcoming') return t.start_date && new Date(t.start_date) >= today;
    if (activeTab === 'past')     return t.end_date   && new Date(t.end_date)   <  today;
    if (activeTab === 'local')    return String(t.id).startsWith('local-');
    return true;
  });

  const filtered = tabFiltered.filter((t) =>
    !searchQuery ||
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.destinations?.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const firstName = user?.user_metadata?.name?.split(' ')[0];

  return (
    <>
      <Head>
        <title>Dashboard — Atlasync</title>
      </Head>

      <div className="min-h-screen pb-20">

        {/* ── Scroll-aware sticky subheader ─────────────────────── */}
        <div
          className="sticky top-[60px] z-30 transition-all duration-300"
          style={{
            background:   scrolled ? 'rgba(8,8,20,0.85)' : 'transparent',
            backdropFilter: scrolled ? 'blur(20px)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
            padding:      scrolled ? '10px 16px' : '24px 16px 0',
          }}
        >
          <div className="max-w-7xl mx-auto">

            {/* ── Offline banner ──────────────────────────────────── */}
            {offlineMode && (
              <div className="mb-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-sm"
                style={{ animation: 'slide-up 0.3s both' }}>
                <span className="text-amber-400 text-base">📡</span>
                <span className="text-amber-300 font-medium">Offline mode</span>
                <span className="text-amber-400/70 hidden sm:inline">— Showing cached trips. Changes sync on reconnect.</span>
              </div>
            )}

            <div className={`flex flex-col gap-3 transition-all duration-300 ${scrolled ? '' : 'mb-4'}`}>
              {/* Top row: greeting + actions */}
              <div className="flex items-center justify-between gap-4">
                <div className={`transition-all duration-300 ${scrolled ? 'opacity-0 h-0 overflow-hidden pointer-events-none' : 'opacity-100'}`}>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    {user ? `Welcome back${firstName ? `, ${firstName}` : ''}` : 'Your Trips'}
                    <span className="ml-2 inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>✈️</span>
                  </h1>
                  <p className="text-atlas-text-secondary text-sm mt-0.5">
                    {trips.length > 0
                      ? `${trips.length} trip${trips.length !== 1 ? 's' : ''} planned`
                      : 'Start planning your next adventure'}
                  </p>
                </div>

                {/* Compressed title (visible when scrolled) */}
                <div className={`transition-all duration-300 ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <span className="text-base font-bold text-white">
                    {firstName ? `${firstName}'s Trips` : 'My Trips'}
                    {trips.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-atlas-blue/20 text-atlas-blue text-xs font-semibold">
                        {trips.length}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Search toggle */}
                  {trips.length > 0 && (
                    <button
                      onClick={() => setSearchOpen((v) => !v)}
                      className={`p-2 rounded-xl transition-all duration-200 ${
                        searchOpen
                          ? 'bg-atlas-blue/20 text-atlas-blue'
                          : 'text-atlas-text-muted hover:text-white hover:bg-white/[0.06]'
                      }`}
                      title="Search trips"
                    >
                      <SearchIcon />
                    </button>
                  )}
                  {/* AI toggle */}
                  <button
                    onClick={() => setShowAIChat((v) => !v)}
                    className={`p-2 rounded-xl transition-all duration-200 ${
                      showAIChat
                        ? 'bg-violet-500/20 text-violet-300'
                        : 'text-atlas-text-muted hover:text-white hover:bg-white/[0.06]'
                    }`}
                    title="AI Assistant"
                  >
                    <SparkleIcon />
                  </button>
                  {/* New trip */}
                  <button onClick={() => setShowCreate(true)} className="btn-glow text-sm px-4 py-2">
                    <span>+ New Trip</span>
                  </button>
                </div>
              </div>

              {/* Filter tabs */}
              {trips.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: 'all',      label: 'All'      },
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'past',     label: 'Past'     },
                    { id: 'local',    label: 'Local'    },
                  ].map((tab) => (
                    <TabPill
                      key={tab.id}
                      label={tab.label}
                      count={tabCounts[tab.id]}
                      active={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                    />
                  ))}

                  {/* Animated search input */}
                  <div
                    className="ml-auto overflow-hidden transition-all duration-300 ease-out"
                    style={{ maxWidth: searchOpen ? '240px' : '0px', opacity: searchOpen ? 1 : 0 }}
                  >
                    <input
                      ref={searchRef}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && (setSearchOpen(false), setSearchInput(''))}
                      placeholder="Search trips…"
                      className="atlas-input text-xs py-1.5 px-3 h-8 w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main content area ────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className={`flex gap-6 ${showAIChat ? 'flex-col lg:flex-row' : ''}`}>

            {/* ── Trip grid ──────────────────────────────────────── */}
            <div className="flex-1 min-w-0">

              {/* Sign-in prompt */}
              {!user && !loading && (
                <div className="glass rounded-2xl p-10 text-center mb-8"
                  style={{ animation: 'fade-in 0.5s both' }}>
                  <div className="text-5xl mb-4" style={{ animation: 'float 3s ease-in-out infinite' }}>🌍</div>
                  <h2 className="text-xl font-bold text-white mb-2">Sign in to sync your trips</h2>
                  <p className="text-atlas-text-secondary text-sm mb-6">
                    Your trips are saved locally. Sign in to back them up and access them anywhere.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button onClick={handleSignIn} disabled={signingIn} className="btn-glow px-6 py-2.5">
                      <span>{signingIn ? 'Signing in…' : 'Sign in with Google'}</span>
                    </button>
                    <button onClick={() => setShowCreate(true)} className="btn-ghost px-6 py-2.5">
                      Continue without account
                    </button>
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="glass rounded-2xl overflow-hidden"
                      style={{ animation: `slide-up 0.4s ${i * 80}ms both` }}>
                      <div className="h-44 skeleton" />
                      <div className="p-5 space-y-3">
                        <div className="h-4 rounded-lg skeleton w-3/4" />
                        <div className="h-3 rounded-lg skeleton w-full" />
                        <div className="h-3 rounded-lg skeleton w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filtered.map((trip, i) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      onDelete={handleDelete}
                      animationDelay={i * 70}
                    />
                  ))}
                  {/* Add-more card */}
                  <button
                    onClick={() => setShowCreate(true)}
                    className="trip-card glass rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[220px] border-2 border-dashed border-white/10 hover:border-atlas-blue/30 hover:bg-atlas-blue/5 transition-all duration-300 group"
                    style={{ animation: `slide-up 0.4s ${filtered.length * 70}ms both` }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] group-hover:bg-atlas-blue/15 flex items-center justify-center text-2xl transition-all duration-300 group-hover:scale-110">
                      +
                    </div>
                    <span className="text-sm text-atlas-text-muted group-hover:text-white transition-colors font-medium">
                      Plan a new trip
                    </span>
                  </button>
                </div>
              ) : searchQuery ? (
                <div className="text-center py-16" style={{ animation: 'fade-in 0.3s both' }}>
                  <p className="text-atlas-text-muted">No trips match &ldquo;{searchQuery}&rdquo;</p>
                  <button onClick={() => setSearchInput('')} className="mt-3 text-atlas-blue text-sm hover:underline">
                    Clear search
                  </button>
                </div>
              ) : activeTab !== 'all' ? (
                <div className="text-center py-16" style={{ animation: 'fade-in 0.3s both' }}>
                  <p className="text-atlas-text-muted">No {activeTab} trips</p>
                  <button onClick={() => setActiveTab('all')} className="mt-3 text-atlas-blue text-sm hover:underline">
                    View all trips
                  </button>
                </div>
              ) : (
                <div className="text-center py-20" style={{ animation: 'fade-in 0.5s both' }}>
                  <div className="text-6xl mb-5" style={{ animation: 'float 3s ease-in-out infinite' }}>🗺️</div>
                  <h2 className="text-xl font-bold text-white mb-2">No trips yet</h2>
                  <p className="text-atlas-text-secondary text-sm mb-8 max-w-xs mx-auto">
                    Start planning your first adventure — it only takes a minute.
                  </p>
                  <button onClick={() => setShowCreate(true)} className="btn-glow px-8 py-3">
                    <span>Plan your first trip</span>
                  </button>
                </div>
              )}
            </div>

            {/* ── AI Chat panel — slides in from the right ────────── */}
            {showAIChat && (
              <div
                className="lg:w-80 xl:w-96 flex-shrink-0"
                style={{ animation: 'slide-in-right 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
              >
                <AIChat
                  enabled={true}
                  tripName="Your Trips"
                  onClose={() => setShowAIChat(false)}
                  className="sticky top-20"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create trip modal */}
      {showCreate && (
        <CreateTripModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

/* ── Micro icons ─────────────────────────────────────────────────────── */
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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
function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
