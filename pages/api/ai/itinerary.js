/**
 * pages/api/ai/itinerary.js
 * POST /api/ai/itinerary
 *
 * Generates a structured day-by-day travel itinerary using DeepSeek (or Anthropic as fallback).
 *
 * Body:
 *   {
 *     destination: string,       // e.g. "Tokyo, Japan"
 *     numDays: number,           // 1–14
 *     interests: string[],       // e.g. ["culture", "food", "photography"]
 *     pace: "relaxed" | "balanced" | "packed",
 *     startDate?: string,        // ISO date string (optional)
 *     userIdeas?: string,        // optional ideas/preferences
 *     existingLocations?: string,// optional list of places to include (one per line or comma-separated)
 *     existingPlacesWithCoords?: { name: string, lat: number, lng: number }[], // from Google Maps link; AI returns recommended_additions for places not in itinerary
 *   }
 *
 * Response:
 *   {
 *     days: [
 *       {
 *         day_number: number,
 *         theme: string,
 *         locations: [
 *           {
 *             name: string,
 *             type: "attraction" | "restaurant" | "hotel" | "transport" | "activity",
 *             address: string,
 *             lat: number,
 *             lng: number,
 *             notes: string,
 *             duration_minutes: number,
 *           }
 *         ]
 *       }
 *     ],
 *     recommended_additions?: { name: string, lat: number, lng: number }[]  // when existingPlacesWithCoords provided: list places not in itinerary
 *   }
 *
 * Requires env var: DEEPSEEK_API_KEY (or ANTHROPIC_API_KEY as fallback)
 */

const LOCATIONS_PER_DAY = { relaxed: 3, balanced: 4, packed: 6 };

/** Geocode a place name + address to real coordinates via Mapbox (fixes AI hallucinated coords). */
async function geocodePlace(name, address, destination) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const query = [name, address, destination].filter(Boolean).join(', ');
  if (!query.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const feature = data.features?.[0];
    if (!feature?.center?.length) return null;
    const [lng, lat] = feature.center;
    return { lat, lng };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!deepseekKey && !anthropicKey) {
    return res.status(503).json({
      error: 'AI features are not configured. Add DEEPSEEK_API_KEY or ANTHROPIC_API_KEY to .env.local.',
    });
  }

  const {
    destination,
    numDays = 3,
    interests = [],
    pace = 'balanced',
    startDate,
    userIdeas,
    existingLocations,
    existingPlacesWithCoords,
  } = req.body;

  if (!destination || typeof destination !== 'string') {
    return res.status(400).json({ error: '`destination` is required.' });
  }
  if (typeof numDays !== 'number' || numDays < 1 || numDays > 14) {
    return res.status(400).json({ error: '`numDays` must be between 1 and 14.' });
  }

  const locsPerDay = LOCATIONS_PER_DAY[pace] ?? 4;
  const interestStr = interests.length
    ? `The traveller is especially interested in: ${interests.join(', ')}.`
    : 'The traveller has broad interests.';
  const dateStr = startDate
    ? `The trip starts on ${new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`
    : '';
  const ideasStr = userIdeas && typeof userIdeas === 'string' && userIdeas.trim()
    ? `\nThe traveller's ideas and preferences: ${userIdeas.trim()}`
    : '';
  const listStr = existingLocations && typeof existingLocations === 'string' && existingLocations.trim()
    ? `\nIMPORTANT — Include these places in the itinerary (spread across days, integrate logically):\n${existingLocations.trim()}`
    : '';
  const hasListWithCoords = Array.isArray(existingPlacesWithCoords) && existingPlacesWithCoords.length > 0;

  const system = [
    'You are Atlas, an expert AI travel planner with encyclopedic knowledge of destinations worldwide.',
    'You generate detailed, practical, and inspiring day-by-day travel itineraries.',
    'You always respond with ONLY valid JSON — no markdown code fences, no explanation, no preamble.',
    'Coordinates must be accurate real-world values. Addresses must be real.',
  ].join(' ');

  const userPrompt = `Generate a ${numDays}-day travel itinerary for ${destination}.
${dateStr}
${interestStr}${ideasStr}${listStr}

Pace: ${pace} (${locsPerDay} locations per day).

Return ONLY this JSON structure (no markdown fences, no other text):
{
  "days": [
    {
      "day_number": 1,
      "theme": "Short evocative theme for the day",
      "locations": [
        {
          "name": "Full place name",
          "type": "attraction",
          "address": "Full street address",
          "lat": 0.0000,
          "lng": 0.0000,
          "notes": "2–3 sentences: why visit, best time, insider tip",
          "duration_minutes": 90
        }
      ]
    }
  ]${hasListWithCoords ? ',\n  "recommended_additions": [ { "name": "Place name", "lat": 0.0, "lng": 0.0 } ]' : ''}
}

Rules:
- Include exactly ${numDays} days
- Each day has exactly ${locsPerDay} locations
- Types must be one of: attraction, restaurant, hotel, transport, activity
- Coordinates must be accurate real-world WGS84 values
- Vary location types across the day (e.g. mix attractions with meals)
- Order locations logically by geography to minimise travel time
- Day themes should be evocative and specific (not just "Day 1")${listStr ? '\n- You MUST include every place from the user\'s list above; spread them across days and integrate them naturally' : ''}${hasListWithCoords ? '\n- You MUST also return "recommended_additions": an array of places from the user\'s list that you did NOT include in the itinerary (e.g. because of time or pace). Each item: { "name": string, "lat": number, "lng": number }. Use the exact names and coordinates from the user\'s list for recommended_additions.' : ''}`;

  try {
    let text;

    if (deepseekKey) {
      // DeepSeek (OpenAI-compatible API) — free tier available
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model:      'deepseek-chat',
          max_tokens: 4000,
          messages:   [
            { role: 'system', content: system },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: body.error?.message || `DeepSeek API error ${response.status}`,
        });
      }

      const data = await response.json();
      text = data.choices?.[0]?.message?.content ?? '';
    } else {
      // Anthropic Claude (fallback)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          system,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: body.error?.message || `Anthropic API error ${response.status}`,
        });
      }

      const data = await response.json();
      text = data.content?.[0]?.text ?? '';
    }

    // Strip any accidental markdown fences
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      console.error('[ai/itinerary] Failed to parse JSON:', clean.slice(0, 200));
      return res.status(500).json({ error: 'AI returned malformed itinerary. Please try again.' });
    }

    if (!Array.isArray(parsed?.days)) {
      return res.status(500).json({ error: 'AI response missing `days` array.' });
    }

    // When user provided a list with coords, compute recommended_additions = places from list NOT in itinerary (so map can show them)
    if (hasListWithCoords && existingPlacesWithCoords.length > 0) {
      const includedNames = new Set(
        (parsed.days || []).flatMap((d) => (d.locations || []).map((l) => (l.name || '').toLowerCase().trim()))
      );
      parsed.recommended_additions = existingPlacesWithCoords
        .filter((p) => !includedNames.has((p.name || '').toLowerCase().trim()))
        .map((p) => ({
          name: String(p.name || 'Unknown'),
          lat:  typeof p.lat === 'number' ? p.lat : null,
          lng:  typeof p.lng === 'number' ? p.lng : null,
        }))
        .filter((p) => p.lat != null && p.lng != null);
    } else if (!Array.isArray(parsed.recommended_additions)) {
      parsed.recommended_additions = [];
    }

    // Sanitise — ensure required fields
    parsed.days = parsed.days.map((day, i) => ({
      day_number: day.day_number ?? i + 1,
      theme:      typeof day.theme === 'string' ? day.theme : `Day ${i + 1}`,
      locations: (Array.isArray(day.locations) ? day.locations : []).map((loc) => ({
        name:             String(loc.name || 'Unknown place'),
        type:             ['attraction','restaurant','hotel','transport','activity'].includes(loc.type)
                            ? loc.type : 'attraction',
        address:          String(loc.address || ''),
        lat:              typeof loc.lat === 'number' ? loc.lat : null,
        lng:              typeof loc.lng === 'number' ? loc.lng : null,
        notes:            String(loc.notes || ''),
        duration_minutes: typeof loc.duration_minutes === 'number'
                            ? Math.max(15, Math.min(480, loc.duration_minutes)) : 60,
      })),
    }));

    // Geocode each location so markers appear at real places (AI coordinates are often wrong)
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (mapboxToken) {
      const dest = (destination || '').trim();
      const allLocs = parsed.days.flatMap((d) => d.locations);
      const geocoded = await Promise.all(
        allLocs.map(async (loc) => {
          const coords = await geocodePlace(loc.name, loc.address, dest);
          return coords ? { ...loc, lat: coords.lat, lng: coords.lng } : loc;
        })
      );
      let idx = 0;
      parsed.days = parsed.days.map((day) => {
        const count = day.locations.length;
        const locations = geocoded.slice(idx, idx + count);
        idx += count;
        return { ...day, locations };
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('[ai/itinerary]', err);
    return res.status(500).json({ error: 'Failed to reach the AI service.' });
  }
}
