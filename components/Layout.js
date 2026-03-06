/**
 * Layout.js
 * Global page wrapper — renders the Navbar, a star-field background,
 * the page content, and a subtle footer.
 */

import { useEffect, useRef } from 'react';
import Navbar from './Navbar';

export default function Layout({ children, hideNav = false, fullBleed = false }) {
  const canvasRef = useRef(null);

  /* ── Procedural star-field ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Generate stars once
    const STAR_COUNT = 200;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      r:       Math.random() * 1.2 + 0.2,
      opacity: Math.random() * 0.6 + 0.1,
      speed:   Math.random() * 0.0003 + 0.0001,
      phase:   Math.random() * Math.PI * 2,
    }));

    let animId;
    let t = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 1;

      stars.forEach((s) => {
        const alpha = s.opacity * (0.5 + 0.5 * Math.sin(t * s.speed * 60 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-atlas-bg">
      {/* Star field background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.5 }}
      />

      {/* Radial gradient accent — subtle blue glow at top */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 60%)',
        }}
      />

      {/* Navbar */}
      {!hideNav && <Navbar />}

      {/* Page content */}
      <main className={`relative z-10 ${fullBleed ? '' : 'pt-16'}`}>
        {children}
      </main>

      {/* Footer */}
      {!fullBleed && (
        <footer className="relative z-10 border-t border-atlas-border mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gradient-blue">Atlasync</span>
                <span className="text-xs text-atlas-text-muted">— Plan. Explore. Sync.</span>
              </div>
              <p className="text-xs text-atlas-text-muted">
                © {new Date().getFullYear()} Atlasync. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
