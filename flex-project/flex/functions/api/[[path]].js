// Flex API — Cloudflare Pages Function backed by D1 (SQLite).
// Every SQL statement uses bound parameters; passwords are PBKDF2-hashed; sessions are random tokens
// stored only as SHA-256 hashes and sent in an HttpOnly cookie.

const PBKDF2_ITER = 100000;            // Workers' maximum for PBKDF2
const CUSTOMER_SESSION = 7 * 86400;    // seconds
const STAFF_SESSION = 12 * 3600;
const MAX_FAILS = 5, LOCK_SECONDS = 900;
const DEPTS = ['Men', 'Women', 'Kids', 'Unisex'];
const CATS = ['Tops', 'Bottoms', 'Outerwear'];
const COLORS = ['red', 'blue', 'ink', 'volt'];
const TAGS = ['', 'New', 'Bestseller'];
const ORDER_STATUS = ['pending', 'shipped', 'delivered', 'cancelled'];

const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m) => new HttpError(400, m);

// ---------- crypto ----------
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}
async function hashPassword(password) {
  const salt = randomBytes(16);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITER))}`;
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored).split('$');
  if (scheme !== 'pbkdf2') return false;
  return safeEqual(await pbkdf2(password, unb64(salt), Number(iter)), unb64(hash));
}
async function sha256hex(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const DUMMY_HASH = `pbkdf2$${PBKDF2_ITER}$${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`;   // equalises timing for unknown emails

// ---------- validation ----------
function str(v, name, min, max) {
  if (typeof v !== 'string') throw bad(`${name} is required`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${name} must be ${min}-${max} characters`);
  return s;
}
function int(v, name, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}`);
  return n;
}
function username(v) {
  const s = str(v, 'Username', 3, 30).toLowerCase();
  if (!/^[a-z0-9_.]+$/.test(s)) throw bad('Username can only contain letters, numbers, underscores and periods');
  return s;
}
function email(v) {
  const s = str(v, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/.test(s)) throw bad('Enter a valid email address');
  return s;
}
function password(v) {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) throw bad('Password must be 8-128 characters');
  return v;
}
function oneOf(v, list, name) {
  if (!list.includes(v)) throw bad(`${name} must be one of: ${list.join(', ') || '(empty)'}`);
  return v;
}

// ---------- http helpers ----------
const SEC_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json' };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...SEC_HEADERS, ...extra } });

async function body(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 20000) throw new HttpError(413, 'Request too large');
  try {
    const data = await request.json();
    if (data === null || typeof data !== 'object') throw 0;
    return data;
  } catch { throw bad('Invalid JSON body'); }
}
function cookie(request, name) {
  const m = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? m.slice(name.length + 1) : null;
}
const sessionCookie = (token, maxAge) => `flex_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

async function currentUser(env, request) {
  const token = cookie(request, 'flex_session');
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.status FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(await sha256hex(token), now()).first();
  return row && row.status === 'active' ? row : null;
}
async function startSession(env, user) {
  const token = b64url(randomBytes(32));
  const ttl = user.role === 'customer' ? CUSTOMER_SESSION : STAFF_SESSION;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256hex(token), user.id, now(), now() + ttl),
  ]);
  return sessionCookie(token, ttl);
}
const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role });
const audit = (env, actor, action, detail = '') =>
  env.DB.prepare('INSERT INTO audit_log (user_id, actor, action, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(actor.id ?? null, actor.email, action, detail, now()).run();

function orderNo() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'F-' + [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join('');
}
const isUnique = (e) => /UNIQUE/i.test(String(e && e.message));

// ---------- public handlers ----------
async function setup({ env, request }) {
  const b = await body(request);
  if (!env.SETUP_TOKEN) throw new HttpError(404, 'Setup is disabled');
  const given = enc.encode(String(b.token || ''));
  const want = enc.encode(env.SETUP_TOKEN);
  if (!safeEqual(given, want)) throw new HttpError(403, 'Invalid setup token');
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
  if (n > 0) throw new HttpError(409, 'An admin already exists');
  const r = await env.DB.prepare('INSERT INTO users (username, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(username(b.username), email(b.email), str(b.name, 'Name', 1, 100), await hashPassword(password(b.password)), 'admin', now()).run();
  await audit(env, { id: r.meta.last_row_id, email: b.username }, 'setup.admin_created');
  return json({ ok: true });
}

async function register({ env, request }) {
  const b = await body(request);
  const un = username(b.username), e = email(b.email), name = str(b.name, 'Name', 1, 100), hash = await hashPassword(password(b.password));
  try {
    const r = await env.DB.prepare('INSERT INTO users (username, email, name, password_hash, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(un, e, name, hash, now(), now()).run();
    const user = { id: r.meta.last_row_id, username: un, email: e, name, role: 'customer' };
    return json({ user: publicUser(user) }, 201, { 'Set-Cookie': await startSession(env, user) });
  } catch (err) {
    if (isUnique(err)) throw new HttpError(409, 'That username is already taken');
    throw err;
  }
}

// Checks a password against one user row, with lockout, then starts a session.
async function authenticate(env, u, pw, failMessage) {
  if (!u) { await verifyPassword(pw, DUMMY_HASH); throw new HttpError(401, failMessage); }
  if (u.locked_until > now()) throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');
  if (!(await verifyPassword(pw, u.password_hash))) {
    const fails = u.failed_attempts + 1;
    await env.DB.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
      .bind(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? now() + LOCK_SECONDS : 0, u.id).run();
    throw new HttpError(401, failMessage);
  }
  if (u.status !== 'active') throw new HttpError(403, 'This account is disabled');
  await env.DB.prepare('UPDATE users SET failed_attempts = 0, locked_until = 0, last_login_at = ? WHERE id = ?').bind(now(), u.id).run();
  return json({ user: publicUser(u) }, 200, { 'Set-Cookie': await startSession(env, u) });
}

async function login({ env, request }) {
  const b = await body(request);
  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username(b.username)).first();
  return authenticate(env, u, typeof b.password === 'string' ? b.password.slice(0, 128) : '', 'Invalid username or password');
}

async function logout({ env, request }) {
  const token = cookie(request, 'flex_session');
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

const me = async ({ user }) => json({ user: user ? publicUser(user) : null });

async function listProducts({ env, url }) {
  let sql = `SELECT p.id, p.name, p.department, p.category, p.price_cents, p.stock, p.tag, p.color,
    (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS image_url
    FROM products p WHERE p.status = 'active'`;
  const binds = [];
  const dep = url.searchParams.get('department'), cat = url.searchParams.get('category');
  if (DEPTS.includes(dep)) { sql += ' AND p.department = ?'; binds.push(dep); }
  if (CATS.includes(cat)) { sql += ' AND p.category = ?'; binds.push(cat); }
  if (url.searchParams.get('featured') === '1') sql += ' AND p.featured = 1';
  const { results } = await env.DB.prepare(sql + ' ORDER BY p.id').bind(...binds).all();
  return json({ products: results });
}

// Public product page: full detail plus the ordered image gallery.
async function productDetail({ env, params }) {
  const id = Number(params.id);
  const product = await env.DB.prepare(
    "SELECT id, name, department, category, price_cents, stock, tag, color FROM products WHERE id = ? AND status = 'active'"
  ).bind(id).first();
  if (!product) throw new HttpError(404, 'Product not found');
  const { results } = await env.DB.prepare('SELECT id, url, alt_text, position FROM product_images WHERE product_id = ? ORDER BY position, id').bind(id).all();
  return json({ product, images: results });
}

async function listDropsPublic({ env }) {
  const { results } = await env.DB.prepare('SELECT id, name, description, release_date FROM drops ORDER BY id').all();
  return json({ drops: results });
}

async function subscribe({ env, user, params }) {
  const drop = await env.DB.prepare('SELECT id FROM drops WHERE id = ?').bind(Number(params.id)).first();
  if (!drop) throw new HttpError(404, 'Drop not found');
  await env.DB.prepare('INSERT OR IGNORE INTO drop_subscribers (drop_id, email, created_at) VALUES (?, ?, ?)')
    .bind(drop.id, user.email, now()).run();
  return json({ ok: true });
}

async function contact({ env, request }) {
  const b = await body(request);
  const e = email(b.email), name = str(b.name, 'Name', 1, 100), text = str(b.message, 'Message', 1, 2000);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE email = ? AND created_at > ?').bind(e, now() - 3600).first();
  if (n >= 5) throw new HttpError(429, 'Too many messages. Please try again later.');
  await env.DB.prepare('INSERT INTO messages (name, email, body, created_at) VALUES (?, ?, ?, ?)').bind(name, e, text, now()).run();
  return json({ ok: true }, 201);
}

async function checkout({ env, request, user }) {
  const b = await body(request);
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 20) throw bad('Your bag is empty');
  const wanted = new Map();
  for (const it of b.items) {
    const id = int(it && it.productId, 'Product', 1, 1e9), qty = int(it && it.qty, 'Quantity', 1, 20);
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }
  const ids = [...wanted.keys()];
  const { results } = await env.DB.prepare(
    `SELECT id, name, price_cents, stock FROM products WHERE status = 'active' AND id IN (${ids.map(() => '?').join(',')})`
  ).bind(...ids).all();
  if (results.length !== ids.length) throw new HttpError(409, 'Some items in your bag are no longer available');
  let total = 0;
  for (const p of results) {
    const qty = wanted.get(p.id);
    if (p.stock < qty) throw new HttpError(409, `Only ${p.stock} left of ${p.name}`);
    total += p.price_cents * qty;                 // price always comes from the database
  }
  const no = orderNo(), t = now();
  const stmts = [env.DB.prepare('INSERT INTO orders (order_no, user_id, email, name, total_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(no, user.id, user.email, user.name, total, t)];
  for (const p of results) {
    const qty = wanted.get(p.id);
    stmts.push(env.DB.prepare('INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty) VALUES ((SELECT id FROM orders WHERE order_no = ?), ?, ?, ?, ?)')
      .bind(no, p.id, p.name, p.price_cents, qty));
    // stock has CHECK (stock >= 0): if someone bought the last unit meanwhile, this fails and the whole batch rolls back
    stmts.push(env.DB.prepare('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?').bind(qty, t, p.id));
  }
  try { await env.DB.batch(stmts); }
  catch (err) {
    if (/CHECK|constraint/i.test(String(err.message))) throw new HttpError(409, 'Some items just sold out. Please review your bag.');
    throw err;
  }
  return json({ orderNo: no, totalCents: total }, 201);
}

// ---------- admin handlers ----------
async function stats({ env }) {
  const since = now() - 7 * 86400;
  const [rev, ord, cust, low, days, recent] = await env.DB.batch([
    env.DB.prepare("SELECT COALESCE(SUM(total_cents),0) AS v FROM orders WHERE status != 'cancelled'"),
    env.DB.prepare('SELECT COUNT(*) AS v FROM orders'),
    env.DB.prepare("SELECT COUNT(*) AS v FROM users WHERE role = 'customer'"),
    env.DB.prepare('SELECT COUNT(*) AS v FROM products WHERE stock <= 10'),
    env.DB.prepare("SELECT date(created_at,'unixepoch') AS day, SUM(total_cents) AS v FROM orders WHERE status != 'cancelled' AND created_at >= ? GROUP BY day").bind(since),
    env.DB.prepare('SELECT id, order_no, name, total_cents, status FROM orders ORDER BY id DESC LIMIT 5'),
  ]);
  const byDay = Object.fromEntries(days.results.map((r) => [r.day, r.v]));
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date((now() - i * 86400) * 1000), key = d.toISOString().slice(0, 10);
    week.push({ day: key, label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }), cents: byDay[key] || 0 });
  }
  return json({
    revenueCents: rev.results[0].v, orders: ord.results[0].v, customers: cust.results[0].v,
    lowStock: low.results[0].v, week, recent: recent.results,
  });
}

function productFields(b) {
  const price = Number(b.priceCents);
  if (!Number.isInteger(price) || price < 0 || price > 10000000) throw bad('Price must be a valid amount');
  return {
    name: str(b.name, 'Name', 1, 100), department: oneOf(b.department, DEPTS, 'Department'),
    category: oneOf(b.category, CATS, 'Category'), price_cents: price, stock: int(b.stock, 'Stock', 0, 1000000),
    status: oneOf(b.status, ['active', 'draft'], 'Status'), tag: oneOf(b.tag ?? '', TAGS, 'Tag'),
    color: oneOf(b.color ?? 'blue', COLORS, 'Color'), featured: b.featured ? 1 : 0,
  };
}
async function adminProducts({ env }) {
  const { results } = await env.DB.prepare(`SELECT p.*,
    (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position, id LIMIT 1) AS image_url,
    (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS image_count
    FROM products p ORDER BY p.id DESC`).all();
  return json({ products: results });
}
async function createProduct({ env, request, user }) {
  const b = await body(request), f = productFields(b);
  const sku = b.sku ? str(b.sku, 'SKU', 2, 40).toUpperCase() : 'FX-' + b64url(randomBytes(4)).toUpperCase().replace(/[-_]/g, 'X');
  try {
    const t = now();
    const r = await env.DB.prepare(`INSERT INTO products (sku,name,department,category,price_cents,stock,status,tag,color,featured,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(sku, f.name, f.department, f.category, f.price_cents, f.stock, f.status, f.tag, f.color, f.featured, t, t).run();
    await audit(env, user, 'product.create', `${f.name} (${sku})`);
    return json({ product: await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(r.meta.last_row_id).first() }, 201);
  } catch (err) { if (isUnique(err)) throw new HttpError(409, 'That SKU already exists'); throw err; }
}
async function updateProduct({ env, request, user, params }) {
  const id = Number(params.id), f = productFields(await body(request));
  const r = await env.DB.prepare(`UPDATE products SET name=?,department=?,category=?,price_cents=?,stock=?,status=?,tag=?,color=?,featured=?,updated_at=? WHERE id=?`)
    .bind(f.name, f.department, f.category, f.price_cents, f.stock, f.status, f.tag, f.color, f.featured, now(), id).run();
  if (!r.meta.changes) throw new HttpError(404, 'Product not found');
  await audit(env, user, 'product.update', `#${id} ${f.name}`);
  return json({ product: await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first() });
}
async function deleteProduct({ env, user, params }) {
  const id = Number(params.id);
  const p = await env.DB.prepare('SELECT name FROM products WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError(404, 'Product not found');
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();   // product_images cascade-delete with it
  await audit(env, user, 'product.delete', `#${id} ${p.name}`);
  return json({ ok: true });
}

// ---------- product images ("cloth img") ----------
function imageUrl(v) {
  const s = str(v, 'Image URL', 8, 2000);
  if (!/^https:\/\//i.test(s)) throw bad('Image URL must start with https://');
  return s;
}
async function listProductImages({ env, params }) {
  const productId = Number(params.id);
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
  if (!product) throw new HttpError(404, 'Product not found');
  const { results } = await env.DB.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY position, id').bind(productId).all();
  return json({ images: results });
}
async function addProductImage({ env, request, user, params }) {
  const productId = Number(params.id);
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
  if (!product) throw new HttpError(404, 'Product not found');
  const b = await body(request);
  const url = imageUrl(b.url), alt = str(b.altText ?? '', 'Alt text', 0, 200);
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?').bind(productId).first();
  if (count >= 12) throw bad('A product can have at most 12 images');
  const position = Number.isInteger(b.position) ? int(b.position, 'Position', 0, 999) : count;
  const width = b.width != null ? int(b.width, 'Width', 1, 20000) : null;
  const height = b.height != null ? int(b.height, 'Height', 1, 20000) : null;
  const r = await env.DB.prepare('INSERT INTO product_images (product_id, url, alt_text, position, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(productId, url, alt, position, width, height, now()).run();
  await audit(env, user, 'product.image_add', `product #${productId}`);
  return json({ image: await env.DB.prepare('SELECT * FROM product_images WHERE id = ?').bind(r.meta.last_row_id).first() }, 201);
}
async function updateProductImage({ env, request, user, params }) {
  const id = Number(params.id);
  const existing = await env.DB.prepare('SELECT product_id FROM product_images WHERE id = ?').bind(id).first();
  if (!existing) throw new HttpError(404, 'Image not found');
  const b = await body(request);
  const alt = str(b.altText ?? '', 'Alt text', 0, 200), position = int(b.position, 'Position', 0, 999);
  await env.DB.prepare('UPDATE product_images SET alt_text = ?, position = ? WHERE id = ?').bind(alt, position, id).run();
  await audit(env, user, 'product.image_update', `product #${existing.product_id} image #${id}`);
  return json({ ok: true });
}
async function setCoverImage({ env, user, params }) {
  const id = Number(params.id);
  const target = await env.DB.prepare('SELECT product_id FROM product_images WHERE id = ?').bind(id).first();
  if (!target) throw new HttpError(404, 'Image not found');
  const { results } = await env.DB.prepare('SELECT id FROM product_images WHERE product_id = ? ORDER BY position, id').bind(target.product_id).all();
  const ordered = [id, ...results.map((r) => r.id).filter((x) => x !== id)];
  await env.DB.batch(ordered.map((imgId, i) => env.DB.prepare('UPDATE product_images SET position = ? WHERE id = ?').bind(i, imgId)));
  await audit(env, user, 'product.image_cover', `product #${target.product_id} image #${id}`);
  return json({ ok: true });
}
async function deleteProductImage({ env, user, params }) {
  const id = Number(params.id);
  const img = await env.DB.prepare('SELECT product_id FROM product_images WHERE id = ?').bind(id).first();
  if (!img) throw new HttpError(404, 'Image not found');
  await env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(id).run();
  await audit(env, user, 'product.image_delete', `product #${img.product_id} image #${id}`);
  return json({ ok: true });
}

async function adminOrders({ env, url }) {
  const status = url.searchParams.get('status');
  const where = ORDER_STATUS.includes(status) ? 'WHERE o.status = ?' : '';
  const stmt = env.DB.prepare(`SELECT o.id, o.order_no, o.name, o.email, o.total_cents, o.status, o.created_at,
    (SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id = o.id) AS items
    FROM orders o ${where} ORDER BY o.id DESC LIMIT 200`);
  const { results } = await (where ? stmt.bind(status) : stmt).all();
  return json({ orders: results });
}
async function orderDetail({ env, params }) {
  const id = Number(params.id);
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw new HttpError(404, 'Order not found');
  const { results } = await env.DB.prepare('SELECT name, unit_price_cents, qty FROM order_items WHERE order_id = ?').bind(id).all();
  return json({ order, items: results });
}
async function updateOrder({ env, request, user, params }) {
  const id = Number(params.id), status = oneOf((await body(request)).status, ORDER_STATUS, 'Status');
  const order = await env.DB.prepare('SELECT id, order_no, status FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status === 'cancelled') throw new HttpError(409, 'Cancelled orders cannot be changed');
  const stmts = [env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id)];
  if (status === 'cancelled') {                       // put the stock back
    const { results } = await env.DB.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ? AND product_id IS NOT NULL').bind(id).all();
    for (const it of results) stmts.push(env.DB.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?').bind(it.qty, now(), it.product_id));
  }
  await env.DB.batch(stmts);
  await audit(env, user, 'order.status', `${order.order_no}: ${order.status} -> ${status}`);
  return json({ ok: true });
}

async function adminDrops({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT d.*, (SELECT COUNT(*) FROM drop_subscribers s WHERE s.drop_id = d.id) AS subscribers FROM drops d ORDER BY d.id').all();
  return json({ drops: results });
}
async function createDrop({ env, request, user }) {
  const b = await body(request);
  const name = str(b.name, 'Name', 1, 100), date = str(b.releaseDate, 'Release date', 1, 40), desc = str(b.description ?? '', 'Description', 0, 500);
  await env.DB.prepare('INSERT INTO drops (name, description, release_date, created_at) VALUES (?, ?, ?, ?)').bind(name, desc, date, now()).run();
  await audit(env, user, 'drop.create', name);
  return json({ ok: true }, 201);
}
async function deleteDrop({ env, user, params }) {
  const d = await env.DB.prepare('SELECT name FROM drops WHERE id = ?').bind(Number(params.id)).first();
  if (!d) throw new HttpError(404, 'Drop not found');
  await env.DB.prepare('DELETE FROM drops WHERE id = ?').bind(Number(params.id)).run();
  await audit(env, user, 'drop.delete', d.name);
  return json({ ok: true });
}

async function adminMessages({ env }) {
  const { results } = await env.DB.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 200').all();
  return json({ messages: results });
}
async function updateMessage({ env, request, params }) {
  const status = oneOf((await body(request)).status, ['new', 'read'], 'Status');
  await env.DB.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(status, Number(params.id)).run();
  return json({ ok: true });
}
async function deleteMessage({ env, user, params }) {
  await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(Number(params.id)).run();
  await audit(env, user, 'message.delete', `#${params.id}`);
  return json({ ok: true });
}

async function adminUsers({ env }) {
  const { results } = await env.DB.prepare(`SELECT u.id, u.username, u.email, u.name, u.role, u.status, u.created_at, u.last_login_at, u.locked_until,
    (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS orders,
    (SELECT COALESCE(SUM(total_cents),0) FROM orders o WHERE o.user_id = u.id AND o.status != 'cancelled') AS spent_cents
    FROM users u ORDER BY u.id DESC LIMIT 500`).all();
  return json({ users: results });
}
async function createUser({ env, request, user }) {
  const b = await body(request);
  const un = username(b.username), e = email(b.email), name = str(b.name, 'Name', 1, 100), role = oneOf(b.role ?? 'customer', ['customer', 'staff', 'admin'], 'Role');
  const hash = await hashPassword(password(b.password));
  try {
    await env.DB.prepare('INSERT INTO users (username, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(un, e, name, hash, role, now()).run();
  } catch (err) { if (isUnique(err)) throw new HttpError(409, 'That username is already taken'); throw err; }
  await audit(env, user, 'user.create', `${un} (${role})`);
  return json({ ok: true }, 201);
}
async function updateUser({ env, request, user, params }) {
  const id = Number(params.id), b = await body(request);
  const target = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(id).first();
  if (!target) throw new HttpError(404, 'User not found');
  const un = username(b.username), e = email(b.email), name = str(b.name, 'Name', 1, 100);
  const role = oneOf(b.role, ['customer', 'staff', 'admin'], 'Role'), status = oneOf(b.status, ['active', 'disabled'], 'Status');
  if (id === user.id && (role !== user.role || status !== 'active')) throw new HttpError(409, 'You cannot change your own role or disable yourself');
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET username = ?, email = ?, name = ?, role = ?, status = ? WHERE id = ?').bind(un, e, name, role, status, id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),   // force re-login after any change
    ]);
  } catch (err) { if (isUnique(err)) throw new HttpError(409, 'That username is already taken'); throw err; }
  await audit(env, user, 'user.update', `${target.username} -> ${un}: role=${role}, status=${status}`);
  return json({ ok: true });
}
async function resetPassword({ env, request, user, params }) {
  const id = Number(params.id), pw = (await body(request)).password;
  const target = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(id).first();
  if (!target) throw new HttpError(404, 'User not found');
  const hash = await hashPassword(password(pw));
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = 0 WHERE id = ?').bind(hash, id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
  ]);
  await audit(env, user, 'user.password_reset', target.username);
  return json({ ok: true });
}
async function deleteUser({ env, user, params }) {
  const id = Number(params.id);
  if (id === user.id) throw new HttpError(409, 'You cannot delete your own account');
  const target = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(id).first();
  if (!target) throw new HttpError(404, 'User not found');
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();   // orders keep history (user_id set to NULL)
  await audit(env, user, 'user.delete', target.username);
  return json({ ok: true });
}
async function auditLog({ env }) {
  const { results } = await env.DB.prepare('SELECT actor, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 100').all();
  return json({ entries: results });
}

// ---------- router ----------
const routes = [];
const add = (method, path, handler, access) => routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler, access });
add('POST', '/api/setup', setup, 'public');
add('POST', '/api/auth/register', register, 'public');
add('POST', '/api/auth/login', login, 'public');
add('POST', '/api/auth/logout', logout, 'public');
add('GET', '/api/auth/me', me, 'public');
add('GET', '/api/products', listProducts, 'public');
add('GET', '/api/products/:id', productDetail, 'public');
add('GET', '/api/drops', listDropsPublic, 'public');
add('POST', '/api/drops/:id/subscribe', subscribe, 'customer');
add('POST', '/api/contact', contact, 'public');
add('POST', '/api/orders', checkout, 'customer');
add('GET', '/api/admin/stats', stats, 'staff');
add('GET', '/api/admin/products', adminProducts, 'staff');
add('POST', '/api/admin/products', createProduct, 'staff');
add('PUT', '/api/admin/products/:id', updateProduct, 'staff');
add('DELETE', '/api/admin/products/:id', deleteProduct, 'staff');
add('GET', '/api/admin/products/:id/images', listProductImages, 'staff');
add('POST', '/api/admin/products/:id/images', addProductImage, 'staff');
add('PUT', '/api/admin/images/:id', updateProductImage, 'staff');
add('POST', '/api/admin/images/:id/cover', setCoverImage, 'staff');
add('DELETE', '/api/admin/images/:id', deleteProductImage, 'staff');
add('GET', '/api/admin/orders', adminOrders, 'staff');
add('GET', '/api/admin/orders/:id', orderDetail, 'staff');
add('PUT', '/api/admin/orders/:id', updateOrder, 'staff');
add('GET', '/api/admin/drops', adminDrops, 'staff');
add('POST', '/api/admin/drops', createDrop, 'staff');
add('DELETE', '/api/admin/drops/:id', deleteDrop, 'staff');
add('GET', '/api/admin/messages', adminMessages, 'staff');
add('PUT', '/api/admin/messages/:id', updateMessage, 'staff');
add('DELETE', '/api/admin/messages/:id', deleteMessage, 'staff');
add('GET', '/api/admin/users', adminUsers, 'admin');
add('POST', '/api/admin/users', createUser, 'admin');
add('PUT', '/api/admin/users/:id', updateUser, 'admin');
add('POST', '/api/admin/users/:id/password', resetPassword, 'admin');
add('DELETE', '/api/admin/users/:id', deleteUser, 'admin');
add('GET', '/api/admin/audit', auditLog, 'admin');

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) throw new Error('D1 binding "DB" is not configured');
    const url = new URL(request.url);
    const method = request.method;
    if (method !== 'GET') {                                    // CSRF defence in depth (cookie is also SameSite=Strict)
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) throw new HttpError(403, 'Cross-origin request blocked');
    }
    let match = null, pathMatched = false;
    for (const r of routes) {
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method === method) { match = { r, params: m.groups || {} }; break; }
    }
    if (!match) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Method not allowed' : 'Not found');
    const user = await currentUser(env, request);
    const { access } = match.r;
    if (access !== 'public') {
      if (!user) throw new HttpError(401, 'Please sign in');
      const allowed = { customer: ['customer', 'staff', 'admin'], staff: ['staff', 'admin'], admin: ['admin'] }[access];
      if (!allowed.includes(user.role)) throw new HttpError(403, 'You do not have permission to do that');
    }
    return await match.r.handler({ request, env, url, user, params: match.params });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: 'Server error' }, 500);
  }
}
