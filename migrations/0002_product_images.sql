-- Run this once against your existing database:
--   npx wrangler d1 execute flex-db --remote --file=migrations/0002_product_images.sql
-- Safe to run even if you started from the newest schema.sql (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL CHECK (url LIKE 'https://%'),
  alt_text   TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL DEFAULT 0,
  width      INTEGER,
  height     INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id, position);
