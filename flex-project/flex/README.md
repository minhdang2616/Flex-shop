# Flex: storefront + admin hub on Cloudflare Pages + D1

One project, one deploy. Static pages live in `public/`, the API is a Pages Function in
`functions/api/[[path]].js`, and all data lives in a D1 (SQLite) database defined by `schema.sql`.

## Deploy (about 10 minutes)

Requires a Cloudflare account and Node 18+.

```bash
npx wrangler login

# 1. Create the database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create flex-db

# 2. Create tables and load the sample catalog
npx wrangler d1 execute flex-db --remote --file=schema.sql
npx wrangler d1 execute flex-db --remote --file=seed.sql

# 3. Create the Pages project and a one-time setup secret (use a long random string)
npx wrangler pages project create flex --production-branch main
npx wrangler pages secret put SETUP_TOKEN --project-name flex

# 4. Deploy
npx wrangler pages deploy

# 5. Create YOUR admin account (works once, only while SETUP_TOKEN exists and no admin exists)
curl -X POST https://flex.pages.dev/api/setup -H "Content-Type: application/json" \
  -d '{"token":"YOUR_SETUP_TOKEN","username":"admin","name":"Your Name","email":"you@example.com","password":"a long passphrase"}'

# 6. Turn setup off for good
npx wrangler pages secret delete SETUP_TOKEN --project-name flex
```

Sign in at `https://flex.pages.dev/admin.html`. Create staff/admin/customer accounts from **Users**.

## Already deployed? Add the product_images table

If you deployed before this version, run the one new migration against your live database (safe to run more than once):

```bash
npx wrangler d1 execute flex-db --remote --file=migrations/0002_product_images.sql
```

## Run locally

```bash
echo "SETUP_TOKEN=dev-token" > .dev.vars
npx wrangler d1 execute flex-db --local --file=schema.sql
npx wrangler d1 execute flex-db --local --file=seed.sql
npx wrangler pages dev          # http://localhost:8788
```
Safari does not keep `Secure` cookies over plain http://localhost; use Chrome or Firefox locally.

## Tests

`node --test tests/api.test.mjs` (Node 22+) runs the real API code against an in-memory SQLite database
that emulates the D1 interface: auth, lockout, roles, checkout/stock/rollback, cancellations, CRUD, audit log.

## What lives where

| Data | Table | Managed in admin |
|---|---|---|
| Accounts, roles, credentials | `users`, `sessions` | Users: create, edit role/status, reset password, delete |
| Inventory | `products` | Products: price, stock, status, department, featured |
| Product photos | `product_images` | Products → **Images**: add by URL, set cover photo, delete (12 per product max) |
| Orders | `orders`, `order_items` | Orders: view, change status (cancel restocks) |
| Upcoming drops + notify list | `drops`, `drop_subscribers` | Upcoming drops |
| Contact form | `messages` | Messages |
| Who changed what | `audit_log` | Activity log (admin only) |

## Bulk-adding product photos

`product_images` stores an `https://` URL per photo, not the file itself, so each image needs to be hosted
somewhere first — [Cloudflare R2](https://developers.cloudflare.com/r2/) (works well alongside Pages/D1),
Cloudflare Images, or any CDN you already use. Uploading files from the admin UI isn't built yet; add images by
URL under Products → **Images**, or load many at once with SQL, e.g. from a product photo dataset:

```sql
INSERT INTO product_images (product_id, url, alt_text, position, created_at) VALUES
  (1, 'https://img.yoursite.com/1-front.jpg', 'Motion Tee, front view', 0, strftime('%s','now')),
  (1, 'https://img.yoursite.com/1-back.jpg',  'Motion Tee, back view',  1, strftime('%s','now'));
```

Run it with `npx wrangler d1 execute flex-db --remote --file=your-import.sql`. Match `product_id` to the
`id` already in your `products` table (check with `SELECT id, sku, name FROM products`), and keep `position`
increasing per product — position `0` becomes the cover photo shown on the storefront.

## Security model

- **Login is by username**, not email. Email is stored as contact info only — it's not unique and isn't used to sign in.
- Passwords are salted PBKDF2-SHA256 hashes. **Nobody, including admins, can view a password**; admins can only set a new one.
- Sessions are random tokens in an `HttpOnly; Secure; SameSite=Strict` cookie; only the SHA-256 of the token is stored.
- Roles: `customer` (shop, checkout), `staff` (products, orders, drops, messages), `admin` (everything, incl. users and audit).
- 5 failed sign-ins lock an account for 15 minutes. Changing a user's role/status or password signs them out everywhere.
- Every query uses bound parameters. Prices are always read from the database at checkout, never from the browser.
- Stock has a `CHECK (stock >= 0)` constraint and checkout is one atomic batch, so two buyers can't take the last unit.
- Add **Cloudflare Access** in front of `/admin*` for a second login layer (Zero Trust > Access > Applications).

## Not included yet

- Payments: checkout records the order; connect Stripe (or another processor) before charging real money.
- Email: no verification, password-reset email, or order confirmations (Cloudflare Email Workers / Resend can add these).
- Product images: cards use color blocks; add R2 storage + an image column when you have photography.
