/**
 * pages/api/travel/routes.js
 * POST /api/travel/routes
 *
 * Body: { oName, dName }  (origin/destination place names)
 *
 * Tries Rome2Rio for multi-modal options (flight, train, bus, etc.)
 * Returns normalized route array.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { oName, dName } = req.body;
  if (!oName || !dName) return res.status(400).json({ error: '`oName` and `dName` are required' });

  const rome2rioKey = process.env.ROME2RIO_API_KEY;

  if (!rome2rioKey) {
    return res.status(200).json({ routes: [], available: false });
  }

  const MODE_MAP = {
    flight:  { emoji: '✈️',  label: 'Fly',   mode: 'flight'  },
    train:   { emoji: '🚆',  label: 'Train', mode: 'train'   },
    bus:     { emoji: '🚌',  label: 'Bus',   mode: 'bus'     },
    ferry:   { emoji: '⛴️', label: 'Ferry', mode: 'ferry'   },
    car:     { emoji: '🚗',  label: 'Drive', mode: 'drive'   },
    bicycle: { emoji: '🚴',  label: 'Cycle', mode: 'cycle'   },
    walk:    { emoji: '🚶',  label: 'Walk',  mode: 'walk'    },
  };

  try {
    const url = `https://free.rome2rio.com/api/1.4/json/Search?key=${rome2rioKey}&oName=${encodeURIComponent(oName)}&dName=${encodeURIComponent(dName)}&currencyCode=USD&languageCode=en`;
    const r   = await fetch(url);
    if (!r.ok) throw new Error(`Rome2Rio ${r.status}`);
    const data = await r.json();

    const routes = (data.routes ?? []).slice(0, 6).map((route) => {
      // Rome2Rio: indicative_price, duration_min, name, segments
      const mainSegment = route.segments?.[0];
      const vehicle     = mainSegment?.vehicle?.toLowerCase?.() ?? route.name?.toLowerCase() ?? '';
      const meta        = Object.values(MODE_MAP).find((m) => vehicle.includes(m.mode)) ?? MODE_MAP.car;

      const priceRange = route.indicative_price;
      const price = priceRange
        ? `$${priceRange.low}–$${priceRange.high}`
        : null;

      return {
        ...meta,
        duration: route.duration_min ?? null,
        distance: route.distance     ?? null,
        price,
        operator: route.name ?? null,
        segments: (route.segments ?? []).slice(0, 3).map(
          (s) => `${s.vehicle ?? ''} to ${s.arrivalPlace?.shortName ?? ''}`
        ),
      };
    });

    return res.status(200).json({ routes, available: true });
  } catch (e) {
    console.error('[travel/routes]', e.message);
    return res.status(200).json({ routes: [], available: false, error: e.message });
  }
}
