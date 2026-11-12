// 바탕화면 '주간 플래너' 위젯: 월~일 7칸에 할 일·출퇴근·마스킹테이프·스티커, 할 일은 바로 체크·추가
(function () {
  const api = window.api;
  const { esc, dateKey, applyTheme, ICONS } = window.M;
  const $ = (id) => document.getElementById(id);
  const EN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const MAX_SHOW = 6;   // 칸마다 보여 줄 할 일 수 (넘으면 +N)
  const w = $('w');
  window.M.guardHTML($('hdr'), $('tl'), $('body'));
  $('prev').innerHTML = ICONS.left; $('next').innerHTML = ICONS.right;
  let S = null, W = null, adding = -1, saveT = 0;
  const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  let monday = mondayOf(new Date());
  const dayAt = (i) => { const x = new Date(monday); x.setDate(x.getDate() + i); return x; };
  const blank = () => ({ notes: '', days: Array.from({ length: 7 }, () => ({ in: '', out: '', items: [] })), tapes: [], stickers: [], habits: [] });
  const isCk = (e) => /^ck:[a-z0-9]+$/.test(e);

  async function load() {
    const r = await api.plannerGet(dateKey(monday));
    W = r && r.week ? r.week : blank();
    render();
  }
  function save() {
    clearTimeout(saveT);
    const key = dateKey(monday), copy = JSON.parse(JSON.stringify(W));
    saveT = setTimeout(() => { saveT = 0; api.plannerSet(key, copy); }, 250);
  }
  // 몇째 주: 그 주 목요일이 속한 달 기준 (달력에서 흔히 쓰는 방식)
  function weekLabel() {
    const th = dayAt(3), m = th.getMonth(), first = new Date(th.getFullYear(), m, 1);
    const firstTh = new Date(first); firstTh.setDate(1 + ((4 - first.getDay() + 7) % 7));
    return (m + 1) + '월 ' + (Math.floor((th.getDate() - firstTh.getDate()) / 7) + 1) + '주차';
  }
  function render() {
    if (!S || !W) return;
    const sk = applyTheme(S.settings).sk;
    const a = (S.settings.alpha != null ? S.settings.alpha : 60) / 100;
    w.style.background = sk.paper ? '#FFFFFF' : 'rgba(var(--glass),' + Math.max(0.2, a - 0.1) + ')';
    document.documentElement.style.setProperty('--sun', sk.sun);
    document.documentElement.style.setProperty('--sat', sk.sat);
    const d0 = dayAt(0), d6 = dayAt(6), todayK = dateKey(new Date());
    $('wk').textContent = weekLabel();
    $('rg').textContent = (d0.getMonth() + 1) + '.' + d0.getDate() + ' – ' + (d6.getMonth() + 1) + '.' + d6.getDate();
    $('thisWeek').hidden = dateKey(monday) === dateKey(mondayOf(new Date()));
    // 요일 머리
    $('hdr').innerHTML = EN.map((k, i) => {
      const d = dayAt(i), dk = dateKey(d), hol = window.M.holiday(dk);
      return '<button type="button" class="dh' + (i === 5 && !hol ? ' sat' : '') + (i === 6 || hol ? ' sun' : '') + (dk === todayK ? ' cur' : '') + '" data-i="' + i + '" title="큰 플래너로 열기"><span class="n">' + d.getDate() + '</span><span class="k">' + k + '</span>' + (hol ? '<span class="h">' + esc(hol) + '</span>' : '') + '</button>';
    }).join('');
    // 마스킹테이프 (겹치면 아래 줄로)
    const rows = [];
    $('tl').innerHTML = W.tapes.map((t) => {
      let r = 0; while (rows[r] && rows[r].some((x) => !(t.b < x[0] || t.a > x[1]))) r++;
      (rows[r] = rows[r] || []).push([t.a, t.b]);
      return '<div class="tape ' + t.c + '" style="grid-column:' + (t.a + 1) + ' / ' + (t.b + 2) + ';grid-row:' + (r + 1) + '" title="' + esc(t.text) + '">' + (t.text ? '<span>' + esc(t.text) + '</span>' : '') + '</div>';
    }).join('');
    $('tl').hidden = !W.tapes.length;
    // 스티커: 큰 플래너에 붙인 자리(가로 위치)로 요일 칸을 찾아 칸 아래에
    const stk = Array.from({ length: 7 }, () => []);
    for (const s of W.stickers) { const col = Math.max(0, Math.min(6, Math.floor((s.x - 17) / (83 / 7)))); if (stk[col].length < 4) stk[col].push(s); }
    $('body').innerHTML = W.days.map((d, i) => {
      const dk = dateKey(dayAt(i));
      const items = d.items.map((it, j) => ({ it, j })).filter((x) => x.it.t);
      const show = items.slice(0, MAX_SHOW);
      const tm = d.in || d.out ? '<div class="wt">' + esc(d.in || '--:--') + ' ~ ' + esc(d.out || '--:--') + '</div>' : '';
      return '<div class="day' + (dk === todayK ? ' cur' : '') + '" data-i="' + i + '">' + tm +
        show.map((x) => '<div class="it' + (x.it.d ? ' done' : '') + '" data-i="' + i + '" data-j="' + x.j + '" title="' + esc(x.it.t) + '"><span class="cb"></span><span class="tx">' + esc(x.it.t) + '</span></div>').join('') +
        (items.length > MAX_SHOW ? '<div class="more">+' + (items.length - MAX_SHOW) + '개 더</div>' : '') +
        (adding === i ? '<input class="addIn" data-i="' + i + '" maxlength="300" placeholder="할 일 쓰고 Enter">' : '<button type="button" class="add" data-i="' + i + '">+ 할 일</button>') +
        (stk[i].length ? '<div class="stks">' + stk[i].map((s) => '<span style="--r:' + s.r + 'deg">' + (isCk(s.e) ? '<img src="skin/ck-' + s.e.slice(3) + '.png" alt="" draggable="false">' : esc(s.e)) + '</span>').join('') + '</div>' : '') +
        '</div>';
    }).join('');
    const inp = w.querySelector('.addIn');
    if (inp) inp.focus();
    requestAnimationFrame(() => api.plwSize(w.getBoundingClientRect().height + 28));
  }
  // 할 일 체크
  $('body').addEventListener('click', (e) => {
    const it = e.target.closest('.it');
    if (it) { const x = W.days[+it.dataset.i].items[+it.dataset.j]; if (x) { x.d = !x.d; save(); render(); } return; }
    const add = e.target.closest('.add');
    if (add) { adding = +add.dataset.i; api.plwFocus(); render(); }
  });
  // 할 일 추가 (Enter: 추가하고 계속, Esc·빈 칸: 그만)
  $('body').addEventListener('keydown', (e) => {
    const inp = e.target.closest('.addIn'); if (!inp) return;
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      const t = inp.value.trim(), i = +inp.dataset.i;
      if (t && W.days[i].items.length < 40) { W.days[i].items.push({ t: t.slice(0, 300), d: false }); save(); }
      if (!t) adding = -1;
      render();
    } else if (e.key === 'Escape') { adding = -1; render(); }
  });
  $('body').addEventListener('focusout', (e) => {
    const inp = e.target.closest('.addIn'); if (!inp) return;
    setTimeout(() => {
      if (document.activeElement && document.activeElement.classList.contains('addIn')) return;
      const t = inp.value.trim(), i = +inp.dataset.i;
      if (t && W.days[i].items.length < 40) { W.days[i].items.push({ t: t.slice(0, 300), d: false }); save(); }
      adding = -1; render();
    }, 0);
  });
  $('hdr').addEventListener('click', (e) => { const b = e.target.closest('.dh'); if (b) api.plannerOpenAt(dateKey(monday)); });
  $('open').addEventListener('click', () => api.plannerOpenAt(dateKey(monday)));
  const go = (n) => { if (saveT) { clearTimeout(saveT); saveT = 0; api.plannerSet(dateKey(monday), W); } adding = -1; monday.setDate(monday.getDate() + n * 7); monday = new Date(monday); load(); };
  $('prev').addEventListener('click', () => go(-1));
  $('next').addEventListener('click', () => go(1));
  $('thisWeek').addEventListener('click', () => { adding = -1; monday = mondayOf(new Date()); load(); });

  // 머리 부분을 끌어서 옮기기
  const hd = $('hd');
  let drag = null, raf = 0, pend = null;
  hd.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    e.preventDefault();
    drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    hd.setPointerCapture(e.pointerId);
  });
  hd.addEventListener('pointermove', (e) => {
    if (!drag) return;
    pend = { x: drag.wx + e.screenX - drag.sx, y: drag.wy + e.screenY - drag.sy };
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; api.plwMove(pend.x, pend.y, false); });
  });
  hd.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    api.plwMove(d.wx + e.screenX - d.sx, d.wy + e.screenY - d.sy, true);
  });

  api.onCmd((c) => {
    if (c.type === 'leave') { if (saveT) { clearTimeout(saveT); saveT = 0; api.plannerSet(dateKey(monday), W); } w.classList.add('leaving'); }
    if (c.type === 'plReload' && adding < 0 && !saveT) load();   // 큰 플래너·다른 기기에서 바뀌면 다시 읽기
  });
  window.addEventListener('beforeunload', () => { if (saveT) { clearTimeout(saveT); saveT = 0; api.plannerSet(dateKey(monday), W); } });
  api.onState((s) => { S = s; render(); });
  api.init().then((s) => { S = s; load(); });
  // 자정이 지나면 오늘 표시 갱신 (주가 바뀌면 이번 주로)
  let lastDay = dateKey(new Date());
  setInterval(() => {
    const k = dateKey(new Date());
    if (k === lastDay) return;
    const wasThis = dateKey(monday) === dateKey(mondayOf(new Date(Date.now() - 86400000)));
    lastDay = k;
    if (wasThis) { monday = mondayOf(new Date()); load(); } else render();
  }, 60000);
})();
