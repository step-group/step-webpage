CREATE TABLE publications (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(500)  NOT NULL,
  authors     TEXT          NOT NULL DEFAULT '',
  journal     VARCHAR(255)  NOT NULL DEFAULT '',
  year        INTEGER,
  doi         VARCHAR(255)  NOT NULL DEFAULT '',
  abstract    TEXT          NOT NULL DEFAULT '',
  status      VARCHAR(20)   NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','submitted','under_review','published')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER publications_updated_at
  BEFORE UPDATE ON publications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE publication_datasets (
  id              SERIAL PRIMARY KEY,
  publication_id  INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  dataset_id      INTEGER NOT NULL REFERENCES datasets(id)     ON DELETE CASCADE,
  UNIQUE (publication_id, dataset_id)
);
