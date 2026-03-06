/**
 * Navbar.js
 * Top navigation bar with glassmorphism, animated underline, and user avatar.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase, signOut } from '../utils/supabaseClient';

export default function Navbar() {
  const router = useRouter();
  const [user,         setUser]         = useState(null);
  const [scrolled,     setScrolled]     = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  /* Track scroll for navbar blur effect */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Subscribe to Supabase auth state */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  const navLinks = [
    { href: '/',          label: 'Home'      },
    { href: '/dashboard', label: 'My Trips'  },
    { href: '/explorer',  label: 'Explorer'  },
  ];

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
          ? 'backdrop-blur-heavy border-b border-atlas-border bg-[rgba(5,8,16,0.85)]'
          : 'bg-transparent'}
      `}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8">
              {/* Globe icon made of rings */}
              <div className="absolute inset-0 rounded-full border-2 border-atlas-blue opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-[3px] rounded-full border border-atlas-cyan opacity-60" />
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-atlas-blue/20 to-atlas-cyan/10" />
              {/* Equator line */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-atlas-blue/60 -translate-y-px" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-blue">Atlas</span>
              <span className="text-white/90">ync</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`
                  relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive(href)
                    ? 'text-white'
                    : 'text-atlas-text-secondary hover:text-white'}
                `}
              >
                {/* Active indicator */}
                {isActive(href) && (
                  <span className="absolute inset-0 rounded-lg bg-white/[0.06]" />
                )}
                <span className="relative">{label}</span>
                {isActive(href) && (
                  <span className="absolute bottom-0.5 left-4 right-4 h-px bg-gradient-to-r from-atlas-blue to-atlas-cyan rounded-full" />
                )}
              </Link>
            ))}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">
            {user ? (
              /* User avatar + dropdown */
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-white/[0.08] transition-all duration-200"
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
                    className="absolute right-0 mt-2 w-52 glass-heavy rounded-xl py-1 shadow-card animate-slide-up"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-atlas-border">
                      <p className="text-xs text-atlas-text-muted">Signed in as</p>
                      <p className="text-sm font-medium text-white truncate">{user.email}</p>
                    </div>
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-atlas-text-secondary hover:text-white hover:bg-white/[0.06] transition-colors">
                      <GridIcon /> My Trips
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                    >
                      <SignOutIcon /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Sign-in button */
              <Link href="/dashboard" className="btn-glow text-sm py-2 px-4">
                <span>Get Started</span>
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg glass"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <div className="space-y-1.5 w-5">
                <span className={`block h-px bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                <span className={`block h-px bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-px bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden glass-heavy border-t border-atlas-border animate-slide-up">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`
                  block px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isActive(href)
                    ? 'text-white bg-white/[0.06]'
                    : 'text-atlas-text-secondary hover:text-white hover:bg-white/[0.04]'}
                `}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

/* ── Micro icons ────────────────────────────────────────────────────── */

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

function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
