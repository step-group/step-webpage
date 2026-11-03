-- Allow more than 2 compounds per dataset (ternary and higher-order mixtures)
ALTER TABLE dataset_compounds
  DROP CONSTRAINT IF EXISTS dataset_compounds_compound_index_check;

ALTER TABLE dataset_compounds
  ADD CONSTRAINT dataset_compounds_compound_index_check
  CHECK (compound_index >= 1);
