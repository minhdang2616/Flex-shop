document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var user = null, cart = [], note = '', lastOrder = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return '$' + (c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }); }

  async function api(method, path, body) {
    var res = await fetch('/api' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Something went wrong'); e.status = res.status; throw e; }
    return data;
  }

  // ---------- mobile nav ----------
  var navToggle = $('navToggle'), links = document.querySelector('.navlinks');
  if (navToggle) navToggle.addEventListener('click', function () {
    var open = links.style.display === 'flex';
    links.style.display = open ? 'none' : 'flex';
    Object.assign(links.style, { flexDirection: 'column', position: 'absolute', top: '54px', left: '0', right: '0', background: 'var(--white)', borderBottom: '1px solid var(--border)', padding: '16px 32px', gap: '6px' });
    navToggle.setAttribute('aria-expanded', String(!open));
  });

  // ---------- overlay / modal / drawer ----------
  var overlay = $('overlay'), accountModal = $('accountModal'), cartDrawer = $('cartDrawer');
  function closeAll() { [accountModal, cartDrawer, overlay].forEach(function (el) { if (el) el.classList.remove('open'); }); }
  function openAccount(msg) {
    closeAll(); accountModal.classList.add('open'); overlay.classList.add('open');
    var m = $('loginMsg'); m.textContent = msg || ''; m.classList.toggle('show', !!msg);
    var f = $('lemail'); if (f && !user) f.focus();
  }
  overlay.addEventListener('click', closeAll);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  $('closeAccount').addEventListener('click', closeAll);
  $('closeCart').addEventListener('click', closeAll);
  $('accountBtn').addEventListener('click', function () { openAccount(); });
  $('cartBtn').addEventListener('click', function () { closeAll(); cartDrawer.classList.add('open'); overlay.classList.add('open'); });

  // ---------- account ----------
  function paintUser() {
    var signIn = $('signInLink');
    if (signIn) signIn.textContent = user ? 'Sign Out' : 'Sign In';
    $('accountBtn').setAttribute('aria-label', user ? 'Account: ' + user.name : 'Account');
    $('authPanel').hidden = !!user; $('accountInfo').hidden = !user;
    if (user) $('accountHello').textContent = 'Signed in as ' + user.name + ' (' + user.email + ')';
    $('accountTitle').textContent = user ? 'Your account' : 'Account';
  }
  async function logout() { try { await api('POST', '/auth/logout'); } catch (e) {} user = null; paintUser(); }
  $('signInLink').addEventListener('click', function (e) { e.preventDefault(); if (user) logout(); else openAccount(); });
  $('logoutBtn').addEventListener('click', function () { logout(); closeAll(); });

  var tabLogin = $('tabLogin'), tabRegister = $('tabRegister'), loginForm = $('loginForm'), registerForm = $('registerForm');
  function tab(login) {
    tabLogin.classList.toggle('active', login); tabRegister.classList.toggle('active', !login);
    loginForm.classList.toggle('active', login); registerForm.classList.toggle('active', !login);
  }
  tabLogin.addEventListener('click', function () { tab(true); });
  tabRegister.addEventListener('click', function () { tab(false); });
  function authSubmit(form, path, fields, msgEl) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); msgEl.classList.add('show'); msgEl.textContent = 'Please wait...';
      try {
        var body = {}; fields.forEach(function (f) { body[f[0]] = $(f[1]).value; });
        var r = await api('POST', path, body);
        user = r.user; form.reset(); paintUser(); msgEl.textContent = ''; msgEl.classList.remove('show');
      } catch (err) { msgEl.textContent = err.message; }
    });
  }
  authSubmit(loginForm, '/auth/login', [['email', 'lemail'], ['password', 'lpass']], $('loginMsg'));
  authSubmit(registerForm, '/auth/register', [['name', 'rname'], ['email', 'remail'], ['password', 'rpass']], $('registerMsg'));

  // ---------- catalog ----------
  function cardHtml(p) {
    var sold = p.stock <= 0, tag = p.tag ? '<span class="tag' + (p.tag === 'Bestseller' ? ' volt' : '') + '">' + esc(p.tag) + '</span>' : '';
    var media = p.image_url
      ? '<div class="swatch has-photo"><img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy">' + tag + '</div>'
      : '<div class="swatch" style="--swatch-c:var(--' + esc(p.color) + ');">' + tag + '</div>';
    return '<div class="card">' + media + '<h3>' + esc(p.name) + '</h3>' +
      '<span class="price">' + money(p.price_cents) + (p.stock > 0 && p.stock <= 5 ? ' &middot; only ' + p.stock + ' left' : '') + '</span>' +
      '<button class="addcart" data-id="' + p.id + '" data-name="' + esc(p.name) + '" data-price="' + p.price_cents + '" data-stock="' + p.stock + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : 'Add to bag') + '</button></div>';
  }
  document.querySelectorAll('.grid[data-department], .grid[data-featured]').forEach(function (grid) {
    var q = [];
    if (grid.dataset.department) q.push('department=' + encodeURIComponent(grid.dataset.department));
    if (grid.dataset.category) q.push('category=' + encodeURIComponent(grid.dataset.category));
    if (grid.dataset.featured) q.push('featured=1');
    grid.innerHTML = '<p class="empty-note">Loading...</p>';
    api('GET', '/products?' + q.join('&')).then(function (r) {
      grid.innerHTML = r.products.length ? r.products.map(cardHtml).join('') : '<p class="empty-note">New pieces coming soon.</p>';
    }).catch(function () { grid.innerHTML = '<p class="empty-note">We could not load products. Please refresh.</p>'; });
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.addcart'); if (!btn || btn.disabled) return;
    var id = +btn.dataset.id, stock = +btn.dataset.stock, line = cart.find(function (i) { return i.id === id; });
    if (line && line.qty >= stock) { btn.textContent = 'Max in bag'; setTimeout(function () { btn.textContent = 'Add to bag'; }, 900); return; }
    if (line) line.qty++; else cart.push({ id: id, name: btn.dataset.name, price: +btn.dataset.price, qty: 1 });
    note = ''; lastOrder = ''; saveCart(); renderCart();
    btn.textContent = 'Added'; setTimeout(function () { btn.textContent = 'Add to bag'; }, 900);
  });

  // ---------- cart (kept in this browser so it survives page changes) ----------
  function saveCart() { try { localStorage.setItem('flex_cart', JSON.stringify(cart)); } catch (e) {} }
  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem('flex_cart') || '[]');
      cart = Array.isArray(raw) ? raw.filter(function (i) { return i && Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty > 0 && Number.isFinite(i.price); }).map(function (i) { return { id: i.id, name: String(i.name).slice(0, 100), price: i.price, qty: Math.min(i.qty, 20) }; }) : [];
    } catch (e) { cart = []; }
  }
  var itemsEl = $('cartItems');
  function renderCart() {
    var html = note ? '<p class="formmsg show">' + esc(note) + '</p>' : '';
    if (!cart.length) html += lastOrder ? '<p class="cart-empty"><strong>Order ' + esc(lastOrder) + ' placed.</strong> Thank you!</p>' : '<p class="cart-empty">Your bag is empty.</p>';
    else html += cart.map(function (it, i) {
      return '<div class="cart-item"><div><h4>' + esc(it.name) + '</h4><span>' + money(it.price) + '</span><div class="qtyrow"><button class="qtybtn" data-i="' + i + '" data-d="-1" aria-label="Fewer">-</button><span>' + it.qty + '</span><button class="qtybtn" data-i="' + i + '" data-d="1" aria-label="More">+</button></div><button class="remove" data-i="' + i + '">Remove</button></div><strong>' + money(it.price * it.qty) + '</strong></div>';
    }).join('');
    itemsEl.innerHTML = html;
    var count = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    $('cartBadge').textContent = count; $('cartBadge').hidden = count === 0;
    $('cartBtn').setAttribute('aria-label', 'Bag, ' + count + ' items');
    $('cartSubtotal').textContent = money(cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0));
  }
  itemsEl.addEventListener('click', function (e) {
    var t = e.target, i = +t.dataset.i;
    if (t.classList.contains('qtybtn')) { cart[i].qty = Math.min(20, cart[i].qty + +t.dataset.d); if (cart[i].qty <= 0) cart.splice(i, 1); }
    else if (t.classList.contains('remove')) cart.splice(i, 1);
    else return;
    saveCart(); renderCart();
  });
  $('checkoutBtn').addEventListener('click', async function () {
    if (!cart.length) return;
    if (!user) { openAccount('Sign in or create an account to check out.'); return; }
    var btn = this; btn.disabled = true;
    try {
      var r = await api('POST', '/orders', { items: cart.map(function (i) { return { productId: i.id, qty: i.qty }; }) });
      cart = []; note = ''; lastOrder = r.orderNo; saveCart();
    } catch (err) {
      if (err.status === 401) { user = null; paintUser(); openAccount('Your session ended. Please sign in again.'); }
      else note = err.message;
    }
    btn.disabled = false; renderCart();
  });

  // ---------- upcoming drops ----------
  var dropgrid = $('dropgrid');
  if (dropgrid) api('GET', '/drops').then(function (r) {
    var colors = ['red', 'blue', 'volt', 'ink'];
    dropgrid.innerHTML = r.drops.length ? r.drops.map(function (d, i) {
      return '<div class="dropcard"><div class="swatch" style="--swatch-c:var(--' + colors[i % 4] + ');"></div><span class="dropdate">Drops ' + esc(d.release_date) + '</span><h3>' + esc(d.name) + '</h3><p>' + esc(d.description) + '</p><button class="notifybtn" data-id="' + d.id + '">Notify me</button></div>';
    }).join('') : '<p class="empty-note">No drops scheduled right now. Check back soon.</p>';
  }).catch(function () { dropgrid.innerHTML = '<p class="empty-note">We could not load upcoming drops.</p>'; });
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('.notifybtn'); if (!b || b.disabled) return;
    if (!user) { openAccount('Sign in to get notified when this drops.'); return; }
    try { await api('POST', '/drops/' + b.dataset.id + '/subscribe'); b.textContent = "You're on the list"; b.classList.add('done'); b.disabled = true; }
    catch (err) { b.textContent = err.message; }
  });

  // ---------- contact ----------
  var contactForm = $('contactForm');
  if (contactForm) contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('contactMsg'); msg.classList.add('show'); msg.textContent = 'Sending...';
    try {
      await api('POST', '/contact', { name: $('cname').value, email: $('cemail').value, message: $('cmsg').value });
      contactForm.reset(); msg.textContent = "Sent. We'll get back to you within a day.";
    } catch (err) { msg.textContent = err.message; }
  });

  // ---------- boot ----------
  loadCart(); renderCart();
  api('GET', '/auth/me').then(function (r) { user = r.user; paintUser(); }).catch(function () {});
});
