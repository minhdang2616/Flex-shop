-- Switches login from email to username. Email stays on the account as plain info, no longer unique or used to sign in.
-- Run: npx wrangler d1 execute flex-db --remote --file=migrations/0003_username_login.sql

ALTER TABLE users ADD COLUMN username TEXT;

-- Backfill: every existing account gets a starting username derived from their email (the part before @, lowercased).
-- If two existing accounts would collide, this appends their id to keep it unique -- check and rename afterward if you want something nicer.
UPDATE users
SET username = CASE
  WHEN (SELECT COUNT(*) FROM users u2 WHERE lower(substr(u2.email, 1, instr(u2.email, '@') - 1)) = lower(substr(users.email, 1, instr(users.email, '@') - 1)) AND u2.id != users.id) = 0
    THEN lower(substr(email, 1, instr(email, '@') - 1))
  ELSE lower(substr(email, 1, instr(email, '@') - 1)) || id
END
WHERE username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);

-- After this runs, check your usernames and change any you don't like, e.g.:
--   UPDATE users SET username = 'minhdang' WHERE id = 1;
-- (the UNIQUE index will reject a value already taken by someone else)
