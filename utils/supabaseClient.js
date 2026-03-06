/**
 * supabaseClient.js
 * Single shared Supabase client for the entire app.
 *
 * Required Supabase tables (run these in your Supabase SQL editor):
 *
 * -- Enable UUID extension
 * CREATE EXTENSION IF NOT EXISTS "pgcrypto";
 *
 * -- Trips
 * CREATE TABLE trips (
 *   id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   name         TEXT NOT NULL,
 *   description  TEXT,
 *   cover_image  TEXT,
 *   start_date   DATE,
 *   end_date     DATE,
 *   destinations JSONB DEFAULT '[]',
 *   created_at   TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at   TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Trip days
 * CREATE TABLE trip_days (
 *   id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   trip_id    UUID REFERENCES trips(id) ON DELETE CASCADE,
 *   day_number INTEGER NOT NULL,
 *   date       DATE,
 *   title      TEXT,
 *   notes      TEXT
 * );
 *
 * -- Trip locations (points of interest, restaurants, hotels)
 * CREATE TABLE trip_locations (
 *   id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   trip_id          UUID REFERENCES trips(id) ON DELETE CASCADE,
 *   day_id           UUID REFERENCES trip_days(id) ON DELETE SET NULL,
 *   name             TEXT NOT NULL,
 *   type             TEXT DEFAULT 'attraction',
 *   lat              DOUBLE PRECISION,
 *   lng              DOUBLE PRECISION,
 *   address          TEXT,
 *   notes            TEXT,
 *   visit_order      INTEGER DEFAULT 0,
 *   duration_minutes INTEGER DEFAULT 60
 * );
 *
 * -- Row-level security (optional but recommended)
 * ALTER TABLE trips         ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE trip_days     ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE trip_locations ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users own trips"    ON trips          FOR ALL USING (auth.uid() = user_id);
 * CREATE POLICY "Trip days via trip" ON trip_days      FOR ALL USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));
 * CREATE POLICY "Locs via trip"      ON trip_locations FOR ALL USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));
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

/** Get the currently authenticated user (null if not logged in) */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
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

/** Update an existing trip */
export async function updateTrip(tripId, updates) {
  const { data, error } = await supabase
    .from('trips')
    .update({ ...updates, updated_at: new Date().toISOString() })
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
