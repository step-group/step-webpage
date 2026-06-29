ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS date_acquired           DATE,
  ADD COLUMN IF NOT EXISTS comments                TEXT         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS almacenamiento_requerido VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clase_quimica           VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS disposicion_residuos    VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estado_fisico           VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS modelacion              VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS polaridad               VARCHAR(100) NOT NULL DEFAULT '';
