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
  const CONTENT = ['title', 'text', 'items', 'table', 'type', 'mark', 'markColor', 'slot', 'ord'];

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
    plan: icon('<rect x="3.5" y="4.5" width="17" height="16" rx="4"/><path d="M3.5 9.5h17M8 3v3M16 3v3M7.5 13.5l1.6 1.6 3-3M14 14h3M7.5 18h9"/>'),
    people: icon('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.2a5 5 0 0 1 3 5.3"/>'),
    check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>'
  };

  window.M.guardHTML($('list'), $('trashList'), $('grid'), $('evList'), $('skins'), $('fonts'));

  // ───────── 저장 ─────────
  function blankState() {
    return { memos: [], trash: [], tombs: [], events: {}, evMeta: {}, deco: {}, decoMeta: {}, contacts: null, shared: {}, cursor: null, planner: blankPlanner() };
  }
  function blankPlanner() { return { weeks: {}, meta: {}, std: { in: '09:00', out: '18:00', alpha: null }, stdMeta: { mt: 0, dirty: false } }; }
  function loadJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }
  let st = Object.assign(blankState(), loadJSON(LS_STATE, {}));
  if (st.contacts && window.M.fixContactRows(st.contacts.rows)) st.contacts = { rows: window.M.fixContactRows(st.contacts.rows), mt: Math.max(Date.now(), (st.contacts.mt || 0) + 1), dirty: true };
  // 주간 플래너가 생기기 전에 받은 기록은 플래너를 건너뛰었으므로, 처음 한 번은 처음부터 다시 받아요
  if (!st.planner || !st.planner.weeks) { st.planner = blankPlanner(); st.cursor = null; }
  // 달력 꾸미기가 생기기 전에 받은 기록도 처음 한 번은 처음부터 다시 받아요 (다른 기기에서 붙인 꾸미기를 놓치지 않게)
  if (!st.decoMeta || typeof st.decoMeta !== 'object' || !st.deco) { st.deco = {}; st.decoMeta = {}; st.cursor = null; }
  let prefs = Object.assign({ skin: 'lav', font: 'gowun' }, loadJSON(LS_PREFS, {}));
  let saveT = null;
  function saveState() { clearTimeout(saveT); saveT = setTimeout(saveStateNow, 200); }
  function saveStateNow() { clearTimeout(saveT); try { localStorage.setItem(LS_STATE, JSON.stringify(st)); } catch (e) { toast('휴대폰 저장 공간이 부족해요'); } pushWidget(); }

  // 안드로이드 앱(말랑메모 위젯 앱) 안에서 열렸을 때만: 홈 화면 달력 위젯에 일정 요약을 넘겨줌
  // (휴대폰 안에만 저장되고 어디로도 보내지 않음 · 웹 브라우저에서는 아무 일도 안 함)
  let widgetT = 0;
  // 위젯 꾸밈 그림: 앱과 같은 글꼴로 쓴 달 제목(로고 포함)·요일 글자를 그림으로 만들어 넘김 (위젯은 글꼴을 못 바꿔서)
  let artCache = { key: '', art: null };
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function widgetArt(sk) {
    const num = $('calNum'), en = $('calEn'), wd = document.querySelector('.wdays span:nth-child(2)');
    const cn = getComputedStyle(num), ce = getComputedStyle(en), cw = getComputedStyle(wd);
    const logoEl = document.querySelector('.brand img');
    const logoSrc = logoEl ? logoEl.getAttribute('src') : 'logo.png';
    const now = new Date();
    const key = ['st7', prefs.skin, cn.fontFamily, cn.color, ce.color, logoSrc, now.getFullYear(), now.getMonth(), sk.sun, sk.sat, cw.color].join('|');
    if (artCache.key === key) return artCache.art;
    try { await Promise.all([document.fonts.load('700 40px ' + cn.fontFamily, '0123456789'), document.fonts.load('600 20px ' + ce.fontFamily, 'NOVEMBER 2026'), document.fonts.load('600 20px ' + cw.fontFamily, '일월화수목금토')]); } catch (e) { /* 글꼴을 못 불러오면 기본 글꼴 */ }
    const logo0 = await loadImg(logoSrc);
    setStickerShadow(sk.a1);   // 스킨 대표색으로 옅게
    const S = 2.5;   // 크게 그려서 위젯에서 또렷하게 (너무 크면 위젯이 못 받아서 2.5배)
    // 로고도 스티커처럼 (조금 기울여 붙인 느낌)
    const LH = 25 * S;
    const logoSt = logo0 && logo0.naturalWidth ? stickerize(logo0, Math.round(logo0.naturalWidth / logo0.naturalHeight * LH), Math.round(LH), 2.2 * S, -3) : null;
    const logo = logoSt ? logoSt.cv : null;
    // 요일 글자색 (앱 요일 줄 그대로) — 글씨는 위젯이 휴대폰 기본 글꼴로 씀 (갤럭시 캘린더처럼)
    const px0 = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const toArr = (str) => { px0.clearRect(0, 0, 1, 1); px0.fillStyle = '#000'; px0.fillStyle = str; px0.fillRect(0, 0, 1, 1); const d = px0.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], 1]; };
    const wdc = [...document.querySelectorAll('.wdays span')].slice(0, 7).map((sp) => toArr(getComputedStyle(sp).color));
    // 말랑이: 달 끝 빈 칸에 앉혀 둘 그림 (스킨 말랑이, 없으면 기본 말랑이)
    let bunny = null;
    const bim = await loadImg(sk.bunny || 'bunny-big.png');
    if (bim && bim.naturalWidth) {
      const r = Math.min(1, 160 / Math.max(bim.naturalWidth, bim.naturalHeight));
      bunny = stickerize(bim, Math.round(bim.naturalWidth * r), Math.round(bim.naturalHeight * r), 7, -5).cv.toDataURL('image/png');   // 스티커처럼
    }
    // 달력 카드 모양 그대로: 카드 바탕색(유리면 반투명) · 테두리(종이 스킨) · 뒤 배경(색 번짐)
    const card = document.querySelector('.calCard');
    const tr = card.style.transition; card.style.transition = 'none';   // 스킨을 막 바꿨을 때 바뀌는 중간 색을 읽지 않게
    const cc0 = getComputedStyle(card), cc = { boxShadow: cc0.boxShadow, backgroundColor: cc0.backgroundColor };
    card.style.transition = tr;
    // 어떤 모양의 CSS 색이든(color-mix 등) 1칸 그려서 [r, g, b, a] 로 읽기
    const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (str) => {
      if (!str || str === 'none') return null;
      px.clearRect(0, 0, 1, 1); px.fillStyle = '#000'; px.fillStyle = str; px.fillRect(0, 0, 1, 1);
      const d = px.getImageData(0, 0, 1, 1).data;
      return d[3] ? [d[0], d[1], d[2], Math.round(d[3] / 255 * 100) / 100] : [0, 0, 0, 0];
    };
    let line = null;
    for (const sh of (cc.boxShadow || '').split(/,(?![^(]*\))/)) {
      const m = /^\s*((?:[a-z-]+\((?:[^()]|\([^)]*\))*\))|#[0-9a-f]+)\s+(.*)$/i.exec(sh);
      if (!m) continue;
      const col = rgba(m[1]), nums = m[2].trim().split(/\s+/).filter((x) => /px$/.test(x)).map(parseFloat);
      if (col && col[3] > 0.05 && nums.length >= 4 && nums[2] === 0 && nums[3] > 0) { line = { c: col, w: Math.min(3, nums[3]) }; break; }
    }
    const bgShown = getComputedStyle(document.querySelector('.bg')).display !== 'none';
    const art = { base: rgba(sk.base) || [238, 240, 251, 1], b: bgShown ? sk.b : null, card: rgba(cc.backgroundColor) || [255, 255, 255, 0.6], line, dark: !!sk.dark, skin: prefs.skin || 'lav', wdBg: rgba(getComputedStyle(document.querySelector('.wdays')).backgroundColor), wdc, logo: logo ? logo.toDataURL('image/png') : null, bunny };
    artCache = { key, art };
    return art;
  }
  // 그림(이모지·말랑이·로고)을 진짜 스티커처럼: 하얀 테두리로 오려 낸 모양 + 그림자 + 기울임 + 코팅 반짝임
  // src 를 w×h 크기로 그린 뒤 둘레 edge 만큼 하얀 테두리 → { cv, pad } (pad = 그림이 안쪽으로 들어간 만큼)
  // 그림자는 까만색 말고 스킨 대표색을 옅게 (스킨에 녹아드는 부드러운 그림자)
  let stShadow = 'rgba(110, 96, 150, .2)';
  function setStickerShadow(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return;
    const n = parseInt(m[1], 16);
    stShadow = 'rgba(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ', .24)';
  }
  function stickerize(src, w, h, edge, tilt) {
    const rad = tilt * Math.PI / 180;
    const bw = w + edge * 2 + 8, bh = h + edge * 2 + 10;
    const W = Math.ceil(Math.abs(bw * Math.cos(rad)) + Math.abs(bh * Math.sin(rad))), H = Math.ceil(Math.abs(bw * Math.sin(rad)) + Math.abs(bh * Math.cos(rad)));
    const t = document.createElement('canvas'); t.width = bw; t.height = bh;
    t.getContext('2d').drawImage(src, edge + 4, edge + 4, w, h);
    const wm = document.createElement('canvas'); wm.width = bw; wm.height = bh;   // 하얀 오림 모양
    const wc = wm.getContext('2d'); wc.drawImage(t, 0, 0); wc.globalCompositeOperation = 'source-in'; wc.fillStyle = '#fff'; wc.fillRect(0, 0, bw, bh);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.translate(W / 2, H / 2); c.rotate(rad); c.translate(-bw / 2, -bh / 2);
    const ring = (n) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; c.drawImage(wm, Math.cos(a) * edge, Math.sin(a) * edge); } };
    c.save(); c.shadowColor = stShadow; c.shadowBlur = Math.max(4, edge * 1.4); c.shadowOffsetY = Math.max(1.5, edge / 3); ring(24); c.restore();
    ring(24);
    c.drawImage(t, 0, 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.26)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    return { cv, pad: (W - w) / 2 };
  }
  const stkCache = {};
  function stickerImg(em) {
    const ck = em + stShadow;
    if (stkCache[ck]) return stkCache[ck];
    const Z = 84, t = document.createElement('canvas'); t.width = Z; t.height = Z;
    const tc = t.getContext('2d');
    tc.font = '72px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; tc.textAlign = 'center'; tc.textBaseline = 'middle';
    tc.fillText(em, Z / 2, Z / 2 + 3);
    let h = 0; for (const ch of em) h = (h * 31 + ch.codePointAt(0)) | 0;
    const st = stickerize(t, Z, Z, 6, (Math.abs(h) % 2 ? 1 : -1) * (6 + Math.abs(h) % 5));
    return (stkCache[ck] = st.cv.toDataURL('image/png'));
  }
  function pushWidget() {
    if (!window.MallangAndroid || !window.MallangAndroid.saveWidget) return;
    clearTimeout(widgetT);
    widgetT = setTimeout(async () => {
      try {
        let art = null;
        try { art = await widgetArt(skin()); } catch (e) { art = null; }
        const sk = skin(), rec = window.M.recurring(st.events), now = new Date();
        const days = {}, list = {};
        for (let mo = -12; mo <= 36; mo++) {   // 위젯에서 1년 전 ~ 3년 뒤까지 넘겨 볼 수 있게
          const y = now.getFullYear(), m = now.getMonth() + mo, n = new Date(y, m + 1, 0).getDate();
          for (let d = 1; d <= n; d++) {
            const k = dateKey(new Date(y, m, d));
            const evs = window.M.eventsOn(st.events, k, rec).map((x) => x.ev);
            const hol = window.M.holiday(k);
            const dd = window.M.decoDay(st.deco, k);
            if (evs.length || hol || dd.bg || dd.stk) days[k] = { c: evs.slice(0, 3).map((e) => EVENT_COLORS[e.c] || EVENT_COLORS.lav), h: hol || '', bg: dd.bg, s: dd.stk };
            if (evs.length) list[k] = evs.slice().sort((a, b) => String(a.t || '').localeCompare(String(b.t || ''))).slice(0, 6).map((e) => ({ t: /^\d{2}:\d{2}$/.test(e.t) ? e.t : '', n: String(e.title || '(이름 없음)').slice(0, 40), c: EVENT_COLORS[e.c] || EVENT_COLORS.lav }));
          }
        }
        const f0 = dateKey(new Date(now.getFullYear(), now.getMonth() - 12, 1)), t0 = dateKey(new Date(now.getFullYear(), now.getMonth() + 37, 0));
        const tapes = window.M.decoTapes(st.deco, f0, t0).slice(0, 400).map((t) => ({ s: t.s, e: t.e, t: t.t, c: window.M.DECO_TAPES[t.c] }));
        const stk = {};
        for (const v of Object.values(days)) if (v.s && !stk[v.s] && Object.keys(stk).length < 30) { try { stk[v.s] = stickerImg(v.s); } catch (e) { /* 그림 못 만들면 글자 스티커 */ } }
        if (art) art = { ...art, stk };
        window.MallangAndroid.saveWidget(JSON.stringify({ v: 1, art, tapes, at: Date.now(), alpha: prefs.widgetAlpha == null ? 100 : prefs.widgetAlpha, skin: { bg: sk.base, ink: sk.ink, sub: sk.sub, a1: sk.a1, sun: sk.sun, sat: sk.sat }, days, list }));
      } catch (e) { /* 위젯 갱신 실패는 앱 사용에 영향 없음 */ }
    }, 400);
  }
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
    if (kind === 'planner') return id === 'std' ? (st.planner.stdMeta.mt || 0) : ((st.planner.meta[id] && st.planner.meta[id].mt) || 0);
    if (kind === 'event') return (st.evMeta[id] && st.evMeta[id].mt) || 0;
    if (kind === 'deco') return (st.decoMeta[id] && st.decoMeta[id].mt) || 0;
    if (kind === 'contact') return (st.contacts && st.contacts.mt) || 0;
    const m = findMemo(id);
    if (m) return m.mt || 0;
    const t = st.tombs.find((x) => x.uid === id);
    return t ? t.ts : 0;
  }
  const cleanItems = (a) => (Array.isArray(a) ? a.slice(0, 500).map((x) => ({ t: String((x && x.t) || ''), d: !!(x && x.d) })) : []);
  function contentOf(d) {
    return {
      title: String(d.title || ''), text: String(d.text || ''), items: cleanItems(d.items),
      type: ['check', 'table'].includes(d.type) ? d.type : 'text',
      table: d.type === 'table' || d.table ? window.M.cleanTable(d.table) : null,
      mark: MARKS[d.mark] ? d.mark : null,
      markColor: /^#[0-9a-fA-F]{6}$/.test(d.markColor || '') ? d.markColor : '#E8456B',
      slot: Number.isInteger(d.slot) ? ((d.slot % 5) + 5) % 5 : 0,
      ord: typeof d.ord === 'number' && isFinite(d.ord) ? d.ord : null
    };
  }
  function apply(item) {
    if (item.kind === 'planner') { applyPlanner(item); return; }
    if (item.kind === 'deco') {
      if (!/^\d{4}-\d{2}$/.test(item.id)) return;
      const d = item.deleted ? null : window.M.cleanDeco(item.data);
      if (d && !window.M.decoEmpty(d)) st.deco[item.id] = d; else delete st.deco[item.id];
      st.decoMeta[item.id] = { mt: item.ts, dirty: false };
      return;
    }
    if (item.kind === 'contact') {
      if (item.id !== 'main') return;
      const rows = item.deleted ? null : window.M.cleanTable(item.data, window.M.CONTACT_HEAD).rows;
      const fixed = window.M.fixContactRows(rows);
      st.contacts = fixed ? { rows: fixed, mt: item.ts + 1, dirty: true } : rows ? { rows, mt: item.ts, dirty: false } : null;
      if (view === 'people') renderPeople(true);
      return;
    }
    if (item.kind !== 'memo' && item.kind !== 'event') return;
    if (item.kind === 'event') {
      const list = item.deleted ? [] : (item.data && Array.isArray(item.data.list) ? item.data.list : []);
      if (list.length) st.events[item.id] = list.map((e) => {
        const o = { t: String(e.t || ''), title: String(e.title || ''), c: EV_ORDER.includes(e.c) ? e.c : 'lav' };
        if (['d', 'wd', 'w', 'm', 'y'].includes(e.r)) { o.r = e.r; if (Array.isArray(e.x)) o.x = e.x.filter((k) => typeof k === 'string'); }
        return o;
      });
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
    for (const [k, meta] of Object.entries(st.decoMeta)) if (meta && meta.dirty) out.push({ kind: 'deco', id: k, ts: meta.mt, data: st.deco[k] || { bg: {}, stk: {}, tape: [] } });
    if (st.contacts && st.contacts.dirty) out.push({ kind: 'contact', id: 'main', ts: st.contacts.mt, data: { rows: st.contacts.rows } });
    for (const [k, pm] of Object.entries(st.planner.meta)) {
      if (!pm || !pm.dirty) continue;
      const w = st.planner.weeks[k];
      out.push(w ? { kind: 'planner', id: k, ts: pm.mt, data: w } : { kind: 'planner', id: k, ts: pm.mt, deleted: true });
    }
    if (st.planner.stdMeta.dirty) out.push({ kind: 'planner', id: 'std', ts: st.planner.stdMeta.mt, data: st.planner.std });
    return out;
  }
  function pushed(kind, id, ts) {
    if (kind === 'planner') { const pm = id === 'std' ? st.planner.stdMeta : st.planner.meta[id]; if (pm && pm.mt === ts) pm.dirty = false; return; }
    if (kind === 'contact') { if (st.contacts && st.contacts.mt === ts) st.contacts.dirty = false; return; }
    if (kind === 'event') { const m = st.evMeta[id]; if (m && m.mt === ts) m.dirty = false; return; }
    if (kind === 'deco') { const m = st.decoMeta[id]; if (m && m.mt === ts) m.dirty = false; return; }
    const m = findMemo(id);
    if (m && m.mt === ts) m.dirty = false;
    for (const t of st.tombs) if (t.uid === id && t.ts === ts) t.done = true;
  }
  // 회사 공통 연락망 (가입자 누구나 읽기, 관리자만 고치기)
  let sharedChecked = 0;
  async function syncShared() {
    st.shared = st.shared || {};
    try {
      if (st.shared.admin == null || Date.now() - sharedChecked > 6 * 3600 * 1000) { st.shared.admin = await C.isAdmin(holder); sharedChecked = Date.now(); }
      if (st.shared.admin && st.shared.dirty && st.shared.contacts) { await C.putShared(holder, 'contacts', { rows: st.shared.contacts }); st.shared.dirty = false; }
      // 자주 받아오지 않음 (1분에 한 번)
      if (st.shared.fetched && Date.now() - st.shared.fetched < 60000 && !st.shared.dirty) return;
      try { const sk = await C.getShared(holder, 'skins'); st.shared.openSkins = sk && sk.data && Array.isArray(sk.data.open) ? sk.data.open.filter((x) => typeof x === 'string').slice(0, 20) : []; } catch (e) { /* 무시 */ }
      const sh = await C.getShared(holder, 'contacts');
      st.shared.fetched = Date.now();
      if (sh && sh.data && Array.isArray(sh.data.rows) && !st.shared.dirty) {
        const rows = window.M.cleanTable({ rows: sh.data.rows }, window.M.CONTACT_HEAD).rows;
        if (JSON.stringify(rows) !== JSON.stringify(st.shared.contacts)) { st.shared.contacts = rows; if (view === 'people') renderPeople(true); }
      }
    } catch (e) { /* 다음에 다시 */ }
  }
  const contactRows = () => (st.shared && st.shared.contacts) || (st.contacts && st.contacts.rows) || null;
  const canEditContacts = () => !(st.shared && st.shared.contacts) || !!st.shared.admin;

  async function runSync() {
    if (!key || !holder.session) return;
    if (syncing) { again = true; return; }
    syncing = true;
    sync.state = 'syncing'; renderSync();
    try {
      const r = await C.syncOnce({ holder, key, cursor: st.cursor, localTs, apply, dirty: dirtyList, pushed });
      st.cursor = r.cursor || st.cursor;
      await syncShared();
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
  // 달력 꾸미기 고친 달 표시 (mk = 'YYYY-MM')
  function markDeco(mk) {
    const d = st.deco[mk];
    if (d && window.M.decoEmpty(d)) delete st.deco[mk];
    const prev = st.decoMeta[mk] || {};
    st.decoMeta[mk] = { mt: Math.max(Date.now(), (prev.mt || 0) + 1), dirty: true };
    saveState();
    scheduleSync();
  }
  const decoMonth = (mk) => st.deco[mk] || (st.deco[mk] = { bg: {}, stk: {}, tape: [] });
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
    const t = applyTheme(SKINS[prefs.skin] && SKINS[prefs.skin].pcOnly ? Object.assign({}, prefs, { skin: 'lav' }) : prefs);
    document.documentElement.classList.toggle('bodybg', !!prefs.bodyBg);
    const r = document.documentElement.style;
    const sk = t.sk;
    r.setProperty('--base', sk.base);
    r.setProperty('--b0', sk.b[0]); r.setProperty('--b1', sk.b[1]); r.setProperty('--b2', sk.b[2]); r.setProperty('--b3', sk.b[3]);
    r.setProperty('--sun', sk.sun); r.setProperty('--sat', sk.sat);
    r.setProperty('--memo-size', Math.round((t.f.size + 1) * (prefs.fontScale || 100) / 10) / 10 + 'px');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', sk.base);
    setTimeout(() => window.M.syncRanges(), 0);
    pushWidget();
    return t;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pushWidget(); });
  const skin = () => (SKINS[prefs.skin] && !SKINS[prefs.skin].pcOnly && SKINS[prefs.skin]) || SKINS.lav;

  function showApp() {
    $('auth').hidden = true;
    $('app').hidden = false;
    const m = /^#date=(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    if (m) { history.replaceState(null, '', location.pathname + location.search); openDate(m[1]); return; }
    render();
  }
  // 홈 화면 위젯에서 누른 날짜(달)로 달력 열기 — 안드로이드 앱이 불러줌
  function openDate(k) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    const p = k.split('-').map(Number);
    calY = p[0]; calM = p[1] - 1; sel = k; view = 'cal';
    if (editing) closeEditor(true);
    render();
  }
  window.mallangOpenDate = (k) => { if (!$('app').hidden) openDate(k); else location.hash = 'date=' + k; };
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
    $('vPeople').hidden = view !== 'people';
    $('vPlan').hidden = view !== 'plan';
    $('vSet').hidden = view !== 'set';
    $('fab').hidden = view !== 'memos';
    renderSync();
    if (view === 'memos') renderMemos();
    if (view === 'cal') renderCal();
    if (view === 'trash') renderTrash();
    if (view === 'set') renderSet();
    if (view === 'people') renderPeople();
    if (view === 'plan') renderPlan();
    if (view !== 'people' && peopleEditing) setPeopleEdit(false);
  }

  function preview(m) {
    if (m.type === 'table') return ((m.table && m.table.rows) || []).filter((r) => r.some((c) => c.trim())).slice(0, 4).map((r) => r.filter((c) => c.trim()).join(' · ')).join('\n');
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
      const done = m.type === 'check' ? (m.items || []).filter((x) => x.d).length + '/' + (m.items || []).length + ' 완료'
        : m.type === 'table' ? '표 · ' + Math.max(0, ((m.table && m.table.rows) || []).length - 1) + '줄' : '';
      // 접기·펴기 (기본은 접힘 = 제목만, 찾는 중에는 펼쳐서)
      const open = !!q || !!(prefs.mOpen && prefs.mOpen[m.uid]);
      return '<button class="memo' + (open ? '' : ' mFolded') + '" type="button" data-uid="' + esc(m.uid) + '" style="background:' + grad(sk, m.slot || 0, 0.82) + ';animation-delay:' + Math.min(i * 30, 300) + 'ms">' +
        '<span class="mTitle">' + (sk.rowIcons ? '<img class="mIco" src="' + sk.rowIcons[(((m.slot || 0) % sk.rowIcons.length) + sk.rowIcons.length) % sk.rowIcons.length] + '" alt="">' : '') + (m.mark ? markSvg(m.mark, m.markColor || '#E8456B', 18) : '') + '<span>' + esc(m.title || '제목 없음') + '</span>' +
          (q ? '' : '<span class="mFold" role="button" aria-label="' + (open ? '접기' : '펴기') + '" data-fold="' + esc(m.uid) + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>') + '</span>' +
        (preview(m) ? '<span class="mBody">' + (m.type === 'check' ? esc(preview(m)) : window.M.previewHTML(preview(m))) + '</span>' : '') +
        (done ? '<span class="mMeta">' + done + '</span>' : '') +
      '</button>';
    }).join('');
  }
  $('list').addEventListener('click', (e) => {
    if (suppressClick) return;
    const f = e.target.closest('.mFold');
    if (f) {
      const u = f.dataset.fold; prefs.mOpen = prefs.mOpen || {};
      if (prefs.mOpen[u]) delete prefs.mOpen[u]; else prefs.mOpen[u] = 1;
      savePrefs();
      const card = f.closest('.memo'); card.classList.toggle('mFolded', !prefs.mOpen[u]); f.setAttribute('aria-label', prefs.mOpen[u] ? '접기' : '펴기');
      return;
    }
    const b = e.target.closest('.memo'); if (b) openEditor(b.dataset.uid);
  });

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
  const standalone = () => !!window.MallangAndroid || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;   // 말랑메모 안드로이드 앱 안에서도 '설치하기' 안내 안 띄움
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
    const rec = window.M.recurring(st.events);
    let wk = [];
    const lane = () => { h += window.M.tapeLane(st.deco, wk); wk = []; };
    for (let i = 0; i < count; i++) {
      if (i && i % 7 === 0) lane();
      const d = new Date(calY, calM, i - start + 1);
      if (d.getMonth() !== calM) { h += '<div class="cell"></div>'; wk.push(null); continue; }
      const k = dateKey(d);
      wk.push(k);
      const dd = window.M.decoDay(st.deco, k);
      const evs = window.M.eventsOn(st.events, k, rec).map((x) => x.ev);
      const wd = d.getDay();
      const hol = window.M.holiday(k);
      const color = wd === 0 || hol ? 'var(--sun)' : wd === 6 ? 'var(--sat)' : 'var(--ink)';
      h += '<div class="cell">' + (dd.stk ? '<span class="dstk" aria-hidden="true">' + esc(dd.stk) + '</span>' : '') + '<button class="day' + (k === todayK ? ' today' : '') + (k === sel ? ' sel' : '') + (dd.bg ? ' hasbg' : '') + '" type="button" data-k="' + k + '" style="color:' + color + (dd.bg ? ';--dbg:' + dd.bg : '') + '" aria-pressed="' + (k === sel) + '" aria-label="' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일' + (evs.length ? ', 일정 ' + evs.length + '개' : '') + '">' +
        '<span>' + d.getDate() + '</span>' + (hol ? '<span class="holn">' + esc(hol) + '</span>' : '') + '<span class="dots">' + evs.slice(0, 3).map((e) => '<i style="background:' + EVENT_COLORS[e.c] + '"></i>').join('') + '</span></button></div>';
    }
    lane();
    $('grid').innerHTML = h;
    renderDecoBar();
    const p = sel.split('-').map(Number);
    const sd = new Date(p[0], p[1] - 1, p[2]);
    const selHol = window.M.holiday(sel);
    $('selLabel').innerHTML = (sd.getMonth() + 1) + '월 ' + sd.getDate() + '일 ' + WD[sd.getDay()] + '요일' + (selHol ? '<span class="holtag">' + esc(selHol) + '</span>' : '');
    if (!$('evList').contains(document.activeElement)) renderEvents();
  }
  // ───────── 달력 꾸미기 (관리자 베타): 날짜 배경색 · 스티커 · 마스킹테이프 ─────────
  const decoAllowed = () => !!(st.shared && st.shared.admin);
  const md = (k) => { const p = k.split('-').map(Number); return p[1] + '/' + p[2]; };
  function renderDecoBar() {
    const bar = $('decoBar');
    if (!decoAllowed()) { bar.hidden = true; return; }
    bar.hidden = false;
    const dd = window.M.decoDay(st.deco, sel);
    const tapes = window.M.decoTapes(st.deco, sel, sel);
    bar.innerHTML = '<button type="button" class="dchip" data-act="bg">' + (dd.bg ? '<i class="dsw" style="background:' + dd.bg + '"></i>' : '🎨') + ' 배경색</button>' +
      '<button type="button" class="dchip" data-act="stk">' + (dd.stk ? esc(dd.stk) : '🌷') + ' 스티커</button>' +
      '<button type="button" class="dchip" data-act="tape">🎀 테이프</button>' +
      tapes.map((t) => '<button type="button" class="dtape" data-act="edit" data-mk="' + t.mk + '" data-i="' + t.i + '" style="background:' + window.M.DECO_TAPES[t.c] + '">' + esc(t.t || '테이프') + ' <small>' + md(t.s) + '~' + md(t.e) + '</small></button>').join('');
  }
  $('decoBar').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'bg') bgSheet();
    if (b.dataset.act === 'stk') stkSheet();
    if (b.dataset.act === 'tape') tapeSheet(null);
    if (b.dataset.act === 'edit') tapeSheet({ mk: b.dataset.mk, i: Number(b.dataset.i) });
  });
  $('grid').addEventListener('click', (e) => {
    const t = e.target.closest('.tp'); if (!t || !decoAllowed()) return;
    e.stopPropagation(); tapeSheet({ mk: t.dataset.mk, i: Number(t.dataset.i) });
  }, true);
  function openSheet(title, body, btns) {
    $('dsTitle').textContent = title; $('dsBody').innerHTML = body; $('dsBtns').innerHTML = btns;
    $('decoSheet').hidden = false;
  }
  const closeSheet = () => { $('decoSheet').hidden = true; };
  $('decoSheet').addEventListener('click', (e) => { if (e.target === $('decoSheet') || e.target.closest('[data-x]')) closeSheet(); });
  function setDay(field, v) {
    const mk = sel.slice(0, 7), m = decoMonth(mk);
    if (v) m[field][sel] = v; else delete m[field][sel];
    markDeco(mk); renderCal();
  }
  function bgSheet() {
    const cur = window.M.decoDay(st.deco, sel).bg;
    openSheet(md(sel) + ' 배경색', '<div class="dsGrid bgs">' + window.M.DECO_BGS.map((c) => '<button type="button" class="dsw big' + (c === cur ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
      '<label class="dsw big pick" aria-label="색 직접 고르기"><input type="color" id="dsPick" value="' + (cur || '#FFE1E1') + '">＋</label></div>' +
      '<div class="dsTip">원하는 색이 없으면 ＋ 를 눌러 직접 골라요</div>',
      '<button type="button" class="mNo" data-act="none">배경 없애기</button><button type="button" class="mNo" data-x>닫기</button>');
    $('dsBody').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { setDay('bg', b.dataset.c); closeSheet(); } };
    $('dsPick').onchange = (e) => { setDay('bg', e.target.value.toUpperCase()); closeSheet(); };
    $('dsBtns').querySelector('[data-act=none]').onclick = () => { setDay('bg', ''); closeSheet(); };
  }
  function stkSheet() {
    const cur = window.M.decoDay(st.deco, sel).stk;
    openSheet(md(sel) + ' 스티커', '<div class="dsGrid emos">' + window.M.DECO_EMOJI.map((em) => '<button type="button" class="' + (em === cur ? 'on' : '') + '" data-e="' + em + '">' + em + '</button>').join('') + '</div>',
      '<button type="button" class="mNo" data-act="none">스티커 떼기</button><button type="button" class="mNo" data-x>닫기</button>');
    $('dsBody').onclick = (e) => { const b = e.target.closest('[data-e]'); if (b) { setDay('stk', b.dataset.e); closeSheet(); } };
    $('dsBtns').querySelector('[data-act=none]').onclick = () => { setDay('stk', ''); closeSheet(); };
  }
  function tapeSheet(ref) {
    const old = ref && st.deco[ref.mk] && st.deco[ref.mk].tape[ref.i];
    if (ref && !old) return;
    const n = window.M.decoTapes(st.deco, '0000-00-00', '9999-99-99').length;
    const t = old ? { ...old } : { s: sel, e: sel, t: '', c: Object.keys(window.M.DECO_TAPES)[n % 6] };
    let c = t.c;
    openSheet(old ? '테이프 고치기' : '🎀 마스킹테이프 붙이기',
      '<label class="dsRow"><span>내용</span><input type="text" id="tpT" maxlength="60" placeholder="예: 제주 출장, 결산 기간" value="' + esc(t.t) + '"></label>' +
      '<div class="dsRow"><span>기간</span><input type="date" id="tpS" value="' + t.s + '"><b>~</b><input type="date" id="tpE" value="' + t.e + '"></div>' +
      '<div class="dsRow"><span>색</span><div class="dsGrid tps">' + Object.entries(window.M.DECO_TAPES).map(([k, v]) => '<button type="button" class="dsw' + (k === c ? ' on' : '') + '" data-c="' + k + '" style="background:' + v + '" aria-label="' + k + '"></button>').join('') + '</div></div>',
      (old ? '<button type="button" class="mNo" data-act="del">떼기</button>' : '') + '<button type="button" class="mNo" data-x>취소</button><button type="button" class="mYes ok" data-act="ok">' + (old ? '저장' : '붙이기') + '</button>');
    $('dsBody').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { c = b.dataset.c; $('dsBody').querySelectorAll('.tps .dsw').forEach((x) => x.classList.toggle('on', x === b)); } };
    const del = () => { const m = st.deco[ref.mk]; m.tape.splice(ref.i, 1); markDeco(ref.mk); };
    $('dsBtns').querySelector('[data-act=ok]').onclick = () => {
      let s0 = $('tpS').value, e0 = $('tpE').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s0)) s0 = sel;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e0)) e0 = s0;
      if (e0 < s0) [s0, e0] = [e0, s0];
      const nt = { s: s0, e: e0, t: $('tpT').value.trim(), c };
      if (old) del();
      const mk = s0.slice(0, 7), m = decoMonth(mk);
      if (m.tape.length >= 40) { toast('한 달에 테이프는 40개까지 붙일 수 있어요'); return; }
      m.tape.push(nt); markDeco(mk);
      closeSheet(); renderCal();
    };
    if (old) $('dsBtns').querySelector('[data-act=del]').onclick = () => { del(); closeSheet(); renderCal(); };
  }
  function renderEvents(focusIdx) {
    const list = st.events[sel] || [];
    const rec = window.M.eventsOn(st.events, sel).filter((x) => !x.own);
    if (!list.length && !rec.length) { $('evList').innerHTML = '<div class="empty" style="padding:20px">일정이 없어요</div>'; return; }
    const repSel = (e) => '<select class="evr" data-f="r" aria-label="반복">' + window.M.REPEATS.map((o) => '<option value="' + o[0] + '"' + ((e.r || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    $('evList').innerHTML = rec.map((x) =>
      '<div class="ev rec" data-src="' + x.k + '" data-si="' + x.i + '">' +
        '<span class="evc" style="background:' + EVENT_COLORS[x.ev.c] + '"></span>' +
        '<span class="evt">' + esc(/^\d{2}:\d{2}$/.test(x.ev.t) ? x.ev.t : '종일') + '</span>' +
        '<button class="evn evgo" type="button" data-act="go">' + esc(x.ev.title || '(이름 없음)') + '</button>' +
        '<span class="evrep">↻ ' + window.M.REPEAT_NAME[x.ev.r] + '</span>' +
        '<button class="idel" type="button" data-act="skip" aria-label="이 날만 빼기">' + I.x + '</button>' +
      '</div>').join('') + list.map((e, i) =>
      '<div class="ev' + (e.r ? ' hasrep' : '') + '" data-i="' + i + '">' +
        '<button class="evc" type="button" data-act="color" style="background:' + EVENT_COLORS[e.c] + '" aria-label="일정 색 바꾸기"></button>' +
        '<input class="evt" type="time" data-f="t" value="' + esc(/^\d{2}:\d{2}$/.test(e.t) ? e.t : '') + '" aria-label="시간 (비우면 종일)">' +
        '<input class="evn" type="text" data-f="title" value="' + esc(e.title) + '" placeholder="일정 이름" aria-label="일정 이름">' +
        repSel(e) +
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
  $('evList').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const recRow = b.closest('.ev.rec');
    if (recRow) {
      const src = recRow.dataset.src, si = Number(recRow.dataset.si);
      const p = src.split('-').map(Number);
      if (b.dataset.act === 'go') { sel = src; calY = p[0]; calM = p[1] - 1; renderCal(); }
      if (b.dataset.act === 'skip' && await ask('이 날 일정만 뺄까요?', '반복은 그대로 두고 이 날만 빠져요. 반복 전체를 지우려면 시작한 날(' + p[1] + '/' + p[2] + ')에서 지우세요.', '이 날만 빼기')) {
        const ev = (st.events[src] || [])[si];
        if (ev) { ev.x = Array.isArray(ev.x) ? ev.x : []; if (!ev.x.includes(sel)) ev.x.push(sel); markEvent(src); renderCal(); renderEvents(); }
      }
      return;
    }
    const i = Number(b.closest('.ev').dataset.i);
    const list = st.events[sel] || [];
    if (b.dataset.act === 'color') { list[i].c = EV_ORDER[(EV_ORDER.indexOf(list[i].c) + 1) % 4]; b.style.background = EVENT_COLORS[list[i].c]; }
    if (b.dataset.act === 'del') {
      if (list[i].r && !(await ask('반복 일정을 지울까요?', '"' + (list[i].title || '이름 없음') + '" ' + window.M.REPEAT_NAME[list[i].r] + ' 반복이 모두 지워져요.', '모두 지우기'))) return;
      list.splice(i, 1); if (!list.length) delete st.events[sel]; renderEvents();
    }
    markEvent(sel);
    renderCal();
  });
  $('evList').addEventListener('input', (e) => {
    const inp = e.target.closest('input, select'); if (!inp || !inp.closest('.ev[data-i]')) return;
    const i = Number(inp.closest('.ev').dataset.i);
    const ev = (st.events[sel] || [])[i];
    if (!ev) return;
    if (inp.dataset.f === 'r') { if (inp.value) ev.r = inp.value; else { delete ev.r; delete ev.x; } inp.closest('.ev').classList.toggle('hasrep', !!inp.value); markEvent(sel); renderCal(); return; }
    ev[inp.dataset.f] = inp.value;
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

  // ───────── 주간 플래너 (PC와 같은 데이터 · 같은 계산) ─────────
  const PL_EN = ['월', '화', '수', '목', '금', '토', '일'];
  const PL_COLORS = ['peach', 'mint', 'sky', 'lav', 'lemon', 'pink', 'stripe', 'dot'];
  const isT = (v) => /^\d{2}:\d{2}$/.test(v || '');
  function plWeek(w) {
    // 받은 주를 안전하게 정리 (테이프·스티커 등 휴대폰에서 안 쓰는 칸도 그대로 보관)
    w = w && typeof w === 'object' ? w : {};
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = (Array.isArray(w.days) && w.days[i]) || {};
      return { in: isT(d.in) ? d.in : '', out: isT(d.out) ? d.out : '', items: (Array.isArray(d.items) ? d.items : []).slice(0, 40).map((it) => ({ t: String((it && it.t) || '').slice(0, 300), d: !!(it && it.d) })) };
    });
    return { notes: String(w.notes || '').slice(0, 4000), days, tapes: Array.isArray(w.tapes) ? w.tapes : [], stickers: Array.isArray(w.stickers) ? w.stickers : [], habits: Array.isArray(w.habits) ? w.habits : [] };
  }
  function applyPlanner(item) {
    const P = st.planner;
    if (item.id === 'std') {
      if (!item.deleted && item.data) P.std = { in: isT(item.data.in) ? item.data.in : '09:00', out: isT(item.data.out) ? item.data.out : '18:00', alpha: item.data.alpha == null ? null : item.data.alpha };
      P.stdMeta = { mt: item.ts, dirty: false };
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(item.id)) {
      if (item.deleted || !item.data) delete P.weeks[item.id]; else P.weeks[item.id] = plWeek(item.data);
      P.meta[item.id] = { mt: item.ts, dirty: false };
    }
    if (view === 'plan') plRemote();
  }
  const plMonday = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  let plMon = plMonday(new Date());
  const plDay = (i) => new Date(plMon.getFullYear(), plMon.getMonth(), plMon.getDate() + i);
  const plKey = () => dateKey(plMon);
  const plGet = () => st.planner.weeks[plKey()] || plWeek(null);
  const toM = (t) => (isT(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : null);
  const fmtM = (m) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  function plOt(d, i, hol) {   // 주말·공휴일은 휴일 근무로 따로
    const a = toM(d.in); let b = toM(d.out);
    const r = { e: 0, l: 0, w: 0 };
    const u30 = (m) => Math.floor(Math.max(0, m) / 30) * 30;   // 연장근무는 30분 단위
    if (i >= 5 || hol) { if (a != null && b != null) { if (b < a) b += 1440; r.w = u30(b - a); } return r; }
    if (a != null) r.e = u30(toM(st.planner.std.in) - a);
    if (b != null) { if (a != null && b < a) b += 1440; r.l = u30(b - toM(st.planner.std.out)); }
    return r;
  }
  function plSave(w) {
    const k = plKey();
    const empty = !w.notes && !w.tapes.length && !w.stickers.length && w.days.every((d) => !d.in && !d.out && !d.items.some((x) => x.t.trim()));
    const clean = { ...w, days: w.days.map((d) => { const items = d.items.slice(); while (items.length && !items[items.length - 1].t.trim()) items.pop(); return { ...d, items }; }) };
    if (empty) delete st.planner.weeks[k]; else st.planner.weeks[k] = clean;
    const old = st.planner.meta[k];
    st.planner.meta[k] = { mt: Math.max(Date.now(), ((old && old.mt) || 0) + 1), dirty: true };
    saveState();
    scheduleSync();
  }
  let plW = null, plPending = false;
  const plTyping = () => { const a = document.activeElement; return document.visibilityState === 'visible' && document.hasFocus() && a && $('vPlan').contains(a) && /INPUT|TEXTAREA/.test(a.tagName) && !$('plStd').contains(a); };
  function plRemote() {
    // 쓰는 중이면 화면은 그대로 두고 데이터만 새것으로 (지금 쓰는 칸만 내 값) → 손 떼면 다시 그림
    if (plTyping()) {
      const a = document.activeElement, fresh = JSON.parse(JSON.stringify(plGet()));
      if (a.id === 'plNotes') fresh.notes = a.value;
      else if (a.type === 'time' && a.dataset.f) fresh.days[+a.dataset.i][a.dataset.f] = isT(a.value) ? a.value : '';
      else if (a.classList.contains('pTx') && !a.dataset.add) { const it = fresh.days[+a.dataset.i].items; while (it.length <= +a.dataset.j) it.push({ t: '', d: false }); it[+a.dataset.j].t = a.value; }
      plW = fresh; plPending = true; renderPlSum(); return;
    }
    plPending = false; renderPlan();
  }
  $('vPlan').addEventListener('focusout', () => setTimeout(() => { if (plPending && !plTyping()) { plPending = false; renderPlan(); } }, 50));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && plPending && view === 'plan') { plPending = false; renderPlan(); } });
  function renderPlan() {
    plW = JSON.parse(JSON.stringify(plGet()));
    const th = plDay(3), first = plMonday(new Date(th.getFullYear(), th.getMonth(), 1));
    let n = Math.round((plMon - first) / (7 * DAY)) + 1;
    if (new Date(first.getTime() + 3 * DAY).getMonth() !== th.getMonth()) n -= 1;
    const a = plDay(0), b = plDay(6);
    $('plLabel').textContent = (th.getMonth() + 1) + '월 ' + n + '주차';
    $('plRange').textContent = (a.getMonth() + 1) + '. ' + a.getDate() + ' – ' + (b.getMonth() + 1) + '. ' + b.getDate();
    $('plToday').classList.toggle('on', plKey() === dateKey(plMonday(new Date())));
    renderPlSum();
    const todayK = dateKey(new Date());
    $('plDays').innerHTML = plW.days.map((d, i) => {
      const dt = plDay(i), today = dateKey(dt) === todayK, o = plOt(d, i, !!window.M.holiday(dateKey(dt)));
      const tapes = plW.tapes.filter((t) => t && t.a <= i && i <= t.b);
      const tl = (f, label, chip) => '<div class="pdT"><span class="pk">' + label + '</span><input type="time" data-i="' + i + '" data-f="' + f + '" value="' + esc(d[f]) + '">' +
        (!d[f] && today ? '<button class="pNow" type="button" data-i="' + i + '" data-f="' + f + '">지금</button>' : '') + chip + '</div>';
      const items = d.items.map((it, j) => '<div class="pIt' + (it.d ? ' done' : '') + '"><button class="pCb" type="button" data-i="' + i + '" data-j="' + j + '" aria-label="완료">' + (it.d ? I.check : '') + '</button>' +
        '<input class="pTx" type="text" maxlength="300" data-i="' + i + '" data-j="' + j + '" value="' + esc(it.t) + '"></div>').join('');
      const hol = window.M.holiday(dateKey(dt));
      return '<div class="pDay' + (today ? ' today' : '') + (hol ? ' wk6' : i >= 5 ? ' wk' + i : '') + '">' +
        '<div class="pdH"><b>' + dt.getDate() + '</b><span>' + PL_EN[i] + '요일</span>' + (today ? '<em class="pTodayTag">오늘</em>' : '') + (hol ? '<em class="pHol">' + esc(hol) + '</em>' : '') +
        tapes.map((t) => '<span class="pTape ' + (PL_COLORS.includes(t.c) ? t.c : 'peach') + '">' + esc(t.text || ' ') + '</span>').join('') + '</div>' +
        '<div class="pdTimes">' + tl('in', '출근', o.e ? '<span class="pOt e">조출 ' + fmtM(o.e) + '</span>' : '') +
        tl('out', '퇴근', o.l ? '<span class="pOt l">야근 ' + fmtM(o.l) + '</span>' : o.w ? '<span class="pOt w">' + (i >= 5 ? '주말 ' : '휴일 ') + fmtM(o.w) + '</span>' : '') + '</div>' +
        '<div class="pItems">' + items + '<div class="pIt add"><span class="pCb"></span><input class="pTx" type="text" maxlength="300" data-i="' + i + '" data-add="1" placeholder="+ 할 일"></div></div>' +
      '</div>';
    }).join('');
    if (document.activeElement !== $('plNotes')) $('plNotes').value = plW.notes;
    $('plStdIn').value = st.planner.std.in; $('plStdOut').value = st.planner.std.out;
  }
  function renderPlSum() {
    const wk = { e: 0, l: 0, w: 0 };
    plW.days.forEach((d, i) => { const o = plOt(d, i, !!window.M.holiday(dateKey(plDay(i)))); wk.e += o.e; wk.l += o.l; wk.w += o.w; });
    const th = plDay(3), m = th.getMonth(), y = th.getFullYear();
    const mo = { e: 0, l: 0, w: 0 };
    for (let d = plMonday(new Date(y, m, 1)); d <= new Date(y, m + 1, 0); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      const k = dateKey(d), w = k === plKey() ? plW : st.planner.weeks[k];
      if (!w) continue;
      w.days.forEach((dd, i) => { const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i); if (dt.getMonth() !== m) return; const o = plOt(dd, i, !!window.M.holiday(dateKey(dt))); mo.e += o.e; mo.l += o.l; mo.w += o.w; });
    }
    const ww = (t) => t.w ? ' <small class="plW">· 휴일 ' + fmtM(t.w) + '</small>' : '';
    $('plSum').innerHTML = '<span>주간 합계 <b>' + fmtM(wk.e + wk.l) + '</b>' + ww(wk) + '</span><span>월간 합계 <b>' + fmtM(mo.e + mo.l) + '</b>' + ww(mo) + '</span>';
  }
  const plNowT = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  $('plPrev').innerHTML = I.left; $('plNext').innerHTML = I.right;
  $('plPrev').onclick = () => { plMon = plDay(-7); renderPlan(); };
  $('plNext').onclick = () => { plMon = plDay(7); renderPlan(); };
  $('plToday').onclick = () => { plMon = plMonday(new Date()); renderPlan(); };
  $('plStdBtn').onclick = () => { $('plStd').hidden = !$('plStd').hidden; };
  $('plStdOk').onclick = () => {
    st.planner.std = { ...st.planner.std, in: isT($('plStdIn').value) ? $('plStdIn').value : '09:00', out: isT($('plStdOut').value) ? $('plStdOut').value : '18:00' };
    st.planner.stdMeta = { mt: Math.max(Date.now(), (st.planner.stdMeta.mt || 0) + 1), dirty: true };
    saveState(); scheduleSync(); $('plStd').hidden = true; renderPlan(); toast('기준 시간을 바꿨어요');
  };
  $('plDays').addEventListener('click', (e) => {
    const now = e.target.closest('.pNow');
    if (now) { plW.days[+now.dataset.i][now.dataset.f] = plNowT(); plSave(plW); renderPlan(); return; }
    const cb = e.target.closest('button.pCb');
    if (cb) { const it = plW.days[+cb.dataset.i].items[+cb.dataset.j]; if (it && it.t.trim()) { it.d = !it.d; plSave(plW); renderPlan(); } }
  });
  $('plDays').addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'time') { plW.days[+t.dataset.i][t.dataset.f] = isT(t.value) ? t.value : ''; plSave(plW); renderPlan(); }
  });
  $('plDays').addEventListener('input', (e) => {
    const t = e.target; if (!t.classList.contains('pTx')) return;
    const d = plW.days[+t.dataset.i];
    if (t.dataset.add) {
      if (!t.value) return;
      d.items.push({ t: t.value, d: false }); plSave(plW);
      const i = t.dataset.i; renderPlan();
      const ins = $('plDays').querySelectorAll('.pTx[data-i="' + i + '"]:not([data-add])'); const last = ins[ins.length - 1];
      if (last) { last.focus(); last.setSelectionRange(last.value.length, last.value.length); }
      return;
    }
    d.items[+t.dataset.j].t = t.value; plSave(plW);
  });
  $('plDays').addEventListener('keydown', (e) => {
    const t = e.target; if (!t.classList || !t.classList.contains('pTx') || e.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); const add = $('plDays').querySelector('.pTx[data-add][data-i="' + t.dataset.i + '"]'); if (add) add.focus(); }
  });
  $('plDays').addEventListener('focusout', (e) => {
    const t = e.target; if (!t.classList || !t.classList.contains('pTx') || t.dataset.add) return;
    setTimeout(() => {
      const d = plW.days[+t.dataset.i];
      if (d && d.items[+t.dataset.j] && !d.items[+t.dataset.j].t.trim()) { d.items.splice(+t.dataset.j, 1); plSave(plW); renderPlan(); }
      else if (plPending && !$('vPlan').contains(document.activeElement)) { plPending = false; renderPlan(); }
    }, 0);
  });
  $('plNotes').addEventListener('input', (e) => { plW.notes = e.target.value; plSave(plW); });
  $('plNotes').addEventListener('blur', () => { if (plPending) { plPending = false; renderPlan(); } });

  // 설정
  function renderSet() {
    renderInstall();   // 달력에서 바로 설정으로 와도 설치 안내가 맞게
    $('acctName').textContent = (session && session.username) || '';
    $('bodyBg').setAttribute('aria-pressed', String(!!prefs.bodyBg));
    if (document.activeElement !== $('fontScale')) $('fontScale').value = prefs.fontScale || 100;
    $('fontScaleV').textContent = (prefs.fontScale || 100) + '%';
    if (document.activeElement !== $('titleScale')) $('titleScale').value = prefs.titleScale || 100;
    $('titleScaleV').textContent = (prefs.titleScale || 100) + '%';
    $('titleBold').setAttribute('aria-pressed', String(prefs.titleBold !== false));
    $('calFont').innerHTML = window.M.calFontOptions(prefs).map((o) => '<option value="' + o.id + '"' + ((prefs.calFont || 'same') === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('');
    if (document.activeElement !== $('calScale')) $('calScale').value = prefs.calScale || 100;
    $('widgetSet').hidden = !window.MallangAndroid;
    const wa = prefs.widgetAlpha == null ? 100 : prefs.widgetAlpha;
    if (document.activeElement !== $('wAlpha')) $('wAlpha').value = wa;
    $('wAlphaV').textContent = wa + '%';
    $('calScaleV').textContent = (prefs.calScale || 100) + '%';
    window.M.syncRanges();
    $('avatar').textContent = ((session && session.username) || '?').slice(0, 1).toUpperCase();
    const GROUPS = [['기본 스킨', ['lav']], ['컬러 스킨', ['pink', 'cotton', 'blue', 'midnight']], ['디자인 스킨', ['peach', 'forest', 'honey', 'sky', 'aurora']],
      ['페이퍼 스킨', ['office', 'sage', 'berry']], ['말랑 스킨', ['draw']], ['시즌 스킨', ['halloween', 'xmas', 'ghalloween', 'gxmas']], ['베타 스킨', ['retro', 'excel', 'ninja']]];
    const listed = new Set(GROUPS.flatMap((g) => g[1]));
    GROUPS[1][1] = GROUPS[1][1].concat(Object.keys(SKINS).filter((id) => !listed.has(id)));
    const openSk = (st.shared && st.shared.openSkins) || [];
    const visible = (id) => SKINS[id] && !SKINS[id].pcOnly && (SKINS[id].beta ? (openSk.includes(id) || !!(st.shared && st.shared.admin) || prefs.skin === id) : (!SKINS[id].season || window.M.SEASONS_ON || prefs.skin === id));
    const btn = (id) => {
      const k = SKINS[id];
      return '<button class="skin' + (prefs.skin === id ? ' on' : '') + '" type="button" data-skin="' + id + '" aria-pressed="' + (prefs.skin === id) + '" style="--sc:' + k.a1 + '">' +
        (k.bunny ? '<span class="sw swDraw' + (k.deco || k.glassSeason ? ' swDeco' : '') + '" style="background:' + (k.season || k.deco || k.beta ? k.b[0] : '') + '"><img src="' + k.bunny + '" alt=""></span>'
          : '<span class="sw" style="background:linear-gradient(135deg,' + k.b[0] + ',' + k.b[2] + ')"><b style="background:linear-gradient(135deg,' + k.a1 + ',' + k.a2 + ')"></b></span>') +
        '<span class="sn">' + k.name + (k.beta && !openSk.includes(id) ? ' <em class="sbeta">베타</em>' : '') + '</span></button>';
    };
    $('skins').innerHTML = '<div class="skg">' + GROUPS.flatMap((g) => g[1]).filter(visible).map(btn).join('') + '</div>';
    $('fonts').innerHTML = FONTS.map((f) =>
      '<button class="font' + (prefs.font === f.id ? ' on' : '') + '" type="button" data-font="' + f.id + '" aria-pressed="' + (prefs.font === f.id) + '"><span><span style="font-family:' + f.fam.replace(/"/g, '') + ';font-size:' + (f.size + 2) + 'px">오늘의 메모, 가나다</span><span class="fn">' + f.name + '</span></span></button>'
    ).join('');
  }
  $('skins').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (!b) return; prefs.skin = b.dataset.skin; savePrefs(); applyPrefs(); renderSet(); });
  const setFs = (v) => { prefs.fontScale = Math.min(170, Math.max(70, v)); savePrefs(); applyPrefs(); $('fontScale').value = prefs.fontScale; $('fontScaleV').textContent = prefs.fontScale + '%'; };
  $('fontScale').addEventListener('input', (e) => setFs(Number(e.target.value)));
  $('titleScale').addEventListener('input', (e) => { prefs.titleScale = Number(e.target.value); savePrefs(); applyPrefs(); $('titleScaleV').textContent = prefs.titleScale + '%'; });
  $('titleBold').onclick = () => { prefs.titleBold = prefs.titleBold === false; savePrefs(); applyPrefs(); renderSet(); };
  $('fsDown').onclick = () => setFs((prefs.fontScale || 100) - 10);
  $('fsUp').onclick = () => setFs((prefs.fontScale || 100) + 10);
  $('calFont').addEventListener('change', (e) => { prefs.calFont = e.target.value; savePrefs(); applyPrefs(); });
  const setCs = (v) => { prefs.calScale = Math.min(150, Math.max(70, v)); savePrefs(); applyPrefs(); $('calScale').value = prefs.calScale; $('calScaleV').textContent = prefs.calScale + '%'; };
  $('calScale').addEventListener('input', (e) => setCs(Number(e.target.value)));
  $('wAlpha').addEventListener('input', (e) => { prefs.widgetAlpha = Math.min(100, Math.max(0, Number(e.target.value) || 0)); savePrefs(); $('wAlphaV').textContent = prefs.widgetAlpha + '%'; pushWidget(); });
  $('csDown').onclick = () => setCs((prefs.calScale || 100) - 10);
  $('csUp').onclick = () => setCs((prefs.calScale || 100) + 10);
  $('fonts').addEventListener('click', (e) => { const b = e.target.closest('[data-font]'); if (!b) return; prefs.font = b.dataset.font; savePrefs(); applyPrefs(); renderSet(); });
  $('logout').onclick = () => logout(false);
  $('bodyBg').onclick = () => { prefs.bodyBg = !prefs.bodyBg; savePrefs(); applyPrefs(); renderSet(); };

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
    $('editor').style.setProperty('--tint', rgba(sk.pal[(m.slot || 0) % 5][0], 1));
    $('editor').style.background = sk.paper ? '#FFFFFF' : 'linear-gradient(160deg,' + rgba(sk.pal[(m.slot || 0) % 5][0], 1) + ',' + rgba(sk.pal[(m.slot || 0) % 5][1], 1) + ')';
    $('edMarkIcon').innerHTML = m.mark ? markSvg(m.mark, m.markColor || '#E8456B', 22) : '';
    const typing = document.activeElement && $('editor').contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON';
    if (fromRemote && typing) return;
    $('edTitle').value = m.title || '';
    const chk = m.type === 'check', tb = m.type === 'table';
    $('edType').classList.toggle('on', chk);
    $('edType').setAttribute('aria-pressed', String(chk));
    $('edTableBtn').classList.toggle('on', tb);
    $('edTableBtn').setAttribute('aria-pressed', String(tb));
    $('edText').hidden = chk || tb;
    $('edChecks').hidden = !chk;
    $('edTbl').hidden = !tb;
    $('edDiv').hidden = chk || tb;
    if (chk) renderItems(); else if (tb) edTable.setRows((m.table && m.table.rows) || null); else edBody.setText(m.text || '');
    if (!$('edPicker').hidden) renderPicker();
  }
  function closeEditor(silent) {
    if ($('editor').hidden) return;
    const m = ed();
    // 아무것도 안 쓴 새 메모는 남기지 않음
    if (m && !m.title && !m.text && !(m.items || []).some((x) => x.t) && !(m.table && m.table.rows.some((r) => r.some((c) => c.trim()))) && m.isNew) {
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
  const edBody = window.M.lineEditor($('edText'), () => { const m = ed(); if (m) { m.text = edBody.getText(); touch(m); } });
  $('edDiv').innerHTML = icon('<path d="M3 12h18"/><path d="M8 6h8M8 18h8" opacity=".45"/>', 21, 2);
  $('edDiv').addEventListener('pointerdown', (e) => e.preventDefault());   // 누를 때 글자 칸 커서를 잃지 않게
  $('edDiv').onclick = () => edBody.insertDivider();
  $('edTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const m = ed(); if (m && m.type === 'check') focusItem(0); else if (m && m.type === 'table') edTable.focusFirst(); else edBody.focusEnd(); } });
  const copyText = (t) => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject(new Error('no clipboard'))).then(() => toast('표를 복사했어요'), () => toast('복사하지 못했어요'));
  const edTable = window.M.tableEditor($('edTbl'), {
    copy: copyText,
    onChange: (rows) => { const m = ed(); if (m) { m.table = { rows }; m.text = window.M.tableToText(rows); touch(m); } }
  });
  const memoText = (m) => (m.type === 'check' ? (m.items || []).map((x) => x.t).filter((t) => t.trim()).join('\n') : m.text || '');
  $('edTableBtn').onclick = () => {
    const m = ed(); if (!m) return;
    if (m.type === 'table') { m.type = 'text'; m.text = window.M.tableToText((m.table && m.table.rows) || []); m.table = null; }
    else { m.table = window.M.textToTable(memoText(m)); m.text = window.M.tableToText(m.table.rows); m.type = 'table'; }
    touch(m); fillEditor();
    if (m.type === 'table') setTimeout(() => edTable.focusFirst(), 60);
  };

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
    if (m.type === 'check') { m.type = 'text'; m.text = memoText(m); }
    else { const lines = window.M.stripDividers(m.text).split('\n').filter((l) => l.trim()); m.type = 'check'; m.items = lines.length ? lines.map((t) => ({ t, d: false })) : [{ t: '', d: false }]; }
    touch(m); fillEditor();
    if (m.type === 'check' && !m.items[0].t) focusItem(0);
  };

  // ───────── 연락망 ─────────
  let peopleEditing = false, peopleOrdering = false;
  const people = window.M.tableEditor($('people'), {
    head: window.M.CONTACT_HEAD, editable: false, copy: copyText,
    onChange: (rows) => {
      if (st.shared && st.shared.contacts) {
        if (!st.shared.admin) return;
        st.shared.contacts = rows; st.shared.dirty = true;
        saveState(); scheduleSync();
        people.filter($('pq').value);
        return;
      }
      const prev = (st.contacts && st.contacts.mt) || 0;
      st.contacts = { rows, mt: Math.max(Date.now(), prev + 1), dirty: true };
      saveState(); scheduleSync();
      people.filter($('pq').value);
    }
  });
  const peopleGv = window.M.contactView($('peopleGv'), {
    store: 'mallang.people.closed',
    order: () => prefs.peopleOrder || null,
    onOrder: (o) => { prefs.peopleOrder = o; savePrefs(); },
    onPick: (v, row, el) => {
      el.classList.add('picked'); setTimeout(() => el.classList.remove('picked'), 600);
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject(new Error('x'))).then(() => toast('‘' + v + '’ 복사했어요'), () => toast(v));
    }
  });
  function renderPeople(fromRemote) {
    if (fromRemote && people.isEditing()) return;
    if (peopleEditing && !canEditContacts()) { setPeopleEdit(false); return; }
    people.setRows(contactRows());
    people.filter($('pq').value);
    $('people').hidden = !peopleEditing;
    $('peopleGv').hidden = peopleEditing;
    $('pEdit').hidden = !canEditContacts();
    $('pOrd').hidden = peopleEditing;
    if (!peopleEditing) { peopleGv.setRows(contactRows() || [window.M.CONTACT_HEAD]); peopleGv.filter($('pq').value); }
    $('pHint').textContent = peopleOrdering ? '▲▼로 부서·사람 순서를 바꿔요 · 이 폰에만 적용돼요' : st.shared && st.shared.contacts && !peopleEditing ? '회사 공통 연락망 · 번호를 누르면 복사돼요' : peopleEditing ? '엑셀에서 복사해 붙여넣을 수 있어요. 첫 줄은 머리글(부서 · 이름 · 내선)이에요.' : '번호를 누르면 복사돼요 · 부서 이름을 누르면 접혀요';
  }
  function setPeopleEdit(on) {
    peopleEditing = on;
    $('pEdit').textContent = on ? '완료' : '편집';
    $('pEdit').classList.toggle('on', on);
    $('pEdit').setAttribute('aria-pressed', String(on));
    people.setEditable(on);
    if (view === 'people') renderPeople();
  }
  $('pEdit').onclick = () => { if (peopleOrdering) setPeopleOrd(false); setPeopleEdit(!peopleEditing); };
  function setPeopleOrd(on) {
    peopleOrdering = on;
    if (on && peopleEditing) setPeopleEdit(false);
    if (on && $('pq').value) { $('pq').value = ''; people.filter(''); peopleGv.filter(''); }
    $('pOrd').textContent = on ? '완료' : '순서';
    $('pOrd').classList.toggle('on', on);
    $('pOrd').setAttribute('aria-pressed', String(on));
    peopleGv.setOrdering(on);
    $('pHint').textContent = on ? '▲▼로 부서·사람 순서를 바꿔요 · 이 폰에만 적용돼요' : '';
    if (!on && view === 'people') renderPeople();
  }
  $('pOrd').onclick = () => setPeopleOrd(!peopleOrdering);
  $('pq').addEventListener('input', () => { people.filter($('pq').value); peopleGv.filter($('pq').value); });
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
  $('pSearchIcon').innerHTML = ICONS.search;
  $('edTableBtn').innerHTML = ICONS.table.replace('width="15" height="15"', 'width="21" height="21"');
  $('calPrev').innerHTML = I.left; $('calNext').innerHTML = I.right;
  $('edBack').innerHTML = I.back;
  $('edMark').innerHTML = ICONS.starLine.replace('width="15" height="15"', 'width="21" height="21"');
  $('edType').innerHTML = ICONS.list.replace('width="15" height="15"', 'width="21" height="21"');
  $('edDel').innerHTML = ICONS.trash.replace('width="15" height="15"', 'width="21" height="21"');
  setInterval(renderSync, 30000);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  boot();
})();
