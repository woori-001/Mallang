// 정각·30분 말랑이 시계
(function () {
  const api = window.api;
  const $ = (s) => document.getElementById(s);
  const clock = $('clock');
  let mode = new URLSearchParams(location.search).get('mode') || 'show', S = null, endT = null;
  const pad = (n) => (n < 10 ? '0' : '') + n;

  function style() {
    if (!S) return;
    window.M.applyTheme(S.settings);
    const s = S.settings;
    clock.style.setProperty('--op', (s.clockAlpha != null ? s.clockAlpha : 75) / 100);
    clock.style.setProperty('--s', (s.clockScale || 100) / 100);
    clock.classList.toggle('dark', !!s.clockDark);
  }
  function play() {
    const d = new Date();
    let m = d.getMinutes();
    m = (S && S.settings.clockMode === 60) || m < 30 ? 0 : 30;
    if (mode === 'show' && d.getMinutes() !== 0 && d.getMinutes() !== 30) m = d.getMinutes();   // 미리보기는 지금 시각
    const t = pad(d.getHours()) + ':' + pad(m);
    $('time').innerHTML = t.split('').map((c, i) => '<span style="animation-delay:' + (0.25 + i * 0.07) + 's">' + c + '</span>').join('');
    clock.classList.remove('show', 'stay');
    void clock.offsetWidth;
    clock.classList.add(mode === 'place' ? 'stay' : 'show');
    $('done').hidden = mode !== 'place';
    clearTimeout(endT);
    if (mode !== 'place') endT = setTimeout(() => api.clockDone(), 6900);
  }

  // 위치 고르기: 끌어서 옮기기
  let drag = null;
  clock.addEventListener('pointerdown', (e) => {
    if (mode !== 'place' || e.button !== 0) return;
    e.preventDefault();
    drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    clock.setPointerCapture(e.pointerId);
  });
  clock.addEventListener('pointermove', (e) => {
    if (!drag) return;
    api.clockMove(drag.wx + e.screenX - drag.sx, drag.wy + e.screenY - drag.sy, false);
  });
  clock.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    api.clockMove(d.wx + e.screenX - d.sx, d.wy + e.screenY - d.sy, true);
  });
  $('done').addEventListener('click', () => api.clockPlace(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mode === 'place') api.clockPlace(false); });

  api.onCmd((c) => { if (c.type === 'clock') { mode = c.mode || 'show'; play(); } });
  api.onState((s) => { S = s; style(); });
  api.init().then((s) => { S = s; style(); play(); });
})();
