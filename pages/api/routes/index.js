export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const key = process.env.GEOAPIFY_API_KEY;
    const { categories, filter } = req.query;

    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=${filter}&apiKey=${key}`;
    const r = await fetch(url);
    const data = await r.json();

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Places search failed' });
  }
}
