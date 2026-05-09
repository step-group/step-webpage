-- Experiment templates
CREATE TABLE experiment_templates (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  tags       TEXT[] NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER experiment_templates_updated_at
  BEFORE UPDATE ON experiment_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Steps belonging to a template
CREATE TABLE template_steps (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES experiment_templates(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  ordering    INTEGER NOT NULL DEFAULT 0
);

-- Resource categories
CREATE TABLE resource_categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  color      VARCHAR(7)   NOT NULL DEFAULT '#6c757d',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Lab inventory
CREATE TABLE resources (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  category_id  INTEGER REFERENCES resource_categories(id) ON DELETE SET NULL,
  quantity     NUMERIC      NOT NULL DEFAULT 0,
  unit         VARCHAR(50)  NOT NULL DEFAULT '',
  location     VARCHAR(255) NOT NULL DEFAULT '',
  cas_number   VARCHAR(20)  NOT NULL DEFAULT '',
  notes        TEXT         NOT NULL DEFAULT '',
  min_quantity NUMERIC,
  state        VARCHAR(10)  NOT NULL DEFAULT 'normal' CHECK (state IN ('normal', 'archived')),
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Experiments
CREATE TABLE experiments (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  body        TEXT         NOT NULL DEFAULT '',
  status      VARCHAR(30)  NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'success', 'failure', 'need_to_be_redone')),
  date        DATE         NOT NULL DEFAULT CURRENT_DATE,
  tags        TEXT[]       NOT NULL DEFAULT '{}',
  state       VARCHAR(10)  NOT NULL DEFAULT 'normal' CHECK (state IN ('normal', 'archived')),
  template_id INTEGER REFERENCES experiment_templates(id) ON DELETE SET NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Steps within an experiment
CREATE TABLE experiment_steps (
  id            SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  body          TEXT    NOT NULL,
  ordering      INTEGER NOT NULL DEFAULT 0,
  finished      BOOLEAN NOT NULL DEFAULT FALSE,
  finished_at   TIMESTAMPTZ
);

-- Comments on experiments
CREATE TABLE experiment_comments (
  id            SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  body          TEXT    NOT NULL,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Links between experiments and resources
CREATE TABLE exp_resource_links (
  id            SERIAL PRIMARY KEY,
  experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  resource_id   INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  UNIQUE (experiment_id, resource_id)
);
