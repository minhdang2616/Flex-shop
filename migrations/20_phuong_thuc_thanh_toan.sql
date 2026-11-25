-- Allow the supported payment methods while preserving existing orders and their child records.
-- Run once on databases created before VNPay and direct bank QR were enabled.
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
  payment_method  TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','vnpay','bank_qr')),
  payment_status  TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  created_at      INTEGER NOT NULL
);

INSERT INTO orders_new (id, order_no, user_id, email, name, phone, ship_address, total_cents, status, payment_method, payment_status, created_at)
SELECT id, order_no, user_id, email, name, phone, ship_address, total_cents, status, payment_method, payment_status, created_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

PRAGMA defer_foreign_keys = OFF;
