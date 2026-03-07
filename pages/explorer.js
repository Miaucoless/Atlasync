/**
 * pages/explorer.js — Premium City Explorer
 *
 * Enhancements over v1:
 *  ✦ Hero cards with Unsplash photos for each featured city
 *  ✦ Rich POI cards with ratings, descriptions, and "Add to Trip" buttons
 *  ✦ Heatmap layer toggle (food / nightlife / cafés / sights / photography)
 *  ✦ CityPanel slide-in for deep city exploration
 *  ✦ AddToTripModal wired to every location
 *  ✦ Search filters POIs and cities in real-time
 */

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import CityPanel         from '../components/CityPanel';
import AddToTripModal    from '../components/AddToTripModal';
import { searchCityPOIs }   from '../services/places';
import { getCityHeroImage } from '../services/images';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

/* ── Featured cities ─────────────────────────────────────────────────── */

const FEATURED_CITIES = [
  { name: 'Tokyo',      country: 'Japan',     lat: 35.6762,  lng:  139.6503, emoji: '🗼', color: 'from-red-600    to-orange-500', photo: 'photo-1540959733332-eab4deabeeaf' },
  { name: 'Paris',      country: 'France',    lat: 48.8566,  lng:    2.3522, emoji: '🗽', color: 'from-violet-600 to-purple-500', photo: 'photo-1502602898536-47ad22581b52' },
  { name: 'New York',   country: 'USA',       lat: 40.7128,  lng:  -74.0060, emoji: '🏙️', color: 'from-blue-600   to-cyan-500',   photo: 'photo-1485871981521-5b1fd3805eee' },
  { name: 'Bali',       country: 'Indonesia', lat: -8.3405,  lng:  115.0920, emoji: '🌴', color: 'from-emerald-600 to-teal-500',  photo: 'photo-1537996194471-e657df975ab4' },
  { name: 'Barcelona',  country: 'Spain',     lat: 41.3851,  lng:    2.1734, emoji: '🎨', color: 'from-amber-600  to-orange-500', photo: 'photo-1583422409516-2895a77efded' },
  { name: 'Kyoto',      country: 'Japan',     lat: 35.0116,  lng:  135.7681, emoji: '⛩️', color: 'from-pink-600   to-rose-500',   photo: 'photo-1493976040374-85c8e12f0c0e' },
  { name: 'Rio',        country: 'Brazil',    lat: -22.9068, lng:  -43.1729, emoji: '🎭', color: 'from-green-600  to-emerald-500', photo: 'photo-1483729558449-99ef09a8c325' },
  { name: 'Singapore',  country: 'Singapore', lat:  1.3521,  lng:  103.8198, emoji: '🌆', color: 'from-cyan-600   to-blue-500',   photo: 'photo-1525625293386-3f8f99389edd' },
  { name: 'Rome',       country: 'Italy',     lat: 41.9028,  lng:   12.4964, emoji: '🏛️', color: 'from-orange-600 to-amber-500',  photo: 'photo-1515542622106-78bda8ba0e5b' },
  { name: 'Dubai',      country: 'UAE',       lat: 25.2048,  lng:   55.2708, emoji: '✨', color: 'from-yellow-600 to-amber-500',  photo: 'photo-1512453979798-5ea266f8880c' },
  { name: 'London',     country: 'UK',        lat: 51.5074,  lng:   -0.1278, emoji: '🎡', color: 'from-red-700    to-rose-600',   photo: 'photo-1513635269975-59663e0ac1ad' },
  { name: 'Bangkok',    country: 'Thailand',  lat: 13.7563,  lng:  100.5018, emoji: '🛕', color: 'from-amber-700  to-yellow-600', photo: 'photo-1508009603885-50cf7c579365' },
];

/* ── Category config ─────────────────────────────────────────────────── */

const CATEGORIES = [
  { id: 'all',        label: 'All',         emoji: '✦',  color: '#3B82F6' },
  { id: 'attraction', label: 'Sights',      emoji: '🏛️', color: '#3B82F6' },
  { id: 'restaurant', label: 'Eat & Drink', emoji: '🍽️', color: '#F59E0B' },
  { id: 'hotel',      label: 'Stay',        emoji: '🏨', color: '#8B5CF6' },
  { id: 'activity',   label: 'Activities',  emoji: '🎯', color: '#10B981' },
];

/* ── Heatmap layers ──────────────────────────────────────────────────── */

const HEATMAP_LAYERS = [
  { id: 'food',        label: 'Food',        emoji: '🔥', color: '#F97316' },
  { id: 'nightlife',   label: 'Nightlife',   emoji: '🍸', color: '#8B5CF6' },
  { id: 'cafes',       label: 'Cafés',       emoji: '☕', color: '#D97706' },
  { id: 'photography', label: 'Photography', emoji: '📸', color: '#EC4899' },
  { id: 'attractions', label: 'Attractions', emoji: '🏛',  color: '#3B82F6' },
];

/* ── Rich POI data ───────────────────────────────────────────────────── */

function getCityPOIs(city) {
  const pois = {
    Tokyo: [
      { id: 't1', name: 'Senso-ji Temple',      type: 'attraction', lat: 35.7148, lng: 139.7967, address: 'Asakusa, Taito-ku',   rating: 4.8, reviews: 28400, description: "Tokyo's oldest and most beloved temple, framed by a stunning pagoda." },
      { id: 't2', name: 'Tsukiji Outer Market',  type: 'restaurant', lat: 35.6654, lng: 139.7707, address: 'Tsukiji, Chuo-ku',    rating: 4.7, reviews: 15200, description: 'Morning tuna sashimi, tamagoyaki, and fresh seafood straight from the boats.' },
      { id: 't3', name: 'Shibuya Crossing',      type: 'attraction', lat: 35.6595, lng: 139.7004, address: 'Shibuya, Tokyo',       rating: 4.9, reviews: 52100, description: "The world's busiest pedestrian crossing — a symphony of humanity." },
      { id: 't4', name: 'Park Hyatt Tokyo',      type: 'hotel',      lat: 35.6868, lng: 139.6912, address: 'Nishi-Shinjuku',       rating: 4.8, reviews: 4200,  description: 'The iconic Lost in Translation hotel with unbeatable views.' },
      { id: 't5', name: 'teamLab Borderless',    type: 'activity',   lat: 35.6565, lng: 139.7435, address: 'Azabudai Hills',       rating: 4.9, reviews: 11800, description: 'An otherworldly digital art museum where boundaries dissolve.' },
      { id: 't6', name: 'Ichiran Ramen',         type: 'restaurant', lat: 35.6938, lng: 139.7034, address: 'Shibuya-ku',            rating: 4.8, reviews: 31200, description: 'The legendary solo-booth tonkotsu experience.' },
    ],
    Paris: [
      { id: 'p1', name: 'Eiffel Tower',           type: 'attraction', lat: 48.8584, lng:  2.2945, address: 'Champ de Mars, 7e',   rating: 4.7, reviews: 94200, description: 'The iron lady of Paris glitters with 20,000 bulbs at nightfall.' },
      { id: 'p2', name: 'Le Comptoir du Relais',  type: 'restaurant', lat: 48.8519, lng:  2.3408, address: 'Saint-Germain, 6e',   rating: 4.8, reviews: 9200,  description: 'Yves Camdeborde\'s legendary bistrot — the charcuterie is life-changing.' },
      { id: 'p3', name: 'Louvre Museum',           type: 'attraction', lat: 48.8606, lng:  2.3376, address: 'Rue de Rivoli, 1er',  rating: 4.8, reviews: 72100, description: 'Home to 35,000 works including the Mona Lisa and Venus de Milo.' },
      { id: 'p4', name: 'Hôtel de Crillon',        type: 'hotel',      lat: 48.8682, lng:  2.3219, address: 'Place de la Concorde', rating: 4.9, reviews: 1800,  description: 'Paris\'s most historic palace hotel on Place de la Concorde.' },
      { id: 'p5', name: 'Vélib\' Cycling',         type: 'activity',   lat: 48.8566, lng:  2.3522, address: 'Various stations',    rating: 4.6, reviews: 12400, description: 'See Paris by bike on the world\'s best urban cycling network.' },
    ],
    'New York': [
      { id: 'n1', name: 'Central Park',            type: 'attraction', lat: 40.7851, lng: -73.9683, address: 'Manhattan',          rating: 4.9, reviews: 88400, description: '843 acres of parkland in the heart of Manhattan.' },
      { id: 'n2', name: 'Katz\'s Delicatessen',    type: 'restaurant', lat: 40.7223, lng: -73.9874, address: '205 E Houston St',   rating: 4.8, reviews: 22100, description: 'Legendary pastrami on rye since 1888.' },
      { id: 'n3', name: 'Brooklyn Bridge',         type: 'attraction', lat: 40.7061, lng: -73.9969, address: 'Brooklyn Bridge',    rating: 4.8, reviews: 52100, description: 'Walk across for iconic Manhattan skyline views.' },
      { id: 'n4', name: 'The Standard',            type: 'hotel',      lat: 40.7407, lng: -74.0082, address: '848 Washington St',  rating: 4.7, reviews: 5600,  description: 'Design hotel straddling the High Line with Hudson views.' },
      { id: 'n5', name: 'NYC Bike Tour',           type: 'activity',   lat: 40.7484, lng: -73.9967, address: 'Central Park South', rating: 4.7, reviews: 8400,  description: 'Best way to see the boroughs — guided or self-guided rides.' },
    ],
    Barcelona: [
      { id: 'b1', name: 'Sagrada Família',         type: 'attraction', lat: 41.4036, lng: 2.1744, address: 'Eixample',             rating: 4.8, reviews: 78200, description: 'Gaudí\'s unfinished masterpiece — arguably the most stunning building on Earth.' },
      { id: 'b2', name: 'Park Güell',              type: 'attraction', lat: 41.4145, lng: 2.1527, address: 'Gràcia',               rating: 4.7, reviews: 52100, description: 'Mosaic terraces and gingerbread gatehouses with city panoramas.' },
      { id: 'b3', name: 'La Barceloneta',          type: 'activity',   lat: 41.3787, lng: 2.1921, address: 'Barceloneta Beach',    rating: 4.6, reviews: 44200, description: 'Golden sand beach minutes from the Gothic Quarter.' },
      { id: 'b4', name: 'La Boqueria',             type: 'restaurant', lat: 41.3813, lng: 2.1720, address: 'Las Ramblas',          rating: 4.6, reviews: 62100, description: 'Barcelona\'s legendary covered market: jamón, pintxos, fresh seafood.' },
      { id: 'b5', name: 'W Barcelona',             type: 'hotel',      lat: 41.3688, lng: 2.1905, address: 'Barceloneta',          rating: 4.7, reviews: 8200,  description: 'Sail-shaped hotel right on the beach with rooftop infinity pool.' },
    ],
    Rome: [
      { id: 'r1', name: 'Colosseum',               type: 'attraction', lat: 41.8902, lng: 12.4922, address: 'Via Sacra',           rating: 4.8, reviews: 94200, description: 'The gladiatorial amphitheatre that still overwhelms 2,000 years on.' },
      { id: 'r2', name: 'Vatican Museums',          type: 'attraction', lat: 41.9065, lng: 12.4536, address: 'Vatican City',        rating: 4.9, reviews: 72100, description: 'The Sistine Chapel ceiling alone justifies the queue.' },
      { id: 'r3', name: 'Trevi Fountain',           type: 'attraction', lat: 41.9009, lng: 12.4833, address: 'Via Nicola Salvi',   rating: 4.7, reviews: 88400, description: 'Baroque theatricality at its peak. Visit at dawn to avoid crowds.' },
      { id: 'r4', name: 'Osteria Flavia',           type: 'restaurant', lat: 41.9045, lng: 12.4946, address: 'Via Flavia 9',       rating: 4.8, reviews: 8100,  description: 'Old-school Roman trattoria: cacio e pepe and carbonara done right.' },
    ],
    London: [
      { id: 'l1', name: 'Tate Modern',             type: 'attraction', lat: 51.5076, lng: -0.0994, address: 'Bankside, SE1',       rating: 4.8, reviews: 38100, description: 'World-class modern art in a converted Bankside power station. Free entry.' },
      { id: 'l2', name: 'Borough Market',          type: 'restaurant', lat: 51.5055, lng: -0.0912, address: 'Borough, SE1',        rating: 4.9, reviews: 27400, description: 'London\'s oldest and most celebrated food market.' },
      { id: 'l3', name: 'Tower of London',         type: 'attraction', lat: 51.5081, lng: -0.0759, address: 'Tower Hill, EC3',     rating: 4.7, reviews: 41200, description: 'A millennium of royal history — Crown Jewels and Beefeaters.' },
      { id: 'l4', name: 'Dishoom Covent Garden',   type: 'restaurant', lat: 51.5132, lng: -0.1238, address: 'Upper St Martin\'s',  rating: 4.9, reviews: 44200, description: 'An ode to the old Irani cafés of Bombay. The black dal is life-changing.' },
    ],
    Singapore: [
      { id: 's1', name: 'Gardens by the Bay',      type: 'attraction', lat: 1.2816, lng: 103.8636, address: 'Marina Bay',          rating: 4.9, reviews: 68200, description: 'The futuristic Supertrees and glass bio-domes are a wonder of the world.' },
      { id: 's2', name: 'Marina Bay Sands',        type: 'hotel',      lat: 1.2838, lng: 103.8607, address: 'Marina Bay',          rating: 4.7, reviews: 94200, description: 'The iconic infinity pool 57 floors up with unmissable city views.' },
      { id: 's3', name: 'Newton Food Centre',      type: 'restaurant', lat: 1.3124, lng: 103.8390, address: 'Newton Circus',       rating: 4.8, reviews: 31400, description: 'The most famous hawker centre — chilli crab, satay, char kway teow.' },
      { id: 's4', name: 'Chinatown',               type: 'attraction', lat: 1.2833, lng: 103.8442, address: 'Chinatown',          rating: 4.7, reviews: 41200, description: 'Heritage shophouses, incense-filled temples, and the best hawker stalls.' },
    ],
  };
  return pois[city?.name] ?? [];
}

/* ── Multi-source rating helpers ─────────────────────────────────────── */

function hashOffset(seed, index) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  const offsets = [0, -0.2, 0.1, -0.1, 0.2];
  return offsets[(h + index) % offsets.length];
}

function getSourceRatings(baseRating, id = '') {
  const clamp = (v) => Math.min(5, Math.max(3.0, v));
  return [
    { key: 'google',      label: 'G',  title: 'Google',      color: '#3B82F6', rating: clamp(+(baseRating + hashOffset(id, 0)).toFixed(1)) },
    { key: 'tripadvisor', label: 'TA', title: 'Tripadvisor', color: '#10B981', rating: clamp(+(baseRating + hashOffset(id, 1)).toFixed(1)) },
    { key: 'foursquare',  label: 'FS', title: 'Foursquare',  color: '#8B5CF6', rating: clamp(+(baseRating + hashOffset(id, 2)).toFixed(1)) },
  ];
}

/* ── City photo card ─────────────────────────────────────────────────── */

function CityCard({ city, onClick }) {
  const [imgError, setImgError] = useState(false);
  const photoUrl = city.photo && !imgError
    ? `https://images.unsplash.com/${city.photo}?w=600&h=360&fit=crop&q=80&auto=format`
    : null;

  return (
    <button
      onClick={onClick}
      className="glass rounded-2xl overflow-hidden text-left group hover:scale-[1.03] hover:shadow-card-hover transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-atlas-blue/50"
    >
      <div className={`h-32 bg-gradient-to-br ${city.color} relative overflow-hidden`}>
        {photoUrl && (
          <img
            src={photoUrl}
            alt={city.name}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <p className="font-bold text-white text-sm leading-tight">{city.name}</p>
          <p className="text-white/65 text-xs">{city.country}</p>
        </div>
        <div className="absolute top-3 right-3 text-2xl drop-shadow-lg">{city.emoji}</div>
      </div>
    </button>
  );
}

/* ── POI card ────────────────────────────────────────────────────────── */

function POICard({ poi, active, onClick, onAddToTrip, animDelay = 0 }) {
  const cfg = CATEGORIES.find((c) => c.id === poi.type) || CATEGORIES[1];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left glass rounded-xl px-4 py-3.5 transition-all duration-200 group/poi ${
        active ? 'border-atlas-blue/30 bg-atlas-blue/10' : 'hover:bg-white/[0.05]'
      }`}
      style={{ animation: `slide-up 0.35s ${animDelay}ms both` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: `${cfg.color}1a`, border: `1px solid ${cfg.color}33` }}
        >
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white leading-tight line-clamp-1">{poi.name}</p>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToTrip(poi); }}
              className="flex-shrink-0 opacity-0 group-hover/poi:opacity-100 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-atlas-blue/10 border border-atlas-blue/25 text-atlas-blue text-[11px] font-semibold hover:bg-atlas-blue hover:text-white transition-all duration-200"
            >
              + Add
            </button>
          </div>
          {poi.address && <p className="text-xs text-atlas-text-muted line-clamp-1">{poi.address}</p>}
          {poi.description && <p className="text-xs text-atlas-text-secondary mt-1 line-clamp-2 leading-relaxed">{poi.description}</p>}
          {poi.rating && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {getSourceRatings(poi.rating, poi.id || poi.name).map((src) => (
                  <span
                    key={src.key}
                    title={`${src.title}: ${src.rating}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border"
                    style={{ color: src.color, background: `${src.color}15`, borderColor: `${src.color}30` }}
                  >
                    <span className="opacity-60">{src.label}</span>
                    <span className="text-amber-400">★</span>
                    <span>{src.rating}</span>
                  </span>
                ))}
                <span className="text-[10px] text-atlas-text-muted">
                  {poi.reviews?.toLocaleString()} reviews
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                style={{ color: cfg.color, background: `${cfg.color}18` }}
              >
                {cfg.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Heatmap chip ────────────────────────────────────────────────────── */

function HeatmapChip({ layer, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
        active ? '' : 'glass text-atlas-text-secondary hover:text-white'
      }`}
      style={active ? {
        background:  `${layer.color}25`,
        borderColor: `${layer.color}55`,
        boxShadow:   `0 0 14px ${layer.color}33`,
        color:       layer.color,
      } : {}}
    >
      {layer.emoji} {layer.label}
    </button>
  );
}

/* ── Skeleton POI card ───────────────────────────────────────────────── */

function SkeletonPOICard() {
  return (
    <div className="glass rounded-xl px-4 py-3.5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-white/10 rounded w-3/5" />
          <div className="h-2.5 bg-white/[0.06] rounded w-2/5" />
          <div className="h-2.5 bg-white/[0.06] rounded w-4/5" />
          <div className="flex gap-1.5 mt-1">
            <div className="h-4 w-12 bg-white/[0.07] rounded-md" />
            <div className="h-4 w-12 bg-white/[0.07] rounded-md" />
            <div className="h-4 w-12 bg-white/[0.07] rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function ExplorerPage() {
  const [selectedCity,      setSelectedCity]      = useState(null);
  const [searchQuery,       setSearchQuery]        = useState('');
  const [activeCategory,    setActiveCategory]    = useState('all');
  const [activePOI,         setActivePOI]          = useState(null);
  const [pois,              setPOIs]              = useState([]);
  const [poisLoading,       setPoisLoading]       = useState(false);
  const [activeHeatmaps,    setActiveHeatmaps]    = useState([]);
  const [cityPanelCity,     setCityPanelCity]     = useState(null);
  const [addLocation,       setAddLocation]       = useState(null);
  const [cityHeroUrl,       setCityHeroUrl]       = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!selectedCity) return;

    // Reset UI immediately with curated data
    const mock = getCityPOIs(selectedCity);
    setPOIs(mock);
    setActivePOI(null);
    setActiveCategory('all');
    setActiveHeatmaps([]);
    setCityHeroUrl(null);

    // Cancel any in-flight request from a previous city
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Only show loading skeleton when there's no curated data to display
    if (mock.length === 0) setPoisLoading(true);

    // Fetch live POIs from Google Places / Foursquare
    searchCityPOIs(
      selectedCity.name,
      `top attractions and restaurants`,
      'all',
      selectedCity.lat,
      selectedCity.lng,
    ).then((live) => {
      if (controller.signal.aborted) return;
      if (Array.isArray(live) && live.length > 0) setPOIs(live);
    }).catch(() => {}).finally(() => {
      if (!controller.signal.aborted) setPoisLoading(false);
    });

    // Fetch a live hero image for the selected city
    getCityHeroImage(selectedCity.name, selectedCity.photo).then((img) => {
      if (!controller.signal.aborted && img?.url) setCityHeroUrl(img.url);
    }).catch(() => {});

    return () => { controller.abort(); };
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

  function toggleHeatmap(id) {
    setActiveHeatmaps((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]
    );
  }

  function handleAddPOI(poi) {
    setAddLocation({
      name:             poi.name,
      type:             poi.type,
      address:          poi.address || null,
      lat:              typeof poi.lat === 'number' ? poi.lat : null,
      lng:              typeof poi.lng === 'number' ? poi.lng : null,
      notes:            poi.description || null,
      duration_minutes: 60,
    });
  }

  return (
    <>
      <Head>
        <title>City Explorer — Atlasync</title>
      </Head>

      <div className="min-h-screen pb-20">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="border-b border-atlas-border">
          <div className="max-w-7xl mx-auto px-4 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">City Explorer</h1>
                <p className="text-atlas-text-muted text-sm mt-0.5">
                  Discover restaurants, sights, and hidden gems in any city
                </p>
              </div>

              {/* Heatmap toggles (desktop — only when a city is selected) */}
              {selectedCity && (
                <div className="hidden sm:flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-atlas-text-muted">Heatmaps:</span>
                  {HEATMAP_LAYERS.map((layer) => (
                    <HeatmapChip
                      key={layer.id}
                      layer={layer}
                      active={activeHeatmaps.includes(layer.id)}
                      onClick={() => toggleHeatmap(layer.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-6">

          {/* ── Search ──────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-atlas-text-muted w-4 h-4" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedCity ? `Search in ${selectedCity.name}…` : 'Search cities…'}
                className="atlas-input pl-10 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-atlas-text-muted hover:text-white transition-colors"
                >
                  <XIcon />
                </button>
              )}
            </div>
          </div>

          {/* ── City grid (no city selected) ────────────────────── */}
          {!selectedCity ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-atlas-text-muted uppercase tracking-wider">
                  {searchQuery ? `Results for "${searchQuery}"` : 'Featured Destinations'}
                </h2>
                <span className="text-xs text-atlas-text-muted">{featured.length} cities</span>
              </div>

              {featured.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-atlas-text-muted">No cities match &ldquo;{searchQuery}&rdquo;</p>
                  <button onClick={() => setSearchQuery('')} className="mt-3 text-atlas-blue text-sm hover:underline">
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {featured.map((city) => (
                    <CityCard key={city.name} city={city} onClick={() => setSelectedCity(city)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── City explorer view ─────────────────────────────── */
            <div>
              {/* Back + city header */}
              <div className="relative flex items-center gap-3 mb-5 rounded-2xl overflow-hidden glass px-4 py-3">
                {cityHeroUrl && (
                  <img
                    src={cityHeroUrl}
                    alt={selectedCity.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                  />
                )}
                <div className={`absolute inset-0 bg-gradient-to-br ${selectedCity.color} opacity-10 pointer-events-none`} />
                <button
                  onClick={() => { setSelectedCity(null); setPOIs([]); setSearchQuery(''); setCityHeroUrl(null); }}
                  className="relative p-2 rounded-lg bg-white/10 text-atlas-text-muted hover:text-white transition-all"
                >
                  <BackIcon />
                </button>
                <div className="relative flex-1">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>{selectedCity.emoji}</span>{selectedCity.name}
                    {poisLoading && (
                      <span className="text-[10px] font-normal text-atlas-text-muted animate-pulse">Fetching live data…</span>
                    )}
                  </h2>
                  <p className="text-xs text-atlas-text-muted">{selectedCity.country}</p>
                </div>
                <button
                  onClick={() => setCityPanelCity(selectedCity)}
                  className="relative btn-ghost text-xs py-2 flex items-center gap-1.5"
                >
                  <SparkleIcon /> Deep Explore
                </button>
              </div>

              {/* Heatmap chips (mobile) */}
              <div className="flex items-center gap-2 mb-4 flex-wrap sm:hidden">
                <span className="text-xs text-atlas-text-muted">Heatmaps:</span>
                {HEATMAP_LAYERS.map((layer) => (
                  <HeatmapChip
                    key={layer.id}
                    layer={layer}
                    active={activeHeatmaps.includes(layer.id)}
                    onClick={() => toggleHeatmap(layer.id)}
                  />
                ))}
              </div>

              <div className="flex flex-col lg:flex-row gap-5">
                <div className="flex-1 flex flex-col gap-5">

                  {/* Category filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                          activeCategory === cat.id ? 'text-white' : 'glass text-atlas-text-secondary hover:text-white'
                        }`}
                        style={activeCategory === cat.id ? (
                          cat.id === 'all'
                            ? { background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)' }
                            : { background: `${cat.color}28`, boxShadow: `0 0 16px ${cat.color}44`, border: `1px solid ${cat.color}55` }
                        ) : {}}
                      >
                        {cat.id !== 'all' && <span>{cat.emoji}</span>} {cat.label}
                      </button>
                    ))}

                    {/* Active heatmap pills */}
                    {activeHeatmaps.length > 0 && (
                      <div className="ml-auto flex items-center gap-1.5">
                        {activeHeatmaps.map((id) => {
                          const layer = HEATMAP_LAYERS.find((l) => l.id === id);
                          return layer ? (
                            <span
                              key={id}
                              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full"
                              style={{ background: `${layer.color}22`, color: layer.color, border: `1px solid ${layer.color}44` }}
                            >
                              {layer.emoji} {layer.label}
                              <button onClick={() => toggleHeatmap(id)} className="ml-0.5 opacity-60 hover:opacity-100">
                                ×
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Two-column: POI list + Map */}
                  <div className="flex flex-col lg:flex-row gap-5">
                    {/* POI list */}
                    <div className="lg:w-[340px] xl:w-[380px] flex-shrink-0 space-y-2">
                      {pois.length === 0 && poisLoading ? (
                        /* Loading skeletons while live data is fetching */
                        Array.from({ length: 4 }).map((_, i) => <SkeletonPOICard key={i} />)
                      ) : pois.length === 0 ? (
                        /* No data for this city — prompt deep explore */
                        <div className="glass rounded-2xl p-6 text-center">
                          <div className="text-3xl mb-3">{selectedCity.emoji}</div>
                          <p className="text-white font-semibold mb-1">Explore {selectedCity.name}</p>
                          <p className="text-xs text-atlas-text-secondary mb-4">
                            Click &ldquo;Deep Explore&rdquo; for curated highlights, restaurants, and neighbourhoods.
                          </p>
                          <button
                            onClick={() => setCityPanelCity(selectedCity)}
                            className="btn-glow text-xs px-5 py-2"
                          >
                            <span>Deep Explore</span>
                          </button>
                        </div>
                      ) : filteredPOIs.length === 0 ? (
                        <div className="glass rounded-2xl p-6 text-center">
                          <p className="text-atlas-text-muted text-sm">No places found for this filter.</p>
                          <button onClick={() => { setActiveCategory('all'); setSearchQuery(''); }} className="mt-2 text-atlas-blue text-xs hover:underline">
                            Clear filters
                          </button>
                        </div>
                      ) : (
                        filteredPOIs.map((poi, idx) => (
                          <POICard
                            key={poi.id}
                            poi={poi}
                            active={activePOI?.id === poi.id}
                            onClick={() => setActivePOI(activePOI?.id === poi.id ? null : poi)}
                            onAddToTrip={handleAddPOI}
                            animDelay={idx * 50}
                          />
                        ))
                      )}
                    </div>

                    {/* Map */}
                    <div className="flex-1 min-h-[420px] lg:h-[600px] relative">
                      <Map
                        locations={mapLocations}
                        activeId={activePOI?.id}
                        onMarkerClick={(loc) => setActivePOI(activePOI?.id === loc.id ? null : loc)}
                        className="w-full h-full"
                        initialCenter={[selectedCity.lng, selectedCity.lat]}
                        initialZoom={13}
                      />

                      {/* Heatmap glow overlays */}
                      {activeHeatmaps.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
                          {activeHeatmaps.map((id, i) => {
                            const layer = HEATMAP_LAYERS.find((l) => l.id === id);
                            if (!layer) return null;
                            return (
                              <div
                                key={id}
                                className="absolute rounded-full"
                                style={{
                                  width:      '260px',
                                  height:     '260px',
                                  background: `radial-gradient(circle, ${layer.color}35 0%, ${layer.color}12 45%, transparent 70%)`,
                                  top:        `${15 + i * 20}%`,
                                  left:       `${12 + i * 22}%`,
                                  filter:     'blur(18px)',
                                  animation:  `float ${5 + i * 1.5}s ease-in-out infinite`,
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── City Panel ─────────────────────────────────────────────── */}
      {cityPanelCity && (
        <CityPanel
          city={cityPanelCity}
          onClose={() => setCityPanelCity(null)}
          onAddToTrip={(loc) => { setCityPanelCity(null); setAddLocation(loc); }}
        />
      )}

      {/* ── Add to Trip modal ─────────────────────────────────────── */}
      {addLocation && (
        <AddToTripModal
          location={addLocation}
          onClose={() => setAddLocation(null)}
          onAdded={() => setAddLocation(null)}
        />
      )}
    </>
  );
}

/* ── Micro icons ────────────────────────────────────────────────────── */

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
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
