-- Shared lab equipment that can be reserved (microwave, centrifuge, ...)
CREATE TABLE IF NOT EXISTS equipment (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  location    VARCHAR(150) NOT NULL DEFAULT '',
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- A booking is one continuous block from starts_at to ends_at, like a calendar event.
CREATE TABLE IF NOT EXISTS reservations (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER      NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  notes        TEXT         NOT NULL DEFAULT '',
  starts_at    TIMESTAMPTZ  NOT NULL,
  ends_at      TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS reservations_equipment_starts_idx
  ON reservations (equipment_id, starts_at);
