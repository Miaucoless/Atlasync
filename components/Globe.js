"use client";
/**
 * Globe.js — Enhanced Cinematic 3D Globe
 *
 * Enhancements over v1:
 *  ✦ Raycasting hover — detect mouseover on markers, show city tooltip overlay
 *  ✦ Animated particle trails — glowing dots race along arc flight paths
 *  ✦ Drag inertia — globe coasts smoothly to a stop after pointer release
 *  ✦ Layered atmosphere — dual glow spheres + rim light for edge depth
 *  ✦ Drop-shadow disc — subtle shadow beneath the globe for grounding
 *  ✦ Equatorial ring — thin glowing torus around the equator
 *  ✦ Spike markers — vertical rod + glowing orb at each city surface point
 *  ✦ Star twinkle — star field opacity breathes gently over time
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/* ── Math helpers ─────────────────────────────────────────────────── */

function latLngToXYZ(lat, lng, radius = 1) {
  const phi   = (90  - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y:  radius * Math.cos(phi),
    z:  radius * Math.sin(phi) * Math.sin(theta),
  };
}

function slerp(p1, p2, t) {
  const dot   = Math.max(-1, Math.min(1, p1.x*p2.x + p1.y*p2.y + p1.z*p2.z));
  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-10) return { ...p1 };
  const sinO = Math.sin(omega);
  const s1   = Math.sin((1 - t) * omega) / sinO;
  const s2   = Math.sin(t       * omega) / sinO;
  return { x: s1*p1.x + s2*p2.x, y: s1*p1.y + s2*p2.y, z: s1*p1.z + s2*p2.z };
}

/* ── Component ────────────────────────────────────────────────────── */

export default function Globe({
  markers       = [],    // [{ lat, lng, label, color }]
  arcs          = [],    // [{ from: {lat,lng}, to: {lat,lng}, color? }]
  autoSpin      = true,
  onMarkerHover = null,  // (marker | null) => void
  onMarkerClick = null,  // (marker) => void — fires on click (not drag)
  className     = '',
}) {
  const mountRef = useRef(null);

  /* All mutable animation state in a single ref — avoids stale closures
     while keeping React renders minimal */
  const st = useRef({
    isDragging:   false,
    prevMouse:    { x: 0, y: 0 },
    dragStartPos: { x: 0, y: 0 }, // track start position for click vs drag
    rotX: 0.35, rotY: 0,
    targetRotX: 0.35, targetRotY: 0,
    velX: 0, velY: 0,   // inertia
  });

  /* Tooltip is the only React-managed visual state */
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

  const initGlobe = useCallback(async () => {
    const THREE = (await import('three')).default || await import('three');
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth  || 800;
    const H = mount.clientHeight || 600;

    /* ── Renderer ───────────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* ── Scene & Camera ─────────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 1000);
    camera.position.z = 2.6;

    /* ── Lighting ───────────────────────────────────────────── */
    scene.add(new THREE.AmbientLight(0x2244aa, 0.5));

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(4, 3, 5);
    scene.add(sun);

    // Cool rim — creates atmospheric edge glow
    const rim = new THREE.DirectionalLight(0x0055ff, 0.8);
    rim.position.set(-5, -2, -4);
    scene.add(rim);

    // Warm accent
    const accent = new THREE.DirectionalLight(0x00ccff, 0.3);
    accent.position.set(3, 5, -3);
    scene.add(accent);

    /* ── Globe texture (procedural canvas) ──────────────────── */
    const GLOBE_R = 1;
    const tx  = document.createElement('canvas');
    tx.width  = 2048;
    tx.height = 1024;
    const ctx = tx.getContext('2d');

    // Deep ocean background
    const grad = ctx.createLinearGradient(0, 0, 0, tx.height);
    grad.addColorStop(0,   '#030b20');
    grad.addColorStop(0.5, '#051230');
    grad.addColorStop(1,   '#030b20');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, tx.width, tx.height);

    // Fine graticule grid
    ctx.strokeStyle = 'rgba(59,130,246,0.09)';
    ctx.lineWidth   = 0.4;
    for (let lat = -90; lat <= 90; lat += 10) {
      const y = ((90 - lat) / 180) * tx.height;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(tx.width, y); ctx.stroke();
    }
    for (let lng = -180; lng <= 180; lng += 10) {
      const x = ((lng + 180) / 360) * tx.width;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, tx.height); ctx.stroke();
    }
    // Equator & prime meridian — slightly brighter
    ctx.strokeStyle = 'rgba(59,130,246,0.24)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, tx.height/2); ctx.lineTo(tx.width, tx.height/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx.width/2, 0); ctx.lineTo(tx.width/2, tx.height); ctx.stroke();
    // Tropic & arctic circles — subtle purple
    ctx.strokeStyle = 'rgba(139,92,246,0.09)';
    [23.5, -23.5, 66.5, -66.5].forEach((lat) => {
      const y = ((90 - lat) / 180) * tx.height;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(tx.width, y); ctx.stroke();
    });

    const globeTex = new THREE.CanvasTexture(tx);
    const globeMat = new THREE.MeshPhongMaterial({
      map: globeTex, specular: new THREE.Color(0x1a3a6e), shininess: 18,
    });
    const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 72, 72), globeMat);

    /* ── Atmosphere layers ──────────────────────────────────── */
    // Primary blue glow (BackSide)
    const atmo1 = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.07, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x1a60ff, side: THREE.BackSide, transparent: true, opacity: 0.22 })
    );
    // Secondary wider halo
    const atmo2 = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.20, 48, 48),
      new THREE.MeshPhongMaterial({ color: 0x002299, side: THREE.BackSide, transparent: true, opacity: 0.06 })
    );
    // Inner surface sheen
    const innerSheen = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.005, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.04, side: THREE.BackSide })
    );

    /* ── Equatorial ring (torus) ────────────────────────────── */
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.28 });
    const equatorRing = new THREE.Mesh(new THREE.TorusGeometry(GLOBE_R * 1.015, 0.003, 8, 128), ringMat);

    /* ── Drop-shadow disc ───────────────────────────────────── */
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(GLOBE_R * 0.85, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = -GLOBE_R * 1.15;
    scene.add(shadowDisc);

    /* ── Star field ─────────────────────────────────────────── */
    const STAR_N   = 3500;
    const starPos  = new Float32Array(STAR_N * 3);
    for (let i = 0; i < STAR_N; i++) {
      const r  = 90 + Math.random() * 130;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      starPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i*3+2] = r * Math.cos(ph);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.13, transparent: true, opacity: 0.75, sizeAttenuation: true,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    /* ── Markers ────────────────────────────────────────────── */
    const markerGroup = new THREE.Group();
    const dotObjects  = [];   // raycasting targets
    const markerData  = [];   // { dotMesh, ring1, ring2, label }

    markers.forEach(({ lat, lng, label = '', color = '#3B82F6' }, idx) => {
      const c      = new THREE.Color(color);
      const pos    = latLngToXYZ(lat, lng, GLOBE_R);
      const posUp  = latLngToXYZ(lat, lng, GLOBE_R + 0.042);
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();

      // Glowing orb
      const dotGeo = new THREE.SphereGeometry(0.013, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: c });
      const dot    = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(posUp.x, posUp.y, posUp.z);
      dot._markerIdx = idx;
      markerGroup.add(dot);
      dotObjects.push(dot);

      // Vertical spike from surface
      const mid    = latLngToXYZ(lat, lng, GLOBE_R + 0.021);
      const spike  = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0014, 0.0014, 0.042, 6),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7 })
      );
      spike.position.set(mid.x, mid.y, mid.z);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      markerGroup.add(spike);

      // Pulsing rings (two, offset phase)
      const phase = Math.random() * Math.PI * 2;
      const makeRing = (inner, outer, ph) => {
        const rGeo = new THREE.RingGeometry(inner, outer, 32);
        const rMat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        const r    = new THREE.Mesh(rGeo, rMat);
        r.position.set(posUp.x, posUp.y, posUp.z);
        r.lookAt(0, 0, 0);
        r._phase  = ph;
        r._isRing = true;
        markerGroup.add(r);
        return r;
      };
      const ring1 = makeRing(0.018, 0.026, phase);
      const ring2 = makeRing(0.026, 0.032, phase + Math.PI);

      dot._phase = phase;
      markerData.push({ dotMesh: dot, ring1, ring2, label });
    });

    /* ── Arc flight paths + particle trails ─────────────────── */
    const arcGroup  = new THREE.Group();
    const arcTrails = [];

    arcs.forEach(({ from, to, color = '#06B6D4' }, arcIdx) => {
      const c  = new THREE.Color(color);
      const v1 = new THREE.Vector3(...Object.values(latLngToXYZ(from.lat, from.lng, GLOBE_R))).normalize();
      const v2 = new THREE.Vector3(...Object.values(latLngToXYZ(to.lat,   to.lng,   GLOBE_R))).normalize();

      const N      = 80;
      const points = [];
      for (let i = 0; i <= N; i++) {
        const t    = i / N;
        const sl   = slerp(v1, v2, t);
        const lift = 1 + 0.28 * Math.sin(t * Math.PI);
        points.push(new THREE.Vector3(sl.x * lift, sl.y * lift, sl.z * lift));
      }

      // Static arc line
      arcGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.3 })
      ));

      // Leading particle (larger, brighter)
      const trail = new THREE.Mesh(
        new THREE.SphereGeometry(0.009, 8, 8),
        new THREE.MeshBasicMaterial({ color: c })
      );
      arcGroup.add(trail);

      // Trailing particle (smaller, faded)
      const trail2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.005, 8, 8),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5 })
      );
      arcGroup.add(trail2);

      arcTrails.push({
        points,
        t:     (arcIdx * 0.33) % 1,
        t2:    (arcIdx * 0.33 + 0.18) % 1,
        speed: 0.0028 + Math.random() * 0.0012,
        mesh:  trail,
        mesh2: trail2,
      });
    });

    /* ── Pivot — all rotating objects ───────────────────────── */
    const pivot = new THREE.Group();
    pivot.add(globeMesh, atmo1, atmo2, innerSheen, equatorRing, markerGroup, arcGroup);
    scene.add(pivot);

    /* ── Raycaster ──────────────────────────────────────────── */
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2(-99, -99);

    /* ── Input ──────────────────────────────────────────────── */
    const el = renderer.domElement;
    const s  = st.current;
    let lastHoveredIdx = -1;

    const getXY = (e) => ({
      x: e.clientX ?? e.touches?.[0]?.clientX ?? 0,
      y: e.clientY ?? e.touches?.[0]?.clientY ?? 0,
    });

    function onPointerDown(e) {
      const { x, y } = getXY(e);
      s.isDragging   = true;
      s.prevMouse    = { x, y };
      s.dragStartPos = { x, y };   // remember where the drag started
      s.velX = s.velY = 0;
    }

    function onPointerUp(e) {
      s.isDragging = false;

      /* Click detection: if pointer barely moved, treat as a click */
      if (onMarkerClick) {
        const { x, y } = getXY(e);
        const dx = Math.abs(x - s.dragStartPos.x);
        const dy = Math.abs(y - s.dragStartPos.y);
        if (dx < 6 && dy < 6 && lastHoveredIdx >= 0 && markers[lastHoveredIdx]) {
          onMarkerClick(markers[lastHoveredIdx]);
        }
      }
    }

    function onPointerMove(e) {
      const { x, y } = getXY(e);
      const rect = el.getBoundingClientRect();
      // Always update mouse for raycasting
      mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
      mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
      if (!s.isDragging) return;
      const dx = x - s.prevMouse.x;
      const dy = y - s.prevMouse.y;
      s.velX        = dx * 0.005;
      s.velY        = dy * 0.005;
      s.targetRotY += s.velX;
      s.targetRotX += s.velY;
      s.targetRotX  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.targetRotX));
      s.prevMouse   = { x, y };
    }
    function onMouseLeave() { s.isDragging = false; mouse.set(-99, -99); }

    el.addEventListener('mousedown',  onPointerDown);
    el.addEventListener('mousemove',  onPointerMove);
    el.addEventListener('mouseup',    onPointerUp);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('touchstart', onPointerDown, { passive: true });
    el.addEventListener('touchmove',  onPointerMove, { passive: true });
    el.addEventListener('touchend',   onPointerUp);

    /* ── Resize ─────────────────────────────────────────────── */
    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    /* ── Animation loop ─────────────────────────────────────── */
    let animId, t = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      t += 0.016;

      /* ── Rotation with inertia coast ── */
      if (!s.isDragging) {
        if (autoSpin) s.targetRotY += 0.0013;
        s.targetRotY += s.velX;
        s.targetRotX += s.velY;
        s.velX *= 0.92;  // dampen
        s.velY *= 0.92;
        s.targetRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.targetRotX));
      }
      s.rotX += (s.targetRotX - s.rotX) * 0.09;
      s.rotY += (s.targetRotY - s.rotY) * 0.09;
      pivot.rotation.x = s.rotX;
      pivot.rotation.y = s.rotY;

      /* ── Raycasting hover ── */
      raycaster.setFromCamera(mouse, camera);
      const hits        = raycaster.intersectObjects(dotObjects, false);
      const hoveredIdx  = hits.length > 0 ? (hits[0].object._markerIdx ?? -1) : -1;

      if (hoveredIdx !== lastHoveredIdx) {
        // Scale down previously hovered marker
        if (lastHoveredIdx >= 0 && markerData[lastHoveredIdx]) {
          markerData[lastHoveredIdx].dotMesh.scale.setScalar(1);
        }
        lastHoveredIdx = hoveredIdx;

        if (hoveredIdx >= 0 && markerData[hoveredIdx]) {
          // Scale up hovered marker
          markerData[hoveredIdx].dotMesh.scale.setScalar(1.9);
          // Compute screen position for tooltip
          const rect    = el.getBoundingClientRect();
          const wp      = markerData[hoveredIdx].dotMesh.getWorldPosition(new THREE.Vector3());
          wp.project(camera);
          const sx = (wp.x * 0.5 + 0.5) * rect.width  + rect.left;
          const sy = (-wp.y * 0.5 + 0.5) * rect.height + rect.top;
          setTooltip({ visible: true, x: sx, y: sy, text: markers[hoveredIdx]?.label || '' });
          onMarkerHover?.(markers[hoveredIdx]);
        } else {
          setTooltip({ visible: false, x: 0, y: 0, text: '' });
          onMarkerHover?.(null);
        }
      }

      /* ── Pulse marker rings ── */
      markerGroup.children.forEach((child) => {
        if (child._isRing) {
          const s2   = 1 + 0.55 * Math.abs(Math.sin(t * 1.6 + child._phase));
          child.scale.setScalar(s2);
          child.material.opacity = 0.5 * (1 - Math.abs(Math.sin(t * 1.6 + child._phase)) * 0.75);
        }
      });

      /* ── Arc trail particles ── */
      arcTrails.forEach((arc) => {
        arc.t  = (arc.t  + arc.speed) % 1;
        arc.t2 = (arc.t2 + arc.speed) % 1;
        const i1 = Math.min(Math.floor(arc.t  * arc.points.length), arc.points.length - 1);
        const i2 = Math.min(Math.floor(arc.t2 * arc.points.length), arc.points.length - 1);
        arc.mesh.position.copy(arc.points[i1]);
        arc.mesh2.position.copy(arc.points[i2]);
        // Leading particle pulses
        arc.mesh.scale.setScalar(0.8 + 0.5 * Math.sin(t * 9));
      });

      /* ── Star twinkle ── */
      starMat.opacity = 0.5 + 0.25 * Math.sin(t * 0.4);

      /* ── Equatorial ring pulse ── */
      ringMat.opacity = 0.14 + 0.14 * Math.sin(t * 0.9);

      renderer.render(scene, camera);
    }
    animate();

    /* ── Cleanup ─────────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('mousedown',  onPointerDown);
      el.removeEventListener('mousemove',  onPointerMove);
      el.removeEventListener('mouseup',    onPointerUp);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove',  onPointerMove);
      el.removeEventListener('touchend',   onPointerUp);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [markers, arcs, autoSpin, onMarkerHover, onMarkerClick]);

  const [globeError, setGlobeError] = useState(false);

  useEffect(() => {
    let cleanup;
    initGlobe()
      .then((fn) => { cleanup = fn; })
      .catch((err) => {
        console.warn('[Atlasync] Globe init failed:', err?.message);
        setGlobeError(true);
      });
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [initGlobe]);

  if (globeError) {
    return (
      <div
        className={`w-full h-full ${className}`}
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 60%)',
          backgroundColor: '#030b20',
        }}
      />
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* City hover tooltip — positioned via portal-like fixed positioning */}
      {tooltip.visible && tooltip.text && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-1.5 rounded-xl text-xs font-bold text-white whitespace-nowrap"
          style={{
            left:           tooltip.x,
            top:            tooltip.y - 44,
            transform:      'translateX(-50%)',
            background:     'rgba(5,8,22,0.92)',
            backdropFilter: 'blur(16px)',
            border:         '1px solid rgba(59,130,246,0.4)',
            boxShadow:      '0 4px 24px rgba(59,130,246,0.35), 0 0 0 1px rgba(59,130,246,0.15)',
            animation:      'atlas-fade-in 0.12s ease-out',
          }}
        >
          {tooltip.text}
          {/* Arrow */}
          <span
            className="absolute left-1/2 -translate-x-1/2 -bottom-[6px]"
            style={{
              width: 0, height: 0,
              borderLeft:  '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop:   '6px solid rgba(59,130,246,0.4)',
            }}
          />
        </div>
      )}
    </div>
  );
}
