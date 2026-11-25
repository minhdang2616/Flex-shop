-- Re-enable VNPay orders and record each signed gateway payment attempt.
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
  payment_method  TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','bank_qr','vnpay')),
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
SELECT id, order_no, user_id, email, name, phone, ship_address, total_cents, status, payment_method, payment_status, created_at FROM orders;
INSERT INTO order_items_new (id, order_id, product_id, name, name_vi, size, unit_price_cents, qty)
SELECT id, order_id, product_id, name, name_vi, size, unit_price_cents, qty FROM order_items;

DROP TABLE order_items;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
ALTER TABLE order_items_new RENAME TO order_items;
CREATE INDEX idx_orders_status ON orders(status, created_at);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_items_order ON order_items(order_id);

CREATE TABLE payment_attempts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gateway            TEXT NOT NULL CHECK (gateway IN ('vnpay')),
  txn_ref            TEXT NOT NULL UNIQUE,
  amount_vnd         INTEGER NOT NULL CHECK (amount_vnd > 0),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  transaction_no     TEXT NOT NULL DEFAULT '',
  bank_code          TEXT NOT NULL DEFAULT '',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_payment_attempts_order ON payment_attempts(order_id, id DESC);
CREATE UNIQUE INDEX idx_payment_attempts_single_pending ON payment_attempts(order_id) WHERE status = 'pending';

PRAGMA defer_foreign_keys = OFF;
