/**
 * pages/index.js — Enhanced Landing Page
 *
 * Enhancements:
 *  ✦ Typewriter effect — headline types in character-by-character
 *  ✦ Word-reveal — sub-headline words burst in with staggered clip animation
 *  ✦ Parallax globe — globe shifts subtly on scroll (translateY)
 *  ✦ Scroll-linked stats — numbers count up when they enter the viewport
 *  ✦ Animated feature grid — staggered slide-up with visible IntersectionObserver
 *  ✦ Floating city name overlay — hovers above globe markers using Globe's onMarkerHover
 *  ✦ Blob accents — organic glow shapes behind content sections
 *  ✦ Scroll progress bar — thin blue line at top of page
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Head from 'next/head';

const Globe = dynamic(() => import('../components/Globe'), { ssr: false });

/* ── Data ──────────────────────────────────────────────────────── */
const WORLD_MARKERS = [
  { lat: 35.6762,  lng:  139.6503, label: 'Tokyo',       color: '#3B82F6' },
  { lat: 48.8566,  lng:    2.3522, label: 'Paris',       color: '#8B5CF6' },
  { lat: 40.7128,  lng:  -74.0060, label: 'New York',    color: '#06B6D4' },
  { lat: -33.8688, lng:  151.2093, label: 'Sydney',      color: '#10B981' },
  { lat: 51.5074,  lng:   -0.1278, label: 'London',      color: '#F59E0B' },
  { lat:  1.3521,  lng:  103.8198, label: 'Singapore',   color: '#EC4899' },
  { lat: 19.4326,  lng:  -99.1332, label: 'Mexico City', color: '#3B82F6' },
  { lat: 55.7558,  lng:   37.6173, label: 'Moscow',      color: '#8B5CF6' },
  { lat: -22.9068, lng:  -43.1729, label: 'Rio',         color: '#06B6D4' },
];

const WORLD_ARCS = [
  { from: { lat: 40.7128, lng: -74.0060 }, to: { lat: 48.8566, lng:   2.3522 }, color: '#3B82F6' },
  { from: { lat: 48.8566, lng:   2.3522  }, to: { lat: 35.6762, lng: 139.6503 }, color: '#8B5CF6' },
  { from: { lat: 35.6762, lng: 139.6503 }, to: { lat: -33.8688, lng: 151.2093 }, color: '#06B6D4' },
  { from: { lat: 51.5074, lng:  -0.1278 }, to: { lat:   1.3521, lng: 103.8198 }, color: '#10B981' },
  { from: { lat: -22.9068, lng: -43.1729 }, to: { lat: 40.7128, lng: -74.0060 }, color: '#EC4899' },
];

const FEATURES = [
  { icon: '🌍', title: '3D Globe Planning',       description: 'Visualise trips on an interactive globe with animated travel arcs and glowing city markers.', color: 'from-blue-500 to-cyan-400'    },
  { icon: '🗺️', title: 'Smart Route Optimisation', description: 'Instantly reorder stops for the shortest path — runs entirely in your browser, no internet needed.', color: 'from-purple-500 to-violet-400' },
  { icon: '📡', title: 'Offline First',             description: 'Full access to your itineraries even when you\'re off the grid. Everything caches automatically.', color: 'from-cyan-500 to-teal-400'    },
  { icon: '✨', title: 'AI Trip Assistant',         description: 'Get smart recommendations, local tips, and instant itinerary drafts. Fully optional — toggle it off anytime.', color: 'from-pink-500 to-rose-400'   },
  { icon: '📍', title: 'Live City Explorer',        description: 'Discover restaurants, attractions, and hidden gems in any city with an interactive Mapbox map.', color: 'from-amber-500 to-orange-400' },
  { icon: '☁️', title: 'Sync Everywhere',           description: 'Trips backed up to Supabase and accessible on any device. Your data, your way.', color: 'from-emerald-500 to-green-400' },
];

const STATS = [
  { value: 50,  suffix: '+', label: 'Countries' },
  { value: 100, suffix: '%', label: 'Offline Ready' },
  { value: 0,   suffix: '',  label: 'Compromises' },
];

/* ── Typewriter hook ────────────────────────────────────────────── */
function useTypewriter(text, speed = 55, startDelay = 400) {
  const [displayed, setDisplayed] = useState('');
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const delay = setTimeout(() => {
      const id = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(id); setDone(true); }
      }, speed);
      return () => clearInterval(id);
    }, startDelay);
    return () => clearTimeout(delay);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

/* ── Animated counter hook ──────────────────────────────────────── */
function useCountUp(target, duration = 1200, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start    = null;
    const step   = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, active]);
  return count;
}

/* ── CountStat component ────────────────────────────────────────── */
function CountStat({ value, suffix, label, active }) {
  const count = useCountUp(value, 1400, active);
  return (
    <div className="animate-count-in">
      <div className="text-3xl sm:text-5xl font-black text-gradient-blue tabular-nums">
        {count}{suffix}
      </div>
      <div className="text-sm text-atlas-text-secondary mt-2 font-medium">{label}</div>
    </div>
  );
}

/* ── HomePage ───────────────────────────────────────────────────── */
export default function HomePage() {
  const [mounted,      setMounted]      = useState(false);
  const [scrollY,      setScrollY]      = useState(0);
  const [scrollPct,    setScrollPct]    = useState(0);
  const [statsVisible, setStatsVisible] = useState(false);
  const [hoveredCity,  setHoveredCity]  = useState(null);

  const statsRef = useRef(null);
  const { displayed: typedHeadline, done: typewriterDone } = useTypewriter('Plan your world', 60, 600);

  /* ── Mount + scroll tracking ─────────────────────────────────── */
  useEffect(() => {
    setMounted(true);

    function onScroll() {
      setScrollY(window.scrollY);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(total > 0 ? (window.scrollY / total) * 100 : 0);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Intersection observers */
    const fadeObs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.fade-up').forEach((el) => fadeObs.observe(el));

    const statsObs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) statsObs.observe(statsRef.current);

    return () => {
      window.removeEventListener('scroll', onScroll);
      fadeObs.disconnect();
      statsObs.disconnect();
    };
  }, []);

  /* Parallax factor for globe section — moves up as you scroll down */
  const globeParallax = Math.min(scrollY * 0.25, 120);

  return (
    <>
      <Head>
        <title>Atlasync — Cinematic Travel Planning</title>
      </Head>

      {/* ── Scroll progress bar ──────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 h-[2px] z-[100] pointer-events-none transition-all duration-100"
        style={{
          width:      `${scrollPct}%`,
          background: 'linear-gradient(90deg, #3B82F6, #06B6D4, #8B5CF6)',
          boxShadow:  '0 0 8px rgba(59,130,246,0.8)',
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Globe — parallax shift on scroll */}
        <div
          className="absolute inset-0 z-0"
          style={{ transform: `translateY(${globeParallax}px)`, transition: 'transform 0.1s linear' }}
        >
          {mounted && (
            <Globe
              markers={WORLD_MARKERS}
              arcs={WORLD_ARCS}
              autoSpin={true}
              onMarkerHover={(m) => setHoveredCity(m?.label ?? null)}
            />
          )}
          {/* Gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-atlas-bg/50 via-transparent to-atlas-bg/85 pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(5,8,16,0.5) 100%)' }}
          />
        </div>

        {/* Hovered city label (from Globe raycasting) */}
        {hoveredCity && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-fade-in">
            <div className="glass px-4 py-2 rounded-full text-sm font-bold text-white border border-atlas-blue/30">
              📍 {hoveredCity}
            </div>
          </div>
        )}

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {/* Eyebrow pill */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-atlas-blue/30 text-sm text-atlas-cyan font-medium mb-8 animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <span className="w-2 h-2 rounded-full bg-atlas-cyan animate-pulse" />
            Travel Planning, Reimagined
          </div>

          {/* Typewriter headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-white mb-3 leading-[1.08]">
            <span className={typewriterDone ? '' : 'cursor-blink'}>{typedHeadline}</span>
            <br />
            {/* Word reveal for sub-headline */}
            <span className="text-gradient-blue" style={{ animationDelay: '1.4s' }}>
              one trip at a time
            </span>
          </h1>

          <p
            className="text-lg sm:text-xl text-atlas-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
            style={{ animationDelay: '1800ms' }}
          >
            Atlasync combines a cinematic 3D globe, AI-powered itineraries, and
            offline-first design so you can plan beautiful trips from anywhere.
          </p>

          {/* CTA buttons */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up"
            style={{ animationDelay: '2100ms' }}
          >
            <Link href="/dashboard" className="btn-glow px-8 py-3.5 text-base">
              <span>Start Planning</span>
            </Link>
            <Link href="/explorer" className="btn-ghost px-8 py-3.5 text-base">
              Explore Cities
            </Link>
          </div>

          {/* Trust micro-copy */}
          <p
            className="mt-6 text-xs text-atlas-text-muted animate-fade-in"
            style={{ animationDelay: '2400ms' }}
          >
            No account required · Works offline · AI optional
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-float">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-atlas-text-muted tracking-widest uppercase">Scroll</span>
            <div className="w-5 h-9 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2.5 rounded-full bg-atlas-blue/70 animate-bounce" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-4">
        {/* Blob accent */}
        <div
          className="blob absolute left-1/4 top-0 w-96 h-96 rounded-full bg-atlas-blue/20 -translate-x-1/2 -translate-y-1/4"
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto relative">
          {/* Section header */}
          <div className="text-center mb-16 fade-up">
            <p className="text-xs font-bold text-atlas-blue uppercase tracking-[0.2em] mb-3">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Travel smarter,
              <span className="text-gradient-blue"> not harder</span>
            </h2>
            <p className="text-atlas-text-secondary max-w-lg mx-auto text-base">
              Built for travellers who want more than a spreadsheet.
            </p>
          </div>

          {/* Feature grid — staggered */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="fade-up glass rounded-2xl p-6 hover:bg-white/[0.06] transition-all duration-300 group cursor-default"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-2xl mb-4 shadow-glow-sm group-hover:scale-110 group-hover:shadow-glow transition-all duration-300`}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold text-white text-[15px] mb-2">{f.title}</h3>
                <p className="text-atlas-text-secondary text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-4" ref={statsRef}>
        <div className="max-w-4xl mx-auto">
          <div className="glass rounded-3xl p-10 sm:p-14 text-center fade-up relative overflow-hidden">
            {/* Inner glow */}
            <div
              className="absolute inset-0 pointer-events-none rounded-3xl"
              style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,130,246,0.08), transparent)' }}
            />
            <p className="text-xs font-bold text-atlas-blue uppercase tracking-[0.2em] mb-8">By the numbers</p>
            <div className="grid grid-cols-3 gap-6 sm:gap-12 relative">
              {STATS.map((s) => (
                <CountStat key={s.label} value={s.value} suffix={s.suffix} label={s.label} active={statsVisible} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="relative z-10 py-28 px-4 text-center fade-up">
        {/* Blob accent */}
        <div
          className="blob absolute right-1/4 top-1/2 w-80 h-80 rounded-full bg-atlas-purple/15 translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <div className="max-w-2xl mx-auto relative">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight">
            Ready to explore?
          </h2>
          <p className="text-atlas-text-secondary mb-10 text-lg">
            Create your first trip in seconds — no account required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard" className="btn-glow px-10 py-4 text-base">
              <span>Open Dashboard</span>
            </Link>
            <Link href="/explorer" className="btn-ghost px-8 py-4 text-base">
              Explore Cities
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
