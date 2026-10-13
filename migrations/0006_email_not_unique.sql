-- Older installations created users.email as UNIQUE. Email is contact information,
-- not an account identifier, so preserve every account while removing that constraint.
-- D1 defers FK checks for the duration of this migration transaction while users is rebuilt.
PRAGMA defer_foreign_keys = ON;

-- One legacy account has a blank username. Keep it and give it a valid, unique login name.
UPDATE users
SET username = 'legacy_' || id || '_' || lower(substr(hex(randomblob(6)), 1, 12))
WHERE username IS NULL OR trim(username) = '';

CREATE TABLE users_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email           TEXT NOT NULL COLLATE NOCASE,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  city            TEXT NOT NULL DEFAULT '',
  postal_code     TEXT NOT NULL DEFAULT '',
  country         TEXT NOT NULL DEFAULT '',
  google_sub      TEXT,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','staff','admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  last_login_at   INTEGER
);

INSERT INTO users_new (id, username, email, name, phone, address, city, postal_code, country, google_sub,
  password_hash, role, status, failed_attempts, locked_until, created_at, last_login_at)
SELECT id, username, email, name, phone, address, city, postal_code, country, google_sub,
  password_hash, role, status, failed_attempts, locked_until, created_at, last_login_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
PRAGMA defer_foreign_keys = OFF;
