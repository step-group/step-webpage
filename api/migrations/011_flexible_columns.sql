-- Columnas definidas por dataset de template
CREATE TABLE template_columns (
  id                   SERIAL PRIMARY KEY,
  template_dataset_id  INTEGER NOT NULL REFERENCES template_datasets(id) ON DELETE CASCADE,
  name                 VARCHAR(100) NOT NULL,
  unit                 VARCHAR(50)  NOT NULL DEFAULT '',
  ordering             INTEGER      NOT NULL DEFAULT 0
);

-- Columnas de un dataset concreto (copiadas desde template, editables)
CREATE TABLE dataset_columns (
  id          SERIAL PRIMARY KEY,
  dataset_id  INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  unit        VARCHAR(50)  NOT NULL DEFAULT '',
  ordering    INTEGER      NOT NULL DEFAULT 0
);

-- Filas de datos flexibles (reemplaza dataset_points)
CREATE TABLE dataset_rows (
  id          SERIAL PRIMARY KEY,
  dataset_id  INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  data        JSONB   NOT NULL DEFAULT '{}',
  ordering    INTEGER NOT NULL DEFAULT 0
);

DROP TABLE IF EXISTS dataset_points;
