// Runs the real API code against an in-memory SQLite database that emulates the D1 interface.
// Usage: node --test tests/     (Node 22+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { onRequest } = await import(pathToFileURL(path.join(root, 'functions/api/[[path]].js')).href);

const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
sqlite.exec(readFileSync(path.join(root, 'schema.sql'), 'utf8'));
sqlite.exec(readFileSync(path.join(root, 'seed.sql'), 'utf8'));

class Stmt {
  constructor(sql) { this.sql = sql; this.v = []; }
  bind(...v) { this.v = v; return this; }
  async first() { return sqlite.prepare(this.sql).get(...this.v) ?? null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.v) }; }
  async run() { const r = sqlite.prepare(this.sql).run(...this.v); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
}
const DB = {
  prepare: (sql) => new Stmt(sql),
  async batch(stmts) {                                  // atomic, like D1
    sqlite.exec('BEGIN');
    try {
      const out = [];
      for (const s of stmts) out.push(/^\s*select/i.test(s.sql) ? await s.all() : await s.run());
      sqlite.exec('COMMIT');
      return out;
    } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
const env = { DB, SETUP_TOKEN: 'setup-secret' };

async function call(method, url, { body, cookie, origin } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const res = await onRequest({ request: new Request('https://flex.test' + url, { method, headers, body: body ? JSON.stringify(body) : undefined }), env });
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data: await res.json(), cookie: setCookie ? setCookie.split(';')[0] : null, setCookie };
}
const stock = (id) => sqlite.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;

let admin, customer, staff;

test('public catalog', async () => {
  assert.equal((await call('GET', '/api/products')).data.products.length, 23);
  assert.equal((await call('GET', '/api/products?department=Men')).data.products.length, 6);
  assert.equal((await call('GET', '/api/products?featured=1')).data.products.length, 6);
  const inj = await call('GET', "/api/products?department=Men'%20OR%20'1'='1");
  assert.equal(inj.status, 200);                                  // unknown filter values are ignored, never interpolated
  assert.equal((await call('GET', '/api/drops')).data.drops.length, 4);
});

test('admin routes require auth', async () => {
  assert.equal((await call('GET', '/api/admin/stats')).status, 401);
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('DELETE', '/api/products')).status, 405);
});

test('first-admin setup is token-protected and one-shot', async () => {
  const body = { token: 'wrong', name: 'Owner', email: 'admin@flex.test', password: 'correct horse 1' };
  assert.equal((await call('POST', '/api/setup', { body })).status, 403);
  assert.equal((await call('POST', '/api/setup', { body: { ...body, token: 'setup-secret' } })).status, 200);
  assert.equal((await call('POST', '/api/setup', { body: { ...body, token: 'setup-secret' } })).status, 409);
});

test('login, session cookie flags, /me', async () => {
  const bad = await call('POST', '/api/auth/login', { body: { email: 'admin@flex.test', password: 'nope-nope' } });
  assert.equal(bad.status, 401);
  const ok = await call('POST', '/api/auth/login', { body: { email: 'ADMIN@flex.test', password: 'correct horse 1' } });
  assert.equal(ok.status, 200);
  assert.match(ok.setCookie, /HttpOnly/); assert.match(ok.setCookie, /Secure/); assert.match(ok.setCookie, /SameSite=Strict/);
  admin = ok.cookie;
  assert.equal((await call('GET', '/api/auth/me', { cookie: admin })).data.user.role, 'admin');
  assert.equal((await call('GET', '/api/auth/me')).data.user, null);
  const row = sqlite.prepare("SELECT password_hash FROM users WHERE email='admin@flex.test'").get();
  assert.match(row.password_hash, /^pbkdf2\$100000\$/);            // hashed, never plaintext
  assert.ok(!row.password_hash.includes('correct horse'));
  const tokenHashStored = sqlite.prepare('SELECT token_hash FROM sessions').all().every((s) => s.token_hash !== admin.split('=')[1]);
  assert.ok(tokenHashStored);                                      // only the hash of the session token is stored
});

test('customer registration + validation', async () => {
  assert.equal((await call('POST', '/api/auth/register', { body: { name: 'Lee', email: 'bad', password: 'password123' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { name: 'Lee', email: 'lee@x.com', password: 'short' } })).status, 400);
  const r = await call('POST', '/api/auth/register', { body: { name: 'Lee Tran', email: 'lee@example.com', password: 'password123' } });
  assert.equal(r.status, 201); customer = r.cookie;
  assert.equal((await call('POST', '/api/auth/register', { body: { name: 'Dup', email: 'LEE@example.com', password: 'password123' } })).status, 409);
  assert.equal((await call('GET', '/api/admin/stats', { cookie: customer })).status, 403);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: "' OR 1=1--", password: 'x' } })).status, 400);
});

test('account lockout after repeated failures', async () => {
  await call('POST', '/api/auth/register', { body: { name: 'Vic', email: 'vic@example.com', password: 'password123' } });
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/auth/login', { body: { email: 'vic@example.com', password: 'wrongwrong' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'vic@example.com', password: 'password123' } })).status, 429);
});

test('cross-origin writes are blocked', async () => {
  const r = await call('POST', '/api/contact', { origin: 'https://evil.example', body: { name: 'a', email: 'a@a.com', message: 'hi' } });
  assert.equal(r.status, 403);
});

test('checkout uses DB prices, decrements stock, blocks overselling', async () => {
  assert.equal((await call('POST', '/api/orders', { body: { items: [{ productId: 1, qty: 1 }] } })).status, 401);
  assert.equal(stock(5), 4);
  const o = await call('POST', '/api/orders', { cookie: customer, body: { items: [{ productId: 5, qty: 2, price: 1 }, { productId: 1, qty: 1 }] } });
  assert.equal(o.status, 201);
  assert.equal(o.data.totalCents, 12800 * 2 + 4200);               // client-sent price ignored
  assert.equal(stock(5), 2); assert.equal(stock(1), 119);
  const over = await call('POST', '/api/orders', { cookie: customer, body: { items: [{ productId: 5, qty: 3 }] } });
  assert.equal(over.status, 409); assert.equal(stock(5), 2);
  assert.throws(() => sqlite.exec('UPDATE products SET stock = -1 WHERE id = 1'), /CHECK/);   // DB-level oversell guard
  assert.equal((await call('POST', '/api/orders', { cookie: customer, body: { items: [] } })).status, 400);
  assert.equal((await call('POST', '/api/orders', { cookie: customer, body: { items: [{ productId: 999, qty: 1 }] } })).status, 409);
  // atomicity: second line fails the CHECK constraint mid-batch -> nothing is written
  const before = sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n;
  sqlite.exec('UPDATE products SET stock = 1 WHERE id = 2');
  const realFirst = Stmt.prototype.all; let flipped = false;
  Stmt.prototype.all = async function () {                          // simulate a concurrent buyer taking the last unit after validation
    const r = await realFirst.call(this);
    if (!flipped && /FROM products WHERE status = 'active' AND id IN/.test(this.sql)) { flipped = true; sqlite.exec('UPDATE products SET stock = 0 WHERE id = 2'); }
    return r;
  };
  const race = await call('POST', '/api/orders', { cookie: customer, body: { items: [{ productId: 1, qty: 1 }, { productId: 2, qty: 1 }] } });
  Stmt.prototype.all = realFirst;
  assert.equal(race.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n, before);   // rolled back
  assert.equal(stock(1), 119);
});

test('admin: dashboard stats + order workflow + restock on cancel', async () => {
  const s = (await call('GET', '/api/admin/stats', { cookie: admin })).data;
  assert.equal(s.orders, 1); assert.equal(s.customers, 2); assert.equal(s.revenueCents, 29800); assert.equal(s.week.length, 7);
  const list = (await call('GET', '/api/admin/orders', { cookie: admin })).data.orders;
  assert.equal(list[0].items, 3);
  const id = list[0].id;
  assert.equal((await call('GET', `/api/admin/orders/${id}`, { cookie: admin })).data.items.length, 2);
  assert.equal((await call('PUT', `/api/admin/orders/${id}`, { cookie: admin, body: { status: 'shipped' } })).status, 200);
  assert.equal((await call('PUT', `/api/admin/orders/${id}`, { cookie: admin, body: { status: 'bogus' } })).status, 400);
  assert.equal((await call('PUT', `/api/admin/orders/${id}`, { cookie: admin, body: { status: 'cancelled' } })).status, 200);
  assert.equal(stock(5), 4); assert.equal(stock(1), 120);          // stock restored
  assert.equal((await call('PUT', `/api/admin/orders/${id}`, { cookie: admin, body: { status: 'delivered' } })).status, 409);
});

test('admin: product CRUD + validation', async () => {
  const good = { name: 'Test Tee', department: 'Men', category: 'Tops', priceCents: 2500, stock: 10, status: 'active', tag: 'New', color: 'red' };
  const c = await call('POST', '/api/admin/products', { cookie: admin, body: { ...good, sku: 'T-1' } });
  assert.equal(c.status, 201);
  assert.equal((await call('POST', '/api/admin/products', { cookie: admin, body: { ...good, sku: 'T-1' } })).status, 409);
  assert.equal((await call('POST', '/api/admin/products', { cookie: admin, body: { ...good, department: 'Aliens' } })).status, 400);
  assert.equal((await call('POST', '/api/admin/products', { cookie: admin, body: { ...good, stock: -5 } })).status, 400);
  const id = c.data.product.id;
  const u = await call('PUT', `/api/admin/products/${id}`, { cookie: admin, body: { ...good, stock: 3, priceCents: 3000 } });
  assert.equal(u.data.product.stock, 3);
  assert.equal((await call('GET', '/api/products', {})).data.products.some((p) => p.id === id), true);
  await call('PUT', `/api/admin/products/${id}`, { cookie: admin, body: { ...good, status: 'draft' } });
  assert.equal((await call('GET', '/api/products', {})).data.products.some((p) => p.id === id), false);   // drafts hidden from storefront
  assert.equal((await call('DELETE', `/api/admin/products/${id}`, { cookie: admin })).status, 200);
  assert.equal((await call('DELETE', `/api/admin/products/${id}`, { cookie: admin })).status, 404);
});

test('admin: user management, credentials, roles, safeguards', async () => {
  const users = (await call('GET', '/api/admin/users', { cookie: admin })).data.users;
  assert.ok(users.length >= 3 && users.every((u) => !('password_hash' in u)));   // hashes never leave the server
  const mk = await call('POST', '/api/admin/users', { cookie: admin, body: { name: 'Sam Staff', email: 'sam@flex.test', password: 'staffpass123', role: 'staff' } });
  assert.equal(mk.status, 201);
  const sam = users.length ? (await call('GET', '/api/admin/users', { cookie: admin })).data.users.find((u) => u.email === 'sam@flex.test') : null;
  const login = await call('POST', '/api/auth/login', { body: { email: 'sam@flex.test', password: 'staffpass123' } });
  staff = login.cookie;
  assert.equal((await call('GET', '/api/admin/products', { cookie: staff })).status, 200);     // staff can manage catalog
  assert.equal((await call('GET', '/api/admin/users', { cookie: staff })).status, 403);        // but not users
  // reset password invalidates sessions and old password
  assert.equal((await call('POST', `/api/admin/users/${sam.id}/password`, { cookie: admin, body: { password: 'brandnew-pass1' } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: staff })).data.user, null);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'sam@flex.test', password: 'staffpass123' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'sam@flex.test', password: 'brandnew-pass1' } })).status, 200);
  // disable blocks login; re-enable restores
  await call('PUT', `/api/admin/users/${sam.id}`, { cookie: admin, body: { name: 'Sam Staff', role: 'staff', status: 'disabled' } });
  assert.equal((await call('POST', '/api/auth/login', { body: { email: 'sam@flex.test', password: 'brandnew-pass1' } })).status, 403);
  // self-protection
  const adminId = users.find((u) => u.email === 'admin@flex.test').id;
  assert.equal((await call('PUT', `/api/admin/users/${adminId}`, { cookie: admin, body: { name: 'Owner', role: 'customer', status: 'active' } })).status, 409);
  assert.equal((await call('DELETE', `/api/admin/users/${adminId}`, { cookie: admin })).status, 409);
  // deleting a customer keeps their order history
  const lee = users.find((u) => u.email === 'lee@example.com');
  assert.equal((await call('DELETE', `/api/admin/users/${lee.id}`, { cookie: admin })).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders WHERE user_id IS NULL').get().n, 1);
});

test('contact messages + drop subscriptions + audit log', async () => {
  assert.equal((await call('POST', '/api/contact', { body: { name: '<b>Kim</b>', email: 'kim@x.com', message: 'Sizing help?' } })).status, 201);
  const msgs = (await call('GET', '/api/admin/messages', { cookie: admin })).data.messages;
  assert.equal(msgs.length, 1);
  assert.equal((await call('PUT', `/api/admin/messages/${msgs[0].id}`, { cookie: admin, body: { status: 'read' } })).status, 200);
  const r = await call('POST', '/api/auth/register', { body: { name: 'Sub', email: 'sub@example.com', password: 'password123' } });
  assert.equal((await call('POST', '/api/drops/1/subscribe', { cookie: r.cookie })).status, 200);
  assert.equal((await call('POST', '/api/drops/1/subscribe', { cookie: r.cookie })).status, 200);
  assert.equal((await call('POST', '/api/drops/1/subscribe', {})).status, 401);
  assert.equal((await call('GET', '/api/admin/drops', { cookie: admin })).data.drops[0].subscribers, 1);
  const cd = await call('POST', '/api/admin/drops', { cookie: admin, body: { name: 'New Drop', releaseDate: 'Jan 5', description: 'x' } });
  assert.equal(cd.status, 201);
  const audit = (await call('GET', '/api/admin/audit', { cookie: admin })).data.entries;
  assert.ok(audit.some((a) => a.action === 'user.password_reset') && audit.some((a) => a.action === 'order.status'));
  assert.equal((await call('POST', '/api/auth/logout', { cookie: admin })).status, 200);
  assert.equal((await call('GET', '/api/admin/stats', { cookie: admin })).status, 401);
});

test('password-only admin sign-in', async () => {
  // admin passwords must be long (the password is the only credential)
  const short = await call('POST', '/api/auth/register', { body: { name: 'X', email: 'x@example.com', password: 'password123' } });
  assert.equal(short.status, 201);
  const tooShort = await call('POST', '/api/admin/users', { cookie: (await call('POST', '/api/admin/login', { body: { password: 'correct horse 1' } })).cookie, body: { name: 'Bad', email: 'bad@flex.test', password: 'short-pass1', role: 'admin' } });
  assert.equal(tooShort.status, 400);
  const ok = await call('POST', '/api/admin/login', { body: { password: 'correct horse 1' } });      // no email needed
  assert.equal(ok.status, 200); assert.equal(ok.data.user.role, 'admin');
  assert.equal((await call('GET', '/api/admin/users', { cookie: ok.cookie })).status, 200);
  assert.equal((await call('POST', '/api/admin/login', { body: { password: 'password123' } })).status, 401);   // a customer's password does not work
  for (let i = 0; i < 4; i++) await call('POST', '/api/admin/login', { body: { password: 'wrong-wrong-1' } });
  assert.equal((await call('POST', '/api/admin/login', { body: { password: 'correct horse 1' } })).status, 429);   // lockout applies
  sqlite.exec("UPDATE users SET locked_until = 0, failed_attempts = 0 WHERE role = 'admin'");
  assert.equal((await call('POST', '/api/admin/login', { body: {} })).status, 401);
});

test('product images: CRUD, ordering, cascade delete, public exposure', async () => {
  admin = (await call('POST', '/api/admin/login', { body: { password: 'correct horse 1' } })).cookie;   // the previous test logged this out
  const c = await call('POST', '/api/admin/products', { cookie: admin, body: { name: 'Image Test Tee', department: 'Men', category: 'Tops', priceCents: 1000, stock: 5, status: 'active', tag: '', color: 'red', sku: 'IMG-1' } });
  const pid = c.data.product.id;
  await call('POST', '/api/admin/users', { cookie: admin, body: { name: 'Robin Staff', email: 'robin@flex.test', password: 'staffpass456', role: 'staff' } });
  staff = (await call('POST', '/api/auth/login', { body: { email: 'robin@flex.test', password: 'staffpass456' } })).cookie;
  customer = (await call('POST', '/api/auth/register', { body: { name: 'Robin Shopper', email: 'robin.shopper@example.com', password: 'password123' } })).cookie;

  // only https urls are accepted
  assert.equal((await call('POST', `/api/admin/products/${pid}/images`, { cookie: admin, body: { url: 'http://insecure.example/a.jpg' } })).status, 400);
  assert.equal((await call('POST', `/api/admin/products/${pid}/images`, { cookie: staff, body: { url: 'not-a-url' } })).status, 400);
  assert.equal((await call('POST', `/api/admin/products/999999/images`, { cookie: admin, body: { url: 'https://img.example/x.jpg' } })).status, 404);

  const i1 = await call('POST', `/api/admin/products/${pid}/images`, { cookie: staff, body: { url: 'https://img.example/cover.jpg', altText: 'Front view', width: 800, height: 1000 } });
  assert.equal(i1.status, 201); assert.equal(i1.data.image.position, 0);
  const i2 = await call('POST', `/api/admin/products/${pid}/images`, { cookie: staff, body: { url: 'https://img.example/back.jpg', altText: 'Back view' } });
  assert.equal(i2.data.image.position, 1);

  // cover image surfaces on the public catalog listing, in position order
  const pub = (await call('GET', '/api/products?department=Men')).data.products.find((p) => p.id === pid);
  assert.equal(pub.image_url, 'https://img.example/cover.jpg');

  // public product detail returns the full ordered gallery
  const detail = await call('GET', `/api/products/${pid}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.data.images.map((im) => im.url), ['https://img.example/cover.jpg', 'https://img.example/back.jpg']);
  assert.equal((await call('GET', '/api/products/999999')).status, 404);           // draft/missing hidden from shoppers
  await call('PUT', `/api/admin/products/${pid}`, { cookie: admin, body: { name: 'Image Test Tee', department: 'Men', category: 'Tops', priceCents: 1000, stock: 5, status: 'draft', tag: '', color: 'red' } });
  assert.equal((await call('GET', `/api/products/${pid}`)).status, 404);
  await call('PUT', `/api/admin/products/${pid}`, { cookie: admin, body: { name: 'Image Test Tee', department: 'Men', category: 'Tops', priceCents: 1000, stock: 5, status: 'active', tag: '', color: 'red' } });

  // set-cover resequences everyone atomically (no two images stuck at position 0)
  assert.equal((await call('POST', `/api/admin/images/999999/cover`, { cookie: admin })).status, 404);
  assert.equal((await call('POST', `/api/admin/images/${i2.data.image.id}/cover`, { cookie: admin })).status, 200);
  const reordered = (await call('GET', '/api/products?department=Men')).data.products.find((p) => p.id === pid);
  assert.equal(reordered.image_url, 'https://img.example/back.jpg');
  const positions = (await call('GET', `/api/admin/products/${pid}/images`, { cookie: admin })).data.images.map((im) => im.position).sort();
  assert.deepEqual(positions, [0, 1]);                                           // exactly one image at each position, no duplicates
  assert.equal((await call('PUT', `/api/admin/images/${i1.data.image.id}`, { cookie: admin, body: { altText: 'Front view, updated', position: 1 } })).status, 200);
  assert.equal((await call('GET', `/api/admin/products/${pid}/images`, { cookie: admin })).data.images.find((im) => im.id === i1.data.image.id).alt_text, 'Front view, updated');

  // the 12-image cap
  for (let i = 0; i < 10; i++) assert.equal((await call('POST', `/api/admin/products/${pid}/images`, { cookie: admin, body: { url: `https://img.example/extra${i}.jpg` } })).status, 201);
  assert.equal((await call('POST', `/api/admin/products/${pid}/images`, { cookie: admin, body: { url: 'https://img.example/one-too-many.jpg' } })).status, 400);

  // staff can manage images, customers cannot
  assert.equal((await call('GET', `/api/admin/products/${pid}/images`, { cookie: customer })).status, 403);
  assert.equal((await call('GET', `/api/admin/products/${pid}/images`, { cookie: staff })).status, 200);

  // deleting an image, then deleting the product cascades to any remaining images
  assert.equal((await call('DELETE', `/api/admin/images/${i1.data.image.id}`, { cookie: admin })).status, 200);
  assert.equal((await call('DELETE', `/api/admin/images/999999`, { cookie: admin })).status, 404);
  const before = sqlite.prepare('SELECT COUNT(*) n FROM product_images WHERE product_id = ?').get(pid).n;
  assert.ok(before > 0);
  assert.equal((await call('DELETE', `/api/admin/products/${pid}`, { cookie: admin })).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM product_images WHERE product_id = ?').get(pid).n, 0);
});
