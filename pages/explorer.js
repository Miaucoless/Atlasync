/**
 * pages/explorer.js
 * Live city explorer — search any city, see it on a Mapbox map,
 * browse POI categories, and get AI-powered local tips.
 */

import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import AIChat from '../components/AIChat';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

/* Featured cities to kick-start exploration */
const FEATURED_CITIES = [
  { name: 'Tokyo',      country: 'Japan',       lat: 35.6762, lng: 139.6503, emoji: '🗼', color: 'from-red-500 to-orange-400'   },
  { name: 'Paris',      country: 'France',      lat: 48.8566, lng:  2.3522,  emoji: '🗽', color: 'from-violet-500 to-purple-400' },
  { name: 'New York',   country: 'USA',         lat: 40.7128, lng: -74.0060, emoji: '🏙️', color: 'from-blue-500 to-cyan-400'    },
  { name: 'Bali',       country: 'Indonesia',   lat: -8.3405, lng: 115.0920, emoji: '🌴', color: 'from-emerald-500 to-teal-400' },
  { name: 'Barcelona',  country: 'Spain',       lat: 41.3851, lng:  2.1734,  emoji: '🎨', color: 'from-amber-500 to-orange-400' },
  { name: 'Kyoto',      country: 'Japan',       lat: 35.0116, lng: 135.7681, emoji: '⛩️', color: 'from-pink-500 to-rose-400'   },
  { name: 'Rio',        country: 'Brazil',      lat: -22.9068, lng: -43.1729, emoji: '🎭', color: 'from-green-500 to-emerald-400' },
  { name: 'Singapore',  country: 'Singapore',   lat:  1.3521, lng: 103.8198, emoji: '🌆', color: 'from-cyan-500 to-blue-400'   },
];

/* Category POIs to show per city */
const CATEGORIES = [
  { id: 'attraction', label: 'Sights',       emoji: '🏛️', color: '#3B82F6' },
  { id: 'restaurant', label: 'Eat & Drink',  emoji: '🍽️', color: '#F59E0B' },
  { id: 'hotel',      label: 'Stay',         emoji: '🏨', color: '#8B5CF6' },
  { id: 'activity',   label: 'Activities',   emoji: '🎯', color: '#10B981' },
];

/* Mock POI data per city (in a real app, query Mapbox POIs / Foursquare) */
function getMockPOIs(city) {
  const pois = {
    Tokyo: [
      { id: '1', name: 'Senso-ji Temple',   type: 'attraction', lat: 35.7148, lng: 139.7967, address: 'Asakusa, Taito-ku' },
      { id: '2', name: 'Tsukiji Outer Market', type: 'restaurant', lat: 35.6654, lng: 139.7707, address: 'Tsukiji, Chuo-ku' },
      { id: '3', name: 'Shibuya Crossing',  type: 'attraction', lat: 35.6595, lng: 139.7004, address: 'Shibuya, Tokyo' },
      { id: '4', name: 'Park Hyatt Tokyo',  type: 'hotel',      lat: 35.6868, lng: 139.6912, address: 'Shinjuku, Tokyo' },
      { id: '5', name: 'teamLab Borderless', type: 'activity',  lat: 35.6223, lng: 139.7757, address: 'Odaiba, Koto-ku' },
    ],
    Paris: [
      { id: '6',  name: 'Eiffel Tower',    type: 'attraction', lat: 48.8584, lng:  2.2945, address: 'Champ de Mars, 5 Av. Anatole' },
      { id: '7',  name: 'Le Comptoir',     type: 'restaurant', lat: 48.8519, lng:  2.3408, address: '9 Carrefour de l\'Odéon, 75006' },
      { id: '8',  name: 'Louvre Museum',   type: 'attraction', lat: 48.8606, lng:  2.3376, address: 'Rue de Rivoli, 75001' },
      { id: '9',  name: 'Hôtel de Crillon', type: 'hotel',     lat: 48.8682, lng:  2.3219, address: '10 Pl. de la Concorde' },
      { id: '10', name: 'Vélib Cycling',   type: 'activity',   lat: 48.8566, lng:  2.3522, address: 'Various stations' },
    ],
    'New York': [
      { id: '11', name: 'Central Park',      type: 'attraction', lat: 40.7851, lng: -73.9683, address: 'Central Park, New York' },
      { id: '12', name: 'Katz\'s Delicatessen', type: 'restaurant', lat: 40.7223, lng: -73.9874, address: '205 E Houston St' },
      { id: '13', name: 'Brooklyn Bridge',   type: 'attraction', lat: 40.7061, lng: -73.9969, address: 'Brooklyn Bridge' },
      { id: '14', name: 'The Standard',      type: 'hotel',      lat: 40.7407, lng: -74.0082, address: '848 Washington St' },
      { id: '15', name: 'NYC Bike Tour',     type: 'activity',   lat: 40.7484, lng: -73.9967, address: 'Central Park South' },
    ],
  };
  return pois[city.name] ?? [];
}

export default function ExplorerPage() {
  const [selectedCity, setSelectedCity]   = useState(null);
  const [searchQuery,  setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activePOI,    setActivePOI]      = useState(null);
  const [showAI,       setShowAI]         = useState(false);
  const [pois,         setPOIs]           = useState([]);

  useEffect(() => {
    if (selectedCity) {
      setPOIs(getMockPOIs(selectedCity));
      setActivePOI(null);
      setActiveCategory('all');
    }
  }, [selectedCity]);

  const filteredPOIs = pois.filter((p) =>
    (activeCategory === 'all' || p.type === activeCategory) &&
    (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const mapLocations = filteredPOIs.map((p, i) => ({ ...p, visit_order: i }));

  const featured = FEATURED_CITIES.filter((c) =>
    !searchQuery ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>City Explorer — Atlasync</title>
      </Head>

      <div className="min-h-screen pb-20">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="border-b border-atlas-border">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">City Explorer</h1>
                <p className="text-atlas-text-muted text-sm mt-0.5">
                  Discover restaurants, sights, and hidden gems in any city
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAI((v) => !v)}
                  className={`btn-ghost text-sm gap-2 ${showAI ? 'border-violet-500/40 text-violet-300' : ''}`}
                >
                  <SparkleIcon /> Local Tips AI
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-6">
          {/* ── Search ─────────────────────────────────────── */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-atlas-text-muted w-4 h-4" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cities…"
                className="atlas-input pl-9"
              />
            </div>
          </div>

          {/* ── Featured city grid (when no city selected) ── */}
          {!selectedCity ? (
            <div>
              <h2 className="text-sm font-semibold text-atlas-text-muted uppercase tracking-wider mb-4">
                Featured Destinations
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {featured.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => setSelectedCity(city)}
                    className={`
                      glass rounded-2xl overflow-hidden text-left group
                      hover:scale-[1.02] hover:shadow-card-hover transition-all duration-300
                    `}
                  >
                    <div className={`h-28 bg-gradient-to-br ${city.color} flex items-center justify-center text-4xl relative`}>
                      {city.emoji}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-white text-sm">{city.name}</p>
                      <p className="text-atlas-text-muted text-xs">{city.country}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── City explorer view ──────────────────────── */
            <div>
              {/* Back + city header */}
              <div className="flex items-center gap-3 mb-5">
                <button
                  onClick={() => { setSelectedCity(null); setPOIs([]); }}
                  className="p-2 rounded-lg glass text-atlas-text-muted hover:text-white transition-all"
                >
                  <BackIcon />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedCity.emoji} {selectedCity.name}
                  </h2>
                  <p className="text-xs text-atlas-text-muted">{selectedCity.country}</p>
                </div>
              </div>

              <div className={`flex gap-6 ${showAI ? 'flex-col xl:flex-row' : ''}`}>
                <div className="flex-1 flex flex-col gap-5">
                  {/* Category filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${activeCategory === 'all' ? 'bg-atlas-blue text-white shadow-glow-sm' : 'glass text-atlas-text-secondary hover:text-white'}`}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5
                          ${activeCategory === cat.id
                            ? 'text-white shadow-glow-sm'
                            : 'glass text-atlas-text-secondary hover:text-white'}
                        `}
                        style={activeCategory === cat.id ? { background: `${cat.color}33`, boxShadow: `0 0 15px ${cat.color}44`, borderColor: `${cat.color}55` } : {}}
                      >
                        {cat.emoji} {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Two-column: POI list + Map */}
                  <div className="flex flex-col lg:flex-row gap-5">
                    {/* POI list */}
                    <div className="lg:w-72 xl:w-80 flex-shrink-0 space-y-2">
                      {filteredPOIs.length === 0 ? (
                        <div className="glass rounded-2xl p-8 text-center">
                          <p className="text-atlas-text-muted text-sm">No places found for this filter.</p>
                        </div>
                      ) : (
                        filteredPOIs.map((poi, idx) => {
                          const cat    = CATEGORIES.find((c) => c.id === poi.type) || CATEGORIES[0];
                          const active = activePOI?.id === poi.id;
                          return (
                            <button
                              key={poi.id}
                              onClick={() => setActivePOI(active ? null : poi)}
                              className={`
                                w-full text-left glass rounded-xl px-4 py-3 transition-all duration-200 group
                                ${active
                                  ? 'border-atlas-blue/30 bg-atlas-blue/10'
                                  : 'hover:bg-white/[0.04]'}
                              `}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                                  style={{ background: `${cat.color}22`, border: `1px solid ${cat.color}33` }}
                                >
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-white text-sm font-semibold line-clamp-1">{poi.name}</p>
                                  <p className="text-atlas-text-muted text-xs line-clamp-1 mt-0.5">
                                    {cat.emoji} {cat.label}
                                    {poi.address && ` · ${poi.address}`}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Map */}
                    <div className="flex-1 min-h-[420px] lg:h-[580px]">
                      <Map
                        locations={mapLocations}
                        activeId={activePOI?.id}
                        onMarkerClick={(loc) => setActivePOI(activePOI?.id === loc.id ? null : loc)}
                        className="w-full h-full"
                        initialCenter={[selectedCity.lng, selectedCity.lat]}
                        initialZoom={13}
                      />
                    </div>
                  </div>
                </div>

                {/* AI chat */}
                {showAI && (
                  <div className="xl:w-80 flex-shrink-0 animate-slide-in-right">
                    <AIChat
                      enabled={true}
                      tripName={`${selectedCity.name} Explorer`}
                      cityHint={selectedCity.name}
                      onClose={() => setShowAI(false)}
                      className="sticky top-20"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Micro icons ─────────────────────────────────────────────────── */
function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
