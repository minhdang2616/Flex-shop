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
  var authPromise = Promise.resolve();       // resolves once we know whether the visitor is signed in
  function closeAll() { [accountModal, cartDrawer, overlay].forEach(function (el) { if (el) el.classList.remove('open'); }); }
  function dismiss() { clearPending(); closeAll(); }       // visitor closed it themselves, so forget what they were trying to do
  // The page to come back to after Google sign-in or registration.
  function returnTo() {
    var p = location.pathname + location.search;
    if (location.pathname.indexOf('register') !== -1) p = new URLSearchParams(location.search).get('next') || '/';
    return p.charAt(0) === '/' && p.charAt(1) !== '/' && !/[\\\u0000-\u001f]/.test(p) ? p : '/';
  }
  function paintAuthLinks() {
    var next = encodeURIComponent(returnTo());
    var g = $('googleLogin'); if (g) g.href = '/api/auth/google/start?next=' + next;
    var su = $('signupLink'); if (su) su.href = 'register.html?next=' + next;
  }
  function openAccount(msg) {
    closeAll(); accountModal.classList.add('open'); overlay.classList.add('open');
    var n = $('authNote'); if (n) { n.textContent = msg || ''; n.hidden = !msg; }
    var m = $('loginMsg'); if (m) { m.textContent = ''; m.classList.remove('show'); }
    paintAuthLinks();
    var f = $('lusername'); if (f && !user) f.focus();
  }
  function openCart() { closeAll(); cartDrawer.classList.add('open'); overlay.classList.add('open'); }
  overlay.addEventListener('click', dismiss);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') dismiss(); });
  $('closeAccount').addEventListener('click', dismiss);
  $('closeCart').addEventListener('click', closeAll);
  $('accountBtn').addEventListener('click', function () { openAccount(); });
  var loginLink = $('loginLink'); if (loginLink) loginLink.addEventListener('click', function (e) { e.preventDefault(); openAccount(); });

  // ---------- what the visitor was trying to do before logging in ----------
  // Kept in sessionStorage so it survives going to the registration page or out to Google and back.
  function setPending(p) { try { sessionStorage.setItem('flex_pending', JSON.stringify(p)); } catch (e) {} }
  function clearPending() { try { sessionStorage.removeItem('flex_pending'); } catch (e) {} }
  function takePending() { try { var raw = sessionStorage.getItem('flex_pending'); sessionStorage.removeItem('flex_pending'); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function safeSrc(v) { return typeof v === 'string' && (v.indexOf('/api/img/') === 0 || /^https:\/\//.test(v)) ? v : ''; }
  function cleanItem(i) {
    if (!i || !Number.isInteger(i.id) || !Number.isFinite(i.price) || i.price < 0) return null;
    return { id: i.id, name: String(i.name || '').slice(0, 100), price: i.price, stock: Number.isInteger(i.stock) ? i.stock : 20, image: safeSrc(i.image) };
  }
  function requireLogin(pending, message) {
    if (user) return true;
    setPending(pending); openAccount(message); return false;
  }
  function applyPending() {
    if (!user) return false;                       // not signed in yet: keep it for later
    var p = takePending(); if (!p) return false;
    if (p.type === 'add') { var it = cleanItem(p.item); if (it) addToCart(it); }
    if (p.type === 'add' || p.type === 'cart') { openCart(); return true; }
    return false;
  }

  // ---------- account ----------
  function paintUser() {
    var signIn = $('signInLink');
    if (signIn) signIn.textContent = user ? 'Sign Out' : 'Sign In';
    $('accountBtn').setAttribute('aria-label', user ? 'Account: ' + user.name : 'Account');
    $('authPanel').hidden = !!user; $('accountInfo').hidden = !user;
    if (user) $('accountHello').textContent = 'Signed in as ' + user.name + ' (@' + user.username + ')';
    $('accountTitle').textContent = user ? 'Your account' : 'Log in';
  }
  async function logout() { try { await api('POST', '/auth/logout'); } catch (e) {} user = null; cart = []; note = ''; lastOrder = ''; paintUser(); renderCart(); }
  $('signInLink').addEventListener('click', function (e) { e.preventDefault(); if (user) { logout(); closeAll(); } else openAccount(); });
  $('logoutBtn').addEventListener('click', function () { logout(); closeAll(); });

  var loginForm = $('loginForm'), loginMsg = $('loginMsg');
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault(); loginMsg.classList.add('show'); loginMsg.textContent = 'Please wait...';
    try {
      var r = await api('POST', '/auth/login', { username: $('lusername').value, password: $('lpass').value });
      user = r.user; loginForm.reset(); loginMsg.textContent = ''; loginMsg.classList.remove('show');
      paintUser(); loadCart(); renderCart(); applyPending();      // resumes "add to bag" / "open my bag" if that is what they were doing
    } catch (err) { loginMsg.textContent = err.message; }
  });

  // Google (or sign-up) sends people back here with ?auth_error=... when something went wrong.
  var AUTH_ERRORS = {
    google_not_configured: "Google sign-in isn't set up on this site yet.",
    google_denied: 'Google sign-in was cancelled.',
    google_failed: "We couldn't sign you in with Google. Please try again.",
    google_state: 'That sign-in attempt expired. Please try again.',
    google_unverified: 'Your Google email address is not verified, so it cannot be used here.',
    account_disabled: 'This account is disabled.'
  };
  function showAuthErrorFromUrl() {
    var qs = new URLSearchParams(location.search), code = qs.get('auth_error'); if (!code) return;
    qs.delete('auth_error');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs.toString() : '') + location.hash);
    if (user) return;
    openAccount(); loginMsg.textContent = AUTH_ERRORS[code] || AUTH_ERRORS.google_failed; loginMsg.classList.add('show');
  }

  // ---------- catalog ----------
  function cardHtml(p) {
    var sold = p.stock <= 0, tag = p.tag ? '<span class="tag' + (p.tag === 'Bestseller' ? ' volt' : '') + '">' + esc(p.tag) + '</span>' : '';
    var media = p.image_url
      ? '<div class="swatch has-photo"><img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy">' + tag + '</div>'
      : '<div class="swatch" style="--swatch-c:var(--' + esc(p.color) + ');">' + tag + '</div>';
    var href = 'product.html?id=' + p.id;
    return '<div class="card"><a class="card-link" href="' + href + '">' + media + '</a><h3><a class="card-link" href="' + href + '">' + esc(p.name) + '</a></h3>' +
      '<span class="price">' + money(p.price_cents) + (p.stock > 0 && p.stock <= 5 ? ' &middot; only ' + p.stock + ' left' : '') + '</span>' +
      '<button class="addcart" data-id="' + p.id + '" data-name="' + esc(p.name) + '" data-price="' + p.price_cents + '" data-stock="' + p.stock + '" data-image="' + esc(p.image_url || '') + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : 'Add to bag') + '</button></div>';
  }
  var searchTerm = (new URLSearchParams(location.search).get('q') || '').trim();
  document.querySelectorAll('.grid[data-department], .grid[data-featured], .grid[data-search]').forEach(function (grid) {
    var q = [];
    if (grid.dataset.search) q.push('q=' + encodeURIComponent(searchTerm));
    if (grid.dataset.department) q.push('department=' + encodeURIComponent(grid.dataset.department));
    if (grid.dataset.category) q.push('category=' + encodeURIComponent(grid.dataset.category));
    if (grid.dataset.featured) q.push('featured=1');
    grid.innerHTML = '<p class="empty-note">Loading...</p>';
    api('GET', '/products?' + q.join('&')).then(function (r) {
      var summary = $('searchSummary');
      if (summary) summary.textContent = !searchTerm ? 'Type something in the search box to find products.' : r.products.length + (r.products.length === 1 ? ' result' : ' results') + ' for \u201c' + searchTerm + '\u201d';
      grid.innerHTML = r.products.length ? r.products.map(cardHtml).join('') : '<p class="empty-note">' + (grid.dataset.search ? 'No products match your search. Try another word, like \u201cjacket\u201d or \u201cshorts\u201d.' : 'New pieces coming soon.') + '</p>';
    }).catch(function () { grid.innerHTML = '<p class="empty-note">We could not load products. Please refresh.</p>'; });
  });
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.addcart'); if (!btn || btn.disabled) return;
    await authPromise;
    var item = { id: +btn.dataset.id, name: btn.dataset.name, price: +btn.dataset.price, stock: +btn.dataset.stock, image: btn.dataset.image || '' };
    if (!requireLogin({ type: 'add', item: item }, 'Please log in to add items to your bag.')) return;
    var added = addToCart(item);
    btn.textContent = added ? 'Added' : 'Max in bag'; setTimeout(function () { btn.textContent = 'Add to bag'; }, 900);
  });

  // ---------- search box (header) ----------
  document.querySelectorAll('.searchbox input').forEach(function (input) {
    if (searchTerm && location.pathname.indexOf('search') !== -1) input.value = searchTerm;
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var term = input.value.trim();
      if (term) location.href = 'search.html?q=' + encodeURIComponent(term);
    });
  });

  // ---------- product detail page ----------
  var pdp = $('productView');
  if (pdp) {
    var pid = parseInt(new URLSearchParams(location.search).get('id'), 10);
    var notFound = function () { pdp.innerHTML = '<p class="empty-note">We could not find that product. <a href="index.html#shop">Back to the shop</a></p>'; };
    if (!pid) notFound(); else api('GET', '/products/' + pid).then(function (r) {
      var p = r.product, imgs = r.images, sold = p.stock <= 0;
      document.title = p.name + ' \u2014 Flex';
      var crumbs = $('pCrumbs'); if (crumbs) crumbs.innerHTML = '<a href="index.html">Home</a> / <a href="' + p.department.toLowerCase() + '.html">' + esc(p.department) + '</a> / ' + esc(p.name);
      var main = imgs.length
        ? '<div class="pdp-main"><img id="pdpMain" src="' + esc(imgs[0].src) + '" alt="' + esc(imgs[0].alt_text || p.name) + '"></div>'
        : '<div class="pdp-main pdp-color" style="--swatch-c:var(--' + esc(p.color) + ');"></div>';
      var thumbs = imgs.length > 1 ? '<div class="pdp-thumbs">' + imgs.map(function (im, i) {
        return '<button type="button" class="pdp-thumb' + (i === 0 ? ' on' : '') + '" data-src="' + esc(im.src) + '" data-alt="' + esc(im.alt_text || p.name) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(im.src) + '" alt=""></button>';
      }).join('') + '</div>' : '';
      var stockMsg = sold ? 'Sold out' : p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In stock';
      pdp.innerHTML = '<div class="pdp-gallery">' + main + thumbs + '</div><div class="pdp-info"><span class="dropdate">' + esc(p.department) + ' / ' + esc(p.category) + '</span>' +
        '<h1 class="display">' + esc(p.name) + '</h1><p class="pdp-price">' + money(p.price_cents) + '</p><p class="pdp-stock">' + stockMsg + '</p>' +
        '<button class="cta addcart" data-id="' + p.id + '" data-name="' + esc(p.name) + '" data-price="' + p.price_cents + '" data-stock="' + p.stock + '" data-image="' + esc(imgs.length ? imgs[0].src : '') + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : 'Add to bag') + '</button></div>';
      pdp.addEventListener('click', function (e) {
        var t = e.target.closest('.pdp-thumb'); if (!t) return;
        var big = $('pdpMain'); big.src = t.dataset.src; big.alt = t.dataset.alt;
        pdp.querySelectorAll('.pdp-thumb').forEach(function (b) { b.classList.toggle('on', b === t); });
      });
    }).catch(notFound);
  }

  // ---------- cart (one per account, kept in this browser so it survives page changes) ----------
  function cartKey() { return 'flex_cart_' + user.id; }
  function saveCart() { if (!user) return; try { localStorage.setItem(cartKey(), JSON.stringify(cart)); } catch (e) {} }
  function loadCart() {
    cart = []; if (!user) return;
    try {
      var raw = JSON.parse(localStorage.getItem(cartKey()) || '[]');
      cart = Array.isArray(raw) ? raw.filter(function (i) { return i && Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty > 0 && Number.isFinite(i.price); })
        .map(function (i) { return { id: i.id, name: String(i.name).slice(0, 100), price: i.price, qty: Math.min(i.qty, 20), image: safeSrc(i.image) }; }) : [];
    } catch (e) { cart = []; }
  }
  function addToCart(item) {
    var line = cart.find(function (i) { return i.id === item.id; });
    if (line && line.qty >= item.stock) return false;
    if (line) line.qty++; else cart.push({ id: item.id, name: item.name, price: item.price, qty: 1, image: item.image });
    note = ''; lastOrder = ''; saveCart(); renderCart(); return true;
  }
  var itemsEl = $('cartItems');
  function renderCart() {
    var html = note ? '<p class="formmsg show">' + esc(note) + '</p>' : '';
    if (!cart.length) html += lastOrder ? '<p class="cart-empty"><strong>Order ' + esc(lastOrder) + ' placed.</strong> Thank you!</p>' : '<p class="cart-empty">Your bag is empty.</p>';
    else html += cart.map(function (it, i) {
      var thumb = it.image ? '<img class="cart-thumb" src="' + esc(it.image) + '" alt="">' : '<div class="cart-thumb"></div>';
      return '<div class="cart-item">' + thumb + '<div class="cart-info"><h4>' + esc(it.name) + '</h4><span>' + money(it.price) + '</span><div class="qtyrow"><button class="qtybtn" data-i="' + i + '" data-d="-1" aria-label="Fewer">-</button><span>' + it.qty + '</span><button class="qtybtn" data-i="' + i + '" data-d="1" aria-label="More">+</button></div><button class="remove" data-i="' + i + '">Remove</button></div><strong>' + money(it.price * it.qty) + '</strong></div>';
    }).join('');
    itemsEl.innerHTML = html;
    var count = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    $('cartBadge').textContent = count; $('cartBadge').hidden = count === 0;
    $('cartBtn').setAttribute('aria-label', 'Bag, ' + count + ' items');
    $('cartSubtotal').textContent = money(cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0));
  }
  $('cartBtn').addEventListener('click', async function () {
    await authPromise;
    if (!requireLogin({ type: 'cart' }, 'Please log in to view your bag.')) return;
    openCart();
  });
  itemsEl.addEventListener('click', function (e) {
    var t = e.target, i = +t.dataset.i;
    if (t.classList.contains('qtybtn')) { cart[i].qty = Math.min(20, cart[i].qty + +t.dataset.d); if (cart[i].qty <= 0) cart.splice(i, 1); }
    else if (t.classList.contains('remove')) cart.splice(i, 1);
    else return;
    saveCart(); renderCart();
  });
  $('checkoutBtn').addEventListener('click', async function () {
    if (!cart.length) return;
    if (!requireLogin({ type: 'cart' }, 'Please log in to check out.')) return;
    var btn = this; btn.disabled = true;
    try {
      var r = await api('POST', '/orders', { items: cart.map(function (i) { return { productId: i.id, qty: i.qty }; }) });
      cart = []; note = ''; lastOrder = r.orderNo; saveCart();
    } catch (err) {
      if (err.status === 401) { user = null; cart = []; paintUser(); setPending({ type: 'cart' }); openAccount('Your session ended. Please log in again.'); }
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
    await authPromise;
    if (!user) { openAccount('Please log in to get notified when this drops.'); return; }
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
  paintAuthLinks(); renderCart();
  authPromise = api('GET', '/auth/me').then(function (r) { user = r.user; }, function () { user = null; }).then(function () {
    try { localStorage.removeItem('flex_cart'); } catch (e) {}       // the old shared cart from before accounts were required
    paintUser(); loadCart(); renderCart(); showAuthErrorFromUrl(); applyPending();
  });
});
