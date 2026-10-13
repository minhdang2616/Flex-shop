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
npx wrangler pages project create flex-shop --production-branch main
npx wrangler pages secret put SETUP_TOKEN --project-name flex-shop

# 4. Deploy
npx wrangler pages deploy

# 5. Create YOUR admin account (works once, only while SETUP_TOKEN exists and no admin exists)
curl -X POST https://flex-shop.pages.dev/api/setup -H "Content-Type: application/json" \
  -d '{"token":"YOUR_SETUP_TOKEN","username":"admin","name":"Your Name","email":"you@example.com","password":"a long passphrase"}'

# 6. Turn setup off for good
npx wrangler pages secret delete SETUP_TOKEN --project-name flex-shop
```

Sign in at `https://flex-shop.pages.dev/admin.html`. Create staff/admin/customer accounts from **Users**.

## Already deployed? Update your existing database

Run each migration you haven't run yet, **once each, in order** (a second run fails with "duplicate column", which is harmless):

```bash
npx wrangler d1 execute flex-db --remote --file=migrations/0003_username_login.sql      # username login (skip if you already did it)
npx wrangler d1 execute flex-db --remote --file=migrations/0004_accounts_uploads.sql    # personal details, Google sign-in, photo uploads
npx wrangler d1 execute flex-db --remote --file=migrations/0005_photo_storage.sql       # renames one column (photos live in KV)
npx wrangler d1 execute flex-db --remote --file=migrations/0006_email_not_unique.sql    # removes the old unique-email constraint
```

`0004` keeps every existing user, order and photo; it only adds columns and rebuilds the photo table. `0005` only renames a column. `0006` rebuilds the users table while preserving accounts, sessions and order references; usernames stay unique, emails do not.

## Photo uploads (Workers KV, free)

Photos are uploaded straight from the admin page (**Products -> Images**: drag in PNG, JPG or WebP files, 5 MB each, 12 per product).
They are kept in a Workers KV namespace and served from your own site at `/api/img/<name>`. No payment method or paid plan is needed.

```bash
npx wrangler kv namespace create flex-images
```
It prints a block containing `id = "..."`. Copy only that id into `wrangler.toml`, replacing `PASTE_YOUR_KV_NAMESPACE_ID_HERE` (keep `binding = "IMAGES"`), then deploy:
```bash
npx wrangler pages deploy
```

- The file type is decided by reading the file itself, not its name, so a renamed script or SVG can't be uploaded as a "photo".
- Deleting a photo or product deletes the stored file too. Photos added earlier as links keep working.
- Free-plan limits: 1,000 uploads per day, 100,000 photo views per day (browsers cache photos, so repeat views don't count), 1 GB in total.
- KV is eventually consistent: a brand-new photo can take up to about a minute to appear for visitors far from where you uploaded it.
- Don't want photo uploads yet? Delete the `[[kv_namespaces]]` block from `wrangler.toml`. Everything else keeps working and the upload box explains that storage isn't set up.

## Google sign-in ("Continue with Google")

1. Google Cloud Console -> **APIs & Services -> OAuth consent screen** (External, add your site name and email).
2. **Credentials -> Create credentials -> OAuth client ID -> Web application**. Under *Authorized redirect URIs* add
   `https://YOUR-DOMAIN/api/auth/google/callback` (one line per domain you use, e.g. `https://flex-shop.pages.dev/...` and your custom domain).
3. Store the two values as secrets, then redeploy:
   ```bash
   npx wrangler pages secret put GOOGLE_CLIENT_ID     --project-name flex-shop
   npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name flex-shop
   npx wrangler pages deploy
   ```

Until these exist, the Google button shows "Google sign-in isn't set up on this site yet" instead of failing.
First-time Google users are sent to a short form (username, phone, address) before the account is created. Accounts are matched by Google's
account id, never by email, so a Google account can't take over a password account that happens to share an email address.

## Accounts and the bag

- Adding to the bag, opening the bag and checking out all require a login. The visitor's action is remembered and completed after they log in, register or return from Google.
- Each account has its own bag (kept in the browser). Registering collects name, email, phone and address; orders keep a copy of the phone and shipping address.
- Customers can edit their profile and delivery details, review orders, cancel pending orders, and change their password from the account panel. Google-linked accounts can verify with their current password or a 6-digit code emailed to their Google account address. Other accounts must enter their current password.
- Customers register on `register.html`; staff and admins are only created by an admin under **Users**.

## Run locally

```bash
echo "SETUP_TOKEN=dev-token" > .dev.vars
npx wrangler d1 execute flex-db --local --file=schema.sql
npx wrangler d1 execute flex-db --local --file=seed.sql
npx wrangler pages dev          # http://localhost:8788
```

## Gmail sending (feedback + password codes)

The site can send feedback notifications and password verification codes from `flexshopcompany@gmail.com` using Gmail API. Enable Gmail API in Google Cloud, add the `https://www.googleapis.com/auth/gmail.send` scope to the OAuth consent screen, and create a **separate** OAuth web client for Gmail (so the store sign-in client is untouched). Add `https://developers.google.com/oauthplayground` as its authorized redirect URI. In OAuth Playground settings select **Use your own OAuth credentials**, enter the Gmail client ID and secret, authorize the `gmail.send` scope as `flexshopcompany@gmail.com`, exchange the code for tokens, and save the refresh token and separate client credentials as Cloudflare Pages secrets:

```bash
npx wrangler pages secret put GMAIL_REFRESH_TOKEN --project-name flex-shop
npx wrangler pages secret put GMAIL_CLIENT_ID --project-name flex-shop
npx wrangler pages secret put GMAIL_CLIENT_SECRET --project-name flex-shop
```

The `gmail.send` scope is sensitive. In OAuth consent screen, an External app left in Testing can have refresh tokens expire after 7 days; for ongoing production use, publish the consent screen and complete Google's required verification. Keep refresh tokens private and never put them in browser code or commit them. Existing Resend settings remain as a fallback.
Safari does not keep `Secure` cookies over plain http://localhost; use Chrome or Firefox locally.

## Tests

`node --test tests/api.test.mjs` (Node 22+) runs the real API code against an in-memory SQLite database
that emulates the D1 interface: auth, lockout, roles, checkout/stock/rollback, cancellations, CRUD, audit log.

## What lives where

| Data | Table | Managed in admin |
|---|---|---|
| Accounts, roles, credentials | `users`, `sessions` | Users: create, edit role/status, reset password, delete |
| Inventory | `products` | Products: price, stock, status, department, featured |
| Product photos | `product_images` + a KV namespace | Products → **Images**: upload files, set cover photo, delete (12 per product max) |
| Orders | `orders`, `order_items` | Orders: view, change status (cancel restocks) |
| Upcoming drops + notify list | `drops`, `drop_subscribers` | Upcoming drops |
| Contact form | `messages` | Messages |
| Who changed what | `audit_log` | Activity log (admin only) |

## Security model

- **Login is by username**, not email. Email is stored as contact info only — it's not unique and isn't used to sign in.
- Passwords are salted PBKDF2-SHA256 hashes. **Nobody, including admins, can view a password**; admins can only set a new one.
- Sessions are random tokens in an `HttpOnly; Secure; SameSite=Strict` cookie; only the SHA-256 of the token is stored.
- Roles: `customer` (shop, checkout), `staff` (products, orders, drops, messages), `admin` (everything, incl. users and audit).
- 5 failed sign-ins lock an account for 15 minutes. Admin password resets sign the affected user out everywhere; a customer password change keeps the current session and signs out other sessions.
- Every query uses bound parameters. Prices are always read from the database at checkout, never from the browser.
- Stock has a `CHECK (stock >= 0)` constraint and checkout is one atomic batch, so two buyers can't take the last unit.
- Add **Cloudflare Access** in front of `/admin*` for a second login layer (Zero Trust > Access > Applications).

## Not included yet

- Payments: checkout records the order; connect Stripe (or another processor) before charging real money.
- Email: account email verification and order confirmations are not included. Resend is used only for Google-linked password verification codes.
- Image resizing: photos are stored and served as uploaded; resize before uploading for fast pages (Cloudflare Images can automate this later).
