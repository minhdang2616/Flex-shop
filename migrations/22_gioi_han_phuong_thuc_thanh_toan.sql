-- Restrict orders to the supported methods while preserving orders and order items.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE orders_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no        TEXT NOT NULL UNIQUE,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  ship_address    TEXT NOT NULL DEFAULT '',
  total_cents     INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','shipped','delivered','cancelled')),
  payment_method  TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','bank_qr')),
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  created_at      INTEGER NOT NULL
);

CREATE TABLE order_items_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders_new(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  name_vi          TEXT NOT NULL DEFAULT '',
  size             TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL,
  qty              INTEGER NOT NULL CHECK (qty > 0)
);

INSERT INTO orders_new (id, order_no, user_id, email, name, phone, ship_address, total_cents, status, payment_method, payment_status, created_at)
SELECT id, order_no, user_id, email, name, phone, ship_address, total_cents, status,
  CASE WHEN payment_method = 'vnpay' THEN 'cod' ELSE payment_method END,
  payment_status, created_at
FROM orders;

INSERT INTO order_items_new (id, order_id, product_id, name, name_vi, size, unit_price_cents, qty)
SELECT id, order_id, product_id, name, name_vi, size, unit_price_cents, qty
FROM order_items;

DROP TABLE order_items;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
ALTER TABLE order_items_new RENAME TO order_items;

CREATE INDEX idx_orders_status ON orders(status, created_at);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_items_order ON order_items(order_id);

PRAGMA defer_foreign_keys = OFF;
