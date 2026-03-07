/**
 * WorldGlobe.js — Amplified 3D Globe for the World Explorer page
 *
 * Extended from Globe.js with:
 *  ✦ 100+ city markers across all continents
 *  ✦ Fly-to animation — smooth rotation to any city
 *  ✦ Selected marker state — larger orb, solid ring, no pulse
 *  ✦ Mode-based coloring — discover / budget / climate / routes
 *  ✦ Region dimming — fade out markers outside active continent
 *  ✦ Click UX fixes:
 *      - Auto-spin pauses on mouseenter, resumes on mouseleave
 *      - Globe freezes when a city panel is open (autoSpin=false)
 *      - 2× invisible raycasting hit spheres for easier clicking
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/* ── Math helpers ─────────────────────────────────────────────── */

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

/* Compute approximate solar hour angle for day/night band */
function getSolarTerminatorPoints(numPoints = 180) {
  const now    = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = -180 + (utcHour / 24) * 360;
  const subsolarLat = declination;

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const lng = -180 + (i / numPoints) * 360;
    // Approximate terminator latitude for this longitude
    const lngDiff = lng - subsolarLng;
    const lat = Math.atan2(
      -Math.cos(lngDiff * Math.PI / 180),
      Math.tan(subsolarLat * Math.PI / 180)
    ) * 180 / Math.PI;
    points.push({ lat, lng });
  }
  return points;
}

/* ── Color helpers for modes ──────────────────────────────────── */

function budgetColor(costLevel) {
  // 1=cheapest (green) → 5=expensive (red)
  const colors = ['#10B981', '#84cc16', '#F59E0B', '#f97316', '#EF4444'];
  return colors[Math.min(Math.max((costLevel ?? 3) - 1, 0), 4)];
}

function climateColor(climate) {
  const map = {
    tropical:   '#f97316',
    subtropical:'#F59E0B',
    temperate:  '#3B82F6',
    continental:'#8B5CF6',
    arid:       '#eab308',
    mediterranean: '#06B6D4',
    polar:      '#e2e8f0',
    highland:   '#10B981',
  };
  return map[climate] ?? '#3B82F6';
}

/* ── Component ────────────────────────────────────────────────── */

export default function WorldGlobe({
  markers         = [],
  arcs            = [],
  autoSpin        = true,
  selectedIdx     = -1,
  activeContinent = 'All',
  mode            = 'discover',
  onMarkerHover   = null,
  onMarkerClick   = null,
  onGlobeInit     = null,  // called with { flyTo } when ready
  className       = '',
}) {
  const mountRef = useRef(null);

  const st = useRef({
    isDragging:    false,
    isHovering:    false,       // mouse is over canvas
    prevMouse:     { x: 0, y: 0 },
    dragStartPos:  { x: 0, y: 0 },
    rotX: 0.2, rotY: 0,
    targetRotX: 0.2, targetRotY: 0,
    velX: 0, velY: 0,
    flyTarget:     null,        // { rotX, rotY } for fly-to
    flyProgress:   1,
  });

  const [tooltip, setTooltip]         = useState({ visible: false, x: 0, y: 0, text: '', time: '' });
  const [textureLoaded, setTextureLoaded] = useState(false);

  const flyTo = useCallback((lat, lng) => {
    const phi   = (90 - lat)   * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const targetRotX = -(phi - Math.PI / 2);
    const targetRotY = -theta + Math.PI;
    st.current.flyTarget   = { rotX: targetRotX, rotY: targetRotY };
    st.current.flyProgress = 0;
  }, []);

  const initGlobe = useCallback(async () => {
    const THREE = (await import('three')).default || await import('three');
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth  || 900;
    const H = mount.clientHeight || 700;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* ── Scene & Camera ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000);
    camera.position.z = 2.8;

    /* ── Lighting ── */
    scene.add(new THREE.AmbientLight(0x2244aa, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(4, 3, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x0055ff, 0.8);
    rim.position.set(-5, -2, -4);
    scene.add(rim);
    const accent = new THREE.DirectionalLight(0x00ccff, 0.3);
    accent.position.set(3, 5, -3);
    scene.add(accent);

    /* ── Globe ── */
    const GLOBE_R = 1;
    const loadTex = (url) => new Promise(resolve => {
      new THREE.TextureLoader().load(url, resolve, undefined, () => resolve(null));
    });
    const [earthMap, earthSpec, earthNorm] = await Promise.all([
      loadTex('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
      loadTex('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
      loadTex('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
    ]);
    const globeMat = new THREE.MeshPhongMaterial({
      map:       earthMap,
      ...(earthSpec ? { specularMap: earthSpec } : { specular: new THREE.Color(0x1a3a6e) }),
      ...(earthNorm ? { normalMap: earthNorm, normalScale: new THREE.Vector2(0.5, 0.5) } : {}),
      shininess: 25,
    });
    const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 72, 72), globeMat);
    // Signal parent that texture has loaded (fade-in handled via state)
    mount._onTextureLoad?.();

    /* ── Atmosphere ── */
    const atmo1 = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.07, 64, 64),
      new THREE.MeshPhongMaterial({ color: 0x1a60ff, side: THREE.BackSide, transparent: true, opacity: 0.22 })
    );
    const atmo2 = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.20, 48, 48),
      new THREE.MeshPhongMaterial({ color: 0x002299, side: THREE.BackSide, transparent: true, opacity: 0.06 })
    );
    const innerSheen = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.005, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.04, side: THREE.BackSide })
    );

    /* ── Equatorial ring ── */
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.12 });
    const equatorRing = new THREE.Mesh(new THREE.TorusGeometry(GLOBE_R * 1.015, 0.003, 8, 128), ringMat);

    /* ── Shadow disc ── */
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(GLOBE_R * 0.85, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = -GLOBE_R * 1.15;
    scene.add(shadowDisc);

    /* ── Stars ── */
    const STAR_N  = 4000;
    const starPos = new Float32Array(STAR_N * 3);
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
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.75, sizeAttenuation: true });
    scene.add(new THREE.Points(starGeo, starMat));

    /* ── Markers ── */
    const markerGroup = new THREE.Group();
    const hitObjects  = [];    // invisible larger spheres for raycasting
    const markerData  = [];

    // Shared refs for reactive props (updated without re-init)
    const liveProps = {
      selectedIdx,
      activeContinent,
      mode,
      markers,
    };

    markers.forEach((m, idx) => {
      const resolvedColor = getMarkerColor(m, mode);
      const c      = new THREE.Color(resolvedColor);
      const pos    = latLngToXYZ(m.lat, m.lng, GLOBE_R);
      const posUp  = latLngToXYZ(m.lat, m.lng, GLOBE_R + 0.042);
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();

      // Visible orb (slightly smaller for less clutter)
      const dotGeo = new THREE.SphereGeometry(0.010, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color: c });
      const dot    = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(posUp.x, posUp.y, posUp.z);
      dot._markerIdx = idx;
      markerGroup.add(dot);

      // INVISIBLE larger hit sphere (2× radius = much easier to click)
      const hitGeo = new THREE.SphereGeometry(0.032, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hit    = new THREE.Mesh(hitGeo, hitMat);
      hit.position.set(posUp.x, posUp.y, posUp.z);
      hit._markerIdx = idx;
      markerGroup.add(hit);
      hitObjects.push(hit);

      // Spike
      const mid   = latLngToXYZ(m.lat, m.lng, GLOBE_R + 0.021);
      const spike = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0014, 0.0014, 0.042, 6),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7 })
      );
      spike.position.set(mid.x, mid.y, mid.z);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      markerGroup.add(spike);

      // Rings — hidden by default, shown only for hovered/selected cities
      const phase = Math.random() * Math.PI * 2;
      const makeRing = (inner, outer, ph) => {
        const rMat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        const r    = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), rMat);
        r.position.set(posUp.x, posUp.y, posUp.z);
        r.lookAt(0, 0, 0);
        r._phase  = ph;
        r._isRing = true;
        r.visible = false;   // hidden until hover/select
        markerGroup.add(r);
        return r;
      };
      const ring1 = makeRing(0.018, 0.026, phase);
      const ring2 = makeRing(0.026, 0.032, phase + Math.PI);

      dot._phase = phase;
      markerData.push({ dotMesh: dot, spike, ring1, ring2, dotMat, spikeMat: spike.material, ring1Mat: ring1.material, ring2Mat: ring2.material, marker: m });
    });

    /* ── Arcs ── */
    const arcGroup  = new THREE.Group();
    const arcTrails = [];

    arcs.forEach(({ from, to, color = '#06B6D4' }, arcIdx) => {
      const c  = new THREE.Color(color);
      const v1 = new THREE.Vector3(...Object.values(latLngToXYZ(from.lat, from.lng, GLOBE_R))).normalize();
      const v2 = new THREE.Vector3(...Object.values(latLngToXYZ(to.lat,   to.lng,   GLOBE_R))).normalize();
      const N  = 80;
      const points = [];
      for (let i = 0; i <= N; i++) {
        const t    = i / N;
        const sl   = slerp(v1, v2, t);
        const lift = 1 + 0.28 * Math.sin(t * Math.PI);
        points.push(new THREE.Vector3(sl.x * lift, sl.y * lift, sl.z * lift));
      }
      arcGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.3 })
      ));
      const trail = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), new THREE.MeshBasicMaterial({ color: c }));
      arcGroup.add(trail);
      const trail2 = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5 }));
      arcGroup.add(trail2);
      arcTrails.push({ points, t: (arcIdx * 0.33) % 1, t2: (arcIdx * 0.33 + 0.18) % 1, speed: 0.0025 + Math.random() * 0.001, mesh: trail, mesh2: trail2 });
    });

    /* ── Pivot ── */
    const pivot = new THREE.Group();
    pivot.add(globeMesh, atmo1, atmo2, innerSheen, equatorRing, markerGroup, arcGroup);
    scene.add(pivot);

    /* ── Raycaster ── */
    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2(-99, -99);

    /* ── Input ── */
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
      s.dragStartPos = { x, y };
      s.velX = s.velY = 0;
      s.flyTarget = null; // interrupt fly-to on drag
    }

    function onPointerUp(e) {
      s.isDragging = false;
      if (onMarkerClick) {
        const { x, y } = getXY(e);
        const dx = Math.abs(x - s.dragStartPos.x);
        const dy = Math.abs(y - s.dragStartPos.y);
        if (dx < 6 && dy < 6 && lastHoveredIdx >= 0 && markers[lastHoveredIdx]) {
          onMarkerClick(markers[lastHoveredIdx], lastHoveredIdx);
        }
      }
    }

    function onPointerMove(e) {
      const { x, y } = getXY(e);
      const rect = el.getBoundingClientRect();
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

    function onMouseEnter() { s.isHovering = true; }
    function onMouseLeave() { s.isDragging = false; s.isHovering = false; mouse.set(-99, -99); }

    el.addEventListener('mousedown',  onPointerDown);
    el.addEventListener('mousemove',  onPointerMove);
    el.addEventListener('mouseup',    onPointerUp);
    el.addEventListener('mouseenter', onMouseEnter);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('touchstart', onPointerDown, { passive: true });
    el.addEventListener('touchmove',  onPointerMove, { passive: true });
    el.addEventListener('touchend',   onPointerUp);

    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    /* ── Animation loop ── */
    let animId, t = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      t += 0.016;

      const shouldSpin = autoSpin && !s.isHovering && !s.isDragging;

      /* Fly-to interpolation */
      if (s.flyTarget && s.flyProgress < 1) {
        s.flyProgress = Math.min(s.flyProgress + 0.014, 1);
        const ease = 1 - Math.pow(1 - s.flyProgress, 3);
        s.targetRotX = s.rotX + (s.flyTarget.rotX - s.rotX) * ease;
        s.targetRotY = s.rotY + (s.flyTarget.rotY - s.rotY) * ease;
        if (s.flyProgress >= 1) s.flyTarget = null;
      } else if (!s.isDragging) {
        if (shouldSpin) s.targetRotY += 0.0008; // slower than before
        s.targetRotY += s.velX;
        s.targetRotX += s.velY;
        s.velX *= 0.92;
        s.velY *= 0.92;
        s.targetRotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, s.targetRotX));
      }
      s.rotX += (s.targetRotX - s.rotX) * 0.09;
      s.rotY += (s.targetRotY - s.rotY) * 0.09;
      pivot.rotation.x = s.rotX;
      pivot.rotation.y = s.rotY;

      /* Raycasting */
      raycaster.setFromCamera(mouse, camera);
      const hits       = raycaster.intersectObjects(hitObjects, false);
      const hoveredIdx = hits.length > 0 ? (hits[0].object._markerIdx ?? -1) : -1;

      if (hoveredIdx !== lastHoveredIdx) {
        if (lastHoveredIdx >= 0 && markerData[lastHoveredIdx]) {
          markerData[lastHoveredIdx].dotMesh.scale.setScalar(1);
        }
        lastHoveredIdx = hoveredIdx;
        if (hoveredIdx >= 0 && markerData[hoveredIdx]) {
          markerData[hoveredIdx].dotMesh.scale.setScalar(2.2);
          const rect = el.getBoundingClientRect();
          const wp   = markerData[hoveredIdx].dotMesh.getWorldPosition(new THREE.Vector3());
          wp.project(camera);
          const sx = (wp.x * 0.5 + 0.5) * rect.width  + rect.left;
          const sy = (-wp.y * 0.5 + 0.5) * rect.height + rect.top;
          const m  = markers[hoveredIdx];
          // Local time
          let timeStr = '';
          try {
            timeStr = new Date().toLocaleTimeString('en-US', { timeZone: m.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
          } catch {}
          setTooltip({ visible: true, x: sx, y: sy, text: m?.label || '', time: timeStr });
          onMarkerHover?.(m);
        } else {
          setTooltip({ visible: false, x: 0, y: 0, text: '', time: '' });
          onMarkerHover?.(null);
        }
      }

      /* Update marker colors, opacity, and ring visibility per frame */
      markerData.forEach((md, idx) => {
        const m           = md.marker;
        const isSelected  = idx === liveProps.selectedIdx;
        const isHovered   = idx === lastHoveredIdx;
        const inContinent = liveProps.activeContinent === 'All' || m.continent === liveProps.activeContinent;
        const tOp         = inContinent ? 1 : 0.15;
        const color       = new THREE.Color(getMarkerColor(m, liveProps.mode));

        md.dotMat.color.set(color);
        md.ring1Mat.color.set(color);
        md.ring2Mat.color.set(color);
        md.spikeMat.opacity = 0.7 * tOp;

        if (isSelected) {
          md.dotMesh.scale.setScalar(2.8);
          md.ring1.visible = true; md.ring2.visible = true;
          const pulse = 1 + 0.3 * Math.abs(Math.sin(t * 1.6 + md.dotMesh._phase));
          md.ring1.scale.setScalar(pulse); md.ring2.scale.setScalar(pulse * 1.15);
          md.ring1Mat.opacity = 0.9 * tOp; md.ring2Mat.opacity = 0.7 * tOp;
        } else if (isHovered) {
          md.ring1.visible = true; md.ring2.visible = false;
          md.ring1.scale.setScalar(1.4); md.ring1Mat.opacity = 0.7;
          // hover dot scale handled by the raycasting block above
        } else {
          md.ring1.visible = false; md.ring2.visible = false;
          md.dotMesh.scale.setScalar(inContinent ? 1 : 0.7);
        }
      });

      /* Arc trails */
      arcTrails.forEach((arc) => {
        arc.t  = (arc.t  + arc.speed) % 1;
        arc.t2 = (arc.t2 + arc.speed) % 1;
        const i1 = Math.min(Math.floor(arc.t  * arc.points.length), arc.points.length - 1);
        const i2 = Math.min(Math.floor(arc.t2 * arc.points.length), arc.points.length - 1);
        arc.mesh.position.copy(arc.points[i1]);
        arc.mesh2.position.copy(arc.points[i2]);
        arc.mesh.scale.setScalar(0.8 + 0.5 * Math.sin(t * 9));
      });

      starMat.opacity  = 0.5 + 0.25 * Math.sin(t * 0.4);
      ringMat.opacity  = 0.14 + 0.14 * Math.sin(t * 0.9);

      renderer.render(scene, camera);
    }

    animate();

    /* Keep liveProps in sync without re-init */
    const syncLive = (props) => { Object.assign(liveProps, props); };
    mount._syncLive = syncLive;

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('mousedown',  onPointerDown);
      el.removeEventListener('mousemove',  onPointerMove);
      el.removeEventListener('mouseup',    onPointerUp);
      el.removeEventListener('mouseenter', onMouseEnter);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove',  onPointerMove);
      el.removeEventListener('touchend',   onPointerUp);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, arcs]); // only re-init when city data changes

  /* Sync reactive props without re-initialising the globe */
  useEffect(() => {
    if (mountRef.current?._syncLive) {
      mountRef.current._syncLive({ selectedIdx, activeContinent, mode, markers });
    }
  }, [selectedIdx, activeContinent, mode, markers]);

  const [globeError, setGlobeError] = useState(false);
  useEffect(() => {
    // Wire up texture-loaded callback before initGlobe runs
    if (mountRef.current) mountRef.current._onTextureLoad = () => setTextureLoaded(true);
    let cleanup;
    initGlobe()
      .then((fn) => { cleanup = fn; })
      .catch(() => setGlobeError(true));
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [initGlobe]);

  /* Expose flyTo to parent via callback */
  useEffect(() => {
    onGlobeInit?.({ flyTo });
  }, [flyTo, onGlobeInit]);

  if (globeError) {
    return (
      <div className={`w-full h-full ${className}`}
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 60%)', backgroundColor: '#030b20' }}
      />
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Loading spinner — shown while Earth texture downloads */}
      {!textureLoaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-atlas-blue border-t-transparent rounded-full animate-spin"/>
            <p className="text-xs text-atlas-text-muted">Loading Earth…</p>
          </div>
        </div>
      )}

      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none', opacity: textureLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
      >
      {tooltip.visible && tooltip.text && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap"
          style={{
            left: tooltip.x, top: tooltip.y - 56,
            transform: 'translateX(-50%)',
            background: 'rgba(5,8,22,0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(59,130,246,0.4)',
            boxShadow: '0 4px 24px rgba(59,130,246,0.35)',
          }}
        >
          <div>{tooltip.text}</div>
          {tooltip.time && <div className="text-atlas-cyan text-[10px] font-normal mt-0.5 text-center">{tooltip.time}</div>}
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-[6px]"
            style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid rgba(59,130,246,0.4)' }}
          />
        </div>
      )}
      </div>
    </div>
  );
}

/* ── Helper: resolve marker color based on mode ── */
function getMarkerColor(marker, mode) {
  switch (mode) {
    case 'budget':  return budgetColor(marker.costLevel);
    case 'climate': return climateColor(marker.climate);
    case 'routes':  return '#06B6D4';
    default:        return marker.color ?? '#3B82F6';
  }
}
