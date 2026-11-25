ALTER TABLE products ADD COLUMN sale_price_cents INTEGER CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0);
ALTER TABLE drops ADD COLUMN name_vi TEXT NOT NULL DEFAULT '';
ALTER TABLE drops ADD COLUMN description_vi TEXT NOT NULL DEFAULT '';
