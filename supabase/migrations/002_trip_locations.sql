-- Atlasync: trip_locations (run after 001_trips_and_trip_days.sql)
-- References trip_days(id), so trip_days table must already exist.

CREATE TABLE IF NOT EXISTS trip_locations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id          UUID REFERENCES trips(id) ON DELETE CASCADE,
  day_id           UUID REFERENCES trip_days(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  type             TEXT DEFAULT 'attraction',
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  address          TEXT,
  notes            TEXT,
  visit_order      INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 60
);

ALTER TABLE trip_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Locs via trip" ON trip_locations;
CREATE POLICY "Locs via trip" ON trip_locations FOR ALL
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));
