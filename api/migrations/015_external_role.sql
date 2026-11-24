-- People from outside the lab who may use only the equipment calendar.
-- The new value is not used anywhere in this file, so it is safe inside the migration transaction.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'external';
