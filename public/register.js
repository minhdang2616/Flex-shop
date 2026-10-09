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

  async function call(method, path, body) {
    var res = await fetch('/api' + path, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || 'Something went wrong'); e.status = res.status; throw e; }
    return data;
  }
  function showError(msg) { errBox.textContent = msg; if (msg) errBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  $('googleSignup').href = '/api/auth/google/start?next=' + encodeURIComponent(next);

  // Switch the page into "finish your Google sign-up" mode: no password, email comes from Google.
  function enterGoogleMode(info) {
    $('googleBlock').hidden = true; $('loginPrompt').hidden = true; $('pwFields').hidden = true;
    pwInputs.forEach(function (i) { i.disabled = true; i.required = false; });
    $('regTitle').textContent = 'Almost there';
    $('regLead').textContent = 'You\u2019re signing up with Google. Tell us a bit more to finish creating your account.';
    $('rName').value = info.name || ''; $('rEmail').value = info.email || ''; $('rEmail').readOnly = true;
    submit.textContent = 'Finish sign-up';
  }

  if (googleMode) {
    call('GET', '/auth/google/pending').then(enterGoogleMode).catch(function (err) {
      googleMode = false; showError(err.message);
    });
  } else {
    call('GET', '/auth/me').then(function (r) {
      if (r.user) { form.hidden = true; $('googleBlock').hidden = true; $('regSigned').hidden = false; $('regSigned').querySelector('a').href = next; }
    }).catch(function () {});
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault(); showError('');
    if (!googleMode && $('rPassword').value !== $('rConfirm').value) { showError('The two passwords do not match.'); $('rConfirm').focus(); return; }
    var body = {
      username: $('rUsername').value, name: $('rName').value, email: $('rEmail').value,
      phone: $('rPhone').value, address: $('rAddress').value, city: $('rCity').value, postalCode: $('rPostal').value, country: $('rCountry').value
    };
    if (!googleMode) body.password = $('rPassword').value;
    submit.disabled = true; var label = submit.textContent; submit.textContent = 'Please wait...';
    try {
      await call('POST', googleMode ? '/auth/google/complete' : '/auth/register', body);
      location.href = next;                           // the shared script then finishes whatever they were doing (e.g. adding to their bag)
    } catch (err) {
      showError(err.message); submit.disabled = false; submit.textContent = label;
    }
  });
});
