-- Convert current USD-denominated catalog and order snapshots to VND at 25,000 VND per USD.
-- price_cents continues to store 1/100 of the display amount: VND 1,200,000 => 120,000,000.
UPDATE products SET price_cents = price_cents * 25000;
UPDATE orders SET total_cents = total_cents * 25000;
UPDATE order_items SET unit_price_cents = unit_price_cents * 25000;

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
