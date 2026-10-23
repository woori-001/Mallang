// 바탕화면 '달력' 위젯: 날짜를 누르면 아래에 그날 일정
(function () {
  const api = window.api;
  const { EVENT_COLORS, esc, dateKey, applyTheme, ICONS } = window.M;
  const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const $ = (id) => document.getElementById(id);
  const w = $('w');
  window.M.guardHTML($('grid'), $('list'));
  $('prev').innerHTML = ICONS.left; $('next').innerHTML = ICONS.right;
  let S = null;
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth(), sel = dateKey(now);

  function render() {
    if (!S) return;
    const sk = applyTheme(S.settings).sk;
    const a = (S.settings.alpha != null ? S.settings.alpha : 60) / 100;
    w.style.background = sk.paper ? '#FFFFFF' : 'rgba(var(--glass),' + Math.max(0.2, a - 0.1) + ')';
    document.documentElement.style.setProperty('--sun', sk.sun);
    document.documentElement.style.setProperty('--sat', sk.sat);
    $('num').textContent = String(m + 1);
    $('en').textContent = MONTH_EN[m] + ' ' + y;
    const todayK = dateKey(new Date());
    const start = new Date(y, m, 1).getDay();
    const count = Math.ceil((start + new Date(y, m + 1, 0).getDate()) / 7) * 7;
    const rec = window.M.recurring(S.events);
    let h = '';
    for (let i = 0; i < count; i++) {
      const dt = new Date(y, m, i - start + 1);
      if (dt.getMonth() !== m) { h += '<div class="cell"></div>'; continue; }
      const k = dateKey(dt), wd = dt.getDay();
      const evs = window.M.eventsOn(S.events, k, rec).map((x) => x.ev);
      const color = wd === 0 ? 'var(--sun)' : (wd === 6 ? 'var(--sat)' : 'var(--ink)');
      h += '<div class="cell"><button type="button" class="day' + (k === todayK ? ' today' : '') + (k === sel ? ' sel' : '') + '" data-k="' + k + '" style="color:' + color + '">' +
        '<span>' + dt.getDate() + '</span><span class="dots">' + evs.slice(0, 3).map((e) => '<i style="background:' + EVENT_COLORS[e.c] + '"></i>').join('') + '</span></button></div>';
    }
    $('grid').innerHTML = h;
    const p = sel.split('-').map(Number), sd = new Date(p[0], p[1] - 1, p[2]);
    const list = window.M.eventsOn(S.events, sel);
    $('evh').textContent = (sd.getMonth() + 1) + '월 ' + sd.getDate() + '일 ' + WD[sd.getDay()] + '요일 · 일정 ' + list.length + '개';
    $('list').innerHTML = list.length
      ? list.map((x) => '<div class="ev"><span class="dot" style="background:' + EVENT_COLORS[x.ev.c] + '"></span><span class="t">' + esc(/^\d{2}:\d{2}$/.test(x.ev.t) ? x.ev.t : '종일') + '</span><span class="n">' + esc(x.ev.title || '(이름 없음)') + '</span>' + (x.ev.r ? '<span class="rep">↻ ' + window.M.REPEAT_NAME[x.ev.r] + '</span>' : '') + '</div>').join('')
      : '<div class="none">일정이 없어요</div>';
    requestAnimationFrame(() => api.calwSize(w.getBoundingClientRect().height + 28));
  }
  $('grid').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { sel = b.dataset.k; render(); } });
  $('prev').addEventListener('click', () => { m--; if (m < 0) { m = 11; y--; } render(); });
  $('next').addEventListener('click', () => { m++; if (m > 11) { m = 0; y++; } render(); });
  $('today').addEventListener('click', () => { const d = new Date(); y = d.getFullYear(); m = d.getMonth(); sel = dateKey(d); render(); });

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
    raf = requestAnimationFrame(() => { raf = 0; api.calwMove(pend.x, pend.y, false); });
  });
  hd.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    api.calwMove(d.wx + e.screenX - d.sx, d.wy + e.screenY - d.sy, true);
  });

  api.onCmd((c) => { if (c.type === 'leave') w.classList.add('leaving'); });
  api.onState((s) => { S = s; render(); });
  api.init().then((s) => { S = s; render(); });
  // 자정이 지나면 오늘 표시 갱신
  let lastDay = dateKey(new Date());
  setInterval(() => { const k = dateKey(new Date()); if (k !== lastDay) { lastDay = k; render(); } }, 60000);
})();
