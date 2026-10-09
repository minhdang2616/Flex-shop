-- Adds: personal details on accounts, Google sign-in, shipping snapshot on orders, and file-upload support for product photos.
-- Run ONCE, after 0003:  npx wrangler d1 execute flex-db --remote --file=migrations/0004_accounts_uploads.sql

ALTER TABLE users ADD COLUMN phone       TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN address     TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN city        TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN country     TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN google_sub  TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

ALTER TABLE orders ADD COLUMN phone        TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN ship_address TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS oauth_pending (
  token_hash TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- product_images: SQLite can't relax a CHECK in place, so rebuild the table (existing photos are copied across unchanged).
CREATE TABLE product_images_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url          TEXT,
  r2_key       TEXT,
  content_type TEXT,
  size_bytes   INTEGER,
  alt_text     TEXT NOT NULL DEFAULT '',
  position     INTEGER NOT NULL DEFAULT 0,
  width        INTEGER,
  height       INTEGER,
  created_at   INTEGER NOT NULL,
  CHECK ((url IS NOT NULL AND url LIKE 'https://%') OR r2_key IS NOT NULL)
);
INSERT INTO product_images_new (id, product_id, url, alt_text, position, width, height, created_at)
  SELECT id, product_id, url, alt_text, position, width, height, created_at FROM product_images;
DROP TABLE product_images;
ALTER TABLE product_images_new RENAME TO product_images;
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id, position);
