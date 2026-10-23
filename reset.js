/* QwickSignal account actions page: password reset and email verification links from Firebase Authentication.
   Set as the custom action URL in Firebase console -> Authentication -> Templates. Talks to the same public
   Identity Toolkit endpoints app.js uses; the one-time code in the link is the only credential. */
(function () {
  'use strict';
  const API_KEY = 'AIzaSyBTix4TmUn9oVQrX0ByPra4FissOfAHefY';
  const IDT = 'https://identitytoolkit.googleapis.com/v1/accounts:';
  const $ = id => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const mode = q.get('mode'), code = q.get('oobCode');
  // The code must not linger in history or be sent onward as a referrer once read.
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }

  function show(id) { ['loading', 'reset', 'done', 'bad'].forEach(s => { $(s).hidden = s !== id; }); }
  function fail(kind) {
    const copy = {
      EXPIRED_OOB_CODE: ['This link has expired', 'Reset links work once and for one hour. Ask for a new one in QwickSignal: Settings, Account, Forgot password.'],
      INVALID_OOB_CODE: ['This link has already been used', 'Each link works once. If you still need to change your password, ask for a new link in QwickSignal: Settings, Account, Forgot password.'],
      USER_DISABLED: ['This account is turned off', 'Contact QwickSignal support from Settings, Feedback & support.'],
      USER_NOT_FOUND: ['We couldn’t find this account', 'It may have been deleted. You can create a new account from Settings, Account.'],
      NETWORK: ['No connection', 'Check your internet connection and open the link again.'],
      MODE: ['This link isn’t complete', 'Open the link straight from the email, or ask for a new one in QwickSignal.']
    }[kind] || ['Something went wrong', 'Open the link from the email again, or ask for a new one in QwickSignal: Settings, Account, Forgot password.'];
    $('badTitle').textContent = copy[0]; $('badText').textContent = copy[1];
    show('bad');
  }
  async function call(method, body) {
    let r;
    try {
      r = await fetch(IDT + method + '?key=' + API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) { return { error: 'NETWORK' }; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: String(((j.error || {}).message) || 'UNKNOWN').split(' ')[0] };
    return j;
  }

  async function startReset() {
    const res = await call('resetPassword', { oobCode: code });     // without a new password this only checks the code
    if (res.error) return fail(res.error);
    $('who').textContent = res.email || 'your account';
    show('reset');
    $('pw').focus();
  }
  function check() {
    const a = $('pw').value, b = $('pw2').value;
    const len = a.length >= 8, mix = /[A-Za-z]/.test(a) && /\d/.test(a), same = !!a && a === b;
    $('rLen').classList.toggle('met', len); $('rMix').classList.toggle('met', mix); $('rSame').classList.toggle('met', same);
    $('save').disabled = !(len && mix && same);
    return len && mix && same;
  }
  ['pw', 'pw2'].forEach(id => $(id).addEventListener('input', () => { $('formErr').hidden = true; check(); }));
  document.querySelectorAll('.show').forEach(b => b.addEventListener('click', () => {
    const inp = $(b.dataset.for), on = inp.type === 'password';
    inp.type = on ? 'text' : 'password'; b.textContent = on ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', String(on));
  }));
  $('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!check()) return;
    const btn = $('save'); btn.disabled = true; btn.textContent = 'Updating…';
    const res = await call('resetPassword', { oobCode: code, newPassword: $('pw').value });
    if (res.error === 'WEAK_PASSWORD') {
      $('formErr').textContent = 'Choose a stronger password.'; $('formErr').hidden = false;
      btn.textContent = 'Update password'; check(); return;
    }
    if (res.error) return fail(res.error);
    show('done'); $('foot').hidden = true;
  });

  async function verifyEmail() {
    const res = await call('update', { oobCode: code });
    if (res.error) return fail(res.error);
    $('doneTitle').textContent = 'Email verified';
    $('doneText').textContent = (res.email ? res.email + ' is confirmed. ' : '') + 'You can close this page and carry on in QwickSignal.';
    $('foot').hidden = true;
    show('done');
  }

  if (!code) fail('MODE');
  else if (mode === 'resetPassword') startReset();
  else if (mode === 'verifyEmail') verifyEmail();
  else fail('MODE');
})();
