// 말랑 알람: 정한 시간에 시간·메모와 함께 요란하게
(function () {
  const api = window.api;
  const $ = (s) => document.getElementById(s);
  const M = window.M;
  let S = null, cur = null, stopSound = () => {}, soundT = null, testT = null;
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const DAYN = ['일', '월', '화', '수', '목', '금', '토'];

  function skin() { return (S && M.SKINS[S.settings.skin]) || M.SKINS.lav; }
  function style() { if (S) M.applyTheme(S.settings); }

  function art() {
    const sk = skin(), draw = !!(sk.draw || sk.paper);
    $('art').className = 'art ' + (draw ? 'gd' : 'g3');
    $('art').innerHTML = draw
      ? ['ring', 'clock', 'excl', 'bunny', 'lines'].map((n) => '<img class="' + n + '" src="alarm/almd-' + n + '.png" alt="" draggable="false">').join('')
      : ['shine', 'bunny', 'clock', 'excl', 'lines'].map((n) => '<img class="' + n + '" src="alarm/alm3-' + n + '.png" alt="" draggable="false">').join('');
  }
  // 파티 폭죽: 말랑이가 있는 위쪽(왼쪽 위 ~ 가운데 위)은 비우고 퍼짐
  function party(on) {
    if (!on) { $('party').innerHTML = ''; return; }
    const sk = skin(), id = S.settings.skin;
    const set = M.ALARM_PARTY[id] || (sk.draw || sk.paper ? M.ALARM_PARTY.draw : M.ALARM_PARTY.lav);
    const N = 14, A0 = -20, A1 = 195;
    let h = '';
    for (let i = 0; i < N; i++) {
      const ang = (A0 + (A1 - A0) * (i + 0.5) / N + (i % 2 ? 5 : -4)) * Math.PI / 180, rad = 200 + (i * 37 % 80);
      const x = Math.round(Math.cos(ang) * rad * 1.25), y = Math.round(Math.sin(ang) * rad * 0.8);
      const name = set[i % set.length], arrow = M.ALARM_ARROW[name];
      const deg = Math.atan2(y, x) * 180 / Math.PI;
      const w = arrow != null ? 40 + (i * 7 % 14) : 22 + (i * 13 % 22);
      const r0 = arrow != null ? deg - arrow : 0, r = arrow != null ? r0 + (i % 2 ? 8 : -8) : (i % 2 ? 1 : -1) * (120 + i * 17 % 160);
      h += '<i class="pt' + (i % 4 === 0 ? ' front' : '') + '" style="--u:url(alarm/' + name + '.png);--w:' + w + 'px;--x:' + x + 'px;--y:' + y + 'px;--r0:' + r0 + 'deg;--r:' + r + 'deg;--d:' + (0.12 + (i % 5) * 0.04) + 's"></i>';
    }
    $('party').innerHTML = h + '<i class="wave"></i>';
  }

  function show(a) {
    cur = a;
    if (!a) return;
    style();
    const d = new Date(), h = d.getHours();
    $('tm').innerHTML = '<small>' + (h < 12 ? '오전' : '오후') + '</small>' + ((h % 12) || 12) + ':' + pad(d.getMinutes());
    $('lab').textContent = '⏰ 알람' + (a.test ? ' · 미리보기' : a.snoozed ? ' · ' + a.snoozed + '분 뒤 다시 알림' : a.days && a.days.length ? ' · ' + (a.days.length === 7 ? '매일' : a.days.map((x) => DAYN[x]).join(' ')) : ' · 오늘 한 번');
    $('memo').textContent = a.memo || '';
    document.body.className = 'fx-' + (a.fx || 'boing');
    const sk = skin();
    document.documentElement.style.setProperty('--fl', sk.draw ? 'rgba(22,22,22,.55)' : (sk.glow || 'rgba(110,100,230,.5)').replace(/[\d.]+\)$/, '.85)'));
    art();
    party(a.fx === 'party');
    const w = $('wrap');
    w.classList.remove('in', 'out'); void w.offsetWidth; w.classList.add('in');
    // 소리: 1분 동안 울리고 그 뒤로는 화면만 (미리보기는 한 번만)
    stopSound(); clearTimeout(soundT);
    stopSound = M.alarmSound(a.snd || 'ding', { once: !!a.test });
    soundT = setTimeout(() => stopSound(), 60 * 1000);
    setTimeout(sendRect, 700);
    // 미리보기는 20초 뒤 저절로 닫힘
    clearTimeout(testT);
    if (a.test) testT = setTimeout(() => act('ok'), 20 * 1000);
  }
  function act(x) {
    clearTimeout(testT);
    stopSound(); clearTimeout(soundT);
    over = false;
    api.alarmMouse(false);
    api.alarmAct(x);
  }
  $('s5').addEventListener('click', () => act('snooze5'));
  $('s10').addEventListener('click', () => act('snooze10'));
  $('ok').addEventListener('click', () => act('ok'));
  // 카드 위에 마우스가 있을 때만 클릭을 받음 (나머지는 아래 창으로)
  // 창 쪽에서 마우스 위치로 판단하도록 카드 자리를 알려 줌 (Windows에서 확실하게)
  function sendRect() {
    const r = $('card').getBoundingClientRect();
    api.alarmRect({ x: Math.round(r.left), y: Math.round(r.top) - 20, w: Math.round(r.width), h: Math.round(r.height) + 40 });
  }
  let over = false;
  document.addEventListener('mousemove', (e) => {
    const on = $('card').contains(e.target);
    if (on !== over) { over = on; api.alarmMouse(on); }
  });

  api.onCmd((c) => {
    if (c.type === 'alarm') show(c.alarm);
    if (c.type === 'leave') { stopSound(); $('wrap').classList.add('out'); party(false); document.body.className = ''; }
  });
  api.onState((s) => { S = s; if (cur) { style(); } });
  api.init().then(async (s) => { S = s; style(); show(await api.alarmGet()); });
})();
