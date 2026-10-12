-- Photos are kept in Workers KV (free), not R2. This only renames the column that holds the stored file's key.
-- Run ONCE, after 0004:  npx wrangler d1 execute flex-db --remote --file=migrations/0005_photo_storage.sql

ALTER TABLE product_images RENAME COLUMN r2_key TO file_key;
