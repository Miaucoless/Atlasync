export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { coords, mode = 'drive' } = req.body;
    const key = process.env.GEOAPIFY_API_KEY;

    const waypoints = coords.map(c => `${c.lat},${c.lng}`).join('|');

    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints}&mode=${mode}&apiKey=${key}`;
    const r = await fetch(url);
    const data = await r.json();

    const feature = data.features?.[0];
    return res.status(200).json({
      geometry: feature.geometry,
      summary: {
        distance_m: feature.properties.distance,
        duration_s: feature.properties.time
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Routing failed' });
  }
}
