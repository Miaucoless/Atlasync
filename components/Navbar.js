"use client";
/**
 * Navbar.js
 * Top navigation bar — glassmorphism, scroll blur, icon links,
 * user avatar dropdown with click-outside, quick "New Trip" action.
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase, signOut, getCurrentUser } from '../utils/supabaseClient';
import ProfilePictureModal from './ProfilePictureModal';

const NAV_LINKS = [
  {
    href:  '/',
    label: 'Home',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    ),
  },
  {
    href:  '/world',
    label: 'World',
    badge: 'New',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        <path d="M12 2v20" strokeOpacity="0.5" />
      </svg>
    ),
  },
  {
    href:  '/dashboard',
    label: 'My Trips',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href:  '/explorer',
    label: 'Explorer',
    badge: 'New',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
];

export default function Navbar() {
  const router   = useRouter();
  const menuRef  = useRef(null);

  const [user,           setUser]           = useState(null);
  const [scrolled,       setScrolled]       = useState(false);
  const [menuOpen,        setMenuOpen]      = useState(false);
  const [userMenuOpen,    setUserMenuOpen]  = useState(false);
  const [profilePicOpen,  setProfilePicOpen] = useState(false);

  /* Scroll blur */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Auth state — deferred to avoid refresh loop; .catch() prevents unhandled rejections */
  useEffect(() => {
    const t = setTimeout(() => {
      supabase.auth.getUser()
        .then(({ data: { user } }) => setUser(user))
        .catch(() => {
          setUser(null);
          supabase.auth.signOut().catch(() => {});
        });
    }, 100);
    let sub;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_, session) => { try { setUser(session?.user ?? null); } catch {} }
      );
      sub = subscription;
    } catch {
      sub = null;
    }
    return () => {
      clearTimeout(t);
      sub?.unsubscribe?.();
    };
  }, []);

  /* Click-outside closes user dropdown */
  useEffect(() => {
    if (!userMenuOpen) return;
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  /* Close mobile menu on route change */
  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [router.pathname]);

  const isActive = (href) =>
    href === '/' ? router.pathname === '/' : router.pathname.startsWith(href);

  async function handleSignOut() {
    try {
      await signOut();
      router.push('/');
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled
          ? 'backdrop-blur-heavy border-b border-atlas-border bg-[rgba(5,8,16,0.88)]'
          : 'bg-transparent'}
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ─────────────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-atlas-blue opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-[3px] rounded-full border border-atlas-cyan opacity-60" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-atlas-blue/20 to-atlas-cyan/10" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-atlas-blue/60 -translate-y-px" />
              {/* Meridian */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-atlas-blue/30 -translate-x-px" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-blue">Atlas</span>
              <span className="text-white/90">ync</span>
            </span>
          </Link>

          {/* ── Desktop nav links ─────────────────────────────────── */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label, icon, badge }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${active
                      ? 'text-white bg-white/[0.07]'
                      : 'text-atlas-text-secondary hover:text-white hover:bg-white/[0.04]'}
                  `}
                >
                  <span className={`transition-colors duration-200 ${active ? 'text-atlas-blue' : ''}`}>
                    {icon}
                  </span>
                  {label}
                  {badge && (
                    <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-atlas-blue/20 text-atlas-blue border border-atlas-blue/30 leading-none">
                      {badge}
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0.5 left-4 right-4 h-px bg-gradient-to-r from-atlas-blue to-atlas-cyan rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── Right section ─────────────────────────────────────── */}
          <div className="flex items-center gap-2">

            {user ? (
              <>
                {/* Quick: New Trip */}
                <Link
                  href="/dashboard"
                  className="hidden sm:flex items-center gap-1.5 btn-ghost text-xs py-1.5 px-3 border-atlas-blue/30 text-atlas-blue hover:bg-atlas-blue/10"
                  title="Create a new trip"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>New Trip</span>
                </Link>

                {/* User avatar + dropdown */}
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 ${
                      userMenuOpen
                        ? 'glass-heavy border border-white/10'
                        : 'glass hover:bg-white/[0.08]'
                    }`}
                  >
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Avatar"
                        className="w-7 h-7 rounded-full object-cover ring-2 ring-atlas-blue/40"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-blue-purple flex items-center justify-center text-xs font-bold text-white">
                        {(user.email?.[0] ?? 'U').toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-white hidden sm:block max-w-[120px] truncate">
                      {user.user_metadata?.name || user.email?.split('@')[0]}
                    </span>
                    <ChevronIcon open={userMenuOpen} />
                  </button>

                  {/* Dropdown */}
                  {userMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 glass-heavy rounded-2xl py-1.5 shadow-card border border-white/[0.07]"
                      style={{ animation: 'slide-in-bottom 0.2s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-white/[0.06]">
                        <div className="flex items-center gap-2.5">
                          {user.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-blue-purple flex items-center justify-center text-xs font-bold text-white">
                              {(user.email?.[0] ?? 'U').toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {user.user_metadata?.name || 'Traveller'}
                            </p>
                            <p className="text-[10px] text-atlas-text-muted truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="py-1">
                        <button
                          onClick={() => { setUserMenuOpen(false); setProfilePicOpen(true); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-atlas-text-secondary hover:text-white hover:bg-white/[0.05] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Change profile picture
                        </button>
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-atlas-text-secondary hover:text-white hover:bg-white/[0.05] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                          </svg>
                          My Trips
                        </Link>
                        <Link
                          href="/explorer"
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-atlas-text-secondary hover:text-white hover:bg-white/[0.05] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                          </svg>
                          Explorer
                        </Link>
                      </div>

                      <div className="border-t border-white/[0.06] pt-1">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/dashboard" className="btn-glow text-sm py-2 px-4">
                <span>Get Started</span>
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-xl glass"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <div className="w-5 space-y-[5px]">
                <span className={`block h-px bg-white transition-all duration-300 origin-center ${menuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
                <span className={`block h-px bg-white transition-all duration-300 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block h-px bg-white transition-all duration-300 origin-center ${menuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────── */}
      {menuOpen && (
        <div
          className="md:hidden glass-heavy border-t border-atlas-border"
          style={{ animation: 'slide-in-bottom 0.2s cubic-bezier(0.25,0.46,0.45,0.94) both' }}
        >
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ href, label, icon, badge }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                    ${active
                      ? 'text-white bg-white/[0.07]'
                      : 'text-atlas-text-secondary hover:text-white hover:bg-white/[0.04]'}
                  `}
                >
                  <span className={active ? 'text-atlas-blue' : ''}>{icon}</span>
                  {label}
                  {badge && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-atlas-blue/20 text-atlas-blue border border-atlas-blue/30 leading-none">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {user && (
              <div className="pt-2 mt-2 border-t border-white/[0.06]">
                <div className="flex items-center gap-3 px-4 py-3">
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover ring-2 ring-atlas-blue/30" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-blue-purple flex items-center justify-center text-xs font-bold text-white">
                      {(user.email?.[0] ?? 'U').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{user.user_metadata?.name || 'Traveller'}</p>
                    <p className="text-[10px] text-atlas-text-muted truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); setProfilePicOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-atlas-text-secondary hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Change profile picture
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {profilePicOpen && user && (
        <ProfilePictureModal
          user={user}
          onClose={() => setProfilePicOpen(false)}
          onUpdated={() => getCurrentUser().then(setUser)}
        />
      )}
    </nav>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-atlas-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
