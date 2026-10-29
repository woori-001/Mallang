// 말랑 알람: 정한 시간에 시간·메모와 함께 요란하게
(function () {
  const api = window.api;
  const $ = (s) => document.getElementById(s);
  const M = window.M;
  let S = null, cur = null, stopSound = () => {}, soundT = null, testT = null;
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const DAYN = ['일', '월', '화', '수', '목', '금', '토'];

  function skin() { return (S && M.SKINS[S.settings.skin]) || M.SKINS.lav; }
  function style() {
    if (!S) return;
    M.applyTheme(S.settings);
    document.documentElement.style.setProperty('--sc', String((S.settings.alarmScale || 80) / 100));
    $('pos').className = 'pos p-' + (S.settings.alarmPos || 'tc');
  }

  function art() {
    const sk = skin(), draw = !!(sk.draw || sk.paper);
    $('art').className = 'art ' + (draw ? 'gd' : 'g3');
    $('art').innerHTML = draw
      ? ['ring', 'clock', 'excl', 'bunny', 'lines'].map((n) => '<img class="' + n + '" src="alarm/almd-' + n + '.png" alt="" draggable="false">').join('')
      : ['shine', 'bunny', 'clock', 'excl', 'lines'].map((n) => '<img class="' + n + '" src="alarm/alm3-' + n + '.png" alt="" draggable="false">').join('');
  }

  // 스킨 그림: 목록바와 같은 소품을 카드 모서리에 (카드 밖으로 살짝 걸치게)
  const BAT = '<svg viewBox="0 0 60 30" width="46" height="23"><path d="M30 10 C27 6 25 6 24 9 C18 4 8 4 2 12 C8 11 12 14 13 19 C16 15 20 15 22 19 C24 16 27 17 30 22 C33 17 36 16 38 19 C40 15 44 15 47 19 C48 14 52 11 58 12 C52 4 42 4 36 9 C35 6 33 6 30 10 Z" fill="#1E1630"/><circle cx="28" cy="12" r="1.2" fill="#FFD34D"/><circle cx="32" cy="12" r="1.2" fill="#FFD34D"/></svg>';
  const GHOST = '<svg viewBox="0 0 40 46" width="38" height="44"><path d="M6 20 C6 8 14 2 20 2 C26 2 34 8 34 20 L34 42 L29 38 L24 43 L20 38 L16 43 L11 38 L6 42 Z" fill="#FFFFFF" stroke="#1E1630" stroke-width="2.6" stroke-linejoin="round"/><circle cx="15" cy="18" r="2.2" fill="#1E1630"/><circle cx="25" cy="18" r="2.2" fill="#1E1630"/><ellipse cx="20" cy="25" rx="2.4" ry="3" fill="#1E1630"/></svg>';
  const TREE = '<svg viewBox="0 0 40 50" width="40" height="50"><path d="M20 4 L32 20 L26 20 L36 34 L28 34 L38 44 L2 44 L12 34 L4 34 L14 20 L8 20 Z" fill="#2F7A4F" stroke="#1C2B22" stroke-width="2.6" stroke-linejoin="round"/><rect x="16" y="44" width="8" height="5" fill="#8B5A3C" stroke="#1C2B22" stroke-width="2"/><circle cx="17" cy="26" r="2.2" fill="#D7393B"/><circle cx="25" cy="34" r="2.2" fill="#E7B53C"/><circle cx="14" cy="38" r="2.2" fill="#E7B53C"/><circle cx="22" cy="16" r="2" fill="#D7393B"/></svg>';
  const FLAKE = (z, c) => '<svg width="' + z + '" height="' + z + '" viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="' + c + '" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
  const im = (src, css, cls) => '<img src="' + src + '" alt="" class="' + (cls || '') + '" style="' + css + '">';
  function deco() {
    const sk = skin(), id = S.settings.skin;
    let h = '';
    if (sk.deco === 'forest') h = im('leaf-top.svg', 'right:-44px;bottom:-40px;width:120px;transform:scaleY(-1)', 'sw') + im('leaf-bot.svg', 'left:-58px;bottom:-48px;width:118px');
    else if (sk.deco === 'peach') h = im('peach-fruit.png', 'left:112px;top:-34px;width:58px;transform:rotate(-8deg)', 'sw') + im('blossom-pink.png', 'left:168px;top:-12px;width:24px') + im('blossom-white.png', 'right:-12px;bottom:-12px;width:28px', 'sw') + im('blossom-pink.png', 'left:-12px;bottom:26px;width:24px');
    else if (sk.deco === 'lemon') h = im('lemon-slice.png', 'left:112px;top:-34px;width:58px;transform:rotate(-12deg)', 'sw') + im('daisy-white.png', 'left:168px;top:-12px;width:26px') + im('daisy-white.png', 'left:-14px;bottom:24px;width:28px', 'sw') + im('lemon-slice.png', 'right:-10px;bottom:-12px;width:30px');
    else if (sk.deco === 'sky') h = im('sky-cloud.svg', 'left:104px;top:-26px;width:80px', 'sw') + im('sky-cloud.svg', 'left:-28px;top:120px;width:64px') + im('sky-cloud.svg', 'right:60px;bottom:-22px;width:58px');
    else if (sk.deco === 'aurora') h = im('aur-spark-iris.png', 'left:130px;top:-26px;width:32px', 'sw') + im('aur-pearl.png', 'left:-10px;top:110px;width:26px') + im('aur-spark-gold.png', 'right:30px;bottom:-14px;width:26px') + im('aur-pearl-iris.png', 'left:24px;bottom:-10px;width:18px') + im('aur-spark-purple.png', 'right:-8px;bottom:60px;width:18px', 'sw');
    else if (id === 'midnight') h = im('alarm/stk3-moon.png', 'left:110px;top:-36px;width:58px;transform:rotate(-8deg)', 'sw') + im('alarm/stk3-star-y.png', 'left:170px;top:-14px;width:24px') + im('alarm/stk3-spark-iris.png', 'right:-14px;top:54px;width:20px') + im('alarm/stk3-sparks-gold.png', 'left:-14px;bottom:30px;width:34px');
    else if (sk.season === 'halloween' && !sk.draw) h = im('alarm/stk3-bat.png', 'left:112px;top:-30px;width:58px', 'flap') + im('alarm/stk3-bat.png', 'left:-34px;top:112px;width:44px;animation-delay:-.25s', 'flap') + im('alarm/stk3-ghost.png', 'right:-26px;bottom:-24px;width:70px', 'sw') + im('alarm/stk3-moon.png', 'left:-20px;bottom:-18px;width:48px');
    else if (sk.season === 'xmas' && !sk.draw) { h = im('alarm/stk3-tree.png', 'right:-24px;bottom:-22px;width:62px') + im('alarm/stk3-gift.png', 'left:-24px;bottom:-18px;width:52px;transform:rotate(-8deg)'); for (let i = 0; i < 7; i++) h += '<span class="fall" style="left:' + (8 + i * 13) + '%;top:-6px;animation-delay:-' + (i * 0.6) + 's;animation-duration:' + (3.4 + (i % 3) * .7) + 's">' + FLAKE(8 + (i * 5) % 7, 'rgba(255,255,255,.85)') + '</span>'; }
    else if (sk.season === 'halloween') h = '<span class="flap" style="left:120px;top:-22px">' + BAT + '</span><span class="flap" style="left:-24px;top:118px;animation-delay:-.25s;scale:.75">' + BAT + '</span><span class="sw" style="right:-14px;bottom:-22px">' + GHOST + '</span>' + im('alarm/stkd-moon.png', 'left:-18px;bottom:-16px;width:42px;background:#FFF7EC;border-radius:50%;padding:3px');
    else if (sk.season === 'xmas') { h = '<span style="right:-16px;bottom:-14px">' + TREE + '</span><span style="left:-10px;bottom:-10px;scale:.7">' + TREE + '</span>'; for (let i = 0; i < 7; i++) h += '<span class="fall" style="left:' + (8 + i * 13) + '%;top:-6px;animation-delay:-' + (i * 0.6) + 's;animation-duration:' + (3.4 + (i % 3) * .7) + 's">' + FLAKE(8 + (i * 5) % 7, sk.draw ? '#1C2B22' : 'rgba(255,255,255,.85)') + '</span>'; }
    $('deco').innerHTML = h;
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
    $('lab').textContent = '알람' + (a.test ? ' · 미리보기' : a.snoozed ? ' · ' + a.snoozed + '분 뒤 다시 알림' : a.days && a.days.length ? ' · ' + (a.days.length === 7 ? '매일' : a.days.map((x) => DAYN[x]).join(' ')) : ' · 오늘 한 번');
    $('memo').textContent = a.memo || '';
    document.body.className = '';
    void document.body.offsetWidth;   // 효과를 처음부터 (말랑이·카드 박자 맞춤)
    const sk = skin();
    document.documentElement.style.setProperty('--fl', sk.draw ? 'rgba(22,22,22,.55)' : (sk.glow || 'rgba(110,100,230,.5)').replace(/[\d.]+\)$/, '.85)'));
    art();
    deco();
    party(a.fx === 'party');
    document.body.className = 'fx-' + (a.fx || 'boing');
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
  api.onState((s) => { const was = S && S.settings; S = s; if (cur) { style(); if (was && (was.alarmScale !== s.settings.alarmScale || was.alarmPos !== s.settings.alarmPos)) setTimeout(sendRect, 80); } });
  api.init().then(async (s) => { S = s; style(); show(await api.alarmGet()); });
})();
