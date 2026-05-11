-- Datasets de medición ligados a experimentos
CREATE TABLE datasets (
  id                  SERIAL PRIMARY KEY,
  experiment_id       INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  title               VARCHAR(255) NOT NULL,
  equipment           VARCHAR(255) NOT NULL DEFAULT '',
  calibration_notes   TEXT         NOT NULL DEFAULT '',
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER datasets_updated_at
  BEFORE UPDATE ON datasets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Componentes del sistema (hasta 2 para mezclas binarias)
CREATE TABLE dataset_compounds (
  id              SERIAL PRIMARY KEY,
  dataset_id      INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  compound_index  INTEGER NOT NULL CHECK (compound_index IN (1, 2)),
  name            VARCHAR(255) NOT NULL,
  cas_number      VARCHAR(20)  NOT NULL DEFAULT '',
  purity          NUMERIC,
  purity_unit     VARCHAR(10)  NOT NULL DEFAULT 'mol%',
  supplier        VARCHAR(255) NOT NULL DEFAULT '',
  UNIQUE (dataset_id, compound_index)
);

-- Puntos de medición individuales
CREATE TABLE dataset_points (
  id              SERIAL PRIMARY KEY,
  dataset_id      INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  temperature_k   NUMERIC      NOT NULL,
  pressure_kpa    NUMERIC      NOT NULL DEFAULT 101.325,
  mole_fraction_1 NUMERIC      CHECK (mole_fraction_1 >= 0 AND mole_fraction_1 <= 1),
  density_kg_m3   NUMERIC      NOT NULL,
  u_density       NUMERIC,
  u_temperature   NUMERIC,
  u_pressure      NUMERIC,
  phase           VARCHAR(50)  NOT NULL DEFAULT 'liquid',
  notes           TEXT         NOT NULL DEFAULT '',
  ordering        INTEGER      NOT NULL DEFAULT 0
);
