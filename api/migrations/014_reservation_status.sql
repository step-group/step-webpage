-- Bookings longer than 48 hours by a member start as 'pending' until an admin decides.
-- Existing bookings stay valid, so they become 'confirmed'.
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS status        VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'pending', 'rejected')),
  ADD COLUMN IF NOT EXISTS decided_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decision_note TEXT NOT NULL DEFAULT '';
