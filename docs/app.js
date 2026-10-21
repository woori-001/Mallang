// 말랑메모 모바일 웹앱
(function () {
  'use strict';
  const C = window.MallangCloud;
  const { SKINS, FONTS, MARKS, MARK_NAMES, MARK_COLORS, EVENT_COLORS, ICONS, grad, rgba, esc, dateKey, applyTheme, markSvg, memoOrder } = window.M;
  const $ = (id) => document.getElementById(id);
  const TRASH_DAYS = 7, DAY = 86400000;
  const LS_STATE = 'mallang.state.v1', LS_SESSION = 'mallang.session.v1', LS_PREFS = 'mallang.prefs.v1';
  const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const EV_ORDER = ['lav', 'mint', 'pink', 'sky'];
  const CONTENT = ['title', 'text', 'items', 'type', 'mark', 'markColor', 'slot', 'ord'];

  const icon = (path, size, sw) => '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  const I = {
    memo: icon('<rect x="4" y="3.5" width="16" height="17" rx="4"/><path d="M8 9h8M8 13h8M8 17h5"/>'),
    cal: icon('<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    trash: icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    set: icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 22, 1.8),
    plus: icon('<path d="M12 5v14M5 12h14"/>', 26, 2.4),
    back: icon('<path d="M15 5l-7 7 7 7"/>', 22, 2.2),
    sync: icon('<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3"/>', 20, 2),
    left: icon('<path d="M15 5l-7 7 7 7"/>', 16, 2.2),
    right: icon('<path d="M9 5l7 7-7 7"/>', 16, 2.2),
    x: icon('<path d="M6 6l12 12M18 6L6 18"/>', 16, 2.2),
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>'
  };

  window.M.guardHTML($('list'), $('trashList'), $('grid'), $('evList'), $('skins'), $('fonts'));

  // ───────── 저장 ─────────
  function blankState() {
    return { memos: [], trash: [], tombs: [], events: {}, evMeta: {}, cursor: null };
  }
  function loadJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  let st = Object.assign(blankState(), loadJSON(LS_STATE, {}));
  let prefs = Object.assign({ skin: 'lav', font: 'gowun' }, loadJSON(LS_PREFS, {}));
  let saveT = null;
  function saveState() { clearTimeout(saveT); saveT = setTimeout(saveStateNow, 200); }
  function saveStateNow() { clearTimeout(saveT); try { localStorage.setItem(LS_STATE, JSON.stringify(st)); } catch (e) { toast('휴대폰 저장 공간이 부족해요'); } }
  const savePrefs = () => { try { localStorage.setItem(LS_PREFS, JSON.stringify(prefs)); } catch (e) { /* 무시 */ } };

  // 잠금 열쇠는 꺼낼 수 없는 형태로 IndexedDB에 보관
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('mallang', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function kv(mode, k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite');
      const s = tx.objectStore('kv');
      const r = mode === 'get' ? s.get(k) : mode === 'set' ? s.put(v, k) : s.delete(k);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  // ───────── 계정 ─────────
  const holder = { session: null, onSession: (s) => { session = { ...session, ...s }; localStorage.setItem(LS_SESSION, JSON.stringify(session)); } };
  let session = loadJSON(LS_SESSION, null);
  let key = null;
  const sync = { state: 'idle', last: 0, msg: '' };

  async function boot() {
    applyPrefs();
    if (session && session.refresh) {
      try { key = await kv('get', 'key'); } catch (e) { key = null; }
      if (key) {
        holder.session = { access: session.access, refresh: session.refresh, exp: session.exp || 0, userId: session.userId };
        showApp();
        autoPurge();
        scheduleSync(100);
        return;
      }
    }
    showAuth();
  }

  let authMode = 'login', authBusy = false;
  function showAuth() {
    $('app').hidden = true;
    $('editor').hidden = true;
    $('auth').hidden = false;
    renderAuth();
  }
  function renderAuth() {
    $('modeLogin').classList.toggle('on', authMode === 'login');
    $('modeSignup').classList.toggle('on', authMode === 'signup');
    $('modeLogin').setAttribute('aria-selected', String(authMode === 'login'));
    $('modeSignup').setAttribute('aria-selected', String(authMode === 'signup'));
    $('aPw2Wrap').hidden = authMode !== 'signup';
    $('aWarn').hidden = authMode !== 'signup';
    $('aPw').autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
    $('aGo').disabled = authBusy;
    $('aGo').textContent = authBusy ? (authMode === 'signup' ? '가입하는 중…' : '로그인하는 중…') : (authMode === 'signup' ? '가입하고 시작하기' : '로그인');
  }
  $('modeLogin').onclick = () => { authMode = 'login'; $('aMsg').textContent = ''; renderAuth(); };
  $('modeSignup').onclick = () => { authMode = 'signup'; $('aMsg').textContent = ''; renderAuth(); };
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authBusy) return;
    const u = C.normUser($('aUser').value);
    const pw = $('aPw').value;
    const say = (t) => { $('aMsg').textContent = t; };
    if (!C.validUser(u)) return say('아이디는 영어 소문자·숫자·밑줄(_)로 3~20자예요');
    if (pw.length < 8) return say('비밀번호는 8자 이상으로 정해 주세요');
    if (authMode === 'signup' && pw !== $('aPw2').value) return say('비밀번호 확인이 서로 달라요');
    authBusy = true; say(''); renderAuth();
    try {
      const k = await C.deriveKeys(u, pw);
      if (authMode === 'signup') await C.signup(u, k.secret);
      const s = await C.login(u, k.secret);
      key = await C.importKey(k.keyRaw, false);
      await kv('set', 'key', key);
      session = { username: u, ...s };
      localStorage.setItem(LS_SESSION, JSON.stringify(session));
      holder.session = s;
      st = blankState();
      saveStateNow();
      view = 'memos';
      $('aPw').value = ''; $('aPw2').value = '';
      showApp();
      sync.state = 'syncing';
      renderSync();
      await runSync();
    } catch (err) {
      say(C.message(err));
    } finally {
      authBusy = false;
      renderAuth();
    }
  });

  async function logout(silent) {
    if (!silent) {
      const dirty = dirtyList().length;
      const desc = dirty ? '아직 서버에 올라가지 않은 변경이 ' + dirty + '개 있어요. 그래도 로그아웃하면 이 휴대폰에서 사라져요.' : '이 휴대폰에 저장된 메모가 지워져요. 메모는 서버와 PC에 그대로 있어요.';
      if (!(await ask('로그아웃할까요?', desc, '로그아웃'))) return;
    }
    clearTimeout(syncT);
    try { await kv('del', 'key'); } catch (e) { /* 무시 */ }
    key = null; holder.session = null;
    const name = session && session.username;
    session = null;
    clearTimeout(saveT);
    st = blankState();
    localStorage.removeItem(LS_SESSION);
    localStorage.removeItem(LS_STATE);
    view = 'memos';
    $('aUser').value = name || '';
    showAuth();
  }

  // ───────── 동기화 ─────────
  let syncT = null, syncing = false, again = false;
  function scheduleSync(ms) {
    if (!key || !holder.session) return;
    clearTimeout(syncT);
    syncT = setTimeout(runSync, ms == null ? 1200 : ms);
  }
  const findMemo = (u) => st.memos.find((m) => m.uid === u) || st.trash.find((m) => m.uid === u);
  function localTs(kind, id) {
    if (kind === 'event') return (st.evMeta[id] && st.evMeta[id].mt) || 0;
    const m = findMemo(id);
    if (m) return m.mt || 0;
    const t = st.tombs.find((x) => x.uid === id);
    return t ? t.ts : 0;
  }
  const cleanItems = (a) => (Array.isArray(a) ? a.slice(0, 500).map((x) => ({ t: String((x && x.t) || ''), d: !!(x && x.d) })) : []);
  function contentOf(d) {
    return {
      title: String(d.title || ''), text: String(d.text || ''), items: cleanItems(d.items),
      type: d.type === 'check' ? 'check' : 'text',
      mark: MARKS[d.mark] ? d.mark : null,
      markColor: /^#[0-9a-fA-F]{6}$/.test(d.markColor || '') ? d.markColor : '#E8456B',
      slot: Number.isInteger(d.slot) ? ((d.slot % 5) + 5) % 5 : 0,
      ord: typeof d.ord === 'number' && isFinite(d.ord) ? d.ord : null
    };
  }
  function apply(item) {
    if (item.kind === 'event') {
      const list = item.deleted ? [] : (item.data && Array.isArray(item.data.list) ? item.data.list : []);
      if (list.length) st.events[item.id] = list.map((e) => ({ t: String(e.t || ''), title: String(e.title || ''), c: EV_ORDER.includes(e.c) ? e.c : 'lav' }));
      else delete st.events[item.id];
      st.evMeta[item.id] = { mt: item.ts, dirty: false };
      return;
    }
    const u = item.id;
    const inMemos = st.memos.find((m) => m.uid === u);
    const inTrash = st.trash.find((m) => m.uid === u);
    if (item.deleted) {
      st.memos = st.memos.filter((m) => m.uid !== u);
      st.trash = st.trash.filter((m) => m.uid !== u);
      st.tombs = st.tombs.filter((t) => t.uid !== u).concat([{ uid: u, ts: item.ts, done: true }]);
      if (editing === u) closeEditor(true);
      return;
    }
    const d = item.data || {};
    const c = { ...contentOf(d), mt: item.ts, dirty: false };
    if (d.trashed) {
      st.memos = st.memos.filter((m) => m.uid !== u);
      if (inTrash) Object.assign(inTrash, c, { deletedAt: Number(d.deletedAt) || inTrash.deletedAt });
      else st.trash.unshift({ uid: u, ...c, deletedAt: Number(d.deletedAt) || Date.now() });
      if (editing === u) closeEditor(true);
    } else {
      st.trash = st.trash.filter((m) => m.uid !== u);
      if (inMemos) Object.assign(inMemos, c);
      else st.memos.push({ uid: u, ...c });
      if (editing === u) fillEditor(true);
    }
  }
  function payload(m, trashed) {
    const p = {};
    for (const k of CONTENT) p[k] = m[k];
    return { ...p, trashed: !!trashed, deletedAt: trashed ? m.deletedAt : null };
  }
  function dirtyList() {
    const out = [];
    for (const m of st.memos) if (m.dirty) out.push({ kind: 'memo', id: m.uid, ts: m.mt, data: payload(m, false) });
    for (const m of st.trash) if (m.dirty) out.push({ kind: 'memo', id: m.uid, ts: m.mt, data: payload(m, true) });
    for (const t of st.tombs) if (!t.done) out.push({ kind: 'memo', id: t.uid, ts: t.ts, deleted: true });
    for (const [k, meta] of Object.entries(st.evMeta)) if (meta && meta.dirty) out.push({ kind: 'event', id: k, ts: meta.mt, data: { list: st.events[k] || [] } });
    return out;
  }
  function pushed(kind, id, ts) {
    if (kind === 'event') { const m = st.evMeta[id]; if (m && m.mt === ts) m.dirty = false; return; }
    const m = findMemo(id);
    if (m && m.mt === ts) m.dirty = false;
    for (const t of st.tombs) if (t.uid === id && t.ts === ts) t.done = true;
  }
  async function runSync() {
    if (!key || !holder.session) return;
    if (syncing) { again = true; return; }
    syncing = true;
    sync.state = 'syncing'; renderSync();
    try {
      const r = await C.syncOnce({ holder, key, cursor: st.cursor, localTs, apply, dirty: dirtyList, pushed });
      st.cursor = r.cursor || st.cursor;
      st.tombs = st.tombs.filter((t) => !t.done || t.ts > Date.now() - 30 * DAY);
      saveStateNow();
      sync.state = 'ok'; sync.last = Date.now(); sync.msg = '';
      if (r.applied) render();
    } catch (e) {
      sync.state = 'error'; sync.msg = C.message(e);
      if (e && (e.code === 'session_expired' || e.code === 'signed_out')) {
        toast(sync.msg);
        await logout(true);
        return;
      }
    } finally {
      syncing = false;
      renderSync();
      if (again) { again = false; scheduleSync(600); }
    }
  }
  function touch(m) {
    m.mt = Math.max(Date.now(), (m.mt || 0) + 1);
    m.dirty = true;
    saveState();
    scheduleSync();
  }
  function markEvent(k) {
    const prev = st.evMeta[k] || {};
    st.evMeta[k] = { mt: Math.max(Date.now(), (prev.mt || 0) + 1), dirty: true };
    saveState();
    scheduleSync();
  }
  function autoPurge() {
    const lim = Date.now() - TRASH_DAYS * DAY;
    const old = st.trash.filter((t) => (t.deletedAt || 0) < lim);
    if (!old.length) return;
    purge(old.map((t) => t.uid));
  }
  function purge(uids) {
    const set = new Set(uids);
    for (const t of st.trash) if (set.has(t.uid)) st.tombs.push({ uid: t.uid, ts: Math.max(Date.now(), (t.mt || 0) + 1) });
    st.trash = st.trash.filter((t) => !set.has(t.uid));
    saveStateNow();
    scheduleSync(300);
  }

  setInterval(() => { if (document.visibilityState === 'visible') scheduleSync(0); }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0);
    else saveStateNow();
  });
  window.addEventListener('online', () => scheduleSync(0));
  window.addEventListener('pagehide', saveStateNow);

  // ───────── 화면 ─────────
  let view = 'memos', q = '';
  const now = new Date();
  let calY = now.getFullYear(), calM = now.getMonth(), sel = dateKey(now);

  function applyPrefs() {
    const t = applyTheme(prefs);
    const r = document.documentElement.style;
    const sk = t.sk;
    r.setProperty('--base', sk.base);
    r.setProperty('--b0', sk.b[0]); r.setProperty('--b1', sk.b[1]); r.setProperty('--b2', sk.b[2]); r.setProperty('--b3', sk.b[3]);
    r.setProperty('--sun', sk.sun); r.setProperty('--sat', sk.sat);
    r.setProperty('--memo-size', Math.round((t.f.size + 1) * (prefs.fontScale || 100) / 10) / 10 + 'px');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', sk.base);
    return t;
  }
  const skin = () => SKINS[prefs.skin] || SKINS.lav;

  function showApp() {
    $('auth').hidden = true;
    $('app').hidden = false;
    render();
  }
  function renderSync() {
    const el = $('sync');
    if (!el) return;
    el.className = 'sync ' + sync.state;
    const ago = sync.last ? Math.round((Date.now() - sync.last) / 1000) : 0;
    const t = sync.state === 'syncing' ? '맞추는 중…' : sync.state === 'error' ? sync.msg : sync.state === 'ok' ? '맞춤 완료' + (ago > 60 ? ' · ' + Math.round(ago / 60) + '분 전' : '') : '연결 중…';
    el.innerHTML = '<i></i><span>' + esc((session && session.username ? session.username + ' · ' : '') + t) + '</span>';
    $('syncBtn').classList.toggle('spin', sync.state === 'syncing');
  }
  function render() {
    if ($('app').hidden) return;
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('vMemos').hidden = view !== 'memos';
    $('vCal').hidden = view !== 'cal';
    $('vTrash').hidden = view !== 'trash';
    $('vSet').hidden = view !== 'set';
    $('fab').hidden = view !== 'memos';
    renderSync();
    if (view === 'memos') renderMemos();
    if (view === 'cal') renderCal();
    if (view === 'trash') renderTrash();
    if (view === 'set') renderSet();
  }

  function preview(m) {
    if (m.type === 'check') return (m.items || []).map((x) => (x.d ? '✓ ' : '○ ') + x.t).filter((x) => x.length > 2).slice(0, 4).join('\n');
    return m.text || '';
  }
  let shown = [];
  function renderMemos() {
    const sk = skin();
    const lower = q.toLowerCase();
    const list = st.memos
      .filter((m) => !lower || [m.title, m.text, ...(m.items || []).map((x) => x.t)].join(' ').toLowerCase().includes(lower))
      .sort(memoOrder);
    shown = list;
    $('sortHint').hidden = !!q || list.length < 2 || !!prefs.sortHintSeen;
    renderInstall();
    if (!list.length) {
      $('list').innerHTML = '<div class="empty">' + (q ? '찾는 메모가 없어요' : '아직 메모가 없어요.<br>오른쪽 아래 + 를 눌러 써 보세요') + '</div>';
      return;
    }
    $('list').innerHTML = list.map((m, i) => {
      const done = m.type === 'check' ? (m.items || []).filter((x) => x.d).length + '/' + (m.items || []).length + ' 완료' : '';
      return '<button class="memo" type="button" data-uid="' + esc(m.uid) + '" style="background:' + grad(sk, m.slot || 0, 0.82) + ';animation-delay:' + Math.min(i * 30, 300) + 'ms">' +
        '<span class="mTitle">' + (m.mark ? markSvg(m.mark, m.markColor || '#E8456B', 18) : '') + '<span>' + esc(m.title || '제목 없음') + '</span></span>' +
        (preview(m) ? '<span class="mBody">' + esc(preview(m)) + '</span>' : '') +
        (done ? '<span class="mMeta">' + done + '</span>' : '') +
      '</button>';
    }).join('');
  }
  $('list').addEventListener('click', (e) => { if (suppressClick) return; const b = e.target.closest('.memo'); if (b) openEditor(b.dataset.uid); });

  // ───────── 꾹 눌러 순서 바꾸기 ─────────
  const listEl = $('list');
  let press = null, drag = null, suppressClick = false, autoRaf = 0;
  const pt = (e) => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
  function startPress(e) {
    if (q || drag) return;
    const card = e.target.closest('.memo');
    if (!card || (e.type === 'mousedown' && e.button !== 0)) return;
    const p = pt(e);
    press = { card, x: p.x, y: p.y, timer: setTimeout(() => beginDrag(card, p), 420) };
  }
  function beginDrag(card, p) {
    press = null;
    const cards = [...listEl.querySelectorAll('.memo')];
    const idx = cards.indexOf(card);
    if (idx < 0 || cards.length < 2) return;
    const rects = cards.map((c) => c.getBoundingClientRect());
    drag = { card, cards, idx, to: idx, rects, startY: p.y, lastY: p.y, scroll0: window.scrollY, step: rects[idx].height + 10 };
    card.classList.add('lift');
    listEl.classList.add('sorting');
    suppressClick = true;
    if (navigator.vibrate) navigator.vibrate(12);
    autoRaf = requestAnimationFrame(autoScroll);
  }
  function updateDrag() {
    const dy = drag.lastY - drag.startY + (window.scrollY - drag.scroll0);
    drag.card.style.transform = 'translateY(' + dy + 'px) scale(1.03)';
    const r0 = drag.rects[drag.idx];
    const top = r0.top + dy, bottom = top + r0.height;
    let to = drag.idx;
    drag.cards.forEach((c, i) => {
      if (i === drag.idx) return;
      const r = drag.rects[i];
      const mid = r.top + r.height / 2;
      let shift = 0;
      if (i > drag.idx && bottom > mid) { shift = -drag.step; to = Math.max(to, i); }
      else if (i < drag.idx && top < mid) { shift = drag.step; to = Math.min(to, i); }
      c.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
    });
    drag.to = to;
  }
  function autoScroll() {
    if (!drag) return;
    const h = window.innerHeight;
    let v = 0;
    if (drag.lastY < 90) v = -Math.ceil((90 - drag.lastY) / 8);
    else if (drag.lastY > h - 160) v = Math.ceil((drag.lastY - (h - 160)) / 8);
    if (v) { window.scrollBy(0, v); updateDrag(); }
    autoRaf = requestAnimationFrame(autoScroll);
  }
  function movePress(e) {
    if (press) {
      const p = pt(e);
      if (Math.abs(p.x - press.x) + Math.abs(p.y - press.y) > 10) { clearTimeout(press.timer); press = null; }
      return;
    }
    if (!drag) return;
    if (e.cancelable) e.preventDefault();
    drag.lastY = pt(e).y;
    updateDrag();
  }
  function endPress() {
    if (press) { clearTimeout(press.timer); press = null; }
    if (!drag) return;
    cancelAnimationFrame(autoRaf);
    const { idx, to, cards } = drag;
    drag.card.classList.remove('lift');
    listEl.classList.remove('sorting');
    cards.forEach((c) => { c.style.transform = ''; });
    drag = null;
    if (to !== idx) {
      const order = shown.slice();
      const [m] = order.splice(idx, 1);
      order.splice(to, 0, m);
      order.forEach((x, i) => { if (x.ord !== i) { x.ord = i; touch(x); } });
      if (!prefs.sortHintSeen) { prefs.sortHintSeen = true; savePrefs(); }
    }
    renderMemos();
    setTimeout(() => { suppressClick = false; }, 80);
  }
  listEl.addEventListener('touchstart', startPress, { passive: true });
  listEl.addEventListener('mousedown', startPress);
  document.addEventListener('touchmove', movePress, { passive: false });
  document.addEventListener('mousemove', movePress);
  document.addEventListener('touchend', endPress);
  document.addEventListener('touchcancel', endPress);
  document.addEventListener('mouseup', endPress);
  listEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // ───────── 앱으로 설치 ─────────
  // 안드로이드 크롬: 설치 버튼을 누르면 바로 설치 창이 떠요.
  // 카카오톡 등 앱 안 브라우저: 크롬/사파리로 열어 바로 설치할 수 있게 넘겨줘요.
  // 아이폰: 애플이 직접 설치를 막아 두어서 사파리 공유 버튼으로만 추가할 수 있어요.
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua);
  const isKakao = /KAKAOTALK/i.test(ua);
  const iosNotSafari = isIOS && /CriOS|FxiOS|EdgiOS|Whale|NAVER/i.test(ua);
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let installed = false, installBusy = false;
  const evt = () => window.__installEvt;

  window.addEventListener('mallang-installable', renderInstall);
  window.addEventListener('appinstalled', () => {
    window.__installEvt = null; installed = true; renderInstall();
    toast('설치했어요! 홈 화면의 말랑메모 아이콘으로 열어 보세요');
  });
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => { if (apps && apps.length) { installed = true; renderInstall(); } }).catch(() => {});
  }

  function installMode() {
    if (standalone()) return 'none';
    if (inApp) return 'external';            // 카카오톡 등 → 크롬/사파리로 열기
    if (evt()) return 'prompt';              // 바로 설치
    if (installed) return 'installed';
    if (isIOS) return iosNotSafari ? 'external' : 'ios';
    if (isAndroid) return 'wait';            // 크롬이 준비되면 바로 설치
    return 'none';
  }
  function renderInstall() {
    const mode = installMode();
    const show = mode !== 'none' && mode !== 'installed' && !prefs.installHide;
    $('install').hidden = !show;
    const sub = { prompt: '누르면 바로 설치돼요', wait: '누르면 바로 설치돼요', ios: '홈 화면에 아이콘을 만들어요', external: isIOS ? '사파리에서 설치해요' : '크롬에서 바로 설치' }[mode] || '';
    $('installSub').textContent = sub;
    $('installGo').textContent = installBusy ? '준비 중…' : (mode === 'external' ? (isIOS ? '사파리로' : '크롬으로') : '설치');
    $('installGo').disabled = installBusy;
    const card = $('installSet').closest('.card');
    card.hidden = mode === 'none' && !installed;
    $('installSet').textContent = installed || mode === 'installed' ? '이미 설치돼 있어요' : '설치하기';
    $('installSet').disabled = installed || mode === 'installed';
  }

  function openExternal() {
    const url = location.href.split('#')[0];
    if (isKakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url); return; }
    if (isAndroid) {
      location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
      return;
    }
    // 아이폰의 다른 브라우저: 사파리로 바로 넘길 방법이 없어 주소 복사
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('주소를 복사했어요. 사파리에 붙여넣어 열어 주세요')).catch(() => toast('사파리에서 ' + url + ' 을 열어 주세요'));
    else toast('사파리에서 ' + url + ' 을 열어 주세요');
  }

  async function runPrompt() {
    const e = evt();
    window.__installEvt = null;
    e.prompt();
    let choice = null;
    try { choice = await e.userChoice; } catch (err) { /* 무시 */ }
    if (choice && choice.outcome === 'accepted') { installed = true; }
    renderInstall();
  }

  async function doInstall() {
    const mode = installMode();
    if (mode === 'prompt') return runPrompt();
    if (mode === 'external') return openExternal();
    if (mode === 'ios') { $('iosTip').hidden = false; return; }
    if (mode === 'installed') { toast('이미 설치돼 있어요. 홈 화면의 말랑메모로 열어 주세요'); return; }
    if (mode === 'wait') {
      // 크롬이 설치 준비를 마칠 때까지 잠깐 기다렸다가 바로 설치
      installBusy = true; renderInstall();
      const ok = await new Promise((res) => {
        if (evt()) return res(true);
        const t = setTimeout(() => { window.removeEventListener('mallang-installable', on); res(false); }, 5000);
        function on() { clearTimeout(t); res(true); }
        window.addEventListener('mallang-installable', on, { once: true });
      });
      installBusy = false;
      if (ok) return runPrompt();
      renderInstall();
      if (installed) toast('이미 설치돼 있어요. 홈 화면의 말랑메모로 열어 주세요');
      else toast('크롬 오른쪽 위 ⋮ 메뉴에서 "앱 설치"를 눌러 주세요');
    }
  }
  $('installGo').onclick = doInstall;
  $('installSet').onclick = doInstall;
  $('installX').innerHTML = icon('<path d="M6 6l12 12M18 6L6 18"/>', 16, 2.2);
  $('installX').onclick = () => { prefs.installHide = true; savePrefs(); renderInstall(); toast('설정 탭에서 언제든 설치할 수 있어요'); };
  $('iosTipX').innerHTML = icon('<path d="M6 6l12 12M18 6L6 18"/>', 14, 2.2);
  $('iosTipX').onclick = () => { $('iosTip').hidden = true; };
  $('iosShare').innerHTML = icon('<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>', 16, 2.2);
  $('q').addEventListener('input', (e) => { q = e.target.value.trim(); renderMemos(); });

  // 캘린더
  function renderCal() {
    $('calNum').textContent = String(calM + 1);
    $('calEn').textContent = MONTH_EN[calM] + ' ' + calY;
    const todayK = dateKey(new Date());
    const start = new Date(calY, calM, 1).getDay();
    const days = new Date(calY, calM + 1, 0).getDate();
    const count = Math.ceil((start + days) / 7) * 7;
    let h = '';
    for (let i = 0; i < count; i++) {
      const d = new Date(calY, calM, i - start + 1);
      if (d.getMonth() !== calM) { h += '<div class="cell"></div>'; continue; }
      const k = dateKey(d);
      const evs = st.events[k] || [];
      const wd = d.getDay();
      const color = wd === 0 ? 'var(--sun)' : wd === 6 ? 'var(--sat)' : 'var(--ink)';
      h += '<div class="cell"><button class="day' + (k === todayK ? ' today' : '') + (k === sel ? ' sel' : '') + '" type="button" data-k="' + k + '" style="color:' + color + '" aria-pressed="' + (k === sel) + '" aria-label="' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일' + (evs.length ? ', 일정 ' + evs.length + '개' : '') + '">' +
        '<span>' + d.getDate() + '</span><span class="dots">' + evs.slice(0, 3).map((e) => '<i style="background:' + EVENT_COLORS[e.c] + '"></i>').join('') + '</span></button></div>';
    }
    $('grid').innerHTML = h;
    const p = sel.split('-').map(Number);
    const sd = new Date(p[0], p[1] - 1, p[2]);
    $('selLabel').textContent = (sd.getMonth() + 1) + '월 ' + sd.getDate() + '일 ' + WD[sd.getDay()] + '요일';
    if (!$('evList').contains(document.activeElement)) renderEvents();
  }
  function renderEvents(focusIdx) {
    const list = st.events[sel] || [];
    if (!list.length) { $('evList').innerHTML = '<div class="empty" style="padding:20px">일정이 없어요</div>'; return; }
    $('evList').innerHTML = list.map((e, i) =>
      '<div class="ev" data-i="' + i + '">' +
        '<button class="evc" type="button" data-act="color" style="background:' + EVENT_COLORS[e.c] + '" aria-label="일정 색 바꾸기"></button>' +
        '<input class="evt" type="time" data-f="t" value="' + esc(/^\d{2}:\d{2}$/.test(e.t) ? e.t : '') + '" aria-label="시간 (비우면 종일)">' +
        '<input class="evn" type="text" data-f="title" value="' + esc(e.title) + '" placeholder="일정 이름" aria-label="일정 이름">' +
        '<button class="idel" type="button" data-act="del" aria-label="일정 삭제">' + I.x + '</button>' +
      '</div>').join('');
    if (focusIdx != null) { const inp = $('evList').querySelector('.ev[data-i="' + focusIdx + '"] .evn'); if (inp) inp.focus(); }
  }
  $('grid').addEventListener('click', (e) => { const b = e.target.closest('.day'); if (!b) return; sel = b.dataset.k; renderCal(); });
  $('calPrev').onclick = () => { if (calM === 0) { calM = 11; calY--; } else calM--; renderCal(); };
  $('calNext').onclick = () => { if (calM === 11) { calM = 0; calY++; } else calM++; renderCal(); };
  $('calToday').onclick = () => { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); sel = dateKey(d); renderCal(); };
  $('addEv').onclick = () => {
    const list = st.events[sel] || (st.events[sel] = []);
    list.push({ t: '', title: '', c: EV_ORDER[list.length % 4] });
    markEvent(sel);
    renderCal();
    renderEvents(list.length - 1);
  };
  $('evList').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const i = Number(b.closest('.ev').dataset.i);
    const list = st.events[sel] || [];
    if (b.dataset.act === 'color') { list[i].c = EV_ORDER[(EV_ORDER.indexOf(list[i].c) + 1) % 4]; b.style.background = EVENT_COLORS[list[i].c]; }
    if (b.dataset.act === 'del') { list.splice(i, 1); if (!list.length) delete st.events[sel]; renderEvents(); }
    markEvent(sel);
    renderCal();
  });
  $('evList').addEventListener('input', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    const i = Number(inp.closest('.ev').dataset.i);
    (st.events[sel] || [])[i][inp.dataset.f] = inp.value;
    markEvent(sel);
  });
  $('evList').addEventListener('focusout', () => setTimeout(() => { if (!$('evList').contains(document.activeElement)) renderCal(); }, 50));

  // 휴지통
  function renderTrash() {
    const sk = skin();
    $('emptyTrash').hidden = !st.trash.length;
    if (!st.trash.length) { $('trashList').innerHTML = '<div class="empty">휴지통이 비어 있어요</div>'; return; }
    $('trashList').innerHTML = st.trash.map((t) => {
      const left = Math.ceil(((t.deletedAt || 0) + TRASH_DAYS * DAY - Date.now()) / DAY);
      return '<div class="trow" data-uid="' + esc(t.uid) + '" style="border-left:6px solid transparent;background-image:' + grad(sk, t.slot || 0, 0.5) + '">' +
        '<div class="tt"><div class="mTitle">' + (t.mark ? markSvg(t.mark, t.markColor || '#E8456B', 16) : '') + '<span>' + esc(t.title || '제목 없음') + '</span></div>' +
        '<div class="mMeta">' + (left <= 1 ? '오늘 자동 영구 삭제' : left + '일 후 자동 영구 삭제') + '</div></div>' +
        '<button class="tbtn" type="button" data-act="restore">되살리기</button>' +
        '<button class="tbtn tdel" type="button" data-act="purge">영구 삭제</button></div>';
    }).join('');
  }
  $('trashList').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const u = b.closest('.trow').dataset.uid;
    const t = st.trash.find((x) => x.uid === u); if (!t) return;
    if (b.dataset.act === 'restore') {
      st.trash = st.trash.filter((x) => x !== t);
      delete t.deletedAt;
      st.memos.push(t);
      touch(t);
      toast('메모를 되살렸어요');
      renderTrash();
    } else if (await ask('영구 삭제할까요?', '"' + (t.title || '제목 없음') + '" 메모가 PC와 서버에서도 완전히 지워져요. 되돌릴 수 없어요.', '영구 삭제')) {
      purge([u]);
      renderTrash();
    }
  });
  $('emptyTrash').onclick = async () => {
    if (!st.trash.length) return;
    if (await ask('휴지통을 비울까요?', '메모 ' + st.trash.length + '개가 PC와 서버에서도 완전히 지워져요. 되돌릴 수 없어요.', '모두 영구 삭제')) {
      purge(st.trash.map((t) => t.uid));
      renderTrash();
    }
  };

  // 설정
  function renderSet() {
    $('acctName').textContent = (session && session.username) || '';
    if (document.activeElement !== $('fontScale')) $('fontScale').value = prefs.fontScale || 100;
    $('fontScaleV').textContent = (prefs.fontScale || 100) + '%';
    $('avatar').textContent = ((session && session.username) || '?').slice(0, 1).toUpperCase();
    $('skins').innerHTML = Object.keys(SKINS).map((id) => {
      const k = SKINS[id];
      return '<button class="skin' + (prefs.skin === id ? ' on' : '') + '" type="button" data-skin="' + id + '" aria-pressed="' + (prefs.skin === id) + '" style="--sc:' + k.a1 + ';--sg:' + k.glow + '">' +
        '<span class="prev" style="background:linear-gradient(135deg,' + k.b[0] + ',' + k.b[1] + ' 55%,' + k.b[2] + ')"><i style="background:' + rgba(k.pal[0][0], 0.9) + '"></i><i style="background:' + rgba(k.pal[1][1], 0.9) + '"></i><b style="background:' + k.a1 + '"></b></span>' +
        '<span>' + k.name + '</span></button>';
    }).join('');
    $('fonts').innerHTML = FONTS.map((f) =>
      '<button class="font' + (prefs.font === f.id ? ' on' : '') + '" type="button" data-font="' + f.id + '" aria-pressed="' + (prefs.font === f.id) + '"><span><span style="font-family:' + f.fam.replace(/"/g, '') + ';font-size:' + (f.size + 2) + 'px">오늘의 메모, 가나다</span><span class="fn">' + f.name + '</span></span></button>'
    ).join('');
  }
  $('skins').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (!b) return; prefs.skin = b.dataset.skin; savePrefs(); applyPrefs(); renderSet(); });
  const setFs = (v) => { prefs.fontScale = Math.min(170, Math.max(70, v)); savePrefs(); applyPrefs(); $('fontScale').value = prefs.fontScale; $('fontScaleV').textContent = prefs.fontScale + '%'; };
  $('fontScale').addEventListener('input', (e) => setFs(Number(e.target.value)));
  $('fsDown').onclick = () => setFs((prefs.fontScale || 100) - 10);
  $('fsUp').onclick = () => setFs((prefs.fontScale || 100) + 10);
  $('fonts').addEventListener('click', (e) => { const b = e.target.closest('[data-font]'); if (!b) return; prefs.font = b.dataset.font; savePrefs(); applyPrefs(); renderSet(); });
  $('logout').onclick = () => logout(false);

  // ───────── 메모 편집 ─────────
  let editing = null;
  const ed = () => st.memos.find((m) => m.uid === editing);
  function openEditor(u) {
    editing = u;
    $('edPicker').hidden = true;
    $('editor').hidden = false;
    fillEditor();
    history.pushState({ editor: true }, '');
  }
  function fillEditor(fromRemote) {
    const m = ed();
    if (!m) return;
    const sk = skin();
    $('editor').style.background = 'linear-gradient(160deg,' + rgba(sk.pal[(m.slot || 0) % 5][0], 1) + ',' + rgba(sk.pal[(m.slot || 0) % 5][1], 1) + ')';
    $('edMarkIcon').innerHTML = m.mark ? markSvg(m.mark, m.markColor || '#E8456B', 22) : '';
    const typing = document.activeElement && $('editor').contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON';
    if (fromRemote && typing) return;
    $('edTitle').value = m.title || '';
    const chk = m.type === 'check';
    $('edType').classList.toggle('on', chk);
    $('edType').setAttribute('aria-pressed', String(chk));
    $('edText').hidden = chk;
    $('edChecks').hidden = !chk;
    if (chk) renderItems(); else $('edText').value = m.text || '';
    if (!$('edPicker').hidden) renderPicker();
  }
  function closeEditor(silent) {
    if ($('editor').hidden) return;
    const m = ed();
    // 아무것도 안 쓴 새 메모는 남기지 않음
    if (m && !m.title && !m.text && !(m.items || []).some((x) => x.t) && m.isNew) {
      st.memos = st.memos.filter((x) => x !== m);
      st.tombs.push({ uid: m.uid, ts: Date.now() + 1 });
      saveState();
      scheduleSync();
    } else if (m) delete m.isNew;
    editing = null;
    $('editor').hidden = true;
    render();
    if (!silent && history.state && history.state.editor) history.back();
  }
  window.addEventListener('popstate', () => { if (!$('editor').hidden) closeEditor(true); });
  $('edBack').onclick = () => closeEditor();
  $('fab').onclick = () => {
    const m = { uid: C.uid(), title: '', text: '', items: [], type: 'text', mark: null, markColor: '#E8456B', slot: st.memos.length % 5, isNew: true };
    const ords = st.memos.map((x) => x.ord).filter((v) => typeof v === 'number');
    if (ords.length) m.ord = Math.min(...ords) - 1;
    st.memos.push(m);
    touch(m);
    openEditor(m.uid);
    setTimeout(() => $('edTitle').focus(), 80);
  };
  $('edTitle').addEventListener('input', () => { const m = ed(); if (m) { m.title = $('edTitle').value; touch(m); } });
  $('edText').addEventListener('input', () => { const m = ed(); if (m) { m.text = $('edText').value; touch(m); } });
  $('edTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const m = ed(); if (m && m.type === 'check') focusItem(0); else $('edText').focus(); } });

  function renderItems(focusIdx, caret) {
    const m = ed(); if (!m) return;
    $('edItems').innerHTML = (m.items || []).map((it, i) =>
      '<div class="item' + (it.d ? ' done' : '') + '" data-i="' + i + '">' +
        '<button class="chk" type="button" data-act="toggle" aria-pressed="' + !!it.d + '" aria-label="완료 표시">' + I.check + '</button>' +
        '<input class="itxt" data-i="' + i + '" value="' + esc(it.t) + '" placeholder="할 일" enterkeyhint="next" aria-label="항목 ' + (i + 1) + '">' +
        '<button class="idel" type="button" data-act="idel" aria-label="항목 삭제">' + I.x + '</button></div>').join('');
    if (focusIdx != null) focusItem(focusIdx, caret);
  }
  function focusItem(i, caret) {
    const inp = $('edItems').querySelector('.itxt[data-i="' + i + '"]');
    if (!inp) return;
    inp.focus();
    const c = caret == null ? inp.value.length : caret;
    try { inp.setSelectionRange(c, c); } catch (e) { /* 무시 */ }
  }
  $('edItems').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = ed(); const i = Number(b.closest('.item').dataset.i);
    if (b.dataset.act === 'toggle') {
      m.items[i].d = !m.items[i].d;
      b.closest('.item').classList.toggle('done', m.items[i].d);
      b.setAttribute('aria-pressed', String(m.items[i].d));
    } else {
      m.items.splice(i, 1);
      renderItems(m.items.length ? Math.max(0, i - 1) : null);
    }
    touch(m);
  });
  $('edItems').addEventListener('input', (e) => {
    const inp = e.target.closest('.itxt'); if (!inp) return;
    const m = ed(); m.items[Number(inp.dataset.i)].t = inp.value; touch(m);
  });
  $('edItems').addEventListener('keydown', (e) => {
    const inp = e.target.closest('.itxt'); if (!inp || e.isComposing || e.keyCode === 229) return;
    const m = ed(); const i = Number(inp.dataset.i);
    if (e.key === 'Enter') {
      e.preventDefault();
      const pos = inp.selectionStart;
      const rest = inp.value.slice(pos);
      m.items[i].t = inp.value.slice(0, pos);
      m.items.splice(i + 1, 0, { t: rest, d: false });
      renderItems(i + 1, 0); touch(m);
    } else if (e.key === 'Backspace' && inp.selectionStart === 0 && inp.selectionEnd === 0 && i > 0) {
      e.preventDefault();
      const c = m.items[i - 1].t.length;
      m.items[i - 1].t += m.items[i].t;
      m.items.splice(i, 1);
      renderItems(i - 1, c); touch(m);
    }
  });
  $('edAddItem').onclick = () => { const m = ed(); m.items.push({ t: '', d: false }); renderItems(m.items.length - 1); touch(m); };
  $('edType').onclick = () => {
    const m = ed(); if (!m) return;
    if (m.type === 'check') { m.type = 'text'; m.text = m.items.map((x) => x.t).filter((t) => t.trim()).join('\n'); }
    else { const lines = (m.text || '').split('\n').filter((l) => l.trim()); m.type = 'check'; m.items = lines.length ? lines.map((t) => ({ t, d: false })) : [{ t: '', d: false }]; }
    touch(m); fillEditor();
    if (m.type === 'check' && !m.items[0].t) focusItem(0);
  };
  $('edDel').onclick = async () => {
    const m = ed(); if (!m) return;
    if (!(await ask('이 메모를 삭제할까요?', '휴지통에서 7일 동안 되살릴 수 있어요.', '삭제'))) return;
    st.memos = st.memos.filter((x) => x !== m);
    delete m.isNew;
    m.deletedAt = Date.now();
    st.trash.unshift(m);
    touch(m);
    closeEditor();
    toast('휴지통으로 옮겼어요');
  };
  $('edMark').onclick = () => { $('edPicker').hidden = !$('edPicker').hidden; $('edMark').classList.toggle('on', !$('edPicker').hidden); if (!$('edPicker').hidden) renderPicker(); };
  function renderPicker() {
    const m = ed(); if (!m) return;
    const color = m.markColor || '#E8456B';
    const sk = skin();
    $('pMarks').innerHTML = Object.keys(MARKS).map((k) => '<button class="popt' + (m.mark === k ? ' on' : '') + '" style="--pc:' + esc(color) + '" type="button" data-mark="' + k + '" aria-label="' + MARK_NAMES[k] + '" aria-pressed="' + (m.mark === k) + '">' + markSvg(k, color, 26) + '</button>').join('') +
      '<button class="ptext" type="button" data-mark="">없음</button>';
    $('pColors').innerHTML = MARK_COLORS.map((c) => '<button class="swatch' + (c.hex.toLowerCase() === color.toLowerCase() ? ' on' : '') + '" style="background:' + c.hex + ';--pc:' + c.hex + '" type="button" data-color="' + c.hex + '" aria-label="' + c.name + '"></button>').join('') +
      '<label class="custom"><span class="sr">기호 색 직접 고르기</span><input id="customColor" type="color" value="' + esc(color.toLowerCase()) + '"></label>';
    $('pSlots').innerHTML = [0, 1, 2, 3, 4].map((s) => '<button class="swatch slotsw' + ((m.slot || 0) === s ? ' on' : '') + '" style="background:' + grad(sk, s, 1) + ';--pc:' + sk.a1 + '" type="button" data-slot="' + s + '" aria-label="메모 색 ' + (s + 1) + '"></button>').join('');
  }
  $('edPicker').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const m = ed();
    if ('mark' in b.dataset) m.mark = b.dataset.mark || null;
    else if (b.dataset.color) { m.markColor = b.dataset.color; m.mark = m.mark || 'heart'; }
    else if (b.dataset.slot != null) m.slot = Number(b.dataset.slot);
    touch(m); fillEditor(); renderPicker();
  });
  $('edPicker').addEventListener('change', (e) => {
    if (e.target.id !== 'customColor') return;
    const m = ed(); m.markColor = e.target.value; m.mark = m.mark || 'heart'; touch(m); fillEditor(); renderPicker();
  });

  // ───────── 공통 ─────────
  let askResolve = null;
  function ask(title, desc, yes) {
    $('cTitle').textContent = title; $('cDesc').textContent = desc; $('cYes').textContent = yes;
    $('confirm').hidden = false;
    setTimeout(() => $('cNo').focus(), 30);
    return new Promise((r) => { askResolve = r; });
  }
  function answer(v) { $('confirm').hidden = true; if (askResolve) { const r = askResolve; askResolve = null; r(v); } }
  $('cNo').onclick = () => answer(false);
  $('cYes').onclick = () => answer(true);
  $('confirm').addEventListener('click', (e) => { if (e.target === $('confirm')) answer(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('confirm').hidden) answer(false);
    else if (!$('editor').hidden) closeEditor();
  });
  let toastT = null;
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }

  document.querySelectorAll('.tab').forEach((b) => { b.querySelector('.ti').innerHTML = I[b.querySelector('.ti').dataset.icon]; b.onclick = () => { view = b.dataset.view; render(); window.scrollTo({ top: 0 }); }; });
  $('fab').innerHTML = I.plus;
  $('syncBtn').innerHTML = I.sync;
  $('syncBtn').onclick = () => scheduleSync(0);
  $('searchIcon').innerHTML = ICONS.search;
  $('calPrev').innerHTML = I.left; $('calNext').innerHTML = I.right;
  $('edBack').innerHTML = I.back;
  $('edMark').innerHTML = ICONS.starLine.replace('width="15" height="15"', 'width="21" height="21"');
  $('edType').innerHTML = ICONS.list.replace('width="15" height="15"', 'width="21" height="21"');
  $('edDel').innerHTML = ICONS.trash.replace('width="15" height="15"', 'width="21" height="21"');
  setInterval(renderSync, 30000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  boot();
})();
