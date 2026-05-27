ALTER TABLE dataset_compounds
  ADD COLUMN resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL,
  ADD COLUMN grade        VARCHAR(100);
