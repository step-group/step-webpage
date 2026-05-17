-- Hierarchical locations
CREATE TABLE IF NOT EXISTS locations (
  id        SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  name      VARCHAR(100) NOT NULL,
  ordering  INTEGER NOT NULL DEFAULT 0
);

-- New container fields
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS barcode          VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier         VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado_actual    VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS grado            VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero           VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS inventory_status VARCHAR(50)  NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS location_id      INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Seed default locations
DO $$
DECLARE
  cupboards_id  INTEGER;
  lab_step_id   INTEGER;
  personal_id   INTEGER;
BEGIN
  -- Top-level
  INSERT INTO locations (name, parent_id, ordering) VALUES ('Cupboards', NULL, 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO cupboards_id;
  IF cupboards_id IS NULL THEN
    SELECT id INTO cupboards_id FROM locations WHERE name = 'Cupboards' AND parent_id IS NULL;
  END IF;

  INSERT INTO locations (name, parent_id, ordering) VALUES ('Personal', NULL, 2)
    ON CONFLICT DO NOTHING
    RETURNING id INTO personal_id;
  IF personal_id IS NULL THEN
    SELECT id INTO personal_id FROM locations WHERE name = 'Personal' AND parent_id IS NULL;
  END IF;

  -- Lab STEP under Cupboards
  INSERT INTO locations (name, parent_id, ordering) VALUES ('Lab STEP', cupboards_id, 1)
    ON CONFLICT DO NOTHING
    RETURNING id INTO lab_step_id;
  IF lab_step_id IS NULL THEN
    SELECT id INTO lab_step_id FROM locations WHERE name = 'Lab STEP' AND parent_id = cupboards_id;
  END IF;

  -- Zones under Lab STEP
  INSERT INTO locations (name, parent_id, ordering) VALUES
    ('Zone 1.1',          lab_step_id, 1),
    ('Zone 1.2',          lab_step_id, 2),
    ('Zone 1.3',          lab_step_id, 3),
    ('Zone 1.4',          lab_step_id, 4),
    ('Zone 2.1',          lab_step_id, 5),
    ('Zone 2.2',          lab_step_id, 6),
    ('Zone 2.3',          lab_step_id, 7),
    ('Zone 2.4',          lab_step_id, 8),
    ('Zone 3.1',          lab_step_id, 9),
    ('Zone 3.2',          lab_step_id, 10),
    ('Zone 3.3',          lab_step_id, 11),
    ('Zone 3.4',          lab_step_id, 12),
    ('Zone 4.4',          lab_step_id, 13),
    ('Zone Refrigerador', lab_step_id, 14)
  ON CONFLICT DO NOTHING;

  -- Children of Personal
  INSERT INTO locations (name, parent_id, ordering) VALUES
    ('[Unassigned]', personal_id, 1),
    ('New Location',  personal_id, 2),
    ('Store',         personal_id, 3)
  ON CONFLICT DO NOTHING;
END $$;
