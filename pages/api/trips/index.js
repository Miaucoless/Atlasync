/**
 * pages/api/trips/index.js
 * GET  /api/trips  — list all trips for the authenticated user
 * POST /api/trips  — create a new trip
 */

import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client (uses service role for server reads)
function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default async function handler(req, res) {
  // Auth: extract the user from the Authorization header (Bearer <JWT>)
  const authHeader = req.headers.authorization;
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = getServerSupabase();

  // Verify the token and get the user
  let user = null;
  if (token) {
    const { data: { user: u }, error } = await supabase.auth.getUser(token);
    if (!error) user = u;
  }

  /* ── GET — list trips ──────────────────────────────────────── */
  if (req.method === 'GET') {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_days(*, trip_locations(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  /* ── POST — create trip ────────────────────────────────────── */
  if (req.method === 'POST') {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, start_date, end_date, destinations } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('trips')
      .insert([{
        user_id:      user.id,
        name:         name.trim(),
        description:  description ?? null,
        start_date:   start_date  ?? null,
        end_date:     end_date    ?? null,
        destinations: destinations ?? [],
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
