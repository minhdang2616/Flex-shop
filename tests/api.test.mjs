// Runs the real API code against an in-memory SQLite database that emulates the D1 interface.
// Usage: node --test tests/     (Node 22+)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
// Minimal in-memory stand-in for a Workers KV namespace (same rules as the real one: values are strings, streams or ArrayBuffers)
const store = new Map();
const IMAGES = {
  async put(key, value) { assert.ok(value instanceof ArrayBuffer, 'KV put() takes a string, stream or ArrayBuffer'); store.set(key, new Uint8Array(value.slice(0))); },
  async get(key, type) { assert.equal(type, 'arrayBuffer'); const b = store.get(key); return b ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : null; },
  async delete(key) { store.delete(key); },
};
const env = { DB, IMAGES, SETUP_TOKEN: 'setup-secret' };
const profile = { phone: '+84 901 234 567', address: '12 Le Loi Street', city: 'Phan Thiet', postalCode: '800000', country: 'Vietnam' };

async function call(method, url, { body, cookie, origin } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  const res = await onRequest({ request: new Request('https://flex.test' + url, { method, headers, body: body ? JSON.stringify(body) : undefined }), env });
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, data: await res.json(), cookie: setCookie ? setCookie.split(';')[0] : null, setCookie };
}
async function callForm(url, fields, { cookie } = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const headers = cookie ? { cookie } : {};
  const res = await onRequest({ request: new Request('https://flex.test' + url, { method: 'POST', headers, body: fd }), env });
  return { status: res.status, data: await res.json() };
}
const file = (bytes, name, type) => new File([new Uint8Array(bytes)], name, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const stock = (id) => sqlite.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;

let admin, customer, staff;

test('public catalog', async () => {
  assert.equal((await call('GET', '/api/products')).data.products.length, 23);
  assert.equal((await call('GET', '/api/products?department=Men')).data.products.length, 6);
  assert.equal((await call('GET', '/api/products?featured=1')).data.products.length, 6);
  const inj = await call('GET', "/api/products?department=Men'%20OR%20'1'='1");
  assert.equal(inj.status, 200);                                  // unknown filter values are ignored, never interpolated
  assert.equal((await call('GET', '/api/drops')).data.drops.length, 4);
  // keyword search: word-prefix, case-insensitive, wildcard-safe
  const names = async (q) => (await call('GET', '/api/products?q=' + encodeURIComponent(q))).data.products.map((p) => p.name);
  assert.equal((await names('jacket')).length, 4);
  assert.equal((await names('TEE')).length, 4);
  assert.equal((await names('jack')).length, 4);                          // prefix of a word
  const men = await names('men');
  assert.equal(men.length, 6); assert.ok(men.every((n) => !n.startsWith('Women')));   // "men" must not match "Women"
  assert.equal((await names('women')).length, 6);
  assert.equal((await names('tops')).length, 11);                         // matches category
  assert.equal((await names('zzzz')).length, 0);
  assert.equal((await names('%')).length, 0);                             // LIKE wildcards in user input are escaped, not honoured
  assert.equal((await names("x' OR '1'='1")).length, 0);                  // and injection stays inert
  assert.equal((await call('GET', '/api/products?q=jacket&department=Men')).data.products.length, 1);   // combines with filters
  const one = await call('GET', '/api/products/5');                       // product page endpoint
  assert.equal(one.status, 200); assert.equal(one.data.product.name, 'Articulated Jacket');
});

test('admin routes require auth', async () => {
  assert.equal((await call('GET', '/api/admin/stats')).status, 401);
  assert.equal((await call('GET', '/api/nope')).status, 404);
  assert.equal((await call('DELETE', '/api/products')).status, 405);
});

test('first-admin setup is token-protected and one-shot', async () => {
  const body = { token: 'wrong', username: 'admin', name: 'Owner', email: 'admin@flex.test', password: 'correct horse 1' };
  assert.equal((await call('POST', '/api/setup', { body })).status, 403);
  assert.equal((await call('POST', '/api/setup', { body: { ...body, token: 'setup-secret' } })).status, 200);
  assert.equal((await call('POST', '/api/setup', { body: { ...body, token: 'setup-secret' } })).status, 409);
});

test('login by username, session cookie flags, /me', async () => {
  const bad = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'nope-nope' } });
  assert.equal(bad.status, 401);
  const ok = await call('POST', '/api/auth/login', { body: { username: 'ADMIN', password: 'correct horse 1' } });   // username lookup is case-insensitive
  assert.equal(ok.status, 200);
  assert.match(ok.setCookie, /HttpOnly/); assert.match(ok.setCookie, /Secure/); assert.match(ok.setCookie, /SameSite=Strict/);
  admin = ok.cookie;
  assert.equal((await call('GET', '/api/auth/me', { cookie: admin })).data.user.role, 'admin');
  assert.equal((await call('GET', '/api/auth/me', { cookie: admin })).data.user.username, 'admin');
  assert.equal((await call('GET', '/api/auth/me', { cookie: admin })).data.user.email, 'admin@flex.test');  // email still returned as info
  assert.equal((await call('GET', '/api/auth/me')).data.user, null);
  const row = sqlite.prepare("SELECT password_hash FROM users WHERE username='admin'").get();
  assert.match(row.password_hash, /^pbkdf2\$100000\$/);            // hashed, never plaintext
  assert.ok(!row.password_hash.includes('correct horse'));
  const tokenHashStored = sqlite.prepare('SELECT token_hash FROM sessions').all().every((s) => s.token_hash !== admin.split('=')[1]);
  assert.ok(tokenHashStored);                                      // only the hash of the session token is stored
});

test('customer registration + validation', async () => {
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'lee', name: 'Lee', email: 'bad', password: 'password123', ...profile } })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'l', name: 'Lee', email: 'lee@x.com', password: 'password123', ...profile } })).status, 400); // username too short
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'lee tran!', name: 'Lee', email: 'lee@x.com', password: 'password123', ...profile } })).status, 400); // bad characters
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'lee', name: 'Lee', email: 'lee@x.com', password: 'short', ...profile } })).status, 400);
  const r = await call('POST', '/api/auth/register', { body: { username: 'lee', name: 'Lee Tran', email: 'lee@example.com', password: 'password123', ...profile } });
  assert.equal(r.status, 201); customer = r.cookie;
  assert.equal(r.data.user.username, 'lee');
  // username uniqueness is case-insensitive; email is NOT required to be unique (it's just informational now)
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'LEE', name: 'Dup', email: 'lee@example.com', password: 'password123', ...profile } })).status, 409);
  assert.equal((await call('POST', '/api/auth/register', { body: { username: 'lee2', name: 'Also Lee', email: 'lee@example.com', password: 'password123', ...profile } })).status, 201); // same email, different username: fine
  assert.equal((await call('GET', '/api/admin/stats', { cookie: customer })).status, 403);
  assert.equal((await call('POST', '/api/auth/login', { body: { username: "' OR 1=1--", password: 'x' } })).status, 400);
});

test('account lockout after repeated failures', async () => {
  await call('POST', '/api/auth/register', { body: { username: 'vic', name: 'Vic', email: 'vic@example.com', password: 'password123', ...profile } });
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/auth/login', { body: { username: 'vic', password: 'wrongwrong' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'vic', password: 'password123' } })).status, 429);
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
  assert.equal(s.orders, 1); assert.equal(s.customers, 3); assert.equal(s.revenueCents, 29800); assert.equal(s.week.length, 7);
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
  assert.ok(users.every((u) => typeof u.username === 'string' && u.username.length > 0));

  const mk = await call('POST', '/api/admin/users', { cookie: admin, body: { username: 'samstaff', name: 'Sam Staff', email: 'sam@flex.test', password: 'staffpass123', role: 'staff' } });
  assert.equal(mk.status, 201);
  assert.equal((await call('POST', '/api/admin/users', { cookie: admin, body: { username: 'SamStaff', name: 'Dup', email: 'x@x.com', password: 'password123', role: 'staff' } })).status, 409); // username taken, case-insensitive
  const sam = (await call('GET', '/api/admin/users', { cookie: admin })).data.users.find((u) => u.username === 'samstaff');
  const login = await call('POST', '/api/auth/login', { body: { username: 'samstaff', password: 'staffpass123' } });
  staff = login.cookie;
  assert.equal((await call('GET', '/api/admin/products', { cookie: staff })).status, 200);     // staff can manage catalog
  assert.equal((await call('GET', '/api/admin/users', { cookie: staff })).status, 403);        // but not users

  // editing a user now covers username/email too, not just role/status
  const renamed = await call('PUT', `/api/admin/users/${sam.id}`, { cookie: admin, body: { username: 'samstaff', email: 'sam2@flex.test', name: 'Samantha Staff', role: 'staff', status: 'active' } });
  assert.equal(renamed.status, 200);
  assert.equal((await call('GET', '/api/admin/users', { cookie: admin })).data.users.find((u) => u.id === sam.id).email, 'sam2@flex.test');
  // renaming to someone else's username is rejected
  assert.equal((await call('PUT', `/api/admin/users/${sam.id}`, { cookie: admin, body: { username: 'lee', email: 'sam2@flex.test', name: 'Samantha Staff', role: 'staff', status: 'active' } })).status, 409);

  // reset password invalidates sessions and old password
  assert.equal((await call('POST', `/api/admin/users/${sam.id}/password`, { cookie: admin, body: { password: 'brandnew-pass1' } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: staff })).data.user, null);
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'samstaff', password: 'staffpass123' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'samstaff', password: 'brandnew-pass1' } })).status, 200);
  // disable blocks login; re-enable restores
  await call('PUT', `/api/admin/users/${sam.id}`, { cookie: admin, body: { username: 'samstaff', email: 'sam2@flex.test', name: 'Samantha Staff', role: 'staff', status: 'disabled' } });
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'samstaff', password: 'brandnew-pass1' } })).status, 403);
  // self-protection: role/status locked, but an admin can still rename their own username/email
  const adminRow = users.find((u) => u.username === 'admin');
  assert.equal((await call('PUT', `/api/admin/users/${adminRow.id}`, { cookie: admin, body: { username: 'admin', email: 'admin@flex.test', name: 'Owner', role: 'customer', status: 'active' } })).status, 409);
  assert.equal((await call('PUT', `/api/admin/users/${adminRow.id}`, { cookie: admin, body: { username: 'admin', email: 'newadmin@flex.test', name: 'Owner', role: 'admin', status: 'active' } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { cookie: admin })).data.user, null);   // editing yourself signs you out too, same as editing anyone
  admin = (await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'correct horse 1' } })).cookie;
  assert.equal((await call('DELETE', `/api/admin/users/${adminRow.id}`, { cookie: admin })).status, 409);
  // deleting a customer keeps their order history
  const lee = users.find((u) => u.username === 'lee');
  assert.equal((await call('DELETE', `/api/admin/users/${lee.id}`, { cookie: admin })).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders WHERE user_id IS NULL').get().n, 1);
});

test('contact messages + drop subscriptions + audit log', async () => {
  assert.equal((await call('POST', '/api/contact', { body: { name: '<b>Kim</b>', email: 'kim@x.com', message: 'Sizing help?' } })).status, 201);
  const msgs = (await call('GET', '/api/admin/messages', { cookie: admin })).data.messages;
  assert.equal(msgs.length, 1);
  assert.equal((await call('PUT', `/api/admin/messages/${msgs[0].id}`, { cookie: admin, body: { status: 'read' } })).status, 200);
  const r = await call('POST', '/api/auth/register', { body: { username: 'sub', name: 'Sub', email: 'sub@example.com', password: 'password123', ...profile } });
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

test('admin and staff sign in with username + password, same as customers', async () => {
  // the previous test logged the shared `admin` cookie out — sign back in the normal way (note: username changed earlier in this suite)
  const fresh = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'correct horse 1' } });
  assert.equal(fresh.status, 200); assert.equal(fresh.data.user.role, 'admin');
  admin = fresh.cookie;

  // admin accounts follow the exact same password rule as everyone else (8+ chars, not a special longer minimum)
  const created = await call('POST', '/api/admin/users', { cookie: admin, body: { username: 'eightcharadmin', name: 'Eight Char Admin', email: 'eightchar@flex.test', password: 'eightchr', role: 'admin' } });
  assert.equal(created.status, 201);
  assert.equal((await call('POST', '/api/auth/login', { body: { username: 'eightcharadmin', password: 'eightchr' } })).status, 200);
  assert.equal((await call('POST', '/api/admin/users', { cookie: admin, body: { username: 'tooshort', name: 'Too Short', email: 'tooshort@flex.test', password: 'short1', role: 'admin' } })).status, 400);

  // the old password-only shortcut no longer exists at all
  assert.equal((await call('POST', '/api/admin/login', { body: { password: 'correct horse 1' } })).status, 404);
});

test('product images: CRUD, ordering, cascade delete, public exposure', async () => {
  const c = await call('POST', '/api/admin/products', { cookie: admin, body: { name: 'Image Test Tee', department: 'Men', category: 'Tops', priceCents: 1000, stock: 5, status: 'active', tag: '', color: 'red', sku: 'IMG-1' } });
  const pid = c.data.product.id;
  await call('POST', '/api/admin/users', { cookie: admin, body: { username: 'robinstaff', name: 'Robin Staff', email: 'robin@flex.test', password: 'staffpass456', role: 'staff' } });
  staff = (await call('POST', '/api/auth/login', { body: { username: 'robinstaff', password: 'staffpass456' } })).cookie;
  customer = (await call('POST', '/api/auth/register', { body: { username: 'robinshopper', name: 'Robin Shopper', email: 'robin.shopper@example.com', password: 'password123', ...profile } })).cookie;

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
  assert.deepEqual(detail.data.images.map((im) => im.src), ['https://img.example/cover.jpg', 'https://img.example/back.jpg']);
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


async function rawCall(method, url, { cookie, body } = {}) {            // returns the Response untouched (for redirects, images)
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return onRequest({ request: new Request('https://flex.test' + url, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }), env });
}
const cookiesOf = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]);

test('registration collects personal details; orders snapshot the shipping address', async () => {
  const base = { username: 'nora', name: 'Nora Pham', email: 'nora@example.com', password: 'password123', ...profile };
  for (const k of ['phone', 'address', 'city', 'country']) {
    const b = { ...base, username: 'nora' + k }; delete b[k];
    assert.equal((await call('POST', '/api/auth/register', { body: b })).status, 400, `${k} is required`);
  }
  assert.equal((await call('POST', '/api/auth/register', { body: { ...base, username: 'noraph1', phone: 'call me' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { body: { ...base, username: 'noraph2', phone: '123' } })).status, 400);
  const ok = await call('POST', '/api/auth/register', { body: base });
  assert.equal(ok.status, 201);
  const row = sqlite.prepare("SELECT phone, address, city, postal_code, country FROM users WHERE username = 'nora'").get();
  assert.deepEqual({ ...row }, { phone: '+84 901 234 567', address: '12 Le Loi Street', city: 'Phan Thiet', postal_code: '800000', country: 'Vietnam' });
  const noPostal = { ...base, username: 'nora2' }; delete noPostal.postalCode;
  assert.equal((await call('POST', '/api/auth/register', { body: noPostal })).status, 201);   // postal code is optional

  const order = await call('POST', '/api/orders', { cookie: ok.cookie, body: { items: [{ productId: 4, qty: 1 }] } });
  assert.equal(order.status, 201);
  const adm = (await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'correct horse 1' } })).cookie;
  const id = (await call('GET', '/api/admin/orders', { cookie: adm })).data.orders.find((o) => o.order_no === order.data.orderNo).id;
  const detail = (await call('GET', `/api/admin/orders/${id}`, { cookie: adm })).data.order;
  assert.equal(detail.phone, '+84 901 234 567');
  assert.equal(detail.ship_address, '12 Le Loi Street, Phan Thiet, 800000, Vietnam');
});

test('photo upload: type check, size limit, KV storage, public serving, cleanup', async () => {
  admin = (await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'correct horse 1' } })).cookie;
  const staffC = (await call('POST', '/api/auth/login', { body: { username: 'robinstaff', password: 'staffpass456' } })).cookie;
  const custC = (await call('POST', '/api/auth/login', { body: { username: 'robinshopper', password: 'password123' } })).cookie;
  const pid = (await call('POST', '/api/admin/products', { cookie: admin, body: { name: 'Upload Tee', department: 'Women', category: 'Tops', priceCents: 1500, stock: 3, status: 'active', tag: '', color: 'blue', sku: 'UP-1' } })).data.product.id;
  const url = `/api/admin/products/${pid}/images/upload`;
  const up = (f, extra = {}, cookie = admin) => callForm(url, { file: f, ...extra }, { cookie });

  assert.equal((await callForm(url, { file: file(PNG, 'a.png', 'image/png') })).status, 401);
  assert.equal((await up(file(PNG, 'a.png', 'image/png'), {}, custC)).status, 403);                 // customers can't upload
  assert.equal((await callForm('/api/admin/products/999999/images/upload', { file: file(PNG, 'a.png', 'image/png') }, { cookie: admin })).status, 404);

  // real PNG / JPG / WebP accepted; the type comes from the bytes, not the filename
  const png = await up(file([...PNG, 9, 9], 'shirt.png', 'image/png'), { altText: 'Front view' }, staffC);
  assert.equal(png.status, 201);
  assert.match(png.data.image.file_key, /^p\d+-[A-Za-z0-9_-]{16}\.png$/);
  assert.equal(png.data.image.src, '/api/img/' + png.data.image.file_key);
  assert.equal(png.data.image.alt_text, 'Front view'); assert.equal(png.data.image.position, 0);
  const jpg = await up(file(JPG, 'photo.jpeg', 'image/jpeg'));       assert.equal(jpg.status, 201); assert.match(jpg.data.image.file_key, /\.jpg$/);
  const webp = await up(file(WEBP, 'pic.webp', 'image/webp'));       assert.equal(webp.status, 201); assert.match(webp.data.image.file_key, /\.webp$/);
  const mislabeled = await up(file(JPG, 'actually-a-jpg.png', 'image/png'));
  assert.equal(mislabeled.status, 201); assert.match(mislabeled.data.image.file_key, /\.jpg$/);        // stored as what it really is

  // rejected: disguised files, svg (can carry scripts), gif, empty, missing
  const before = store.size;
  assert.equal((await up(file(Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png'))).status, 415);
  assert.equal((await up(file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml'))).status, 415);
  assert.equal((await up(file(Buffer.from('GIF89a....'), 'x.gif', 'image/gif'))).status, 415);
  assert.equal((await up(file([], 'empty.png', 'image/png'))).status, 400);
  assert.equal((await callForm(url, { notfile: 'x' }, { cookie: admin })).status, 400);
  const big = new Uint8Array(5 * 1024 * 1024 + 1); big.set(PNG);
  assert.equal((await up(file(big, 'big.png', 'image/png'))).status, 413);
  assert.equal(store.size, before);                                                                      // nothing stored for rejected files

  // served publicly, with the right type and long-lived caching
  const key = png.data.image.file_key;
  const served = await rawCall('GET', '/api/img/' + key);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.match(served.headers.get('cache-control'), /immutable/);
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual([...new Uint8Array(await served.arrayBuffer())], [...PNG, 9, 9]);
  assert.equal((await rawCall('GET', '/api/img/p1-missingmissing01.png')).status, 404);
  for (const bad of ['..%2F..%2Fsecret', 'p1-short.png', 'evil.html', 'p1-AAAAAAAAAAAAAAAA.svg']) assert.equal((await rawCall('GET', '/api/img/' + bad)).status, 404, bad);

  // storefront sees the cover + gallery; legacy external links still coexist
  const legacy = await call('POST', `/api/admin/products/${pid}/images`, { cookie: admin, body: { url: 'https://img.example/old.jpg' } });
  assert.equal(legacy.data.image.src, 'https://img.example/old.jpg');
  const listed = (await call('GET', '/api/products?department=Women')).data.products.find((p) => p.id === pid);
  assert.equal(listed.image_url, '/api/img/' + key);
  const gallery = (await call('GET', `/api/products/${pid}`)).data.images.map((i) => i.src);
  assert.equal(gallery[0], '/api/img/' + key); assert.ok(gallery.includes('https://img.example/old.jpg'));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM product_images WHERE product_id = ?').get(pid).n, 5);

  // 12-photo cap counts uploads, and a refused upload leaves nothing behind
  for (let i = 0; i < 7; i++) assert.equal((await up(file(PNG, `x${i}.png`, 'image/png'))).status, 201);
  const full = store.size;
  assert.equal((await up(file(PNG, 'one-more.png', 'image/png'))).status, 400);
  assert.equal(store.size, full);

  // storage not configured -> clear message, nothing breaks
  const bucket = env.IMAGES; delete env.IMAGES;
  assert.equal((await up(file(PNG, 'a.png', 'image/png'))).status, 503);
  assert.equal((await rawCall('GET', '/api/img/' + key)).status, 404);
  env.IMAGES = bucket;

  // deleting a photo removes its file; deleting the product removes the rest
  assert.equal((await call('DELETE', `/api/admin/images/${png.data.image.id}`, { cookie: admin })).status, 200);
  assert.equal(store.has(key), false);
  assert.equal((await rawCall('GET', '/api/img/' + key)).status, 404);
  const remaining = sqlite.prepare('SELECT file_key FROM product_images WHERE product_id = ? AND file_key IS NOT NULL').all(pid).map((r) => r.file_key);
  assert.ok(remaining.length > 0 && remaining.every((k) => store.has(k)));
  assert.equal((await call('DELETE', `/api/admin/products/${pid}`, { cookie: admin })).status, 200);
  assert.ok(remaining.every((k) => !store.has(k)));                                                       // no orphaned files
});

test('Google sign-in: PKCE redirect, state check, profile completion, returning users, rejections', async () => {
  const realFetch = globalThis.fetch;
  env.GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com'; env.GOOGLE_CLIENT_SECRET = 'csecret';
  const jwt = (c) => 'h.' + Buffer.from(JSON.stringify(c)).toString('base64url') + '.s';
  const claims = (o = {}) => ({ iss: 'https://accounts.google.com', aud: env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 3600, sub: 'g-123', email: 'gina@gmail.com', email_verified: true, name: 'Gina Google', ...o });
  const tokenCalls = [];
  const googleReturns = (c, ok = true) => { globalThis.fetch = async (u, init) => { tokenCalls.push({ u, body: new URLSearchParams(init.body.toString()) }); return new Response(JSON.stringify({ id_token: jwt(c) }), { status: ok ? 200 : 400 }); }; };
  async function begin(next = '/men.html') {
    const res = await rawCall('GET', '/api/auth/google/start?next=' + encodeURIComponent(next));
    const loc = new URL(res.headers.get('location'));
    const ck = cookiesOf(res)[0];
    return { res, loc, ck, state: loc.searchParams.get('state'), saved: ck ? JSON.parse(Buffer.from(ck.split('=')[1], 'base64url').toString()) : null };
  }
  const callback = (b, extra = '') => rawCall('GET', `/api/auth/google/callback?code=abc&state=${b.state}${extra}`, { cookie: b.ck });
  const errOf = (res) => new URL(res.headers.get('location'), 'https://flex.test').searchParams.get('auth_error');
  try {
    // start: goes to Google with PKCE + state, remembers them in a short-lived HttpOnly cookie
    const a = await begin('/men.html');
    assert.equal(a.res.status, 302);
    assert.equal(a.loc.origin + a.loc.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(a.loc.searchParams.get('client_id'), env.GOOGLE_CLIENT_ID);
    assert.equal(a.loc.searchParams.get('redirect_uri'), 'https://flex.test/api/auth/google/callback');
    assert.equal(a.loc.searchParams.get('response_type'), 'code');
    assert.equal(a.loc.searchParams.get('scope'), 'openid email profile');
    assert.equal(a.loc.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(a.loc.searchParams.get('code_challenge'), createHash('sha256').update(a.saved.verifier).digest('base64url'));
    assert.equal(a.saved.state, a.state); assert.equal(a.saved.next, '/men.html');
    const sc = a.res.headers.getSetCookie()[0]; assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Lax/);

    // open-redirect attempts all fall back to "/"
    for (const evil of ['//evil.example', 'https://evil.example', '/\\evil.example', '/\t/evil.example', '/%0d%0aSet-Cookie:x=1', 'javascript:alert(1)']) {
      assert.equal((await begin(evil)).saved.next, evil.startsWith('/%0d') ? evil : '/', evil);
    }

    // callback: wrong state, no cookie, and "user pressed cancel" never reach Google's token endpoint
    googleReturns(claims());
    const wrong = await rawCall('GET', `/api/auth/google/callback?code=abc&state=nope`, { cookie: a.ck });
    assert.equal(errOf(wrong), 'google_state');
    assert.equal(errOf(await rawCall('GET', `/api/auth/google/callback?code=abc&state=${a.state}`)), 'google_state');
    assert.equal(errOf(await callback(a, '&error=access_denied')), 'google_denied');
    assert.equal(tokenCalls.length, 0);

    // brand-new Google user -> park identity, send them to finish their profile (no session yet)
    const cb = await callback(a);
    assert.equal(cb.status, 302);
    assert.equal(cb.headers.get('location'), '/register.html?google=1&next=%2Fmen.html');
    const cookies = cb.headers.getSetCookie();
    assert.ok(!cookies.some((c) => c.startsWith('flex_session=')));
    const pending = cookies.find((c) => c.startsWith('flex_oauth_pending=')); assert.match(pending, /SameSite=Strict/); assert.match(pending, /HttpOnly/);
    assert.ok(cookies.some((c) => c.startsWith('flex_oauth=;') && /Max-Age=0/.test(c)));               // one-time state is cleared
    const t = tokenCalls[0].body;
    assert.equal(t.get('grant_type'), 'authorization_code'); assert.equal(t.get('code_verifier'), a.saved.verifier);
    assert.equal(t.get('client_secret'), 'csecret'); assert.equal(t.get('code'), 'abc');
    const pck = pending.split(';')[0];

    assert.equal((await rawCall('GET', '/api/auth/google/pending')).status, 404);
    const pend = await rawCall('GET', '/api/auth/google/pending', { cookie: pck });
    assert.deepEqual(await pend.json(), { email: 'gina@gmail.com', name: 'Gina Google' });

    // completing the profile: validated, then the account + session are created
    const complete = (b, c = pck) => rawCall('POST', '/api/auth/google/complete', { cookie: c, body: b });
    const prof = { username: 'gina', name: 'Gina Google', ...profile };
    assert.equal((await complete({ ...prof, phone: '' })).status, 400);
    assert.equal((await complete({ ...prof, username: 'bad name!' })).status, 400);
    assert.equal((await complete({ ...prof, username: 'ADMIN' })).status, 409);                       // taken
    assert.equal((await complete(prof, 'flex_oauth_pending=forged')).status, 404);
    const done = await complete(prof);
    assert.equal(done.status, 201);
    const u = (await done.json()).user; assert.equal(u.role, 'customer'); assert.equal(u.username, 'gina'); assert.equal(u.email, 'gina@gmail.com');
    const dc = done.headers.getSetCookie();
    const sess = dc.find((c) => c.startsWith('flex_session='));
    assert.ok(sess && /HttpOnly/.test(sess) && /SameSite=Strict/.test(sess));
    assert.ok(dc.some((c) => c.startsWith('flex_oauth_pending=;') && /Max-Age=0/.test(c)));
    const row = sqlite.prepare("SELECT google_sub, email, phone, city, password_hash, role FROM users WHERE username = 'gina'").get();
    assert.equal(row.google_sub, 'g-123'); assert.equal(row.phone, '+84 901 234 567'); assert.equal(row.city, 'Phan Thiet'); assert.equal(row.role, 'customer');
    assert.equal((await complete(prof)).status, 404);                                                  // single use
    assert.equal((await call('GET', '/api/auth/me', { cookie: sess.split(';')[0] })).data.user.username, 'gina');
    assert.equal((await call('POST', '/api/auth/login', { body: { username: 'gina', password: 'oauth$google' } })).status, 401);   // no password login exists for it
    assert.equal((await call('POST', '/api/auth/login', { body: { username: 'gina', password: '' } })).status, 401);

    // same Google account again -> straight in, no profile form
    const b2 = await begin('/'); const back = await callback(b2);
    assert.equal(back.headers.get('location'), '/');
    assert.ok(back.headers.getSetCookie().some((c) => c.startsWith('flex_session=')));
    assert.ok(!back.headers.getSetCookie().some((c) => c.startsWith('flex_oauth_pending=') && !/Max-Age=0/.test(c)));

    // a disabled account is refused
    sqlite.exec("UPDATE users SET status = 'disabled' WHERE username = 'gina'");
    const b3 = await begin('/'); assert.equal(errOf(await callback(b3)), 'account_disabled');
    sqlite.exec("UPDATE users SET status = 'active' WHERE username = 'gina'");

    // Google email that matches an existing password account must NOT sign into it
    googleReturns(claims({ sub: 'g-999', email: 'newadmin@flex.test', name: 'Imposter' }));
    const b4 = await begin('/'); const imp = await callback(b4);
    assert.match(imp.headers.get('location'), /^\/register\.html\?google=1/);
    assert.ok(!imp.headers.getSetCookie().some((c) => c.startsWith('flex_session=')));

    // bad tokens are refused
    for (const [label, c, code] of [['wrong audience', claims({ aud: 'someone-else' }), 'google_failed'], ['expired', claims({ exp: 1 }), 'google_failed'],
                                    ['wrong issuer', claims({ iss: 'https://evil.example' }), 'google_failed'], ['unverified email', claims({ email_verified: false }), 'google_unverified']]) {
      googleReturns(c); const b = await begin('/'); assert.equal(errOf(await callback(b)), code, label);
    }
    googleReturns(claims(), false); { const b = await begin('/'); assert.equal(errOf(await callback(b)), 'google_failed'); }          // Google said no
    globalThis.fetch = async () => { throw new Error('network down'); }; { const b = await begin('/'); assert.equal(errOf(await callback(b)), 'google_failed'); }

    // not configured -> friendly error instead of a broken redirect
    delete env.GOOGLE_CLIENT_SECRET;
    assert.equal(errOf(await rawCall('GET', '/api/auth/google/start?next=/men.html')), 'google_not_configured');
    assert.equal((await rawCall('GET', '/api/auth/google/start?next=/men.html')).headers.get('location'), '/men.html?auth_error=google_not_configured');
  } finally {
    globalThis.fetch = realFetch; delete env.GOOGLE_CLIENT_ID; delete env.GOOGLE_CLIENT_SECRET;
  }
});
