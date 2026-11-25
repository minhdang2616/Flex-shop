document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var qs = new URLSearchParams(location.search);
  var googleMode = qs.get('google') === '1';
  var next = (function () {
    var n = qs.get('next') || '/';
    return n.charAt(0) === '/' && n.charAt(1) !== '/' && !/[\\\u0000-\u001f]/.test(n) ? n : '/';
  })();

  var form = $('regForm'), errBox = $('regError'), submit = $('regSubmit');
  var pwInputs = [$('rPassword'), $('rConfirm')];
  // Current provincial-level administrative units, effective from June 2025.
  var provinces = [
    'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
    'Gia Lai', 'Hà Tĩnh', 'Hưng Yên', 'Khánh Hòa', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
    'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh',
    'Thái Nguyên', 'Thanh Hóa', 'Cần Thơ', 'Đà Nẵng', 'Hà Nội', 'Hải Phòng', 'Hồ Chí Minh', 'Huế',
    'Tuyên Quang', 'Vĩnh Long'
  ];
  var provinceList = $('vietnamProvinces');
  provinces.forEach(function (name) {
    var option = document.createElement('option'); option.value = name; provinceList.appendChild(option);
  });

  function normalizedPhone(value, callingCode) {
    var digits = value.replace(/\D/g, '').slice(0, 10);
    // Customers enter their usual 10-digit number; international format omits its leading 0.
    return callingCode + (digits.charAt(0) === '0' ? digits.slice(1) : digits);
  }

  async function call(method, path, body) {
    var res = await fetch('/api' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Something went wrong'); e.status = res.status; throw e; }
    return data;
  }
  function showError(msg) { errBox.textContent = msg; if (msg) errBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function setFieldError(input, message) {
    var wrap = input.closest('.field'); if (!wrap) return;
    var error = wrap.querySelector('.field-error');
    if (!error) { error = document.createElement('small'); error.className = 'field-error'; wrap.appendChild(error); }
    error.textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) input.setAttribute('aria-describedby', error.id || (error.id = input.id + 'Error'));
    else input.removeAttribute('aria-describedby');
  }
  function fieldMessage(input) {
    var value = input.value.trim();
    switch (input.id) {
      case 'rUsername':
        if (!value) return 'Vui lòng nhập tên đăng nhập.';
        if (value.length < 3 || value.length > 30) return 'Tên đăng nhập phải có từ 3 đến 30 ký tự.';
        if (!/^[a-zA-Z0-9_.]+$/.test(value)) return 'Chỉ dùng chữ không dấu, số, dấu gạch dưới (_) hoặc dấu chấm (.).';
        break;
      case 'rPassword':
        if (!value && !googleMode) return 'Vui lòng nhập mật khẩu.';
        if (value && value.length < 8) return 'Mật khẩu cần có ít nhất 8 ký tự.';
        if (value.length > 128) return 'Mật khẩu không được vượt quá 128 ký tự.';
        break;
      case 'rConfirm':
        if (!value && !googleMode) return 'Vui lòng nhập lại mật khẩu.';
        if (value !== $('rPassword').value) return 'Mật khẩu nhập lại chưa khớp.';
        break;
      case 'rName':
        if (!value) return 'Vui lòng nhập họ và tên.';
        if (value.length > 100) return 'Họ và tên không được vượt quá 100 ký tự.';
        break;
      case 'rEmail':
        if (!value) return 'Vui lòng nhập email.';
        if (!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/.test(value)) return 'Email chưa đúng định dạng.';
        break;
      case 'rPhone':
        if (!value) return 'Vui lòng nhập số điện thoại.';
        if (!/^0\d{9}$/.test(value)) return 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.';
        break;
      case 'rAddress':
        if (!value) return 'Vui lòng nhập địa chỉ.';
        if (value.length < 3) return 'Địa chỉ cần có ít nhất 3 ký tự.';
        break;
      case 'rCity':
        if (!value) return 'Vui lòng nhập tỉnh hoặc thành phố.';
        if (!provinces.some(function (name) { return name.toLocaleLowerCase('vi') === value.toLocaleLowerCase('vi'); })) return 'Vui lòng chọn tỉnh hoặc thành phố trong danh sách gợi ý.';
        break;
    }
    return '';
  }
  var inputs = Array.prototype.slice.call(form.querySelectorAll('input'));
  inputs.forEach(function (input) {
    input.addEventListener('blur', function () { setFieldError(input, fieldMessage(input)); });
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') setFieldError(input, fieldMessage(input));
      if (input.id === 'rPassword' && $('rConfirm').getAttribute('aria-invalid') === 'true') setFieldError($('rConfirm'), fieldMessage($('rConfirm')));
    });
  });
  $('rPhone').addEventListener('input', function () {
    var digits = $('rPhone').value.replace(/\D/g, '').slice(0, 10);
    if (digits !== $('rPhone').value) $('rPhone').value = digits;
  });
  function validateForm() {
    var first = null;
    inputs.forEach(function (input) {
      if (input.disabled) return;
      var message = fieldMessage(input); setFieldError(input, message);
      if (message && !first) first = input;
    });
    if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return !first;
  }
  function serverError(err) {
    var message = err.message || '';
    if (/username is already taken/i.test(message)) { setFieldError($('rUsername'), 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.'); $('rUsername').focus(); return; }
    if (/conflicts with an existing email/i.test(message)) { setFieldError($('rEmail'), 'Email này đã được sử dụng. Vui lòng kiểm tra hoặc dùng email khác.'); $('rEmail').focus(); return; }
    if (/already has an account here/i.test(message)) { showError('Tài khoản Google này đã được đăng ký. Hãy chọn đăng nhập bằng Google.'); return; }
    if (/valid email/i.test(message)) { setFieldError($('rEmail'), 'Email chưa đúng định dạng.'); $('rEmail').focus(); return; }
    if (/phone number/i.test(message)) { setFieldError($('rPhone'), 'Số điện thoại chưa hợp lệ.'); $('rPhone').focus(); return; }
    if (/username/i.test(message)) { setFieldError($('rUsername'), 'Tên đăng nhập không hợp lệ. Vui lòng kiểm tra lại.'); $('rUsername').focus(); return; }
    if (/password/i.test(message)) { setFieldError($('rPassword'), 'Mật khẩu cần có từ 8 đến 128 ký tự.'); $('rPassword').focus(); return; }
    if (/address/i.test(message)) { setFieldError($('rAddress'), 'Địa chỉ cần có từ 3 đến 200 ký tự.'); $('rAddress').focus(); return; }
    if (/city/i.test(message)) { setFieldError($('rCity'), 'Tên tỉnh hoặc thành phố cần có từ 2 đến 100 ký tự.'); $('rCity').focus(); return; }
    if (/name/i.test(message)) { setFieldError($('rName'), 'Vui lòng nhập họ và tên hợp lệ.'); $('rName').focus(); return; }
    showError('Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại.');
  }

  $('googleSignup').href = '/api/auth/google/start?next=' + encodeURIComponent(next);

  // Switch the page into "finish your Google sign-up" mode; password is optional and email comes from Google.
  function enterGoogleMode(info) {
    $('googleBlock').hidden = true; $('loginPrompt').hidden = true; $('pwFields').hidden = false;
    pwInputs.forEach(function (i) { i.disabled = false; i.required = false; });
    $('regTitle').textContent = 'Hoàn tất đăng ký';
    $('regLead').textContent = 'Bạn đang đăng ký bằng Google. Hãy bổ sung thông tin để hoàn tất tài khoản.';
    $('rName').value = info.name || ''; $('rEmail').value = info.email || ''; $('rEmail').readOnly = true;
    var passwordStars = $('pwFields').querySelectorAll('.required-mark'); Array.prototype.forEach.call(passwordStars, function (star) { star.hidden = true; });
    var hint = document.createElement('small'); hint.textContent = 'Email được lấy từ tài khoản Google của bạn.'; $('rEmail').parentNode.appendChild(hint);
    submit.textContent = 'Hoàn tất đăng ký';
    var modeHelp = document.createElement('p'); modeHelp.className = 'altlink';
    var switchLink = document.createElement('a'); switchLink.href = 'register.html' + (next && next !== '/' ? '?next=' + encodeURIComponent(next) : '');
    switchLink.textContent = 'Muốn tạo tài khoản thông thường?';
    modeHelp.appendChild(switchLink); $('regLead').insertAdjacentElement('afterend', modeHelp);
    var passwordHelp = document.createElement('small'); passwordHelp.className = 'field-hint';
    passwordHelp.textContent = 'Không bắt buộc: đặt mật khẩu để có thể đăng nhập bằng tên tài khoản. Để trống cả hai ô nếu chỉ muốn đăng nhập bằng Google.';
    $('pwFields').parentNode.insertBefore(passwordHelp, $('pwFields').nextSibling);
  }

  if (googleMode) {
    call('GET', '/auth/google/pending').then(enterGoogleMode).catch(function (err) {
      googleMode = false; showError('Phiên đăng ký Google đã hết hạn. Vui lòng thử đăng ký lại.');
    });
  } else {
    call('GET', '/auth/me').then(function (r) {
      if (r.user) { form.hidden = true; $('googleBlock').hidden = true; $('regSigned').hidden = false; $('regSigned').querySelector('a').href = next; }
    }).catch(function () {});
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault(); showError('');
    if (!validateForm()) return;
    var body = {
      username: $('rUsername').value, name: $('rName').value, email: $('rEmail').value,
      phone: normalizedPhone($('rPhone').value, $('rPhoneCode').value), address: $('rAddress').value, city: provinces.find(function (name) { return name.toLocaleLowerCase('vi') === $('rCity').value.trim().toLocaleLowerCase('vi'); }) || $('rCity').value.trim()
    };
    if (!googleMode || $('rPassword').value) body.password = $('rPassword').value;
    submit.disabled = true; var label = submit.textContent; submit.textContent = 'Đang tạo tài khoản…';
    try {
      await call('POST', googleMode ? '/auth/google/complete' : '/auth/register', body);
      location.href = next;                           // the shared script then finishes whatever they were doing (e.g. adding to their bag)
    } catch (err) {
      serverError(err); submit.disabled = false; submit.textContent = label;
    }
  });
});
