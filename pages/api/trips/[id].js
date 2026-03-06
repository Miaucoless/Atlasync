/**
 * pages/api/trips/[id].js
 * GET    /api/trips/:id  — fetch a single trip with days & locations
 * PATCH  /api/trips/:id  — update trip metadata
 * DELETE /api/trips/:id  — delete a trip (cascades to days & locations)
 */

import { createClient } from '@supabase/supabase-js';

function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Trip id required' });

  const authHeader = req.headers.authorization;
  const token      = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = getServerSupabase();
  let user = null;
  if (token) {
    const { data: { user: u } } = await supabase.auth.getUser(token);
    user = u;
  }

  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  /* ── GET ──────────────────────────────────────────────────── */
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_days(*, trip_locations(*))')
      .eq('id', id)
      .eq('user_id', user.id)   // RLS guard
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Trip not found' });
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(data);
  }

  /* ── PATCH ────────────────────────────────────────────────── */
  if (req.method === 'PATCH') {
    const allowed = ['name', 'description', 'start_date', 'end_date', 'destinations', 'cover_image'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  /* ── DELETE ───────────────────────────────────────────────── */
  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
