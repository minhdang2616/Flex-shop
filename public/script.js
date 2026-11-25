document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var user = null, cart = [], lastOrder = '';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return Math.round(c / 100).toLocaleString('vi-VN') + ' ₫'; }

  // ---------- customer theme ----------
  var themeButton = $('themeBtn');
  function applyTheme(theme) {
    var dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    if (themeButton) {
      themeButton.textContent = dark ? '☀' : '☾';
      themeButton.setAttribute('aria-label', dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
      themeButton.title = dark ? 'Giao diện sáng' : 'Giao diện tối';
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#151517' : '#FFFFFF';
  }
  var savedTheme = 'light';
  try { savedTheme = localStorage.getItem('flex_theme') || 'light'; } catch (e) {}
  applyTheme(savedTheme);
  if (themeButton) themeButton.addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('flex_theme', next); } catch (e) {}
    applyTheme(next);
  });

  async function api(method, path, body) {
    var res = await fetch('/api' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Đã xảy ra lỗi. Vui lòng thử lại sau.'); e.status = res.status; throw e; }
    return data;
  }

  // ---------- mobile nav ----------
  var navToggle = $('navToggle'), links = document.querySelector('.navlinks');
  if (navToggle) navToggle.addEventListener('click', function () {
    var open = links.classList.toggle('mobile-open');
    navToggle.setAttribute('aria-expanded', String(open));
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
    $('accountTitle').textContent = user ? 'Your account' : 'Log in';
    ['editProfileBtn', 'changePasswordBtn'].forEach(function (id) { var b = $(id); if (b) { b.hidden = false; b.disabled = false; b.textContent = id === 'editProfileBtn' ? 'Sửa hồ sơ và địa chỉ giao hàng' : 'Đổi mật khẩu'; } });
    var profileForm = $('profileForm'); if (profileForm) profileForm.remove();
    var passwordForm = $('passwordForm'); if (passwordForm) passwordForm.remove();
    if ($('accountHello')) $('accountHello').hidden = false;
    if ($('logoutBtn')) $('logoutBtn').hidden = false;
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
  $('accountBtn').addEventListener('click', async function () {
    await authPromise;
    if (user && !location.pathname.endsWith('/account.html')) { location.href = 'account.html'; return; }
    openAccount();
  });
  var accountPortal = $('accountPortal'); if (accountPortal) accountPortal.addEventListener('click', async function (e) {
    var action = e.target.closest('[data-account-action]'); if (!action) return;
    if (!user) { openAccount(); return; }
    if (action.dataset.accountAction === 'orders') {
      $('accountPortalMember').hidden = true;
      $('accountOrdersView').hidden = false;
      $('accountOrdersContent').innerHTML = '<p>Đang tải lịch sử đơn hàng…</p>';
      await loadCustomerOrders($('accountOrdersContent'));
      return;
    }
    openAccount();
    var targetId = action.dataset.accountAction === 'profile' ? 'editProfileBtn' : 'changePasswordBtn';
    var target = $(targetId); if (target) target.click();
  });
  var ordersBack = $('accountOrdersBack');
  if (ordersBack) ordersBack.addEventListener('click', function () {
    $('accountOrdersView').hidden = true;
    $('accountPortalMember').hidden = false;
  });
  async function loadCustomerOrders(container) {
    try {
      var r = await api('GET', '/orders');
      var statusLabels = { pending: 'Đang xác nhận', shipped: 'Đang giao hàng', delivered: 'Đã giao hàng', cancelled: 'Đã hủy' };
      var paymentLabels = { pending: 'Chưa thanh toán', paid: 'Đã thanh toán', refunded: 'Đã hoàn tiền' };
      var rows = (r.orders || []).map(function (o) {
        var progress = o.status === 'cancelled' ? '<p class="order-cancelled">Đơn hàng đã bị hủy.</p>' : '<ol class="order-progress"><li class="done">Đã đặt</li><li class="' + (o.status === 'shipped' || o.status === 'delivered' ? 'done' : '') + '">Đang giao</li><li class="' + (o.status === 'delivered' ? 'done' : '') + '">Đã nhận</li></ol>';
        var items = (o.items || []).map(function (it) { return '<li class="order-line"><span>' + esc(it.name_vi || it.name) + (it.size ? ' <small>· Cỡ ' + esc(displaySize(it.size)) + '</small>' : '') + ' <small>× ' + it.qty + '</small></span><strong>' + money(it.unit_price_cents * it.qty) + '</strong></li>'; }).join('');
        var methodText = o.payment_method === 'bank_qr' ? 'Chuyển khoản ngân hàng bằng QR' : 'Thanh toán bằng tiền mặt khi nhận hàng';
        return '<article class="order-card"><div class="order-card-head"><div><strong class="order-number">' + esc(o.order_no) + '</strong><small>' + esc(new Date(o.created_at * 1000).toLocaleDateString('vi-VN')) + ' · ' + o.items_count + ' sản phẩm</small></div><span class="order-status status-' + esc(o.status) + '">' + (statusLabels[o.status] || esc(o.status)) + '</span></div>' + progress + '<ul class="order-lines">' + items + '</ul><div class="order-payment"><span>' + methodText + '<br><small>Trạng thái: ' + (paymentLabels[o.payment_status] || 'Chưa thanh toán') + '</small></span><strong>Tổng: ' + money(o.total_cents) + '</strong></div>' + (o.status === 'pending' ? '<button class="remove" data-cancel-order="' + o.id + '" type="button">Hủy đơn hàng</button>' : '') + '</article>';
      }).join('');
      container.innerHTML = rows || '<p class="cart-empty">Bạn chưa có đơn hàng nào.</p>';
    } catch (err) {
      container.innerHTML = '<p class="order-load-error">Không tải được lịch sử đơn hàng. Vui lòng đăng nhập lại hoặc thử lại sau.</p><button class="cta ghost" id="retryCustomerOrders" type="button">Thử tải lại</button>';
      var retry = $('retryCustomerOrders'); if (retry) retry.addEventListener('click', function () { container.innerHTML = '<p>Đang tải lịch sử đơn hàng…</p>'; loadCustomerOrders(container); });
    }
  }
  var accountOrdersView = $('accountOrdersView');
  if (accountOrdersView) accountOrdersView.addEventListener('click', async function (e) {
    var cancel = e.target.closest('[data-cancel-order]'); if (!cancel) return;
    if (!confirm('Bạn muốn hủy đơn hàng đang chờ xác nhận? Sản phẩm sẽ được hoàn lại kho.')) return;
    cancel.disabled = true;
    try { await api('POST', '/orders/' + cancel.dataset.cancelOrder + '/cancel'); $('accountOrdersContent').innerHTML = '<p>Đang cập nhật đơn hàng…</p>'; await loadCustomerOrders($('accountOrdersContent')); }
    catch (err) { cancel.disabled = false; cancel.textContent = err.message; }
  });
  var loginLink = $('loginLink'); if (loginLink) loginLink.addEventListener('click', function (e) { e.preventDefault(); openAccount(); });
  var joinLoginLink = $('joinLoginLink'); if (joinLoginLink) joinLoginLink.addEventListener('click', function (e) {
    if (location.pathname.endsWith('/index.html') || location.pathname === '/' || location.pathname.endsWith('/')) { e.preventDefault(); openAccount(); }
  });

  // ---------- what the visitor was trying to do before logging in ----------
  // Kept in sessionStorage so it survives going to the registration page or out to Google and back.
  function setPending(p) { try { sessionStorage.setItem('flex_pending', JSON.stringify(p)); } catch (e) {} }
  function clearPending() { try { sessionStorage.removeItem('flex_pending'); } catch (e) {} }
  function takePending() { try { var raw = sessionStorage.getItem('flex_pending'); sessionStorage.removeItem('flex_pending'); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function safeSrc(v) { return typeof v === 'string' && (v.indexOf('/api/img/') === 0 || /^https:\/\//.test(v)) ? v : ''; }
  function cleanItem(i) {
    if (!i || !Number.isInteger(i.id) || !Number.isFinite(i.price) || i.price < 0) return null;
    return { id: i.id, name: String(i.name || '').slice(0, 100), name_vi: String(i.name_vi || i.name || '').slice(0, 100), price: i.price, stock: Number.isInteger(i.stock) ? i.stock : 20, image: safeSrc(i.image), size: String(i.size || '') };
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
    var registerLink = $('registerLink'); if (registerLink) registerLink.hidden = !!user;
    var joinLogin = $('joinLoginLink'); if (joinLogin) joinLogin.hidden = !!user;
    var portalGuest = $('accountPortalGuest'); if (portalGuest) portalGuest.hidden = !!user;
    var portalMember = $('accountPortalMember'); if (portalMember) portalMember.hidden = !user;
    if (signIn) signIn.textContent = user ? 'Sign Out' : 'Sign In';
    $('accountBtn').setAttribute('aria-label', user ? 'Account: ' + user.name : 'Account');
    $('authPanel').hidden = !!user; $('accountInfo').hidden = !user;
    if (user) {
      $('accountHello').textContent = 'Signed in as ' + user.name + ' (@' + user.username + ')';
      if (!$('editProfileBtn')) $('accountInfo').insertAdjacentHTML('afterbegin', '<button class="cta ghost" id="editProfileBtn" type="button" style="width:100%;margin:0 0 10px">Edit profile & delivery</button>');
      if (!$('changePasswordBtn')) $('accountInfo').insertAdjacentHTML('afterbegin', '<button class="cta ghost" id="changePasswordBtn" type="button" style="width:100%;margin:0 0 10px">Change password</button>');
    }
    $('accountTitle').textContent = user ? 'Your account' : 'Log in';
  }
  async function logout() { try { await api('POST', '/auth/logout'); } catch (e) {} user = null; cart = []; lastOrder = ''; paintUser(); renderCart(); }
  $('signInLink').addEventListener('click', function (e) { e.preventDefault(); if (user) { logout(); closeAll(); } else openAccount(); });
  $('logoutBtn').addEventListener('click', function () { logout(); closeAll(); });
  $('accountInfo').addEventListener('click', async function (e) {
    if (e.target.id === 'changePasswordBtn') {
      var passwordBtn = e.target; passwordBtn.disabled = true; passwordBtn.textContent = 'Loading…';
      try {
        var info = await api('GET', '/account/profile');
        openAccount(); $('accountTitle').textContent = 'Change password';
        $('accountHello').hidden = true; $('editProfileBtn').hidden = true; $('changePasswordBtn').hidden = true; $('logoutBtn').hidden = true;
        var form = document.createElement('form'); form.id = 'passwordForm';
        form.innerHTML = (info.profile.hasGoogle ? (info.profile.hasPassword ? '<p class="authnote">Verify with your current password, or request a code at your Google account email.</p><div class="field"><label for="oldPassword">Current password</label><input id="oldPassword" name="currentPassword" type="password" autocomplete="current-password"></div><p class="authnote">Or</p>' : '<p class="authnote">This Google account has no password yet. Request a verification code to set one.</p>') + '<button class="cta ghost" id="sendPasswordCode" type="button" style="width:100%">Send code to my email</button><div class="field" id="passwordCodeWrap" hidden><label for="passwordCode">Email verification code</label><input id="passwordCode" name="resetCode" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"></div>' : '<div class="field"><label for="oldPassword">Current password</label><input id="oldPassword" name="currentPassword" type="password" autocomplete="current-password" required></div>') +
          '<div class="field"><label for="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><small>Use at least 8 characters.</small></div>' +
          '<div class="field"><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></div>' +
          '<p class="formmsg" id="passwordMsg" role="alert"></p><button class="cta dark" type="submit" style="width:100%">Save new password</button>';
        $('accountInfo').appendChild(form);
        if (info.profile.hasGoogle) $('sendPasswordCode').addEventListener('click', async function () {
          var send = this, msg = $('passwordMsg'); send.disabled = true; msg.classList.add('show'); msg.textContent = 'Sending verification code…';
          try { await api('POST', '/account/password-code', {}); $('passwordCodeWrap').hidden = false; $('passwordCode').required = true; msg.textContent = 'Code sent to your Google account email. It expires in 10 minutes.'; $('passwordCode').focus(); }
          catch (err) { msg.textContent = err.message; }
          finally { send.disabled = false; }
        });
        form.addEventListener('submit', async function (ev) {
          ev.preventDefault(); var save = form.querySelector('button[type=submit]'), msg = $('passwordMsg');
          if ($('newPassword').value !== $('confirmPassword').value) { msg.classList.add('show'); msg.textContent = 'The new passwords do not match.'; $('confirmPassword').focus(); return; }
          save.disabled = true; msg.classList.add('show'); msg.textContent = 'Updating password…';
          try { await api('POST', '/account/password', Object.fromEntries(new FormData(form).entries())); form.reset(); msg.textContent = 'Password updated. Other signed-in devices have been signed out.'; }
          catch (err) { msg.textContent = err.message; save.disabled = false; }
        });
      } catch (err) { passwordBtn.disabled = false; passwordBtn.textContent = 'Change password'; }
      return;
    }
    if (e.target.id === 'editProfileBtn') {
      var editBtn = e.target; editBtn.disabled = true; editBtn.textContent = 'Loading…';
      try {
        var data = await api('GET', '/account/profile'), p = data.profile;
        openAccount(); $('accountTitle').textContent = 'Profile & delivery';
        $('accountHello').hidden = true; $('editProfileBtn').hidden = true; $('changePasswordBtn').hidden = true; $('logoutBtn').hidden = true;
        var form = document.createElement('form'); form.id = 'profileForm'; form.innerHTML =
          '<div class="field"><label for="pfName">Full name</label><input id="pfName" name="name" required maxlength="100" value="' + esc(p.name) + '"></div>' +
          '<div class="field"><label for="pfEmail">Email</label><input id="pfEmail" name="email" type="email" required value="' + esc(p.email) + '"></div>' +
          '<div class="field"><label for="pfPhone">Phone</label><input id="pfPhone" name="phone" required maxlength="20" value="' + esc(p.phone) + '"></div>' +
          '<div class="field"><label for="pfAddress">Street address</label><input id="pfAddress" name="address" required maxlength="200" value="' + esc(p.address) + '"></div>' +
          '<div class="field"><label for="pfCity">City</label><input id="pfCity" name="city" required maxlength="100" value="' + esc(p.city) + '"></div>' +
          '<p class="formmsg" id="profileMsg" role="alert"></p><button class="cta dark" type="submit" style="width:100%">Save profile</button>';
        $('accountInfo').appendChild(form);
        form.addEventListener('submit', async function (ev) {
          ev.preventDefault(); var save = form.querySelector('button[type=submit]'), msg = $('profileMsg'); save.disabled = true; msg.classList.add('show'); msg.textContent = 'Saving…';
          try { var updated = await api('PUT', '/account/profile', Object.fromEntries(new FormData(form).entries())); user.name = updated.profile.name; user.email = updated.profile.email; paintUser(); msg.textContent = 'Profile saved.'; }
          catch (err) { msg.textContent = err.message; save.disabled = false; }
        });
      } catch (err) { editBtn.disabled = false; editBtn.textContent = 'Edit profile & delivery'; }
      return;
    }
  });

  var loginForm = $('loginForm'), loginMsg = $('loginMsg');
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault(); loginMsg.classList.add('show'); loginMsg.textContent = 'Please wait...';
    try {
      var r = await api('POST', '/auth/login', { username: $('lusername').value, password: $('lpass').value, scope: 'customer' });
      user = r.user; loginForm.reset(); loginMsg.textContent = ''; loginMsg.classList.remove('show');
      paintUser(); loadCart(); renderCart(); renderCheckoutPage(); applyPending();      // resumes "add to bag" / "open my bag" if that is what they were doing
    } catch (err) { loginMsg.textContent = err.message; }
  });

  // Google (or sign-up) sends people back here with ?auth_error=... when something went wrong.
  var AUTH_ERRORS = {
    google_not_configured: "Google sign-in isn't set up on this site yet.",
    google_denied: 'Google sign-in was cancelled.',
    google_failed: "We couldn't sign you in with Google. Please try again.",
    google_state: 'That sign-in attempt expired. Please try again.',
    google_unverified: 'Your Google email address is not verified, so it cannot be used here.',
    account_disabled: 'This account is disabled.',
    account_role: 'This Google account is linked to a staff account and cannot be used for customer sign-in.'
  };
  function showAuthErrorFromUrl() {
    var qs = new URLSearchParams(location.search), code = qs.get('auth_error'); if (!code) return;
    qs.delete('auth_error');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs.toString() : '') + location.hash);
    if (user) return;
    openAccount(); loginMsg.textContent = AUTH_ERRORS[code] || AUTH_ERRORS.google_failed; loginMsg.classList.add('show');
  }

  // ---------- catalog ----------
  function languageIsVietnamese() { try { return localStorage.getItem('flex_language') !== 'en'; } catch (_) { return true; } }
  function localizedName(p) {
    return languageIsVietnamese() && p.name_vi ? p.name_vi : p.name;
  }
  function localizedDescription(p) {
    return p.description_vi || '';
  }
  function displaySize(size) { return String(size || '').replace(/^(\d+)Y$/, '$1 tuổi'); }
  function localizedDept(v) { return languageIsVietnamese() ? ({ Men: 'Nam', Women: 'Nữ', Kids: 'Trẻ em', Unisex: 'Unisex' }[v] || v) : v; }
  function localizedCategory(v) { return languageIsVietnamese() ? ({ Tops: 'Áo', Bottoms: 'Quần', Outerwear: 'Áo khoác' }[v] || v) : v; }
  function cardHtml(p) {
    var sold = p.stock <= 0, onSale = p.sale_price_cents != null && p.sale_price_cents < p.price_cents;
    var tagLabel = p.tag === 'New' ? 'MỚI' : p.tag === 'Bestseller' ? 'BÁN CHẠY' : '';
    var discountPercent = onSale ? Math.round((1 - p.sale_price_cents / p.price_cents) * 100) : 0;
    var tag = onSale ? '<span class="tag sale-tag">GIẢM ' + discountPercent + '%</span>' : tagLabel ? '<span class="tag' + (p.tag === 'Bestseller' ? ' volt' : '') + '">' + tagLabel + '</span>' : '';
    var currentPrice = onSale ? p.sale_price_cents : p.price_cents;
    var name = localizedName(p);
    var media = p.image_url
      ? '<div class="swatch has-photo"><img src="' + esc(p.image_url) + '" alt="' + esc(p.name) + '" loading="lazy">' + tag + '</div>'
      : '<div class="swatch">' + tag + '</div>';
    var href = 'product.html?id=' + p.id;
    var description = localizedDescription(p);
    return '<div class="card"><a class="card-link" href="' + href + '">' + media + '</a><h3><a class="card-link" data-lang-en="' + esc(p.name) + '" data-lang-vi="' + esc(p.name_vi || p.name) + '" href="' + href + '">' + esc(name) + '</a></h3>' +
      (description ? '<p class="card-description">' + esc(description) + '</p>' : '') +
      '<span class="price' + (onSale ? ' is-sale' : '') + '"><span class="price-main">' + (onSale ? '<strong class="sale-price">' + money(currentPrice) + '</strong><del>' + money(p.price_cents) + '</del>' : '<strong>' + money(currentPrice) + '</strong>') + '</span>' + (p.stock > 0 && p.stock <= 5 ? '<span class="price-stock" data-lang-en="only ' + p.stock + ' left" data-lang-vi="Chỉ còn ' + p.stock + ' sản phẩm">' + (languageIsVietnamese() ? 'Chỉ còn ' + p.stock + ' sản phẩm' : 'only ' + p.stock + ' left') + '</span>' : '') + '</span>' +
      '<a class="cta dark" href="' + href + '"' + (sold ? ' aria-disabled="true"' : '') + '>' + (sold ? 'Hết hàng' : 'Thêm vào giỏ') + '</a></div>';
  }
  var searchTerm = (new URLSearchParams(location.search).get('q') || '').trim();
  var sortTerm = new URLSearchParams(location.search).get('sort') || 'featured';
  var tagTerm = new URLSearchParams(location.search).get('tag') || '';
  var catalogParams = new URLSearchParams(location.search);
  var categoryTerm = catalogParams.get('category') || '';
  catalogParams.delete('color');
  var stockOnly = catalogParams.get('stock') === '1', priceBand = catalogParams.get('price') || '';
  var catalogGrids = document.querySelectorAll('.grid[data-department], .grid[data-featured], .grid[data-search], .grid[data-new-arrivals]');
  if (catalogGrids.length) {
    var catalogSections = Array.prototype.map.call(catalogGrids, function (grid) { return grid.closest('.catgroup'); }).filter(function (section, i, all) { return section && all.indexOf(section) === i; });
    var hasSidebar = catalogSections.length && Array.prototype.some.call(catalogGrids, function (grid) { return grid.dataset.department || grid.dataset.search; });
    var resultHost = catalogGrids[0].parentNode;
    if (hasSidebar) {
      var layout = document.createElement('div'); layout.className = 'wrap catalog-layout';
      var sidebar = document.createElement('aside'); sidebar.className = 'catalog-sidebar'; sidebar.setAttribute('aria-label', 'Bộ lọc sản phẩm'); sidebar.innerHTML =
        '<div class="filter-heading"><h2>Bộ lọc</h2><button class="filter-close" type="button" aria-label="Đóng bộ lọc">×</button></div>' +
        '<details open><summary>Danh mục</summary><div class="filter-options"><label><input type="radio" name="categoryFilter" value=""><span>Tất cả danh mục</span></label><label><input type="radio" name="categoryFilter" value="Tops"><span>Áo</span></label><label><input type="radio" name="categoryFilter" value="Bottoms"><span>Quần</span></label><label><input type="radio" name="categoryFilter" value="Outerwear"><span>Áo khoác</span></label></div></details>' +
        '<details><summary>Nhãn sản phẩm</summary><div class="filter-options"><label><input type="radio" name="tagFilter" value=""><span>Tất cả sản phẩm</span></label><label><input type="radio" name="tagFilter" value="New"><span>Mới</span></label><label><input type="radio" name="tagFilter" value="Bestseller"><span>Bán chạy</span></label><label><input type="radio" name="tagFilter" value="Sale"><span>Giảm giá</span></label></div></details>' +
        '<details><summary>Khoảng giá</summary><div class="filter-options"><label><input type="radio" name="priceFilter" value=""><span>Tất cả mức giá</span></label><label><input type="radio" name="priceFilter" value="under300"><span>Dưới 300.000 ₫</span></label><label><input type="radio" name="priceFilter" value="300to700"><span>300.000–700.000 ₫</span></label><label><input type="radio" name="priceFilter" value="over700"><span>Trên 700.000 ₫</span></label></div></details>' +
        '<details><summary>Tình trạng hàng</summary><label class="stock-filter"><input id="stockFilter" type="checkbox"> Chỉ xem sản phẩm còn hàng</label></details>' +
        '<button id="clearCatalogFilters" class="filter-clear" type="button">Xóa tất cả bộ lọc</button>';
      var results = document.createElement('div'); results.className = 'catalog-results';
      var firstSection = catalogSections[0]; firstSection.parentNode.insertBefore(layout, firstSection);
      layout.appendChild(sidebar); layout.appendChild(results);
      var backdrop = document.createElement('button'); backdrop.type = 'button'; backdrop.className = 'catalog-filter-backdrop'; backdrop.setAttribute('aria-label', 'Đóng bộ lọc'); layout.appendChild(backdrop);
      function closeFilters() { layout.classList.remove('filters-open'); }
      sidebar.querySelector('.filter-close').addEventListener('click', closeFilters);
      backdrop.addEventListener('click', closeFilters);
      document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeFilters(); });
      catalogSections.forEach(function (section) { results.appendChild(section); });
      resultHost = results;
    }
    var hasCatalogControls = Array.prototype.some.call(catalogGrids, function (grid) { return grid.dataset.department || grid.dataset.search; });
    if (hasCatalogControls) {
      var sortBar = document.createElement('div'); sortBar.className = 'catalog-tools';
      sortBar.innerHTML = (hasSidebar ? '<button type="button" class="filter-toggle" id="openCatalogFilters">Bộ lọc <span id="filterCount" hidden>0</span></button>' : '') + '<span class="result-count" id="catalogResultCount"></span><label class="sort-control" for="catalogSort"><span>Sắp xếp theo</span><select id="catalogSort"><option value="featured">Nổi bật</option><option value="newest">Mới nhất</option><option value="tag_bestseller">Bán chạy</option><option value="sale_first">Ưu đãi</option><option value="price_asc">Giá thấp đến cao</option><option value="price_desc">Giá cao đến thấp</option></select></label>';
      resultHost.insertBefore(sortBar, resultHost.firstChild);
      if (hasSidebar) {
        var filterButton = $('openCatalogFilters');
        filterButton.addEventListener('click', function () { layout.classList.add('filters-open'); sidebar.querySelector('.filter-close').focus(); });
        var activeFilters = document.createElement('div'); activeFilters.className = 'active-filters'; activeFilters.id = 'activeCatalogFilters';
        sortBar.insertAdjacentElement('afterend', activeFilters);
      }
      $('catalogSort').value = sortTerm;
      $('catalogSort').addEventListener('change', function () { sortTerm = this.value; syncCatalogUrl(); loadCatalogs(); });
    }
    function refreshFilterControls() {
      var sidebar = document.querySelector('.catalog-sidebar'); if (!sidebar) return;
      Array.prototype.forEach.call(sidebar.querySelectorAll('input[name="categoryFilter"]'), function (input) { input.checked = input.value === categoryTerm; });
      Array.prototype.forEach.call(sidebar.querySelectorAll('input[name="tagFilter"]'), function (input) { input.checked = input.value === tagTerm; });
      Array.prototype.forEach.call(sidebar.querySelectorAll('input[name="priceFilter"]'), function (input) { input.checked = input.value === priceBand; });
      if ($('stockFilter')) $('stockFilter').checked = stockOnly;
      var count = (categoryTerm ? 1 : 0) + (tagTerm ? 1 : 0) + (priceBand ? 1 : 0) + (stockOnly ? 1 : 0);
      var badge = $('filterCount'); if (badge) { badge.textContent = count; badge.hidden = !count; }
      var active = $('activeCatalogFilters');
      if (active) {
        var labels = [];
        if (categoryTerm) labels.push({ key: 'category', text: localizedCategory(categoryTerm) });
        if (tagTerm) labels.push({ key: 'tag', text: ({ New: 'Mới', Bestseller: 'Bán chạy', Sale: 'Giảm giá' })[tagTerm] || tagTerm });
        if (priceBand) labels.push({ key: 'price', text: ({ under300: 'Dưới 300.000 ₫', '300to700': '300.000–700.000 ₫', over700: 'Trên 700.000 ₫' })[priceBand] });
        if (stockOnly) labels.push({ key: 'stock', text: 'Còn hàng' });
        active.innerHTML = labels.map(function (item) { return '<button type="button" class="active-filter" data-remove-filter="' + item.key + '">' + esc(item.text) + ' <span aria-hidden="true">×</span></button>'; }).join('');
        active.hidden = !labels.length;
      }
    }
    refreshFilterControls();
    var clearFiltersButton = $('clearCatalogFilters');
    if (clearFiltersButton) clearFiltersButton.addEventListener('click', function () {
      categoryTerm = ''; tagTerm = ''; stockOnly = false; priceBand = '';
      refreshFilterControls();
      syncCatalogUrl(); loadCatalogs();
    });
    var filterSidebar = document.querySelector('.catalog-sidebar');
    if (filterSidebar) {
      filterSidebar.addEventListener('change', function (event) {
        var input = event.target;
        if (input.name === 'categoryFilter') categoryTerm = input.value;
        if (input.name === 'tagFilter') tagTerm = input.value;
        if (input.name === 'priceFilter') priceBand = input.value;
        if (input.id === 'stockFilter') stockOnly = input.checked;
        refreshFilterControls(); syncCatalogUrl(); loadCatalogs();
      });
    }
    var activeFilterHost = $('activeCatalogFilters');
    if (activeFilterHost) activeFilterHost.addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-filter]'); if (!button) return;
      if (button.dataset.removeFilter === 'category') categoryTerm = '';
      if (button.dataset.removeFilter === 'tag') tagTerm = '';
      if (button.dataset.removeFilter === 'price') priceBand = '';
      if (button.dataset.removeFilter === 'stock') stockOnly = false;
      refreshFilterControls(); syncCatalogUrl(); loadCatalogs();
    });
  }
  var catalogRequest = 0;
  var catalogResultCounts = new Array(catalogGrids.length).fill(0);
  function updateCatalogResultCount() {
    var count = $('catalogResultCount');
    if (count) count.textContent = catalogResultCounts.reduce(function (total, value) { return total + value; }, 0) + ' sản phẩm';
  }
  function syncCatalogUrl() {
    var qs = new URLSearchParams(location.search);
    if (sortTerm === 'featured') qs.delete('sort'); else qs.set('sort', sortTerm);
    if (categoryTerm) qs.set('category', categoryTerm); else qs.delete('category');
    qs.delete('color');
    if (tagTerm) qs.set('tag', tagTerm); else qs.delete('tag');
    if (stockOnly) qs.set('stock', '1'); else qs.delete('stock');
    if (priceBand) qs.set('price', priceBand); else qs.delete('price');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs.toString() : '') + location.hash);
  }
  function loadCatalogs() {
    var requestId = ++catalogRequest;
    Array.prototype.forEach.call(catalogGrids, function (grid, gridIndex) {
      var q = [];
      if (grid.dataset.search) q.push('q=' + encodeURIComponent(searchTerm));
      if (grid.dataset.department) q.push('department=' + encodeURIComponent(grid.dataset.department));
      var section = grid.closest('.catgroup');
      if (section && categoryTerm && grid.dataset.category && grid.dataset.category !== categoryTerm) { section.hidden = true; catalogResultCounts[gridIndex] = 0; updateCatalogResultCount(); return; }
      if (section) section.hidden = false;
      if (categoryTerm) q.push('category=' + encodeURIComponent(categoryTerm));
      else if (grid.dataset.category) q.push('category=' + encodeURIComponent(grid.dataset.category));
      if (grid.dataset.featured) q.push('featured=1');
      if (grid.dataset.newArrivals) { q.push('tag=New'); q.push('sort=newest'); }
      else if (sortTerm !== 'featured') q.push('sort=' + encodeURIComponent(sortTerm));
      if (tagTerm) q.push('tag=' + encodeURIComponent(tagTerm));
      if (stockOnly) q.push('stock=1');
      if (priceBand) q.push('price=' + encodeURIComponent(priceBand));
      grid.innerHTML = '<p class="empty-note">Đang tải sản phẩm…</p>';
      api('GET', '/products?' + q.join('&')).then(function (r) {
        if (requestId !== catalogRequest) return;
        var summary = $('searchSummary');
        if (summary) summary.textContent = !searchTerm
          ? 'Chọn bộ lọc hoặc nhập từ khóa để tìm sản phẩm.'
          : 'Tìm thấy ' + r.products.length + ' sản phẩm cho “' + searchTerm + '”';
        catalogResultCounts[gridIndex] = r.products.length; updateCatalogResultCount();
        grid.innerHTML = r.products.length ? r.products.map(cardHtml).join('') : '<p class="empty-note">' + (grid.dataset.search ? 'Không tìm thấy sản phẩm phù hợp.' : 'Chưa có sản phẩm phù hợp.') + '</p>';
      }).catch(function () { if (requestId === catalogRequest) { catalogResultCounts[gridIndex] = 0; updateCatalogResultCount(); grid.innerHTML = '<p class="empty-note">Không tải được sản phẩm. Vui lòng thử lại.</p>'; } });
    });
  }
  loadCatalogs();
  var homeHero = $('homeHeroImage');
  if (homeHero) api('GET', '/products').then(function (result) {
    var products = result.products || [], withPhoto = products.filter(function (p) { return safeSrc(p.image_url); });
    document.querySelectorAll('[data-home-department]').forEach(function (img) {
      var product = withPhoto.find(function (p) { return p.department === img.dataset.homeDepartment; });
      if (product) { img.src = safeSrc(product.image_url); img.closest('.home-category-card').classList.add('has-image'); }
    });
    var campaignPhotos = [
      { department: 'Men', image_url: '/img/Man.webp' },
      { department: 'Women', image_url: '/img/Woman.webp' },
      { department: 'Kids', image_url: '/img/Kid.webp' }
    ];
    if (campaignPhotos.length) {
      var hero = homeHero.closest('.home-hero'), controls = hero.querySelector('.home-hero-controls'), previous = $('heroPrevious'), next = $('heroNext'), pause = $('heroPause'), status = $('heroSlideStatus'), dots = $('heroDots');
      var definitions = [
        { department: 'Men', eyebrow: 'BỘ SƯU TẬP NAM · FLEX 2026', title: 'SẴN SÀNG CHUYỂN ĐỘNG', description: 'Thiết kế linh hoạt đồng hành cùng bạn trong mọi hoạt động.', link: 'men.html', linkText: 'Khám phá đồ nam' },
        { department: 'Women', eyebrow: 'BỘ SƯU TẬP NỮ · FLEX 2026', title: 'TỰ TIN TRONG TỪNG NHỊP', description: 'Thoải mái thể hiện phong cách riêng, từ phòng tập đến phố.', link: 'women.html', linkText: 'Khám phá đồ nữ' },
        { department: 'Kids', eyebrow: 'BỘ SƯU TẬP TRẺ EM · FLEX 2026', title: 'NĂNG LƯỢNG KHÔNG GIỚI HẠN', description: 'Nhẹ nhàng, bền bỉ cho những ngày luôn đầy ắp vui chơi.', link: 'kids.html', linkText: 'Khám phá đồ trẻ em' }
      ];
      var usedSlidePhotos = Object.create(null);
      var slides = definitions.map(function (definition) {
        var photo = campaignPhotos.find(function (p) { return p.department === definition.department && !usedSlidePhotos[p.image_url]; });
        if (!photo) photo = campaignPhotos.find(function (p) { return !usedSlidePhotos[p.image_url]; });
        if (photo) usedSlidePhotos[photo.image_url] = true;
        return Object.assign({}, definition, { image_url: photo ? photo.image_url : '' });
      });
      var current = 0, timer = 0, paused = false, failedSlides = Object.create(null), heroTransition = 0;
      if (dots) dots.innerHTML = slides.map(function (_, index) { return '<button type="button" class="home-hero-dot' + (index === 0 ? ' active' : '') + '" data-hero-index="' + index + '" aria-label="Hiện banner ' + (index + 1) + '"' + (index === 0 ? ' aria-current="true"' : '') + '></button>'; }).join('');
      function showHeroSlide(index) {
        current = (index + slides.length) % slides.length;
        var slide = slides[current], source = slide.image_url;
        var eyebrow = $('heroSlideEyebrow'), title = $('homeHeroTitle'), description = $('heroSlideDescription'), shopLink = $('heroShopLink');
        hero.classList.add('has-image');
        var content = hero.querySelector('.home-hero-content');
        if (content) content.classList.add('is-changing');
        window.clearTimeout(heroTransition);
        if (source && homeHero.getAttribute('src') !== source) {
          homeHero.classList.add('is-changing');
          homeHero.src = source;
          homeHero.alt = 'Bộ sưu tập Flex ' + slide.department;
        } else {
          heroTransition = window.setTimeout(function () { if (content) content.classList.remove('is-changing'); }, 180);
        }
        if (eyebrow) eyebrow.textContent = slide.eyebrow;
        if (title) title.textContent = slide.title;
        if (description) description.textContent = slide.description;
        if (shopLink) { shopLink.href = slide.link; shopLink.textContent = slide.linkText; }
        hero.dataset.slide = String(current + 1);
        if (!source) hero.classList.remove('has-image');
        if (status) status.textContent = 'Banner ' + (current + 1) + ' trên ' + slides.length;
        if (previous) previous.disabled = slides.length < 2;
        if (next) next.disabled = slides.length < 2;
        if (controls) controls.hidden = slides.length < 2;
        if (dots) Array.prototype.forEach.call(dots.querySelectorAll('.home-hero-dot'), function (dot, dotIndex) { dot.classList.toggle('active', dotIndex === current); if (dotIndex === current) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current'); });
      }
      function stopHeroTimer() { window.clearInterval(timer); timer = 0; }
      function startHeroTimer() {
        stopHeroTimer();
        if (paused || slides.length < 2 || document.hidden) return;
        timer = window.setInterval(function () { showHeroSlide(current + 1); }, 6500);
      }
      homeHero.addEventListener('load', function () {
        homeHero.classList.remove('is-changing'); hero.classList.add('has-image');
        var content = hero.querySelector('.home-hero-content'); if (content) content.classList.remove('is-changing');
      });
      homeHero.addEventListener('error', function () {
        homeHero.classList.remove('is-changing'); failedSlides[current] = true;
        if (Object.keys(failedSlides).length >= slides.length) { hero.classList.remove('has-image'); var content = hero.querySelector('.home-hero-content'); if (content) content.classList.remove('is-changing'); stopHeroTimer(); return; }
        var nextSlide = current;
        do { nextSlide = (nextSlide + 1) % slides.length; } while (failedSlides[nextSlide] && Object.keys(failedSlides).length < slides.length);
        window.setTimeout(function () { showHeroSlide(nextSlide); }, 350);
      });
      if (previous) previous.addEventListener('click', function () { showHeroSlide(current - 1); startHeroTimer(); });
      if (next) next.addEventListener('click', function () { showHeroSlide(current + 1); startHeroTimer(); });
      if (dots) dots.addEventListener('click', function (event) { var dot = event.target.closest('[data-hero-index]'); if (!dot) return; showHeroSlide(Number(dot.dataset.heroIndex)); startHeroTimer(); });
      if (pause) pause.addEventListener('click', function () {
        paused = !paused; pause.setAttribute('aria-pressed', String(paused)); pause.setAttribute('aria-label', paused ? 'Tiếp tục banner' : 'Tạm dừng banner'); pause.textContent = paused ? '▶' : 'Ⅱ';
        if (paused) stopHeroTimer(); else startHeroTimer();
      });
      hero.addEventListener('focusin', stopHeroTimer); hero.addEventListener('focusout', function (event) { if (!hero.contains(event.relatedTarget)) startHeroTimer(); });
      document.addEventListener('visibilitychange', startHeroTimer);
      showHeroSlide(0); startHeroTimer();
    }
  }).catch(function () {});
  var pageHero = document.querySelector('[data-page-hero-department], [data-page-hero-tag], [data-page-hero-generic]');
  if (pageHero) api('GET', '/products').then(function (result) {
    var department = pageHero.dataset.pageHeroDepartment;
    var departmentBanner = ({ Men: '/img/Man.webp', Women: '/img/Woman.webp', Kids: '/img/Kid.webp' })[department];
    var media = pageHero.querySelector('.pagehero-media');
    if (departmentBanner && media) {
      media.addEventListener('load', function () { pageHero.classList.add('has-page-image'); }, { once: true });
      media.src = departmentBanner;
      return;
    }
    var products = (result.products || []).filter(function (p) { return safeSrc(p.image_url) && !/anime|cartoon|illustration|drawing|wallpaper/i.test([p.name, p.name_vi, p.image_url].join(' ')); });
    var tag = pageHero.dataset.pageHeroTag;
    var product = department ? products.find(function (p) { return p.department === department; }) : tag === 'Sale'
      ? products.find(function (p) { return p.sale_price_cents != null && p.sale_price_cents < p.price_cents; })
      : tag ? products.find(function (p) { return p.tag === tag; }) : products.find(function (p) { return p.tag === 'Bestseller'; }) || products[0];
    if (!product) return;
    if (!media) return;
    media.addEventListener('load', function () { pageHero.classList.add('has-page-image'); }, { once: true });
    media.src = safeSrc(product.image_url);
  }).catch(function () {});
  document.querySelectorAll('[data-carousel-target]').forEach(function (button) {
    button.addEventListener('click', function () {
      var carousel = $(button.dataset.carouselTarget);
      if (carousel) carousel.scrollBy({ left: carousel.clientWidth * Number(button.dataset.direction || 1) * .82, behavior: 'smooth' });
    });
  });
  var saleGrid = $('saleGrid');
  if (saleGrid) {
    var saleDepartment = $('saleDepartment'), saleCategory = $('saleCategory');
    function loadSaleProducts() {
      var query = new URLSearchParams({ sale: '1' });
      if (saleDepartment.value) query.set('department', saleDepartment.value);
      if (saleCategory.value) query.set('category', saleCategory.value);
      saleGrid.innerHTML = '<p class="empty-note">Đang tải sản phẩm giảm giá…</p>';
      api('GET', '/products?' + query.toString()).then(function (result) {
        saleGrid.innerHTML = result.products.length ? result.products.map(cardHtml).join('') : '<div class="sale-empty-state"><h2>Chưa có sản phẩm giảm giá</h2><p>Cửa hàng chưa áp dụng ưu đãi cho sản phẩm nào. Khi có chương trình mới, sản phẩm sẽ hiển thị tại đây.</p><a class="cta dark" href="index.html#shop">Khám phá sản phẩm</a></div>';
      }).catch(function () { saleGrid.innerHTML = '<p class="empty-note">Không tải được sản phẩm giảm giá. Vui lòng thử lại.</p>'; });
    }
    saleDepartment.addEventListener('change', loadSaleProducts);
    saleCategory.addEventListener('change', loadSaleProducts);
    loadSaleProducts();
  }
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.addcart'); if (!btn || btn.disabled) return;
    await authPromise;
    var size = '';
    if (btn.dataset.requiresSize === '1') { var chosen = document.querySelector('input[name="productSize"]:checked'); if (!chosen) { var error = document.querySelector('.size-error'); if (error) error.textContent = 'Vui lòng chọn kích cỡ trước khi thêm vào giỏ.'; return; } size = chosen.value; }
    var item = { id: +btn.dataset.id, name: btn.dataset.name, name_vi: btn.dataset.nameVi || btn.dataset.name, price: +btn.dataset.price, stock: +btn.dataset.stock, image: btn.dataset.image || '', size: size };
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
      var productName = localizedName(p), productDescription = localizedDescription(p);
      var titleEl = document.querySelector('head title');
      document.title = productName + ' — Flex';
      if (titleEl) { titleEl.setAttribute('data-lang-en', p.name + ' — Flex'); titleEl.setAttribute('data-lang-vi', (p.name_vi || p.name) + ' — Flex'); }
      var crumbs = $('pCrumbs'); if (crumbs) crumbs.innerHTML = '<a href="index.html">Home</a> / <a data-lang-en="' + esc(p.department) + '" data-lang-vi="' + esc(localizedDept(p.department)) + '" href="' + p.department.toLowerCase() + '.html">' + esc(localizedDept(p.department)) + '</a> / <span data-lang-en="' + esc(p.name) + '" data-lang-vi="' + esc(p.name_vi || p.name) + '">' + esc(productName) + '</span>';
      var main = imgs.length
        ? '<div class="pdp-main"><img id="pdpMain" src="' + esc(imgs[0].src) + '" alt="' + esc(imgs[0].alt_text || p.name) + '"></div>'
        : '<div class="pdp-main pdp-color"></div>';
      var thumbs = imgs.length > 1 ? '<div class="pdp-thumbs">' + imgs.map(function (im, i) {
        return '<button type="button" class="pdp-thumb' + (i === 0 ? ' on' : '') + '" data-src="' + esc(im.src) + '" data-alt="' + esc(im.alt_text || p.name) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(im.src) + '" alt=""></button>';
      }).join('') + '</div>' : '';
      var stockMsg = sold ? (languageIsVietnamese() ? 'Hết hàng' : 'Sold out') : p.stock <= 5 ? (languageIsVietnamese() ? 'Chỉ còn ' + p.stock + ' sản phẩm' : 'Only ' + p.stock + ' left') : (languageIsVietnamese() ? 'Còn hàng' : 'In stock');
      var onSale = p.sale_price_cents != null && p.sale_price_cents < p.price_cents, currentPrice = onSale ? p.sale_price_cents : p.price_cents;
      var discountPercent = onSale ? Math.round((1 - p.sale_price_cents / p.price_cents) * 100) : 0;
      var productSizes = (p.sizes || '').split(',').filter(Boolean);
      if (p.department === 'Kids') productSizes.sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
      pdp.innerHTML = '<div class="pdp-gallery">' + main + thumbs + '</div><div class="pdp-info"><span class="dropdate" data-lang-en="' + esc(p.department) + ' / ' + esc(p.category) + '" data-lang-vi="' + esc(localizedDept(p.department)) + ' / ' + esc(localizedCategory(p.category)) + '">' + esc(localizedDept(p.department)) + ' / ' + esc(localizedCategory(p.category)) + '</span>' +
        '<h1 class="display" data-lang-en="' + esc(p.name) + '" data-lang-vi="' + esc(p.name_vi || p.name) + '">' + esc(productName) + '</h1>' +
        (productDescription ? '<p class="pdp-description">' + esc(productDescription) + '</p>' : '') +
        (p.sizes ? '<fieldset class="size-picker' + (p.department === 'Kids' ? ' kids-size-picker' : '') + '"><legend>' + (p.department === 'Kids' ? 'Chọn cỡ theo độ tuổi' : 'Chọn kích cỡ') + ' <span aria-hidden="true">*</span></legend><div class="size-options">' + productSizes.map(function (size) { return '<label><input type="radio" name="productSize" value="' + esc(size) + '" required><span>' + esc(p.department === 'Kids' ? displaySize(size) : size) + '</span></label>'; }).join('') + '</div><p class="size-hint">' + (p.department === 'Kids' ? 'Cỡ được tính theo tuổi của bé. Nếu bé ở giữa hai cỡ, hãy chọn cỡ lớn hơn.' : 'Vui lòng chọn kích cỡ trước khi thêm vào giỏ hàng.') + '</p><p class="size-error" aria-live="polite"></p></fieldset>' : '') +
        '<p class="pdp-price' + (onSale ? ' is-sale' : '') + '">' + (onSale ? '<strong class="sale-price">' + money(currentPrice) + '</strong><span class="pdp-price-details"><del>' + money(p.price_cents) + '</del><span class="sale-tag">Giảm ' + discountPercent + '%</span></span>' : '<strong>' + money(currentPrice) + '</strong>') + '</p><p class="pdp-stock" data-lang-en="' + esc(sold ? 'Sold out' : p.stock <= 5 ? 'Only ' + p.stock + ' left' : 'In stock') + '" data-lang-vi="' + esc(stockMsg) + '">' + stockMsg + '</p>' +
        '<button class="cta addcart" data-requires-size="' + (p.sizes ? '1' : '0') + '" data-id="' + p.id + '" data-name="' + esc(p.name) + '" data-name-vi="' + esc(p.name_vi || p.name) + '" data-price="' + currentPrice + '" data-stock="' + p.stock + '" data-image="' + esc(imgs.length ? imgs[0].src : '') + '"' + (sold ? ' disabled' : '') + '>' + (sold ? 'Sold out' : 'Add to bag') + '</button></div>';
      pdp.addEventListener('click', function (e) {
        var t = e.target.closest('.pdp-thumb'); if (!t) return;
        var big = $('pdpMain'); big.src = t.dataset.src; big.alt = t.dataset.alt;
        pdp.querySelectorAll('.pdp-thumb').forEach(function (b) { b.classList.toggle('on', b === t); });
      });
      pdp.addEventListener('change', function (e) {
        if (e.target.matches('input[name="productSize"]')) { var error = pdp.querySelector('.size-error'); if (error) error.textContent = ''; }
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
        .map(function (i) { return { id: i.id, name: String(i.name).slice(0, 100), name_vi: String(i.name_vi || i.name).slice(0, 100), price: i.price, qty: Math.min(i.qty, 20), image: safeSrc(i.image), size: String(i.size || '') }; }) : [];
    } catch (e) { cart = []; }
  }
  function addToCart(item) {
    var line = cart.find(function (i) { return i.id === item.id && i.size === (item.size || ''); });
    if (line && line.qty >= item.stock) return false;
    if (line) line.qty++; else cart.push({ id: item.id, name: item.name, name_vi: item.name_vi || item.name, price: item.price, qty: 1, image: item.image, size: item.size || '' });
    lastOrder = ''; saveCart(); renderCart(); return true;
  }
  var itemsEl = $('cartItems');
  function renderCart() {
    var html = '';
    if (!cart.length) html += lastOrder ? '<p class="cart-empty"><strong data-lang-en="Order ' + esc(lastOrder) + ' placed." data-lang-vi="Đơn hàng ' + esc(lastOrder) + ' đã được đặt.">' + (languageIsVietnamese() ? 'Đơn hàng ' + esc(lastOrder) + ' đã được đặt.' : 'Order ' + esc(lastOrder) + ' placed.') + '</strong> <span data-lang-en="Thank you!" data-lang-vi="Cảm ơn bạn!">' + (languageIsVietnamese() ? 'Cảm ơn bạn!' : 'Thank you!') + '</span></p>' : '<p class="cart-empty">Your bag is empty.</p>';
    else html += cart.map(function (it, i) {
      var productUrl = 'product.html?id=' + encodeURIComponent(it.id);
      var thumb = it.image ? '<img class="cart-thumb" src="' + esc(it.image) + '" alt="">' : '<div class="cart-thumb"></div>';
      return '<div class="cart-item"><a class="cart-product-link cart-product-image" href="' + productUrl + '" aria-label="Xem sản phẩm ' + esc(localizedName(it)) + '">' + thumb + '</a><div class="cart-info"><h4 data-lang-en="' + esc(it.name) + '" data-lang-vi="' + esc(it.name_vi || it.name) + '"><a class="cart-product-link" href="' + productUrl + '">' + esc(localizedName(it)) + '</a></h4><span>' + money(it.price) + (it.size ? ' · Cỡ ' + esc(displaySize(it.size)) : '') + '</span><div class="qtyrow"><button class="qtybtn" data-i="' + i + '" data-d="-1" aria-label="Fewer">-</button><span>' + it.qty + '</span><button class="qtybtn" data-i="' + i + '" data-d="1" aria-label="More">+</button></div><button class="remove" data-i="' + i + '">Remove</button></div><strong>' + money(it.price * it.qty) + '</strong></div>';
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
    if (!location.pathname.endsWith('/checkout.html')) { location.href = 'checkout.html'; return; }
    closeAll(); var checkoutPage = $('checkoutPage'); if (checkoutPage) checkoutPage.scrollIntoView({ behavior: 'smooth' });
  });

  async function renderCheckoutPage() {
    var page = $('checkoutPage'); if (!page) return;
    var list = $('checkoutItems'), profileBox = $('checkoutAddress'), total = $('checkoutSubtotal');
    try {
      var paymentOptions = await api('GET', '/payments/methods');
      var bankQrOption = (paymentOptions.methods || []).find(function (method) { return method.id === 'bank_qr'; });
      if ($('bankQrMethod')) $('bankQrMethod').hidden = !(bankQrOption && bankQrOption.enabled);
    } catch (_) { if ($('bankQrMethod')) $('bankQrMethod').hidden = true; }
    if (!user) {
      list.innerHTML = '<p>Vui lòng đăng nhập để tiếp tục thanh toán.</p>';
      profileBox.innerHTML = '<button class="cta dark" type="button" onclick="document.getElementById(\'accountBtn\').click()">Đăng nhập</button>';
      $('placeOrderBtn').disabled = true; return;
    }
    if (!cart.length) {
      list.innerHTML = lastOrder ? '<p class="checkout-success">Đặt hàng thành công. Mã đơn hàng: <strong>' + esc(lastOrder) + '</strong></p>' : '<p>Giỏ hàng của bạn đang trống.</p>';
      profileBox.innerHTML = ''; total.textContent = money(0); $('placeOrderBtn').hidden = true; return;
    }
    $('placeOrderBtn').hidden = false; $('placeOrderBtn').disabled = true;
    list.innerHTML = cart.map(function (it) { return '<div class="checkout-line"><span>' + esc(localizedName(it)) + (it.size ? ' <small>· Cỡ ' + esc(displaySize(it.size)) + '</small>' : '') + ' <small>× ' + it.qty + '</small></span><strong>' + money(it.price * it.qty) + '</strong></div>'; }).join('');
    total.textContent = money(cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0));
    try {
      var result = await api('GET', '/account/profile'), p = result.profile;
      function showAddress() {
        var currentAddress = [p.address, p.city].filter(Boolean).join(', ');
        profileBox.innerHTML = '<strong>' + esc(p.name) + '</strong><span>' + esc(p.phone || 'Chưa có số điện thoại') + '</span><span>' + esc(currentAddress || 'Chưa có địa chỉ giao hàng') + '</span><button class="checkout-change" id="changeCheckoutAddress" type="button">Thay đổi</button>';
        $('changeCheckoutAddress').addEventListener('click', showAddressForm);
      }
      function showAddressForm() {
        profileBox.innerHTML = '<div id="checkoutAddressForm" class="checkout-address-form">' +
          '<div class="field"><label for="checkoutName">Họ và tên</label><input id="checkoutName" name="name" required maxlength="100" value="' + esc(p.name) + '"></div>' +
          '<div class="field"><label for="checkoutPhone">Số điện thoại</label><input id="checkoutPhone" name="phone" type="tel" required maxlength="20" value="' + esc(p.phone || '') + '"></div>' +
          '<div class="field"><label for="checkoutStreet">Địa chỉ</label><input id="checkoutStreet" name="address" required maxlength="200" value="' + esc(p.address || '') + '"></div>' +
          '<div class="field"><label for="checkoutCity">Tỉnh / thành phố</label><input id="checkoutCity" name="city" required maxlength="100" value="' + esc(p.city || '') + '"></div>' +
          '<p class="checkout-edit-message" id="checkoutEditMessage" role="alert"></p><div class="checkout-edit-actions"><button class="cta dark" id="saveCheckoutAddress" type="button">Lưu thông tin</button><button class="checkout-change" id="cancelCheckoutAddress" type="button">Hủy</button></div></div>';
        var addressForm = $('checkoutAddressForm');
        $('cancelCheckoutAddress').addEventListener('click', showAddress);
        $('saveCheckoutAddress').addEventListener('click', async function () {
          var saveButton = $('saveCheckoutAddress'), message = $('checkoutEditMessage');
          var fields = Array.prototype.slice.call(addressForm.querySelectorAll('input'));
          var invalidField = fields.find(function (field) { return !field.reportValidity(); });
          if (invalidField) return;
          saveButton.disabled = true; message.textContent = 'Đang lưu thông tin…';
          var values = { name: $('checkoutName').value, phone: $('checkoutPhone').value, address: $('checkoutStreet').value, city: $('checkoutCity').value, email: p.email };
          try {
            var updated = await api('PUT', '/account/profile', values); p = updated.profile;
            user.name = p.name; paintUser(); showAddress();
            if (p.phone && p.address && p.city) { $('checkoutMessage').textContent = ''; $('placeOrderBtn').disabled = false; }
          } catch (error) { message.textContent = 'Không thể lưu thông tin. ' + (error.message || 'Vui lòng kiểm tra lại.'); saveButton.disabled = false; }
        });
      }
      showAddress();
      if (!p.phone || !p.address || !p.city) { $('checkoutMessage').textContent = 'Hãy bổ sung số điện thoại và địa chỉ giao hàng trước khi đặt đơn.'; $('placeOrderBtn').disabled = true; }
      else { $('checkoutMessage').textContent = ''; $('placeOrderBtn').disabled = false; }
    } catch (err) { profileBox.textContent = 'Không tải được thông tin giao hàng. Vui lòng đăng nhập lại.'; $('checkoutMessage').textContent = err.message; }
  }
  var checkoutForm = $('checkoutForm');
  if (checkoutForm) checkoutForm.addEventListener('submit', async function (e) {
    e.preventDefault(); await authPromise;
    if (!cart.length || !user) return;
    var button = $('placeOrderBtn'); button.disabled = true; $('checkoutMessage').textContent = 'Đang tạo đơn hàng…';
    try {
      var paymentMethod = checkoutForm.querySelector('input[name="checkoutPayment"]:checked').value;
      var result = await api('POST', '/orders', { paymentMethod: paymentMethod, items: cart.map(function (i) { return { productId: i.id, qty: i.qty, size: i.size || '' }; }) });
      if (paymentMethod === 'bank_qr' && result.bankTransfer) {
        cart = []; lastOrder = result.orderNo; saveCart(); renderCart();
        $('checkoutMessage').textContent = 'Đơn hàng ' + result.orderNo + ' đã được tạo. Quét mã và nhập đúng số tiền cùng nội dung chuyển khoản bên dưới.';
        $('bankQrPayment').hidden = false;
        $('bankQrPayment').innerHTML = '<div style="text-align:center;padding:12px 0"><img src="' + esc(result.bankTransfer.qrUrl) + '" alt="Mã QR LPBank của Flex Shop" width="280" height="314" style="display:block;max-width:100%;height:auto;margin:0 auto;border:1px solid #e4e4e4;border-radius:8px"><p><strong>' + esc(result.bankTransfer.accountName) + '</strong><br>' + esc(result.bankTransfer.bankId) + ' · ' + esc(result.bankTransfer.accountNo) + '<br>Số tiền: <strong>' + money(result.totalCents) + '</strong><br>Nội dung chuyển khoản: <strong>' + esc(result.bankTransfer.addInfo) + '</strong></p><small>QR này chưa điền sẵn số tiền và nội dung. Vui lòng nhập theo thông tin trên. Shop sẽ xác nhận thanh toán sau khi nhận tiền.</small></div>';
        button.hidden = true; return;
      }
      cart = []; lastOrder = result.orderNo; saveCart(); $('checkoutMessage').textContent = 'Đặt hàng thành công. Mã đơn hàng: ' + result.orderNo;
      renderCart(); renderCheckoutPage();
    } catch (err) {
      if (err.status === 401) { user = null; cart = []; paintUser(); setPending({ type: 'cart' }); openAccount('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); }
      else $('checkoutMessage').textContent = err.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.';
      button.disabled = false;
    }
  });

  // ---------- upcoming drops ----------
  var dropgrid = $('dropgrid');
  if (dropgrid) api('GET', '/drops').then(function (r) {
    var colors = ['red', 'blue', 'volt', 'ink'];
    dropgrid.innerHTML = r.drops.length ? r.drops.map(function (d, i) {
      var name = d.name_vi || d.name, desc = d.description_vi || 'Thông tin sản phẩm đang được cập nhật.';
      var parsedDate = new Date(d.release_date), releaseDate = isNaN(parsedDate.getTime()) ? d.release_date : parsedDate.toLocaleDateString(languageIsVietnamese() ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      var subscribed = Number(d.subscribed) === 1;
      return '<div class="dropcard"><div class="swatch ' + (d.image_url ? 'has-photo' : '') + '" style="--swatch-c:var(--' + colors[i % 4] + ');">' + (d.image_url ? '<img src="' + esc(d.image_url) + '" alt="' + esc(name) + '" loading="lazy">' : '') + '</div><span class="dropdate">Sản phẩm ra mắt ' + esc(releaseDate) + '</span><h3>' + esc(name) + '</h3><p>' + esc(desc) + '</p><button class="notifybtn' + (subscribed ? ' done' : '') + '" data-id="' + d.id + '" type="button"' + (subscribed ? ' disabled aria-pressed="true"' : ' aria-pressed="false"') + '>' + (subscribed ? 'Đã đăng ký nhận tin' : 'Nhận thông báo') + '</button></div>';
    }).join('') : '<p class="empty-note">Hiện chưa có sản phẩm nào được lên lịch ra mắt. Hãy quay lại sau nhé.</p>';
  }).catch(function () { dropgrid.innerHTML = '<p class="empty-note">Không tải được danh sách sản phẩm sắp ra mắt. Vui lòng thử lại.</p>'; });
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('.notifybtn'); if (!b || b.disabled) return;
    await authPromise;
    if (!user) { openAccount('Vui lòng đăng nhập để nhận thông báo khi sản phẩm ra mắt.'); return; }
    try {
      await api('POST', '/drops/' + b.dataset.id + '/subscribe');
      b.textContent = 'Đã đăng ký nhận tin'; b.classList.add('done'); b.disabled = true; b.setAttribute('aria-pressed', 'true');
    }
    catch (_) { b.textContent = 'Không thể đăng ký. Vui lòng thử lại.'; }
  });

  // ---------- contact ----------
  var contactForm = $('contactForm');
  if (contactForm) contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('contactMsg'); msg.classList.add('show'); msg.textContent = 'Sending...';
    try {
      var result = await api('POST', '/contact', { name: $('cname').value, email: $('cemail').value, message: $('cmsg').value });
      contactForm.reset(); msg.textContent = result.emailSent ? "Sent to Flex Shop. We'll get back to you within a day." : 'Message saved. The shop can review it in the Messages page.';
    } catch (err) { msg.textContent = err.message; }
  });

  // ---------- boot ----------
  paintAuthLinks(); renderCart();
  authPromise = api('GET', '/auth/me').then(function (r) { user = r.user; }, function () { user = null; }).then(function () {
    try { localStorage.removeItem('flex_cart'); } catch (e) {}       // the old shared cart from before accounts were required
    paintUser(); loadCart(); renderCart(); renderCheckoutPage(); showAuthErrorFromUrl(); applyPending();
    if (new URLSearchParams(location.search).get('login') === '1' && !user) openAccount();

  });
});
