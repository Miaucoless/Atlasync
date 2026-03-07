-- Atlasync: trips and trip_days (run first)
-- trip_days must exist before trip_locations because of day_id foreign key.
-- Run in Supabase Dashboard → SQL Editor, or use: supabase db push

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  cover_image  TEXT,
  start_date   DATE,
  end_date     DATE,
  destinations JSONB DEFAULT '[]',
  sections     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Trip days (linked to trips). Must exist before trip_locations.
CREATE TABLE IF NOT EXISTS trip_days (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id    UUID REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date       DATE,
  title      TEXT,
  notes      TEXT
);

-- Row-level security
ALTER TABLE trips     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own trips" ON trips;
CREATE POLICY "Users own trips" ON trips FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Trip days via trip" ON trip_days;
CREATE POLICY "Trip days via trip" ON trip_days FOR ALL
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));
