/**
 * supabaseClient.js
 * Single shared Supabase client for the entire app.
 *
 * Schema: run migrations in order so trip_days exists before trip_locations (foreign key).
 *   supabase/migrations/001_trips_and_trip_days.sql  — trips, trip_days
 *   supabase/migrations/002_trip_locations.sql       — trip_locations (references trip_days)
 * In Supabase Dashboard → SQL Editor, run 001 first, then 002.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Atlasync] Supabase env vars missing. Running in offline/demo mode.'
  );
}

// Create the client (safe to call on server and client)
export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnon || 'placeholder-anon-key',
  {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl: true,
    },
  }
);

/* ── Auth helpers ─────────────────────────────────────────────────────── */

/** Sign in with Google OAuth */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (error) throw error;
  return data;
}

/** Sign out the current user */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get the currently authenticated user (null if not logged in or on error) */
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** Update profile picture URL (stored in user_metadata.avatar_url) */
export async function updateProfilePicture(avatarUrl) {
  const { data, error } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl || null },
  });
  if (error) throw error;
  return data.user;
}

/**
 * Upload avatar to Supabase Storage. Returns public URL.
 * Create bucket "avatars" in Supabase Dashboard → Storage, set to Public.
 */
export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
  return publicUrl;
}

/* ── Trip CRUD helpers ────────────────────────────────────────────────── */

/** Fetch all trips for the current user */
export async function fetchTrips(userId) {
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_days(*, trip_locations(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Fetch a single trip by id */
export async function fetchTrip(tripId) {
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_days(*, trip_locations(*))')
    .eq('id', tripId)
    .single();
  if (error) throw error;
  return data;
}

/** Create a new trip */
export async function createTrip(userId, tripData) {
  const { data, error } = await supabase
    .from('trips')
    .insert([{ user_id: userId, ...tripData }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update an existing trip (only sends fields in updates; no updated_at to avoid schema cache errors if column is missing) */
export async function updateTrip(tripId, updates) {
  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete a trip (cascade deletes days & locations) */
export async function deleteTrip(tripId) {
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);
  if (error) throw error;
}

/** Insert trip days and return the created rows with IDs */
export async function insertTripDays(tripId, days) {
  const rows = days.map((d) => ({
    trip_id: tripId,
    day_number: d.day_number,
    date: d.date ?? null,
    title: d.title ?? null,
    notes: d.notes ?? null,
  }));
  const { data, error } = await supabase
    .from('trip_days')
    .insert(rows)
    .select();
  if (error) throw error;
  return data;
}

/* ── Location helpers ────────────────────────────────────────────────── */

/** Upsert a list of locations for a trip */
export async function upsertLocations(locations) {
  const { data, error } = await supabase
    .from('trip_locations')
    .upsert(locations, { onConflict: 'id' })
    .select();
  if (error) throw error;
  return data;
}

/** Delete a single location */
export async function deleteLocation(locationId) {
  const { error } = await supabase
    .from('trip_locations')
    .delete()
    .eq('id', locationId);
  if (error) throw error;
}

/** Delete all locations for the given day IDs (e.g. before replacing with AI itinerary to avoid duplicates) */
export async function deleteLocationsByDayIds(dayIds) {
  if (!Array.isArray(dayIds) || dayIds.length === 0) return;
  const { error } = await supabase
    .from('trip_locations')
    .delete()
    .in('day_id', dayIds);
  if (error) throw error;
}
