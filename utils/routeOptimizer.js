/**
 * routeOptimizer.js
 * Offline-first route optimization using the Nearest Neighbor heuristic
 * for the Travelling Salesman Problem (TSP).
 *
 * All logic runs locally in the browser — no API call required.
 * For better results, an optional AI-powered optimization can be swapped in
 * via the `optimizeRouteAI` function below.
 */

/* ── Haversine distance (great-circle distance in km) ─────────────────── */

/**
 * Calculate the distance in kilometers between two lat/lng points.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in km
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R   = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/* ── Distance matrix ─────────────────────────────────────────────────── */

/**
 * Build an n×n distance matrix from an array of location objects.
 * @param {Array<{lat: number, lng: number}>} locations
 * @returns {number[][]}
 */
export function buildDistanceMatrix(locations) {
  const n = locations.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 0;
      return haversineDistance(
        locations[i].lat, locations[i].lng,
        locations[j].lat, locations[j].lng
      );
    })
  );
}

/* ── Nearest Neighbour TSP ───────────────────────────────────────────── */

/**
 * Nearest Neighbour greedy heuristic.
 * Returns indices in visit order starting from `startIndex` (default 0).
 * @param {number[][]} distMatrix
 * @param {number}     startIndex
 * @returns {number[]} Ordered list of indices
 */
function nearestNeighbour(distMatrix, startIndex = 0) {
  const n       = distMatrix.length;
  const visited = new Set([startIndex]);
  const route   = [startIndex];
  let   current = startIndex;

  while (visited.size < n) {
    let bestDist = Infinity;
    let bestNext = -1;

    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && distMatrix[current][j] < bestDist) {
        bestDist = distMatrix[current][j];
        bestNext = j;
      }
    }

    if (bestNext === -1) break; // safety guard
    visited.add(bestNext);
    route.push(bestNext);
    current = bestNext;
  }

  return route;
}

/* ── 2-opt improvement ──────────────────────────────────────────────── */

/**
 * Apply 2-opt local search to improve a greedy route.
 * Iteratively reverses sub-routes when that reduces total distance.
 * @param {number[]}   route
 * @param {number[][]} distMatrix
 * @returns {number[]} Improved route
 */
function twoOpt(route, distMatrix) {
  let improved = true;
  let best     = [...route];

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const before =
          distMatrix[best[i - 1]][best[i]] +
          distMatrix[best[j]][best[(j + 1) % best.length]];
        const after =
          distMatrix[best[i - 1]][best[j]] +
          distMatrix[best[i]][best[(j + 1) % best.length]];

        if (after < before - 1e-9) {
          // Reverse segment [i .. j]
          best = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1),
          ];
          improved = true;
        }
      }
    }
  }

  return best;
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Optimize the visit order of a list of locations (offline, instant).
 *
 * @param {Array<{id: string, name: string, lat: number, lng: number}>} locations
 * @param {object} [options]
 * @param {boolean} [options.twoOptEnabled=true]  Apply 2-opt improvement
 * @param {number}  [options.startIndex=0]        Index of starting location
 * @returns {{
 *   orderedLocations: typeof locations,
 *   totalDistanceKm:  number,
 *   routeIndices:     number[]
 * }}
 */
export function optimizeRoute(locations, options = {}) {
  const { twoOptEnabled = true, startIndex = 0 } = options;

  if (!locations || locations.length <= 1) {
    return {
      orderedLocations: locations || [],
      totalDistanceKm:  0,
      routeIndices:     locations ? [0] : [],
    };
  }

  // Filter out locations without coordinates
  const valid = locations.filter(
    (l) => typeof l.lat === 'number' && typeof l.lng === 'number'
  );

  if (valid.length === 0) {
    return { orderedLocations: locations, totalDistanceKm: 0, routeIndices: [] };
  }

  const matrix      = buildDistanceMatrix(valid);
  let   routeIdx    = nearestNeighbour(matrix, startIndex);
  if (twoOptEnabled) routeIdx = twoOpt(routeIdx, matrix);

  const orderedLocations = routeIdx.map((i) => valid[i]);
  const totalDistanceKm  = routeIdx.reduce((sum, cur, i) => {
    if (i === 0) return sum;
    return sum + matrix[routeIdx[i - 1]][cur];
  }, 0);

  return {
    orderedLocations,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    routeIndices: routeIdx,
  };
}

/**
 * Estimate travel time between two points using a speed assumption.
 * @param {number} distKm
 * @param {'walking'|'driving'|'transit'} mode
 * @returns {string} Human-readable time, e.g. "25 min"
 */
export function estimateTravelTime(distKm, mode = 'driving') {
  const speeds = { walking: 5, driving: 40, transit: 25 }; // km/h averages
  const speed  = speeds[mode] || 40;
  const mins   = Math.round((distKm / speed) * 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/**
 * Convert a lat/lng coordinate to a map-friendly format.
 * @param {number} lat
 * @param {number} lng
 * @returns {[number, number]} [longitude, latitude] (Mapbox order)
 */
export function toMapboxCoord(lat, lng) {
  return [lng, lat];
}

/**
 * Generate a GeoJSON LineString from an ordered list of locations.
 * Useful for rendering the optimized route on a Mapbox map.
 * @param {Array<{lat: number, lng: number}>} orderedLocations
 * @returns {object} GeoJSON FeatureCollection
 */
export function routeToGeoJSON(orderedLocations) {
  const coordinates = orderedLocations.map((l) => [l.lng, l.lat]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {},
      },
    ],
  };
}
