(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var me = null, current = 'dashboard', orderFilter = 'all', cache = { products: [], users: [] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return '$' + (c / 100).toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }); }
  function when(ts) { return ts ? new Date(ts * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'; }
  function pill(s) { return '<span class="pill s-' + esc(s) + '">' + esc(s) + '</span>'; }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }

  async function api(method, path, body) {
    var res = await fetch('/api' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      if (res.status === 401 && me) showLogin('Your session ended. Please sign in again.');
      var err = new Error(data.error || 'Request failed'); err.status = res.status; throw err;
    }
    return data;
  }

  // ---------- auth ----------
  function showLogin(msg) { me = null; $('app').hidden = true; $('login').hidden = false; $('loginErr').textContent = msg || ''; }
  function showApp(user) {
    me = user; $('login').hidden = true; $('app').hidden = false;
    $('who').textContent = user.name + ' (' + user.role + ')';
    document.querySelectorAll('[data-admin]').forEach(function (b) { b.hidden = user.role !== 'admin'; });
    if (current === 'users' || current === 'activity') { if (user.role !== 'admin') current = 'dashboard'; }
    render();
  }
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault(); $('loginErr').textContent = '';
    try {
      var staffMode = !$('emField').hidden;
      var r = staffMode ? await api('POST', '/auth/login', { email: $('em').value, password: $('pw').value }) : await api('POST', '/admin/login', { password: $('pw').value });
      if (r.user.role === 'customer') { await api('POST', '/auth/logout').catch(function () {}); throw new Error('This account does not have admin access.'); }
      $('pw').value = ''; showApp(r.user);
    } catch (err) { $('loginErr').textContent = err.message; }
  });
  $('modeLink').addEventListener('click', function () {
    var show = $('emField').hidden; $('emField').hidden = !show; $('em').required = show;
    $('modeLink').textContent = show ? 'Back to password-only sign in' : 'Staff account? Sign in with email';
    (show ? $('em') : $('pw')).focus();
  });
  $('logoutBtn').addEventListener('click', async function () { await api('POST', '/auth/logout').catch(function () {}); showLogin(); });
  $('themeBtn').addEventListener('click', function () {
    var r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  });

  // ---------- views ----------
  function kpi(l, v, s) { return '<div class="card kpi"><span>' + l + '</span><strong>' + v + '</strong><small>' + s + '</small></div>'; }
  function table(head, rows, empty) {
    return '<div class="tablewrap"><table><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">' + empty + '</td></tr>') + '</tbody></table></div>';
  }
  var views = {
    dashboard: async function () {
      var s = await api('GET', '/admin/stats'), max = Math.max.apply(null, s.week.map(function (w) { return w.cents; }).concat([1]));
      return '<div class="kpis">' + kpi('Revenue', money(s.revenueCents), 'excludes cancelled') + kpi('Orders', s.orders, 'all time') + kpi('Customers', s.customers, 'registered') + kpi('Low stock', s.lowStock, '10 units or fewer') + '</div>' +
        '<div class="two"><div class="card"><h2>Revenue, last 7 days</h2><div class="bars">' +
        s.week.map(function (w) { return '<div class="bar" title="' + money(w.cents) + '"><i style="height:' + Math.round(w.cents / max * 100) + '%"></i>' + esc(w.label) + '</div>'; }).join('') +
        '</div></div><div class="card"><h2>Recent orders</h2>' + (s.recent.length ? '<ul class="recent">' + s.recent.map(function (o) {
          return '<li><span>' + esc(o.order_no) + ' ' + esc(o.name) + '</span><span>' + money(o.total_cents) + ' ' + pill(o.status) + '</span></li>'; }).join('') + '</ul>' : '<p class="sub">No orders yet.</p>') + '</div></div>';
    },
    products: async function () {
      cache.products = (await api('GET', '/admin/products')).products;
      var rows = cache.products.map(function (p) {
        var thumb = p.image_url ? '<img class="thumb" src="' + esc(p.image_url) + '" alt="" loading="lazy">' : '<span class="thumb thumb-empty" style="--swatch-c:var(--' + esc(p.color) + ');"></span>';
        return '<tr><td><div style="display:flex;align-items:center;gap:10px;">' + thumb + '<div><strong>' + esc(p.name) + '</strong><div class="sub">' + esc(p.sku) + (p.image_count ? ' &middot; ' + p.image_count + ' photo' + (p.image_count > 1 ? 's' : '') : ' &middot; no photos') + '</div></div></div></td><td>' + esc(p.department) + ' / ' + esc(p.category) + '</td><td>' + money(p.price_cents) + '</td>' +
          '<td class="' + (p.stock <= 10 ? 'low' : '') + '">' + p.stock + (p.stock <= 10 ? ' (low)' : '') + '</td><td>' + pill(p.status) + '</td>' +
          '<td class="r"><div class="actions"><button class="btn ghost sm" data-act="edit-product" data-id="' + p.id + '">Edit</button><button class="btn ghost sm" data-act="images-product" data-id="' + p.id + '">Images</button><button class="btn ghost sm" data-act="del-product" data-id="' + p.id + '">Delete</button></div></td></tr>';
      }).join('');
      return '<div class="tools"><span class="who">' + cache.products.length + ' products</span><button class="btn red" data-act="add-product">Add product</button></div>' +
        table('<th>Name</th><th>Department</th><th>Price</th><th>Stock</th><th>Status</th><th class="r">Actions</th>', rows, 'No products yet.');
    },
    orders: async function () {
      var list = (await api('GET', '/admin/orders' + (orderFilter === 'all' ? '' : '?status=' + orderFilter))).orders;
      var tabs = ['all', 'pending', 'shipped', 'delivered', 'cancelled'].map(function (t) { return '<button data-act="filter" data-id="' + t + '" class="' + (t === orderFilter ? 'active' : '') + '">' + t[0].toUpperCase() + t.slice(1) + '</button>'; }).join('');
      var rows = list.map(function (o) {
        var locked = o.status === 'cancelled';
        var opts = ['pending', 'shipped', 'delivered', 'cancelled'].map(function (s) { return '<option ' + (s === o.status ? 'selected' : '') + '>' + s + '</option>'; }).join('');
        return '<tr><td><strong>' + esc(o.order_no) + '</strong></td><td>' + esc(o.name) + '<div class="sub">' + esc(o.email) + '</div></td><td>' + when(o.created_at) + '</td><td>' + o.items + '</td><td>' + money(o.total_cents) + '</td><td>' + pill(o.status) + '</td>' +
          '<td class="r"><div class="actions"><button class="btn ghost sm" data-act="view-order" data-id="' + o.id + '">View</button><select class="inline-select" data-act="order-status" data-id="' + o.id + '" ' + (locked ? 'disabled' : '') + ' aria-label="Change status of ' + esc(o.order_no) + '">' + opts + '</select></div></td></tr>';
      }).join('');
      return '<div class="tools"><div class="tabs">' + tabs + '</div></div>' + table('<th>Order</th><th>Customer</th><th>Placed</th><th>Items</th><th>Total</th><th>Status</th><th class="r">Manage</th>', rows, 'No orders here.');
    },
    users: async function () {
      cache.users = (await api('GET', '/admin/users')).users;
      var rows = cache.users.map(function (u) {
        var lock = u.locked_until > Date.now() / 1000 ? ' <span class="pill s-disabled">locked</span>' : '';
        return '<tr><td><strong>' + esc(u.name) + '</strong><div class="sub">' + esc(u.email) + '</div></td><td>' + pill(u.role) + '</td><td>' + pill(u.status) + lock + '</td><td>' + u.orders + ' / ' + money(u.spent_cents) + '</td><td>' + when(u.last_login_at) + '</td>' +
          '<td class="r"><div class="actions"><button class="btn ghost sm" data-act="edit-user" data-id="' + u.id + '">Edit</button><button class="btn ghost sm" data-act="reset-pw" data-id="' + u.id + '">Reset password</button>' +
          (u.id === me.id ? '' : '<button class="btn ghost sm" data-act="del-user" data-id="' + u.id + '">Delete</button>') + '</div></td></tr>';
      }).join('');
      return '<div class="tools"><span class="who">' + cache.users.length + ' accounts</span><button class="btn red" data-act="add-user">Create user</button></div>' +
        table('<th>User</th><th>Role</th><th>Status</th><th>Orders / spent</th><th>Last sign-in</th><th class="r">Actions</th>', rows, 'No users.');
    },
    drops: async function () {
      var list = (await api('GET', '/admin/drops')).drops;
      var rows = list.map(function (d) { return '<tr><td><strong>' + esc(d.name) + '</strong><div class="sub">' + esc(d.description) + '</div></td><td>' + esc(d.release_date) + '</td><td>' + d.subscribers + ' waiting</td><td class="r"><div class="actions"><button class="btn ghost sm" data-act="del-drop" data-id="' + d.id + '">Remove</button></div></td></tr>'; }).join('');
      return '<div class="tools"><span class="who">' + list.length + ' scheduled</span><button class="btn red" data-act="add-drop">Schedule drop</button></div>' +
        table('<th>Drop</th><th>Release date</th><th>Notify list</th><th class="r">Actions</th>', rows, 'Nothing scheduled.');
    },
    messages: async function () {
      var list = (await api('GET', '/admin/messages')).messages;
      if (!list.length) return '<div class="card empty">No messages yet.</div>';
      return list.map(function (m) {
        return '<div class="msg"><header><strong>' + esc(m.name) + ' <span class="sub">&lt;' + esc(m.email) + '&gt;</span></strong><span>' + pill(m.status) + ' <span class="sub">' + when(m.created_at) + '</span></span></header><p>' + esc(m.body) + '</p>' +
          '<div class="actions" style="justify-content:flex-start"><a class="btn ghost sm" style="text-decoration:none" href="mailto:' + encodeURIComponent(m.email) + '">Reply</a>' +
          '<button class="btn ghost sm" data-act="msg-toggle" data-id="' + m.id + '" data-status="' + (m.status === 'new' ? 'read' : 'new') + '">Mark ' + (m.status === 'new' ? 'read' : 'unread') + '</button>' +
          '<button class="btn ghost sm" data-act="msg-del" data-id="' + m.id + '">Delete</button></div></div>';
      }).join('');
    },
    activity: async function () {
      var list = (await api('GET', '/admin/audit')).entries;
      return table('<th>When</th><th>Who</th><th>Action</th><th>Detail</th>', list.map(function (a) { return '<tr><td>' + when(a.created_at) + '</td><td>' + esc(a.actor) + '</td><td><strong>' + esc(a.action) + '</strong></td><td>' + esc(a.detail) + '</td></tr>'; }).join(''), 'No activity yet.');
    }
  };
  var titles = { dashboard: 'Dashboard', products: 'Products', orders: 'Orders', users: 'Users', drops: 'Upcoming drops', messages: 'Messages', activity: 'Activity log' };

  async function render() {
    $('title').textContent = titles[current];
    document.querySelectorAll('#nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === current); });
    var view = $('view');
    try { view.innerHTML = await views[current](); }
    catch (e) { if (e.status !== 401) view.innerHTML = '<div class="card">' + esc(e.message) + '</div>'; }
  }

  // ---------- modal ----------
  function openModal(html, onSubmit) {
    var root = $('modalRoot');
    root.innerHTML = '<div class="overlay" id="ov"><form class="modal" role="dialog" aria-modal="true">' + html + '<p class="formerr" role="alert"></p></form></div>';
    var form = root.querySelector('form'), first = form.querySelector('input,select'); if (first) first.focus();
    function close() { root.innerHTML = ''; }
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await onSubmit(form); close(); render(); } catch (err) { form.querySelector('.formerr').textContent = err.message; }
    });
    var cancel = root.querySelector('[data-cancel]'); if (cancel) cancel.addEventListener('click', close);
    $('ov').addEventListener('mousedown', function (e) { if (e.target.id === 'ov') close(); });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('modalRoot').innerHTML = ''; });
  var buttons = function (label) { return '<div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Cancel</button><button class="btn red" type="submit">' + label + '</button></div>'; };
  var field = function (label, name, val, attrs) { return '<div class="field"><label>' + label + '</label><input name="' + name + '" value="' + esc(val) + '" ' + (attrs || '') + '></div>'; };
  var select = function (label, name, list, val) { return '<div class="field"><label>' + label + '</label><select name="' + name + '">' + list.map(function (o) { return '<option ' + (o === val ? 'selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>'; };

  function productModal(p) {
    var isNew = !p; p = p || { name: '', sku: '', department: 'Men', category: 'Tops', price_cents: '', stock: '', status: 'active', tag: '', color: 'blue', featured: 0 };
    openModal('<h2 class="display">' + (isNew ? 'Add' : 'Edit') + ' product</h2>' + field('Name', 'name', p.name, 'required maxlength="100"') +
      (isNew ? field('SKU (optional)', 'sku', '', 'maxlength="40"') : '') +
      select('Department', 'department', ['Men', 'Women', 'Kids', 'Unisex'], p.department) + select('Category', 'category', ['Tops', 'Bottoms', 'Outerwear'], p.category) +
      field('Price (USD)', 'price', p.price_cents === '' ? '' : (p.price_cents / 100).toFixed(2), 'type="number" min="0" step="0.01" required') + field('Stock', 'stock', p.stock, 'type="number" min="0" step="1" required') +
      select('Status', 'status', ['active', 'draft'], p.status) + select('Tag', 'tag', ['', 'New', 'Bestseller'], p.tag) + select('Color', 'color', ['red', 'blue', 'ink', 'volt'], p.color) +
      '<label class="check"><input type="checkbox" name="featured" ' + (p.featured ? 'checked' : '') + '> Feature on home page</label>' + buttons('Save'),
      function (f) {
        var d = { name: f.name.value, department: f.department.value, category: f.category.value, priceCents: Math.round(parseFloat(f.price.value) * 100), stock: f.stock.value, status: f.status.value, tag: f.tag.value, color: f.color.value, featured: f.featured.checked };
        if (isNew) { if (f.sku.value.trim()) d.sku = f.sku.value; return api('POST', '/admin/products', d).then(function () { toast('Product added'); }); }
        return api('PUT', '/admin/products/' + p.id, d).then(function () { toast('Product updated'); });
      });
  }
  function userModal(u) {
    var isNew = !u; u = u || { name: '', email: '', role: 'customer', status: 'active' };
    openModal('<h2 class="display">' + (isNew ? 'Create' : 'Edit') + ' user</h2>' + field('Name', 'name', u.name, 'required maxlength="100"') +
      (isNew ? field('Email', 'email', '', 'type="email" required') + field('Password (min 8 characters)', 'password', '', 'type="password" minlength="8" required autocomplete="new-password"') : '<p class="sub">' + esc(u.email) + '</p>') +
      select('Role', 'role', ['customer', 'staff', 'admin'], u.role) + (isNew ? '' : select('Status', 'status', ['active', 'disabled'], u.status)) +
      (isNew ? '' : '<p class="sub">Changing a role or status signs the user out everywhere.</p>') + buttons('Save'),
      function (f) {
        if (isNew) return api('POST', '/admin/users', { name: f.name.value, email: f.email.value, password: f.password.value, role: f.role.value }).then(function () { toast('User created'); });
        return api('PUT', '/admin/users/' + u.id, { name: f.name.value, role: f.role.value, status: f.status.value }).then(function () { toast('User updated'); });
      });
  }

  async function imagesModal(p) {
    var root = $('modalRoot');
    root.innerHTML = '<div class="overlay open" id="ov"><div class="modal open" role="dialog" aria-modal="true" style="width:min(560px,92vw);">' +
      '<button type="button" class="closebtn" id="imgClose" aria-label="Close" style="position:absolute;top:14px;right:14px;">\u2715</button>' +
      '<h2 class="display">' + esc(p.name) + '</h2><p class="sub" style="margin:-10px 0 16px;">Up to 12 photos. The first (or "Set as cover") shows on the storefront and in search.</p>' +
      '<div id="imgList" class="imglist"></div>' +
      '<form id="imgAddForm" style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;">' +
      field('Image URL (https://...)', 'url', '', 'required placeholder="https://images.example.com/photo.jpg"') +
      field('Alt text (for screen readers)', 'alt', '', 'maxlength="200" placeholder="' + esc(p.name) + ', front view"') +
      '<p class="formerr" role="alert"></p><button class="btn red" type="submit">Add image</button></form></div></div>';
    $('imgClose').addEventListener('click', function () { root.innerHTML = ''; render(); });
    $('ov').addEventListener('mousedown', function (e) { if (e.target.id === 'ov') { root.innerHTML = ''; render(); } });
    document.addEventListener('keydown', function esc1(e) { if (e.key === 'Escape') { root.innerHTML = ''; document.removeEventListener('keydown', esc1); } });

    async function reload() {
      var imgs = (await api('GET', '/admin/products/' + p.id + '/images')).images;
      var list = $('imgList');
      list.innerHTML = imgs.length ? imgs.map(function (im, i) {
        return '<div class="imgrow"><img src="' + esc(im.url) + '" alt="" loading="lazy">' +
          '<div class="imgmeta"><div class="sub">' + (i === 0 ? '<strong>Cover photo</strong>' : 'Position ' + (i + 1)) + '</div><div class="sub">' + esc(im.alt_text || 'No alt text') + '</div></div>' +
          '<div class="actions">' + (i !== 0 ? '<button type="button" class="btn ghost sm" data-cover="' + im.id + '">Set as cover</button>' : '') +
          '<button type="button" class="btn ghost sm" data-delimg="' + im.id + '">Delete</button></div></div>';
      }).join('') : '<p class="sub">No photos yet. Paste an image URL below to add one.</p>';
    }
    $('imgList').addEventListener('click', async function (e) {
      var t = e.target;
      if (t.dataset.cover) { await api('POST', '/admin/images/' + t.dataset.cover + '/cover'); await reload(); toast('Cover photo updated'); }
      else if (t.dataset.delimg) { if (confirm('Delete this photo?')) { await api('DELETE', '/admin/images/' + t.dataset.delimg); await reload(); toast('Photo deleted'); } }
    });
    $('imgAddForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var f = e.target, err = f.querySelector('.formerr');
      try { await api('POST', '/admin/products/' + p.id + '/images', { url: f.url.value, altText: f.alt.value }); f.reset(); err.textContent = ''; await reload(); toast('Photo added'); }
      catch (ex) { err.textContent = ex.message; }
    });
    await reload();
  }

  // ---------- events ----------
  $('nav').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { current = b.dataset.view; render(); } });
  async function run(promise, msg) { try { await promise; toast(msg); render(); } catch (err) { toast(err.message); render(); } }

  $('view').addEventListener('click', async function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.dataset.act, id = t.dataset.id;
    if (act === 'add-product') productModal(null);
    else if (act === 'edit-product') productModal(cache.products.find(function (p) { return p.id == id; }));
    else if (act === 'images-product') imagesModal(cache.products.find(function (p) { return p.id == id; }));
    else if (act === 'del-product') { var p = cache.products.find(function (x) { return x.id == id; }); if (confirm('Delete "' + p.name + '"? Past orders keep their line items.')) run(api('DELETE', '/admin/products/' + id), 'Product deleted'); }
    else if (act === 'filter') { orderFilter = id; render(); }
    else if (act === 'view-order') {
      var d = await api('GET', '/admin/orders/' + id);
      openModal('<h2 class="display">' + esc(d.order.order_no) + '</h2><p class="sub">' + esc(d.order.name) + ' &middot; ' + esc(d.order.email) + ' &middot; ' + when(d.order.created_at) + '</p><ul class="items">' +
        d.items.map(function (i) { return '<li><span>' + i.qty + ' &times; ' + esc(i.name) + '</span><strong>' + money(i.unit_price_cents * i.qty) + '</strong></li>'; }).join('') + '<li><strong>Total</strong><strong>' + money(d.order.total_cents) + '</strong></li></ul>' +
        '<div class="modal-actions"><button type="button" class="btn" data-cancel>Close</button></div>', function () {});
    }
    else if (act === 'add-drop') openModal('<h2 class="display">Schedule drop</h2>' + field('Name', 'name', '', 'required') + field('Release date', 'date', '', 'required placeholder="e.g. Dec 9"') + field('Description', 'desc', '', 'maxlength="500"') + buttons('Schedule'),
      function (f) { return api('POST', '/admin/drops', { name: f.name.value, releaseDate: f.date.value, description: f.desc.value }).then(function () { toast('Drop scheduled'); }); });
    else if (act === 'del-drop') { if (confirm('Remove this drop and its notify list?')) run(api('DELETE', '/admin/drops/' + id), 'Drop removed'); }
    else if (act === 'msg-toggle') run(api('PUT', '/admin/messages/' + id, { status: t.dataset.status }), 'Updated');
    else if (act === 'msg-del') { if (confirm('Delete this message?')) run(api('DELETE', '/admin/messages/' + id), 'Message deleted'); }
    else if (act === 'add-user') userModal(null);
    else if (act === 'edit-user') userModal(cache.users.find(function (u) { return u.id == id; }));
    else if (act === 'reset-pw') {
      var u = cache.users.find(function (x) { return x.id == id; });
      openModal('<h2 class="display">Reset password</h2><p class="sub">Set a new password for ' + esc(u.email) + '. Existing passwords are hashed and can never be viewed. They will be signed out everywhere.</p>' +
        field('New password (min 8 characters)', 'password', '', 'type="password" minlength="8" required autocomplete="new-password"') + buttons('Reset'),
        function (f) { return api('POST', '/admin/users/' + id + '/password', { password: f.password.value }).then(function () { toast('Password reset'); }); });
    }
    else if (act === 'del-user') { var du = cache.users.find(function (x) { return x.id == id; }); if (confirm('Delete ' + du.email + '? Their orders stay on record.')) run(api('DELETE', '/admin/users/' + id), 'User deleted'); }
  });
  $('view').addEventListener('change', function (e) {
    if (e.target.dataset.act === 'order-status') run(api('PUT', '/admin/orders/' + e.target.dataset.id, { status: e.target.value }), 'Order updated');
  });

  // ---------- boot ----------
  api('GET', '/auth/me').then(function (r) { if (r.user && r.user.role !== 'customer') showApp(r.user); }).catch(function () {});
})();
