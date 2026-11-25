ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod'));
ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded'));
ALTER TABLE order_items ADD COLUMN name_vi TEXT NOT NULL DEFAULT '';

UPDATE order_items
SET name_vi = COALESCE((SELECT p.name_vi FROM products p WHERE p.id = order_items.product_id), name)
WHERE name_vi = '';
