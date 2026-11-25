(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var validViews = ['dashboard', 'reports', 'products', 'orders', 'users', 'drops', 'messages', 'activity'];
  var savedView = location.hash.slice(1);
  var me = null, current = validViews.indexOf(savedView) !== -1 ? savedView : 'dashboard', orderFilter = 'all', cache = { products: [], users: [], orders: [], drops: [], messages: [], activity: [], report: null };
  function dateInputValue(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); }
  var reportTo = new Date(), reportFrom = new Date(); reportFrom.setDate(reportFrom.getDate() - 29);
  var reportRange = { from: dateInputValue(reportFrom), to: dateInputValue(reportTo) };
  var productFilterState = { search: '', department: '', category: '', stock: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return Math.round(c / 100).toLocaleString('vi-VN') + ' ₫'; }
  function when(ts) { return ts ? new Date(ts * 1000).toLocaleString('vi-VN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa từng'; }
  function dropDate(value) {
    if (!value) return '';
    var text = String(value).trim(), date;
    var iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    else date = new Date(text);
    return isNaN(date.getTime()) ? text : date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function viValue(value) {
    return ({ '': 'Không có nhãn', pending: 'Chờ xử lý', shipped: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy', active: 'Đang hoạt động', disabled: 'Đã khóa', draft: 'Bản nháp', paid: 'Đã thanh toán', refunded: 'Đã hoàn tiền', customer: 'Khách hàng', staff: 'Nhân viên', admin: 'Quản trị viên', new: 'Mới', read: 'Đã đọc', all: 'Tất cả', Men: 'Nam', Women: 'Nữ', Kids: 'Trẻ em', Unisex: 'Unisex', Tops: 'Áo', Bottoms: 'Quần', Outerwear: 'Áo khoác', New: 'Mới', Bestseller: 'Bán chạy', Sale: 'Giảm giá', red: 'Đỏ', blue: 'Xanh dương', ink: 'Đen', volt: 'Xanh neon' })[value] || value;
  }
  function pill(s) { return '<span class="pill s-' + esc(s) + '">' + esc(viValue(s)) + '</span>'; }
  function stockPill(stock) {
    stock = Number(stock) || 0;
    if (stock <= 0) return '<span class="pill s-stock-out">Hết hàng</span>';
    if (stock < 10) return '<span class="pill s-stock-low">Sắp hết</span>';
    return '<span class="pill s-stock-ok">Còn hàng</span>';
  }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  function exportButtons() { return '<span class="tabs"><button class="btn ghost" data-act="export-excel">Xuất Excel</button><button class="btn ghost" data-act="export-pdf">Xuất PDF</button></span>'; }

  function exportRowsForView() {
    var date = function (v) { return v ? new Date(v * 1000).toLocaleString('vi-VN') : ''; };
    if (current === 'products') return [['SKU', 'Tên sản phẩm', 'Đối tượng', 'Danh mục', 'Giá (VND)', 'Giá khuyến mãi (VND)', 'Số lượng', 'Kích cỡ', 'Nhãn', 'Trạng thái']].concat(cache.products.map(function (p) { return [p.sku, p.name_vi || p.name, viValue(p.department), viValue(p.category), Math.round(p.price_cents / 100), p.sale_price_cents == null ? '' : Math.round(p.sale_price_cents / 100), p.stock, p.sizes || '', viValue(p.tag || ''), viValue(p.status)]; }));
    if (current === 'orders') return [['Mã đơn', 'Khách hàng', 'Email', 'Ngày tạo', 'Số sản phẩm', 'Tổng tiền (VND)', 'Trạng thái']].concat((cache.orders || []).map(function (o) { return [o.order_no, o.name, o.email, date(o.created_at), o.items, Math.round(o.total_cents / 100), viValue(o.status)]; }));
    if (current === 'users') return [['Tên đăng nhập', 'Họ tên', 'Email', 'Điện thoại', 'Vai trò', 'Trạng thái', 'Số đơn', 'Tổng chi tiêu (VND)']].concat(cache.users.map(function (u) { return [u.username, u.name, u.email, u.phone || '', viValue(u.role), viValue(u.status), u.orders, Math.round((u.spent_cents || 0) / 100)]; }));
    if (current === 'drops') return [['Sản phẩm', 'Mô tả', 'Ngày ra mắt', 'Người nhận tin']].concat(cache.drops.map(function (d) { return [d.name_vi || d.name, d.description_vi || d.description || '', dropDate(d.release_date), d.subscribers]; }));
    if (current === 'messages') return [['Họ tên', 'Email', 'Nội dung', 'Trạng thái', 'Ngày gửi']].concat(cache.messages.map(function (m) { return [m.name, m.email, m.body, viValue(m.status), date(m.created_at)]; }));
    if (current === 'activity') return [['Thời gian', 'Người thực hiện', 'Hoạt động', 'Chi tiết']].concat(cache.activity.map(function (a) { return [date(a.created_at), a.actor, a.action, a.detail]; }));
    if (current === 'reports' && cache.report) {
      var report = cache.report, rows = [['Nhóm dữ liệu', 'Nội dung', 'Số lượng', 'Giá trị / doanh thu (VND)', 'Trạng thái / ghi chú']];
      rows.push(['Tổng hợp', 'Doanh thu', '', Math.round(report.summary.revenue_cents / 100), report.from + ' → ' + report.to]);
      rows.push(['Tổng hợp', 'Tổng đơn hàng', report.summary.orders, '', '']);
      rows.push(['Tổng hợp', 'Đã thanh toán', '', Math.round(report.summary.paid_cents / 100), '']);
      rows.push(['Tổng hợp', 'Chưa thanh toán', '', Math.round(report.summary.unpaid_cents / 100), '']);
      rows.push(['Tổng hợp', 'Đơn đã hủy', report.summary.cancelled_orders, '', '']);
      rows.push(['Tổng hợp', 'Giá trị đơn trung bình', '', Math.round(report.summary.average_order_cents / 100), '']);
      report.daily.forEach(function (d) { rows.push(['Theo ngày', d.day, d.orders, Math.round(d.revenue_cents / 100), '']); });
      report.topProducts.forEach(function (p) { rows.push(['Sản phẩm bán chạy', p.name, p.quantity, Math.round(p.revenue_cents / 100), '']); });
      report.paymentMethods.forEach(function (p) { rows.push(['Phương thức thanh toán', p.method, p.orders, Math.round(p.total_cents / 100), '']); });
      report.orderStatuses.forEach(function (s) { rows.push(['Trạng thái đơn', viValue(s.status), s.orders, '', '']); });
      report.inventory.forEach(function (p) { rows.push(['Tồn kho', p.name, p.stock, Math.round((p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? p.sale_price_cents : p.price_cents) / 100), (p.sku || '') + ' · ' + (p.stock_status === 'out' ? 'Hết' : p.stock_status === 'low' ? 'Sắp hết' : 'Còn')]); });
      report.orders.forEach(function (o) { rows.push(['Chi tiết đơn', o.order_no, '', Math.round(o.total_cents / 100), [o.name, o.email, new Date(o.created_at * 1000).toLocaleString('vi-VN'), viValue(o.status), o.payment_status === 'paid' ? 'Đã thanh toán' : o.payment_status === 'refunded' ? 'Đã hoàn tiền' : 'Chưa thanh toán', o.payment_method === 'bank_qr' ? 'Chuyển khoản QR' : o.payment_method === 'vnpay' ? 'VNPAY' : 'COD'].join(' · ')]); });
      return rows;
    }
    return [['Không có dữ liệu']];
  }
  function reportExportSections() {
    var r = cache.report;
    if (!r) return [];
    var sections = [
      ['Tổng quan', [['Chỉ số', 'Giá trị'], ['Khoảng thời gian', r.from + ' – ' + r.to], ['Doanh thu thuần', Math.round(r.summary.revenue_cents / 100)], ['Tổng đơn', r.summary.orders], ['Đã thanh toán', Math.round(r.summary.paid_cents / 100)], ['Chưa thanh toán', Math.round(r.summary.unpaid_cents / 100)], ['Đơn đã hủy', r.summary.cancelled_orders], ['Giá trị đơn trung bình', Math.round(r.summary.average_order_cents / 100)]]],
      ['Doanh thu theo ngày', [['Ngày', 'Số đơn', 'Doanh thu (VND)']].concat(r.daily.map(function (d) { return [d.day, d.orders, Math.round(d.revenue_cents / 100)]; }))],
      ['Sản phẩm bán chạy', [['Sản phẩm', 'Số lượng bán', 'Doanh thu (VND)']].concat(r.topProducts.map(function (p) { return [p.name, p.quantity, Math.round(p.revenue_cents / 100)]; }))],
      ['Phương thức thanh toán', [['Phương thức', 'Số đơn', 'Tổng tiền (VND)']].concat(r.paymentMethods.map(function (p) { return [p.method === 'bank_qr' ? 'Chuyển khoản QR' : 'COD', p.orders, Math.round(p.total_cents / 100)]; }))],
      ['Trạng thái đơn', [['Trạng thái', 'Số đơn']].concat(r.orderStatuses.map(function (s) { return [viValue(s.status), s.orders]; }))],
      ['Tồn kho', [['SKU', 'Sản phẩm', 'Tồn kho', 'Tình trạng']].concat(r.inventory.map(function (p) { return [p.sku || '', p.name, p.stock, p.stock_status === 'out' ? 'Hết' : p.stock_status === 'low' ? 'Sắp hết' : 'Còn']; }))],
      ['Chi tiết đơn hàng', [['Mã đơn', 'Khách hàng', 'Email', 'Ngày đặt', 'Tổng tiền (VND)', 'Trạng thái', 'Thanh toán', 'Phương thức']].concat(r.orders.map(function (o) { return [o.order_no, o.name, o.email, new Date(o.created_at * 1000).toLocaleString('vi-VN'), Math.round(o.total_cents / 100), viValue(o.status), o.payment_status === 'paid' ? 'Đã thanh toán' : o.payment_status === 'refunded' ? 'Đã hoàn tiền' : 'Chưa thanh toán', o.payment_method === 'bank_qr' ? 'Chuyển khoản QR' : o.payment_method === 'vnpay' ? 'VNPAY' : 'COD']; }))],
    ];
    return sections;
  }
  function exportExcel() {
    if (current === 'reports') {
      var sections = reportExportSections(), html = '<html><head><meta charset="UTF-8"><style>body{font:12px Arial;color:#222}table{border-collapse:collapse;margin:0 0 22px;min-width:520px}th,td{border:1px solid #cbd0d8;padding:7px 10px;text-align:left}th{background:#eef1f7} .section{background:#252a34;color:white;font-weight:bold;font-size:14px;text-align:left}</style></head><body>' + sections.map(function (section) { var cols = section[1][0].length; return '<table><thead><tr><th class="section" colspan="' + cols + '">' + esc(section[0]) + '</th></tr><tr>' + section[1][0].map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') + '</tr></thead><tbody>' + section[1].slice(1).map(function (row) { return '<tr>' + row.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }).join('') + '</body></html>';
      var reportBlob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), reportUrl = URL.createObjectURL(reportBlob), reportLink = document.createElement('a');
      reportLink.href = reportUrl; reportLink.download = 'flex-bao-cao-' + reportRange.from + '-' + reportRange.to + '.xls'; document.body.appendChild(reportLink); reportLink.click(); reportLink.remove(); setTimeout(function () { URL.revokeObjectURL(reportUrl); }, 1000); return;
    }
    var rows = exportRowsForView(), html = '<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>' + rows[0].map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.slice(1).map(function (row) { return '<tr>' + row.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></body></html>';
    var blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'flex-' + current + '-' + new Date().toISOString().slice(0, 10) + '.xls'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportPdf() {
    if (current === 'reports') {
      var sections = reportExportSections(), reportPopup = window.open('', '_blank');
      if (!reportPopup) { toast('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên để lưu PDF.'); return; }
      reportPopup.document.open();
      reportPopup.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo Flex</title><style>body{font:11px Arial,sans-serif;color:#222;padding:24px}h1{font-size:20px;margin:0 0 4px}p.meta{color:#555;margin:0 0 18px}h2{font-size:14px;margin:20px 0 7px;color:#252a34}table{width:100%;border-collapse:collapse;margin-bottom:15px;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #cbd0d8;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eef1f7}thead{display:table-header-group}@page{size:A4 landscape;margin:12mm}@media print{body{padding:0}}</style></head><body><h1>Flex · Thống kê báo cáo</h1><p class="meta">Kỳ báo cáo: ' + esc(reportRange.from) + ' – ' + esc(reportRange.to) + ' · Xuất lúc ' + esc(new Date().toLocaleString('vi-VN')) + '</p>' + sections.map(function (section) { return '<h2>' + esc(section[0]) + '</h2><table><thead><tr>' + section[1][0].map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') + '</tr></thead><tbody>' + section[1].slice(1).map(function (row) { return '<tr>' + row.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }).join('') + '<script>window.onload=function(){window.focus();window.print()}<\/script></body></html>');
      reportPopup.document.close(); return;
    }
    var rows = exportRowsForView(), popup = window.open('', '_blank');
    if (!popup) { toast('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên để lưu PDF.'); return; }
    popup.document.open();
    popup.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Xuất dữ liệu Flex</title><style>body{font:12px Arial,sans-serif;color:#222;padding:24px}h1{font-size:20px;margin:0 0 6px}p{color:#555;margin:0 0 18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px;text-align:left;vertical-align:top}th{background:#eee}@page{size:A4 landscape;margin:12mm}@media print{body{padding:0}}</style></head><body><h1>' + esc(titles[current] || 'Dữ liệu Flex') + '</h1><p>Xuất ngày ' + esc(new Date().toLocaleString('vi-VN')) + ' · ' + (rows.length - 1) + ' dòng dữ liệu</p><table><thead><tr>' + rows[0].map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.slice(1).map(function (row) { return '<tr>' + row.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><script>window.onload=function(){window.focus();window.print()}<\/script></body></html>');
    popup.document.close();
  }

  async function api(method, path, body) {
    var res = await fetch('/api' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      if (res.status === 401 && me) showLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      var err = new Error(data.error || 'Yêu cầu không thành công'); err.status = res.status; throw err;
    }
    return data;
  }

  // ---------- auth ----------
  function showLogin(msg) { me = null; $('authLoading').hidden = true; $('app').hidden = true; $('login').hidden = false; $('loginErr').textContent = msg || ''; }
  function showApp(user) {
    me = user; $('authLoading').hidden = true; $('login').hidden = true; $('app').hidden = false;
    $('who').textContent = '@' + user.username + ' \u2014 ' + user.name + ' (' + viValue(user.role) + ')';
    document.querySelectorAll('[data-admin]').forEach(function (b) { b.hidden = user.role !== 'admin'; });
    if ((current === 'users' || current === 'activity') && user.role !== 'admin') current = 'dashboard';
    if (location.hash.slice(1) !== current) history.replaceState(null, '', location.pathname + location.search + '#' + current);
    render();
  }
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault(); $('loginErr').textContent = '';
    try {
      var r = await api('POST', '/auth/login', { username: $('un').value, password: $('pw').value, scope: 'admin' });
      $('pw').value = ''; showApp(r.user);
    } catch (err) { $('loginErr').textContent = err.message; }
  });
  $('logoutBtn').addEventListener('click', async function () { await api('POST', '/auth/logout?scope=admin').catch(function () {}); showLogin(); });
  $('themeBtn').addEventListener('click', function () {
    var r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  });

  // ---------- views ----------
  function kpi(l, v, s) { return '<div class="card kpi"><span>' + l + '</span><strong>' + v + '</strong><small>' + s + '</small></div>'; }
  function table(head, rows, empty, tableClass) {
    return '<div class="tablewrap"><table' + (tableClass ? ' class="' + esc(tableClass) + '"' : '') + '><thead><tr>' + head + '</tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">' + empty + '</td></tr>') + '</tbody></table></div>';
  }
  var views = {
    dashboard: async function () {
      var s = await api('GET', '/admin/stats'), max = Math.max.apply(null, s.week.map(function (w) { return w.cents; }).concat([1]));
      return '<div class="kpis">' + kpi('Doanh thu', money(s.revenueCents), 'không tính đơn đã hủy') + kpi('Đơn hàng', s.orders, 'từ trước đến nay') + kpi('Khách hàng', s.customers, 'đã đăng ký') + kpi('Sắp hết hàng', s.lowStock, 'còn từ 1 đến 9 sản phẩm') + '</div>' +
        '<div class="two"><div class="card"><h2>Doanh thu 7 ngày gần đây</h2><div class="bars">' +
        s.week.map(function (w) { var day = ({ Mon: 'T2', Tue: 'T3', Wed: 'T4', Thu: 'T5', Fri: 'T6', Sat: 'T7', Sun: 'CN' })[w.label] || w.label; return '<div class="bar" title="' + money(w.cents) + '"><i style="height:' + Math.round(w.cents / max * 100) + '%"></i>' + esc(day) + '</div>'; }).join('') +
        '</div></div><div class="card"><h2>Đơn hàng gần đây</h2>' + (s.recent.length ? '<ul class="recent">' + s.recent.map(function (o) {
          return '<li><span>' + esc(o.order_no) + ' ' + esc(o.name) + '</span><span>' + money(o.total_cents) + ' ' + pill(o.status) + '</span></li>'; }).join('') + '</ul>' : '<p class="sub">Chưa có đơn hàng.</p>') + '</div></div>';
    },
    reports: async function () {
      var data = await api('GET', '/admin/reports?from=' + encodeURIComponent(reportRange.from) + '&to=' + encodeURIComponent(reportRange.to));
      cache.report = data;
      var summary = data.summary, max = Math.max.apply(null, data.daily.map(function (d) { return d.revenue_cents; }).concat([1]));
      var dayMap = {}; data.daily.forEach(function (d) { dayMap[d.day] = d; });
      var start = new Date(reportRange.from + 'T00:00:00'), finish = new Date(reportRange.to + 'T00:00:00'), dayCount = Math.round((finish - start) / 86400000) + 1;
      var dailyBars = [];
      for (var i = 0; i < dayCount; i++) {
        var d = new Date(start); d.setDate(start.getDate() + i);
        var key = dateInputValue(d), row = dayMap[key] || { revenue_cents: 0, orders: 0 };
        dailyBars.push('<div class="report-bar" title="' + esc(key) + ' · ' + money(row.revenue_cents) + ' · ' + row.orders + ' đơn"><i style="height:' + Math.max(row.revenue_cents ? 3 : 0, Math.round(row.revenue_cents / max * 100)) + '%"></i><small>' + esc(key.slice(5)) + '</small></div>');
      }
      var topRows = data.topProducts.map(function (p, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(p.name) + '</td><td>' + p.quantity + '</td><td>' + money(p.revenue_cents) + '</td></tr>'; }).join('');
      var paymentRows = data.paymentMethods.map(function (p) { return '<tr><td>' + (p.method === 'bank_qr' ? 'Chuyển khoản QR' : 'Tiền mặt khi nhận hàng') + '</td><td>' + p.orders + '</td><td>' + money(p.total_cents) + '</td></tr>'; }).join('');
      var statusRows = data.orderStatuses.map(function (s) { return '<tr><td>' + esc(viValue(s.status)) + '</td><td>' + s.orders + '</td></tr>'; }).join('');
      var lowInventory = data.inventory.filter(function (p) { return p.stock_status !== 'ok'; });
      var inventoryRows = lowInventory.map(function (p) { return '<tr><td>' + esc(p.sku || '') + '</td><td>' + esc(p.name) + '</td><td>' + p.stock + '</td><td>' + (p.stock_status === 'out' ? 'Hết' : 'Sắp hết') + '</td></tr>'; }).join('');
      var orderRows = data.orders.map(function (o) { return '<tr><td>' + esc(o.order_no) + '</td><td>' + esc(o.name) + '<div class="sub">' + esc(o.email) + '</div></td><td>' + esc(new Date(o.created_at * 1000).toLocaleString('vi-VN')) + '</td><td>' + money(o.total_cents) + '</td><td>' + esc(viValue(o.status)) + '</td><td>' + esc(viValue(o.payment_status)) + '</td></tr>'; }).join('');
      return '<div class="tools report-tools"><div class="report-range"><label>Từ ngày <input type="date" id="reportFrom" value="' + esc(reportRange.from) + '"></label><label>Đến ngày <input type="date" id="reportTo" value="' + esc(reportRange.to) + '"></label><button class="btn red" data-act="run-report">Xem báo cáo</button></div>' + exportButtons() + '</div>' +
        '<div class="kpis report-kpis">' + kpi('Doanh thu thuần', money(summary.revenue_cents), 'không tính đơn đã hủy') + kpi('Tổng đơn hàng', summary.orders, summary.cancelled_orders + ' đơn đã hủy') + kpi('Giá trị đơn trung bình', money(summary.average_order_cents), 'trên các đơn chưa hủy') + kpi('Chưa thanh toán', money(summary.unpaid_cents), money(summary.paid_cents) + ' đã thanh toán') + '</div>' +
        '<div class="card report-chart-card"><div class="report-card-heading"><h2>Doanh thu theo ngày</h2><span>' + esc(reportRange.from) + ' – ' + esc(reportRange.to) + '</span></div><div class="report-chart-scroll"><div class="report-chart" style="min-width:' + Math.max(640, dayCount * 28) + 'px">' + dailyBars.join('') + '</div></div></div>' +
        '<div class="report-bottom"><div class="card"><h2>Sản phẩm bán chạy</h2>' + table('<th>#</th><th>Sản phẩm</th><th>Số lượng</th><th>Doanh thu</th>', topRows, 'Chưa có sản phẩm bán ra.') + '</div><div class="card"><h2>Phương thức thanh toán</h2>' + table('<th>Phương thức</th><th>Số đơn</th><th>Tổng tiền</th>', paymentRows, 'Chưa có dữ liệu.') + '<h2 class="report-status-title">Trạng thái đơn hàng</h2>' + table('<th>Trạng thái</th><th>Số đơn</th>', statusRows, 'Chưa có dữ liệu.') + '</div></div>' +
        '<div class="card" style="margin-top:16px"><h2>Cảnh báo tồn kho <span class="sub">(' + lowInventory.length + ' mặt hàng)</span></h2>' + table('<th>SKU</th><th>Sản phẩm</th><th>Tồn</th><th>Trạng thái</th>', inventoryRows, 'Không có cảnh báo tồn kho.') + '</div>' +
        '<div class="card" style="margin-top:16px"><h2>Chi tiết đơn hàng trong kỳ</h2>' + table('<th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Tổng tiền</th><th>Trạng thái đơn</th><th>Thanh toán</th>', orderRows, data.orders.length ? '' : 'Chưa có đơn hàng.') + (data.orders.length >= 5000 ? '<p class="sub">Đang hiển thị tối đa 5.000 đơn; thu hẹp khoảng ngày để xem đầy đủ.</p>' : '') + '</div>';
    },
    products: async function () {
      cache.products = (await api('GET', '/admin/products')).products;
    var rows = cache.products.map(function (p) {
        var thumb = p.image_url ? '<img class="thumb" src="' + esc(p.image_url) + '" alt="" loading="lazy">' : '<span class="thumb thumb-empty"></span>';
        var primaryName = p.name_vi || p.name, secondaryName = p.name_vi && p.name_vi !== p.name ? '<div class="sub">' + esc(p.name) + '</div>' : '';
        var discount = p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? Math.round((1 - p.sale_price_cents / p.price_cents) * 100) : 0;
        var stockState = p.stock <= 0 ? 'out' : p.stock < 10 ? 'low' : 'ok';
        return '<tr data-search="' + esc((p.name + ' ' + p.name_vi + ' ' + p.sku + ' ' + p.department + ' ' + p.category).toLowerCase()) + '" data-department="' + esc(p.department) + '" data-category="' + esc(p.category) + '" data-stock-state="' + stockState + '"><td><div style="display:flex;align-items:center;gap:10px;">' + thumb + '<div><strong>' + esc(primaryName) + '</strong>' + secondaryName + (p.status === 'draft' ? '<div class="sub"><span class="pill s-draft">Bản nháp</span></div>' : '') + '<div class="sub">' + esc(p.sku) + (p.image_count ? ' &middot; ' + p.image_count + ' ảnh' : ' &middot; chưa có ảnh') + '</div></div></div></td><td>' + esc(viValue(p.department)) + ' / ' + esc(viValue(p.category)) + (p.sizes ? '<div class="sub">Kích cỡ: ' + esc(p.sizes.split(',').join(', ')) + '</div>' : '') + (p.tag ? '<div class="sub">Nhãn: ' + esc(viValue(p.tag)) + '</div>' : '') + '</td><td>' + (discount ? '<del>' + money(p.price_cents) + '</del><br><strong class="low">' + money(p.sale_price_cents) + '</strong><div class="sub">Giảm ' + discount + '%</div>' : money(p.price_cents)) + '</td>' +
          '<td class="' + (p.stock > 0 && p.stock < 10 ? 'low' : '') + '">' + p.stock + '</td><td>' + stockPill(p.stock) + '</td>' +
          '<td class="r"><div class="actions"><button class="btn ghost sm" data-act="edit-product" data-id="' + p.id + '">Sửa</button><button class="btn ghost sm" data-act="images-product" data-id="' + p.id + '">Ảnh</button><button class="btn ghost sm" data-act="del-product" data-id="' + p.id + '">Xóa</button></div></td></tr>';
      }).join('');
      return '<div class="tools"><span class="who" id="productResultCount">' + cache.products.length + ' sản phẩm</span><div class="product-filters"><input id="productSearch" type="search" placeholder="Tìm tên, SKU hoặc danh mục" aria-label="Tìm sản phẩm"><select id="productDepartmentFilter" aria-label="Lọc theo đối tượng"><option value="">Tất cả đối tượng</option><option value="Men">Nam</option><option value="Women">Nữ</option><option value="Kids">Trẻ em</option><option value="Unisex">Unisex</option></select><select id="productCategoryFilter" aria-label="Lọc theo danh mục"><option value="">Tất cả danh mục</option><option value="Tops">Áo</option><option value="Bottoms">Quần</option><option value="Outerwear">Áo khoác</option></select><select id="productStockFilter" aria-label="Lọc theo tình trạng kho"><option value="">Tất cả tình trạng kho</option><option value="ok">Còn hàng</option><option value="low">Sắp hết</option><option value="out">Hết hàng</option></select><button class="btn red" data-act="add-product">Thêm sản phẩm</button>' + exportButtons() + '</div></div>' +
        table('<th>Tên sản phẩm</th><th>Bộ phận / danh mục</th><th>Giá</th><th>Số lượng</th><th>Tình trạng kho</th><th class="r">Thao tác</th>', rows, 'Chưa có sản phẩm.', 'products-table');
    },
    orders: async function () {
      var list = (await api('GET', '/admin/orders' + (orderFilter === 'all' ? '' : '?status=' + orderFilter))).orders;
      cache.orders = list;
      var tabs = ['all', 'pending', 'shipped', 'delivered', 'cancelled'].map(function (t) { return '<button data-act="filter" data-id="' + t + '" class="' + (t === orderFilter ? 'active' : '') + '">' + esc(viValue(t)) + '</button>'; }).join('');
      var rows = list.map(function (o) {
        var locked = o.status === 'cancelled';
        var opts = ['pending', 'shipped', 'delivered', 'cancelled'].map(function (s) { return '<option value="' + s + '" ' + (s === o.status ? 'selected' : '') + '>' + esc(viValue(s)) + '</option>'; }).join('');
        return '<tr data-search="' + esc((o.order_no + ' ' + o.name + ' ' + o.email).toLowerCase()) + '"><td><strong>' + esc(o.order_no) + '</strong></td><td>' + esc(o.name) + '<div class="sub">' + esc(o.email) + '</div></td><td>' + when(o.created_at) + '</td><td>' + o.items + '</td><td>' + money(o.total_cents) + '</td><td>' + pill(o.status) + '</td>' +
          '<td class="r"><div class="actions"><button class="btn ghost sm" data-act="view-order" data-id="' + o.id + '">Xem</button><select class="inline-select" data-act="order-status" data-id="' + o.id + '" ' + (locked ? 'disabled' : '') + ' aria-label="Đổi trạng thái đơn ' + esc(o.order_no) + '">' + opts + '</select></div></td></tr>';
      }).join('');
      return '<div class="tools"><div class="tabs">' + tabs + '</div><input id="orderSearch" type="search" placeholder="Tìm đơn hàng hoặc khách hàng" aria-label="Tìm đơn hàng" style="max-width:260px;padding:10px;border:1px solid var(--line);border-radius:8px">' + exportButtons() + '</div>' + table('<th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Số sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th><th class="r">Quản lý</th>', rows, 'Không có đơn hàng.');
    },
    users: async function () {
      cache.users = (await api('GET', '/admin/users')).users;
      var rows = cache.users.map(function (u) {
        var lock = u.locked_until > Date.now() / 1000 ? ' <span class="pill s-disabled">Đã khóa</span>' : '';
        return '<tr><td><strong>' + esc(u.username) + '</strong>' + (u.has_google ? ' <span class="pill s-new">google</span>' : '') + '<div class="sub">' + esc(u.name) + ' &middot; ' + esc(u.email) + (u.phone ? ' &middot; ' + esc(u.phone) : '') + '</div></td><td>' + pill(u.role) + '</td><td>' + pill(u.status) + lock + '</td><td>' + u.orders + ' / ' + money(u.spent_cents) + '</td><td>' + when(u.last_login_at) + '</td>' +
          '<td class="r"><div class="actions"><button class="btn ghost sm" data-act="edit-user" data-id="' + u.id + '">Sửa</button><button class="btn ghost sm" data-act="reset-pw" data-id="' + u.id + '">Đặt lại mật khẩu</button>' +
          (u.id === me.id ? '' : '<button class="btn ghost sm" data-act="del-user" data-id="' + u.id + '">Xóa</button>') + '</div></td></tr>';
      }).join('');
      return '<div class="tools"><span class="who">' + cache.users.length + ' tài khoản</span><div class="tabs"><button class="btn red" data-act="add-user">Tạo người dùng</button>' + exportButtons() + '</div></div>' +
        table('<th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th>Đơn hàng / chi tiêu</th><th>Đăng nhập gần nhất</th><th class="r">Thao tác</th>', rows, 'Chưa có người dùng.');
    },
    drops: async function () {
      var list = (await api('GET', '/admin/drops')).drops;
      cache.drops = list;
      var rows = list.map(function (d) { return '<tr><td>' + (d.image_url ? '<img class="thumb" src="' + esc(d.image_url) + '" alt="" loading="lazy"> ' : '') + '<strong>' + esc(d.name_vi || d.name) + '</strong><div class="sub">' + esc(d.description_vi || 'Chưa có mô tả') + '</div></td><td>' + esc(dropDate(d.release_date)) + '</td><td>' + d.subscribers + ' đang chờ</td><td class="r"><div class="actions"><button class="btn ghost sm" data-act="edit-drop" data-id="' + d.id + '">Sửa</button><button class="btn ghost sm" data-act="del-drop" data-id="' + d.id + '">Xóa</button></div></td></tr>'; }).join('');
      return '<div class="tools"><span class="who">' + list.length + ' sản phẩm đã lên lịch</span><div class="tabs"><button class="btn red" data-act="add-drop">Lên lịch ra mắt</button>' + exportButtons() + '</div></div>' +
        table('<th>Sản phẩm sắp ra mắt</th><th>Ngày ra mắt</th><th>Số người nhận tin</th><th class="r">Thao tác</th>', rows, 'Chưa có lịch ra mắt.');
    },
    messages: async function () {
      var list = (await api('GET', '/admin/messages')).messages;
      cache.messages = list;
      if (!list.length) return '<div class="tools">' + exportButtons() + '</div><div class="card empty">Chưa có tin nhắn.</div>';
      return '<div class="tools">' + exportButtons() + '</div>' + list.map(function (m) {
        return '<div class="msg"><header><strong>' + esc(m.name) + ' <span class="sub">&lt;' + esc(m.email) + '&gt;</span></strong><span>' + pill(m.status) + ' <span class="sub">' + when(m.created_at) + '</span></span></header><p>' + esc(m.body) + '</p>' +
          '<div class="actions" style="justify-content:flex-start"><a class="btn ghost sm" style="text-decoration:none" href="mailto:' + encodeURIComponent(m.email) + '">Trả lời</a>' +
          '<button class="btn ghost sm" data-act="msg-toggle" data-id="' + m.id + '" data-status="' + (m.status === 'new' ? 'read' : 'new') + '">' + (m.status === 'new' ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc') + '</button>' +
          '<button class="btn ghost sm" data-act="msg-del" data-id="' + m.id + '">Xóa</button></div></div>';
      }).join('');
    },
    activity: async function () {
      var list = (await api('GET', '/admin/audit')).entries;
      cache.activity = list;
      return '<div class="tools">' + exportButtons() + '</div>' + table('<th>Thời gian</th><th>Người thực hiện</th><th>Hoạt động</th><th>Chi tiết</th>', list.map(function (a) { return '<tr><td>' + when(a.created_at) + '</td><td>' + esc(a.actor) + '</td><td><strong>' + esc(a.action) + '</strong></td><td>' + esc(a.detail) + '</td></tr>'; }).join(''), 'Chưa có hoạt động.');
    }
  };
  var titles = { dashboard: 'Tổng quan', reports: 'Thống kê báo cáo', products: 'Sản phẩm', orders: 'Đơn hàng', users: 'Người dùng', drops: 'Sắp ra mắt', messages: 'Tin nhắn', activity: 'Nhật ký hoạt động' };

  async function render() {
    $('title').textContent = titles[current];
    document.querySelectorAll('#nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === current); });
    var view = $('view');
    try {
      view.innerHTML = await views[current]();
      if (current === 'products') restoreProductFilters();
    }
    catch (e) {
      if (e.status === 401) { showLogin('Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại để xem báo cáo.'); return; }
      view.innerHTML = '<div class="card" role="alert">Không tải được dữ liệu: ' + esc(e.message || 'Vui lòng thử lại.') + '</div>';
    }
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
  var buttons = function (label) { return '<div class="modal-actions"><button type="button" class="btn ghost" data-cancel>Hủy</button><button class="btn red" type="submit">' + label + '</button></div>'; };
  var field = function (label, name, val, attrs) { return '<div class="field"><label>' + label + '</label><input name="' + name + '" value="' + esc(val) + '" ' + (attrs || '') + '></div>'; };
  var textArea = function (label, name, val, max) { return '<div class="field"><label>' + label + '</label><textarea name="' + name + '" maxlength="' + max + '">' + esc(val) + '</textarea></div>'; };
  var select = function (label, name, list, val) { return '<div class="field"><label>' + label + '</label><select name="' + name + '">' + list.map(function (o) { return '<option value="' + esc(o) + '" ' + (o === val ? 'selected' : '') + '>' + esc(viValue(o)) + '</option>'; }).join('') + '</select></div>'; };

  function productModal(p) {
    var isNew = !p; p = p || { name: '', name_vi: '', description_vi: '', sizes: '', sku: '', department: 'Men', category: 'Tops', price_cents: '', sale_price_cents: '', stock: '', status: 'active', tag: '', featured: 0 };
    var selectedTag = p.sale_price_cents != null && p.sale_price_cents < p.price_cents ? 'Sale' : p.tag;
    var initialPercent = p.sale_price_cents != null && p.price_cents ? Math.max(1, Math.min(99, Math.round((1 - p.sale_price_cents / p.price_cents) * 100))) : '';
    openModal('<h2 class="display">' + (isNew ? 'Thêm sản phẩm' : 'Sửa sản phẩm') + '</h2>' + field('Tên sản phẩm (tiếng Anh)', 'name', p.name, 'required maxlength="100"') +
      field('Tên sản phẩm (tiếng Việt)', 'nameVi', p.name_vi || '', 'maxlength="100"') +
      textArea('Mô tả', 'descriptionVi', p.description_vi || '', 2000) +
      (isNew ? field('SKU (không bắt buộc)', 'sku', '', 'maxlength="40"') : '') +
      select('Bộ phận', 'department', ['Men', 'Women', 'Kids', 'Unisex'], p.department) + select('Danh mục', 'category', ['Tops', 'Bottoms', 'Outerwear'], p.category) +
      field('Giá gốc (VNĐ)', 'price', p.price_cents === '' ? '' : String(Math.round(p.price_cents / 100)), 'type="number" min="0" max="500000000" step="1000" required') +
      '<div id="discountBox" class="field" style="display:' + (selectedTag === 'Sale' ? 'block' : 'none') + '"><label for="discountPercent">Mức giảm (%)</label><input id="discountPercent" name="discountPercent" type="number" min="1" max="99" step="1" value="' + initialPercent + '" placeholder="Ví dụ: 20"><small class="sub">Giá sau giảm: <strong id="discountPrice">—</strong></small></div>' +
      field('Kích cỡ (size, phân cách bằng dấu phẩy)', 'sizes', (p.sizes || '').toString().replace(/,/g, ', '), 'placeholder="S, M, L, XL hoặc 28, 30, 32" maxlength="100"') +
      field('Tồn kho', 'stock', p.stock, 'type="number" min="0" step="1" required') +
      select('Hiển thị trên cửa hàng', 'status', ['active', 'draft'], p.status) + select('Nhãn sản phẩm', 'tag', ['', 'New', 'Bestseller', 'Sale'], selectedTag) +
      '<label class="check"><input type="checkbox" name="featured" ' + (p.featured ? 'checked' : '') + '> Hiển thị nổi bật trên trang chủ</label>' + buttons('Lưu'),
      function (f) {
        var priceVnd = Number(f.price.value), percent = Number(f.discountPercent.value), salePriceCents = f.tag.value === 'Sale' ? Math.round(priceVnd * (100 - percent) / 100) * 100 : null;
        if (f.tag.value === 'Sale' && (!(priceVnd > 0) || !Number.isFinite(percent) || percent < 1 || percent > 99)) throw new Error('Vui lòng nhập giá gốc và mức giảm từ 1% đến 99%.');
        var d = { name: f.name.value, nameVi: f.nameVi.value, description: '', descriptionVi: f.descriptionVi.value, department: f.department.value, category: f.category.value, priceCents: Math.round(priceVnd * 100), salePriceCents: salePriceCents, stock: f.stock.value, status: f.status.value, tag: f.tag.value, sizes: f.sizes.value.split(',').map(function (size) { return size.trim(); }).filter(Boolean), featured: f.featured.checked };
        if (isNew) { if (f.sku.value.trim()) d.sku = f.sku.value; return api('POST', '/admin/products', d).then(function () { toast('Đã thêm sản phẩm'); }); }
        return api('PUT', '/admin/products/' + p.id, d).then(function () { toast('Đã cập nhật sản phẩm'); });
      });
    var form = $('modalRoot').querySelector('form'), tagSelect = form.elements.tag, priceInput = form.elements.price, percentInput = form.elements.discountPercent;
    function refreshDiscount() {
      var show = tagSelect.value === 'Sale';
      $('discountBox').style.display = show ? 'block' : 'none'; percentInput.required = show;
      var price = Number(priceInput.value), percent = Number(percentInput.value), out = $('discountPrice');
      out.textContent = price > 0 && percent > 0 && percent < 100 ? money(Math.round(price * (100 - percent) / 100) * 100) : '—';
    }
    tagSelect.addEventListener('change', refreshDiscount); priceInput.addEventListener('input', refreshDiscount); percentInput.addEventListener('input', refreshDiscount); refreshDiscount();
  }
  function userModal(u) {
    var isNew = !u; u = u || { username: '', name: '', email: '', role: 'customer', status: 'active' };
    openModal('<h2 class="display">' + (isNew ? 'Tạo người dùng' : 'Sửa người dùng') + '</h2>' +
      field('Tên đăng nhập', 'username', u.username, 'required maxlength="30" pattern="[a-zA-Z0-9_.]+" autocomplete="username"' + (isNew ? '' : '')) +
      field('Họ và tên', 'name', u.name, 'required maxlength="100"') +
      field('Email', 'email', u.email, 'type="email" required') +
      (isNew ? field('Mật khẩu (ít nhất 8 ký tự)', 'password', '', 'type="password" minlength="8" required autocomplete="new-password"') : '') +
      select('Vai trò', 'role', ['customer', 'staff', 'admin'], u.role) + (isNew ? '' : select('Trạng thái', 'status', ['active', 'disabled'], u.status)) +
      (isNew ? '' : '<p class="sub">Thay đổi thông tin sẽ đăng xuất tài khoản này khỏi các thiết bị đang dùng.</p>') + buttons('Lưu'),
      function (f) {
        if (isNew) return api('POST', '/admin/users', { username: f.username.value, name: f.name.value, email: f.email.value, password: f.password.value, role: f.role.value }).then(function () { toast('Đã tạo người dùng'); });
        return api('PUT', '/admin/users/' + u.id, { username: f.username.value, name: f.name.value, email: f.email.value, role: f.role.value, status: f.status.value }).then(function () { toast('Đã cập nhật người dùng'); });
      });
  }

  var MAX_PHOTO = 5 * 1024 * 1024, PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'], MAX_PHOTOS = 12;

  // multipart upload (no JSON header: the browser sets the boundary itself)
  async function uploadPhoto(productId, file, altText) {
    var fd = new FormData(); fd.append('file', file); fd.append('altText', altText);
    var res = await fetch('/api/admin/products/' + productId + '/images/upload', { method: 'POST', credentials: 'same-origin', body: fd });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      if (res.status === 401 && me) showLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      throw new Error(data.error || 'Tải ảnh lên không thành công');
    }
    return data;
  }

  async function uploadDropPhoto(dropId, file) {
    var fd = new FormData(); fd.append('file', file);
    var res = await fetch('/api/admin/drops/' + dropId + '/image', { method: 'POST', credentials: 'same-origin', body: fd });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      if (res.status === 401 && me) showLogin('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      throw new Error(data.error || 'Tải ảnh lên không thành công');
    }
    return data;
  }

  async function imagesModal(p) {
    var root = $('modalRoot');
    root.innerHTML = '<div class="overlay open" id="ov"><div class="modal open" role="dialog" aria-modal="true" style="width:min(560px,92vw);">' +
      '<button type="button" class="closebtn" id="imgClose" aria-label="Đóng" style="position:absolute;top:14px;right:14px;">\u2715</button>' +
      '<h2 class="display">' + esc(p.name_vi || p.name) + '</h2><p class="sub" style="margin:-10px 0 16px;">Có thể tải tối đa ' + MAX_PHOTOS + ' ảnh. Ảnh đầu tiên hoặc ảnh bìa sẽ hiển thị trên cửa hàng, kết quả tìm kiếm và giỏ hàng.</p>' +
      '<div id="imgList" class="imglist"></div>' +
      '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;">' +
      '<label class="dropzone" id="dropzone"><input type="file" id="imgFile" class="visually-hidden" accept="image/png,image/jpeg,image/webp" multiple>' +
      '<strong>Kéo ảnh vào đây hoặc bấm để chọn</strong><span class="sub">PNG, JPG hoặc WebP &middot; tối đa 5 MB mỗi ảnh</span></label>' +
      '<div class="field" style="margin-top:12px;"><label for="imgAlt">Mô tả ảnh cho trình đọc màn hình (không bắt buộc)</label><input id="imgAlt" maxlength="200" placeholder="' + esc(p.name_vi || p.name) + ', ảnh mặt trước"></div>' +
      '<div id="uploadStatus" class="uploadstatus" aria-live="polite"></div></div></div></div>';
    var count = 0;
    function close() { root.innerHTML = ''; render(); }
    $('imgClose').addEventListener('click', close);
    $('ov').addEventListener('mousedown', function (e) { if (e.target.id === 'ov') close(); });
    document.addEventListener('keydown', function esc1(e) { if (e.key === 'Escape') { root.innerHTML = ''; document.removeEventListener('keydown', esc1); } });

    async function reload() {
      var imgs = (await api('GET', '/admin/products/' + p.id + '/images')).images;
      count = imgs.length;
      $('imgList').innerHTML = imgs.length ? imgs.map(function (im, i) {
        var detail = im.size_bytes ? Math.max(1, Math.round(im.size_bytes / 1024)) + ' KB' : 'liên kết ngoài';
        return '<div class="imgrow"><img src="' + esc(im.src) + '" alt="" loading="lazy">' +
          '<div class="imgmeta"><div class="sub">' + (i === 0 ? '<strong>Ảnh bìa</strong>' : 'Ảnh ' + (i + 1)) + ' &middot; ' + detail + '</div><div class="sub">' + esc(im.alt_text || 'Chưa có mô tả') + '</div></div>' +
          '<div class="actions">' + (i !== 0 ? '<button type="button" class="btn ghost sm" data-cover="' + im.id + '">Đặt làm ảnh bìa</button>' : '') +
          '<button type="button" class="btn ghost sm" data-delimg="' + im.id + '">Xóa</button></div></div>';
      }).join('') : '<p class="sub">Chưa có ảnh. Tải ảnh lên bên dưới.</p>';
    }
    $('imgList').addEventListener('click', async function (e) {
      var t = e.target;
      if (t.dataset.cover) { await api('POST', '/admin/images/' + t.dataset.cover + '/cover'); await reload(); toast('Đã cập nhật ảnh bìa'); }
      else if (t.dataset.delimg) { if (confirm('Xóa ảnh này? Tệp ảnh cũng sẽ bị xóa khỏi kho lưu trữ.')) { await api('DELETE', '/admin/images/' + t.dataset.delimg); await reload(); toast('Đã xóa ảnh'); } }
    });

    async function handleFiles(fileList) {
      var files = Array.prototype.slice.call(fileList), box = $('uploadStatus'), alt = $('imgAlt').value.trim() || p.name, ok = 0;
      box.innerHTML = '';
      for (var i = 0; i < files.length; i++) {
        var f = files[i], line = document.createElement('div'); line.className = 'upl'; box.appendChild(line);
        var say = function (cls, text) { line.className = 'upl ' + cls; line.textContent = text; };
        if (PHOTO_TYPES.indexOf(f.type) === -1) { say('bad', f.name + ' \u2014 chỉ chấp nhận ảnh PNG, JPG hoặc WebP'); continue; }
        if (f.size > MAX_PHOTO) { say('bad', f.name + ' \u2014 dung lượng vượt quá 5 MB'); continue; }
        if (count >= MAX_PHOTOS) { say('bad', f.name + ' \u2014 sản phẩm đã có đủ ' + MAX_PHOTOS + ' ảnh'); continue; }
        say('', f.name + ' \u2014 đang tải lên…');
        try { await uploadPhoto(p.id, f, alt); count++; ok++; say('good', f.name + ' \u2014 đã thêm'); await reload(); }
        catch (err) { say('bad', f.name + ' \u2014 ' + err.message); }
      }
      if (ok) toast(ok === 1 ? 'Đã tải ảnh lên' : 'Đã tải lên ' + ok + ' ảnh');
      $('imgFile').value = '';
    }
    $('imgFile').addEventListener('change', function () { if (this.files.length) handleFiles(this.files); });
    var dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
    await reload();
  }

  function dropModal(existing) {
    var d = existing || { name: '', name_vi: '', description_vi: '', release_date: '', image_url: '' };
    var isNew = !existing, createdId = null;
    var preview = d.image_url ? '<img src="' + esc(d.image_url) + '" alt="" style="display:block;max-width:100%;max-height:180px;border-radius:8px;margin-bottom:10px;">' : '';
    openModal('<h2 class="display">' + (isNew ? 'Lên lịch sản phẩm ra mắt' : 'Sửa sản phẩm sắp ra mắt') + '</h2>' +
      field('Tên sản phẩm (tiếng Anh)', 'name', d.name, 'required') + field('Tên sản phẩm (tiếng Việt)', 'nameVi', d.name_vi || '', 'required') +
      field('Ngày ra mắt', 'date', d.release_date, 'required') + field('Mô tả', 'descVi', d.description_vi || '', 'maxlength="500"') +
      '<div class="field"><label for="dropImage">Hình ảnh sản phẩm</label>' + preview + '<input id="dropImage" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp">' +
      '<small class="sub">PNG, JPG hoặc WebP; tối đa 5 MB. Chọn ảnh mới để thay ảnh hiện tại.</small></div>' + buttons(isNew ? 'Lên lịch' : 'Lưu'),
      async function (f) {
        var payload = { name: f.name.value, nameVi: f.nameVi.value, releaseDate: f.date.value, description: '', descriptionVi: f.descVi.value };
        var saved;
        if (isNew && !createdId) { saved = await api('POST', '/admin/drops', payload); createdId = saved.id; }
        else { var saveId = isNew ? createdId : d.id; await api('PUT', '/admin/drops/' + saveId, payload); saved = { id: saveId }; }
        var file = f.imageFile.files && f.imageFile.files[0];
        if (file) await uploadDropPhoto(saved.id, file);
        toast(isNew ? 'Đã lên lịch ra mắt' : 'Đã cập nhật sản phẩm ra mắt');
      });
    var fileInput = $('dropImage');
    if (fileInput) fileInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var old = this.parentNode.querySelector('img');
      if (old) old.remove();
      var img = document.createElement('img'); img.alt = ''; img.style.cssText = 'display:block;max-width:100%;max-height:180px;border-radius:8px;margin-bottom:10px;';
      img.src = URL.createObjectURL(file); this.parentNode.insertBefore(img, this);
    });
  }

  // ---------- events ----------
  $('nav').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b && validViews.indexOf(b.dataset.view) !== -1) { current = b.dataset.view; history.replaceState(null, '', location.pathname + location.search + '#' + current); render(); } });
  async function run(promise, msg) { try { await promise; toast(msg); render(); } catch (err) { toast(err.message); render(); } }

  function filterProducts() {
    var search = $('productSearch'); if (!search) return;
    var term = search.value.trim().toLowerCase();
    var department = $('productDepartmentFilter').value, category = $('productCategoryFilter').value, stock = $('productStockFilter').value;
    productFilterState = { search: search.value, department: department, category: category, stock: stock };
    var rows = Array.prototype.slice.call($('view').querySelectorAll('tbody tr[data-search]'));
    var visible = 0;
    rows.forEach(function (row) {
      var matches = (!term || row.dataset.search.indexOf(term) !== -1) &&
        (!department || row.dataset.department === department) &&
        (!category || row.dataset.category === category) &&
        (!stock || row.dataset.stockState === stock);
      row.hidden = !matches;
      if (matches) visible++;
    });
    var count = $('productResultCount');
    if (count) count.textContent = visible === cache.products.length ? cache.products.length + ' sản phẩm' : visible + ' / ' + cache.products.length + ' sản phẩm';
  }
  function restoreProductFilters() {
    var search = $('productSearch'); if (!search) return;
    search.value = productFilterState.search;
    $('productDepartmentFilter').value = productFilterState.department;
    $('productCategoryFilter').value = productFilterState.category;
    $('productStockFilter').value = productFilterState.stock;
    filterProducts();
  }

  $('view').addEventListener('click', async function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.dataset.act, id = t.dataset.id;
    if (act === 'export-excel' || act === 'export-pdf') {
      if (current === 'orders') {
        try { cache.orders = (await api('GET', '/admin/orders?export=1' + (orderFilter === 'all' ? '' : '&status=' + encodeURIComponent(orderFilter)))).orders; }
        catch (err) { toast(err.message || 'Không tải được dữ liệu đơn hàng để xuất.'); return; }
      }
      if (act === 'export-excel') exportExcel(); else exportPdf();
      return;
    }
    if (act === 'run-report') {
      var from = $('reportFrom').value, to = $('reportTo').value;
      if (!from || !to || from > to) { toast('Vui lòng chọn khoảng ngày hợp lệ.'); return; }
      reportRange = { from: from, to: to };
      t.disabled = true; t.textContent = 'Đang tải…';
      $('view').innerHTML = '<div class="card" role="status">Đang tải báo cáo ' + esc(from) + ' – ' + esc(to) + '…</div>';
      await render(); return;
    }
    if (act === 'add-product') productModal(null);
    else if (act === 'edit-product') productModal(cache.products.find(function (p) { return p.id == id; }));
    else if (act === 'images-product') imagesModal(cache.products.find(function (p) { return p.id == id; }));
    else if (act === 'del-product') { var p = cache.products.find(function (x) { return x.id == id; }); if (confirm('Xóa sản phẩm “' + (p.name_vi || p.name) + '”? Chi tiết sản phẩm trong đơn cũ vẫn được giữ.')) run(api('DELETE', '/admin/products/' + id), 'Đã xóa sản phẩm'); }
    else if (act === 'filter') { orderFilter = id; render(); }
    else if (act === 'view-order') {
      var d = await api('GET', '/admin/orders/' + id);
      openModal('<h2 class="display">' + esc(d.order.order_no) + '</h2><p class="sub">' + esc(d.order.name) + ' &middot; ' + esc(d.order.email) + ' &middot; ' + when(d.order.created_at) + '</p>' +
        (d.order.phone ? '<p class="sub">Số điện thoại: ' + esc(d.order.phone) + '</p>' : '') +
        '<p class="sub">' + (d.order.ship_address ? 'Giao đến: ' + esc(d.order.ship_address) : 'Chưa có địa chỉ giao hàng.') + '</p><p class="sub">Thanh toán: ' + (d.order.payment_method === 'bank_qr' ? 'Chuyển khoản QR' : d.order.payment_method === 'vnpay' ? 'VNPAY' : 'Tiền mặt khi nhận hàng') + ' &middot; ' + esc(viValue(d.order.payment_status || 'pending')) + '</p>' + (d.order.payment_method === 'bank_qr' && d.order.payment_status === 'pending' ? '<p class="sub">Chỉ xác nhận đã thanh toán sau khi đối chiếu giao dịch thực tế.</p>' : '') + '<label class="field"><span>Trạng thái thanh toán</span><select data-act="payment-status" data-id="' + d.order.id + '" data-order-status="' + esc(d.order.status) + '"><option value="pending" ' + (d.order.payment_status === 'pending' ? 'selected' : '') + '>Chờ xử lý</option><option value="paid" ' + (d.order.payment_status === 'paid' ? 'selected' : '') + '>Đã thanh toán</option><option value="refunded" ' + (d.order.payment_status === 'refunded' ? 'selected' : '') + '>Đã hoàn tiền</option></select></label><ul class="items">' +
        d.items.map(function (i) { return '<li><span>' + i.qty + ' &times; ' + esc(i.name_vi || i.name) + (i.size ? ' · Size ' + esc(i.size) : '') + '</span><strong>' + money(i.unit_price_cents * i.qty) + '</strong></li>'; }).join('') + '<li><strong>Tổng cộng</strong><strong>' + money(d.order.total_cents) + '</strong></li></ul>' +
        '<div class="modal-actions"><button type="button" class="btn" data-cancel>Đóng</button></div>', function () {});
    }
    else if (act === 'add-drop') dropModal(null);
    else if (act === 'edit-drop') api('GET', '/admin/drops').then(function (r) { var d = r.drops.find(function (x) { return x.id === +id; }); if (d) dropModal(d); });
    else if (act === 'del-drop') { if (confirm('Xóa sản phẩm ra mắt và danh sách nhận thông báo?')) run(api('DELETE', '/admin/drops/' + id), 'Đã xóa sản phẩm ra mắt'); }
    else if (act === 'msg-toggle') run(api('PUT', '/admin/messages/' + id, { status: t.dataset.status }), 'Đã cập nhật');
    else if (act === 'msg-del') { if (confirm('Xóa tin nhắn này?')) run(api('DELETE', '/admin/messages/' + id), 'Đã xóa tin nhắn'); }
    else if (act === 'add-user') userModal(null);
    else if (act === 'edit-user') userModal(cache.users.find(function (u) { return u.id == id; }));
    else if (act === 'reset-pw') {
      var u = cache.users.find(function (x) { return x.id == id; });
      openModal('<h2 class="display">Đặt lại mật khẩu</h2><p class="sub">Đặt mật khẩu mới cho tài khoản ' + esc(u.username) + '. Mật khẩu hiện tại được mã hóa nên không thể xem. Tài khoản sẽ bị đăng xuất khỏi tất cả thiết bị.</p>' +
        field('Mật khẩu mới (ít nhất 8 ký tự)', 'password', '', 'type="password" minlength="8" required autocomplete="new-password"') + buttons('Đặt lại mật khẩu'),
        function (f) { return api('POST', '/admin/users/' + id + '/password', { password: f.password.value }).then(function () { toast('Đã đặt lại mật khẩu'); }); });
    }
    else if (act === 'del-user') { var du = cache.users.find(function (x) { return x.id == id; }); if (confirm('Xóa tài khoản ' + du.username + '? Lịch sử đơn hàng vẫn được lưu.')) run(api('DELETE', '/admin/users/' + id), 'Đã xóa người dùng'); }
  });
  $('view').addEventListener('input', function (e) {
    var field = e.target;
    if (field.id === 'productSearch') { filterProducts(); return; }
    if (field.id !== 'orderSearch') return;
    var term = field.value.trim().toLowerCase();
    $('view').querySelectorAll('tbody tr[data-search]').forEach(function (row) { row.hidden = term && row.dataset.search.indexOf(term) === -1; });
  });
  $('view').addEventListener('change', function (e) {
    if (['productDepartmentFilter', 'productCategoryFilter', 'productStockFilter'].indexOf(e.target.id) !== -1) { filterProducts(); return; }
    if (e.target.dataset.act === 'order-status') run(api('PUT', '/admin/orders/' + e.target.dataset.id, { status: e.target.value }), 'Đã cập nhật đơn hàng');
    if (e.target.dataset.act === 'payment-status') run(api('PUT', '/admin/orders/' + e.target.dataset.id, { status: e.target.dataset.orderStatus, paymentStatus: e.target.value }), 'Đã cập nhật trạng thái thanh toán');
  });

  // ---------- boot ----------
  async function restoreAdminSession() {
    $('login').hidden = true;
    $('authLoading').hidden = false;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var r = await api('GET', '/auth/me?scope=admin');
        if (r.user && r.user.role !== 'customer') showApp(r.user);
        else showLogin();
        return;
      } catch (err) {
        if (attempt === 1) showLogin('Không thể kiểm tra phiên đăng nhập. Vui lòng thử đăng nhập lại.');
        else await new Promise(function (resolve) { setTimeout(resolve, 450); });
      }
    }
  }
  restoreAdminSession();
})();
