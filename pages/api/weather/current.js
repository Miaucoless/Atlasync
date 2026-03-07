/**
 * pages/api/weather/current.js
 * GET /api/weather/current?lat=XX&lng=YY
 *
 * Returns current weather from OpenWeatherMap.
 * { data: {...}, available: boolean }
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: '`lat` and `lng` are required' });

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return res.status(200).json({ data: null, available: false });

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric&lang=en`;
    const r   = await fetch(url);
    if (!r.ok) throw new Error(`OpenWeather ${r.status}: ${await r.text()}`);
    const data = await r.json();

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json({ data, available: true });
  } catch (e) {
    console.error('[weather/current]', e.message);
    return res.status(200).json({ data: null, available: false, error: e.message });
  }
}
