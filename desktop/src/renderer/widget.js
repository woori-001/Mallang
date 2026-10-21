// 바탕화면 '오늘 일정' 위젯
(function () {
  const api = window.api;
  const { EVENT_COLORS, esc, dateKey, applyTheme } = window.M;
  const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const w = document.getElementById('w');
  window.M.guardHTML(document.getElementById('list'));
  let S = null;

  function render() {
    if (!S) return;
    applyTheme(S.settings);
    const a = (S.settings.alpha != null ? S.settings.alpha : 60) / 100;
    w.style.background = 'rgba(var(--glass),' + Math.max(0.2, a - 0.1) + ')';
    const d = new Date();
    const evs = (S.events[dateKey(d)] || []).slice().sort((x, y) => (x.t || '').localeCompare(y.t || ''));
    document.getElementById('big').textContent = d.getDate();
    document.getElementById('mon').textContent = MONTH_EN[d.getMonth()];
    document.getElementById('sub').textContent = WD[d.getDay()] + '요일 · 일정 ' + evs.length + '개';
    document.getElementById('list').innerHTML = evs.length
      ? evs.map((e) => '<div class="ev"><span class="dot" style="background:' + EVENT_COLORS[e.c] + '"></span><span class="t">' + esc(e.t || '종일') + '</span><span class="n">' + esc(e.title || '(이름 없음)') + '</span></div>').join('')
      : '<div class="none">오늘은 일정이 없어요</div>';
    requestAnimationFrame(() => api.widgetSize(w.getBoundingClientRect().height + 28));
  }

  // 끌어서 옮기기
  let drag = null, raf = 0, pend = null;
  w.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    w.setPointerCapture(e.pointerId);
  });
  w.addEventListener('pointermove', (e) => {
    if (!drag) return;
    pend = { x: drag.wx + e.screenX - drag.sx, y: drag.wy + e.screenY - drag.sy };
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; api.widgetMove(pend.x, pend.y, false); });
  });
  w.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    api.widgetMove(d.wx + e.screenX - d.sx, d.wy + e.screenY - d.sy, true);
  });

  api.onCmd((c) => { if (c.type === 'leave') w.classList.add('leaving'); });
  api.onState((s) => { S = s; render(); });
  api.init().then((s) => { S = s; render(); });
  setInterval(render, 60000);
})();
