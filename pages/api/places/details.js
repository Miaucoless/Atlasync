// pages/api/places/details.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const key = process.env.GEOAPIFY_API_KEY;
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Missing place id' });
    }

    const url = `https://api.geoapify.com/v2/place-details?id=${id}&apiKey=${key}`;
    const r = await fetch(url);
    const data = await r.json();

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Place detail failed' });
  }
}
