/**
 * pages/api/routes/optimize.js
 * POST /api/routes/optimize
 *
 * Body: { locations: [{ id, name, lat, lng }], options?: { twoOptEnabled } }
 * Returns: { orderedLocations, totalDistanceKm, routeIndices }
 *
 * This endpoint runs the same offline algorithm as routeOptimizer.js
 * so it can also be called server-side or from native apps.
 */

import {
  optimizeRoute,
  buildDistanceMatrix,
} from '../../../utils/routeOptimizer';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { locations, options = {} } = req.body;

  if (!Array.isArray(locations)) {
    return res.status(400).json({ error: '`locations` must be an array.' });
  }
  if (locations.length === 0) {
    return res.status(200).json({ orderedLocations: [], totalDistanceKm: 0, routeIndices: [] });
  }

  try {
    const result = optimizeRoute(locations, {
      twoOptEnabled: options.twoOptEnabled !== false, // default true
      startIndex:    options.startIndex    ?? 0,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[optimize]', err);
    return res.status(500).json({ error: err.message || 'Optimisation failed.' });
  }
}
