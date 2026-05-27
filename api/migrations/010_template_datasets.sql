CREATE TABLE template_datasets (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES experiment_templates(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL DEFAULT 'Dataset de densidad',
  equipment   VARCHAR(255) NOT NULL DEFAULT '',
  ordering    INTEGER NOT NULL DEFAULT 0
);
