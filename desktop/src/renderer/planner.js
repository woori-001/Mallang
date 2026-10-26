// 주간 플래너 (관리자 베타): 출퇴근·조출/야근, 요일별 체크리스트, 마스킹테이프, 이모지 스티커
(function () {
  const api = window.api;
  const { esc, dateKey, applyTheme } = window.M;
  const $ = (id) => document.getElementById(id);
  const EN = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const KO = ['월', '화', '수', '목', '금', '토', '일'];
  const COLORS = ['peach', 'mint', 'sky', 'lav', 'lemon', 'pink', 'stripe', 'dot'];
  const EMOJI = {
    '표정': '😀 😊 🥰 😍 😎 🤓 🥳 😴 🤯 😭 😤 🤔 😇 🫠 😵‍💫 🙃 😋 🤗 😌 🥲 😱 🫡 🤩 😮‍💨',
    '하트': '❤️ 🧡 💛 💚 💙 💜 🩷 🤍 🖤 💖 💗 💝 ✨ ⭐ 🌟 💫 ⚡ 🔥 💯 🎵',
    '업무': '💼 📌 📎 ✏️ 📝 📅 ⏰ ☕ 🍱 💻 📞 📦 ✅ ❗ ❓ 📊 📈 🗂️ 🖨️ 📮 🔔 🔑 🧾 🏢',
    '날씨': '☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ⛄ 🌈 🌙 🌸 🌷 🌻 🍀 🍂 🍁 🌊 🎃 👻 🦇 🎄 🎅 🎁 ⛄ 🧣',
    '음식': '🍰 🎂 🍩 🍪 🍫 🍕 🍔 🍜 🍣 🍙 🍓 🍑 🍎 🍋 🍉 🍺 🍷 🧋 🥤 🍦',
    '동물': '🐰 🐻 🐱 🐶 🐥 🐧 🦊 🐹 🐼 🐨 🐸 🐷 🦄 🐳 🦋 🐝',
    '기타': '🎉 🎈 🎀 💐 🏃 🧘 ✈️ 🚗 🏠 🏥 💊 💰 🛒 🎮 📚 🎬 🎧 📷 🏆 🎯 💡 🧸 🎨 ⚽'
  };
  const pl = $('pl'), sheet = $('sheet'), lane = $('lane'), stk = $('stk'), pop = $('pop');

  let S = null, std = { in: '09:00', out: '18:00' };
  let monday = mondayOf(new Date());
  let W = blank();
  let saveT = 0, placing = null;

  function blank() { return { notes: '', days: Array.from({ length: 7 }, () => ({ in: '', out: '', items: [] })), tapes: [], stickers: [], habits: [] }; }
  function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function dayAt(i) { const x = new Date(monday); x.setDate(x.getDate() + i); return x; }
  const keyOf = () => dateKey(monday);
  const toMin = (t) => (/^\d{2}:\d{2}$/.test(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : null);
  const fmt = (m) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
  function normT(v) {
    const m = String(v || '').replace(/[^\d:]/g, '').match(/^(\d{1,2}):?(\d{2})$/);
    if (!m) return '';
    const h = +m[1], mi = +m[2];
    return h > 23 || mi > 59 ? '' : String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
  }
  function nowT() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  // 조출·야근 계산 (주말은 근무 시간 전체)
  function overtime(i) {
    const d = W.days[i], a = toMin(d.in);
    let b = toMin(d.out);
    const r = { e: 0, l: 0, w: 0 };
    if (i >= 5) { if (a != null && b != null) { if (b < a) b += 1440; r.w = b - a; } return r; }
    if (a != null) r.e = Math.max(0, toMin(std.in) - a);
    if (b != null) { if (a != null && b < a) b += 1440; r.l = Math.max(0, b - toMin(std.out)); }
    return r;
  }

  function save() { clearTimeout(saveT); saveT = setTimeout(flush, 350); }
  function flush() { clearTimeout(saveT); saveT = 0; api.plannerSet(keyOf(), W); }

  async function load() {
    const r = await api.plannerGet(keyOf());
    if (r) { W = r.week; std = r.std || std; } else W = blank();
    render();
  }
  function go(d) { if (saveT) flush(); closePop(); monday = d; load(); }

  // ───────── 그리기
  function render() {
    renderHead(); renderHabits(); renderSum(); renderDays(); renderLane(); renderStickers();
    $('notes').value = W.notes;
  }
  function renderHead() {
    const a = dayAt(0), b = dayAt(6);
    // 이번 주 목요일이 속한 달 기준 주차
    const th = dayAt(3), first = mondayOf(new Date(th.getFullYear(), th.getMonth(), 1));
    let n = Math.round((monday - first) / (7 * 864e5)) + 1;
    if (new Date(first.getTime() + 3 * 864e5).getMonth() !== th.getMonth()) n -= 1;
    $('label').textContent = th.getFullYear() + '년 ' + (th.getMonth() + 1) + '월 ' + n + '주';
    $('range').textContent = (a.getMonth() + 1) + '/' + a.getDate() + ' – ' + (b.getMonth() + 1) + '/' + b.getDate();
    $('today').classList.toggle('on', keyOf() === dateKey(mondayOf(new Date())));
  }
  function renderHabits() {
    const hs = W.habits.length < 4 ? W.habits.concat([{ t: '', d: [0, 0, 0, 0, 0, 0, 0].map(() => false), _new: true }]) : W.habits;
    $('habits').innerHTML = hs.map((h, i) => '<div class="hb" data-h="' + i + '"><input type="text" maxlength="30" value="' + esc(h.t) + '" placeholder="' + (h._new ? '+ 습관 추가' : '') + '" aria-label="습관 이름">' +
      '<span class="dots">' + h.d.map((on, j) => '<button type="button" class="' + (on ? 'on' : '') + '" data-j="' + j + '" aria-label="' + KO[j] + '요일" aria-pressed="' + on + '"></button>').join('') + '</span></div>').join('');
  }
  function renderSum() {
    let e = 0, l = 0, w = 0, days = 0;
    for (let i = 0; i < 7; i++) { const o = overtime(i); e += o.e; l += o.l; w += o.w; if (W.days[i].in || W.days[i].out) days++; }
    $('sum').innerHTML =
      '<div>조출 <b>' + fmt(e) + '</b> · 야근 <b>' + fmt(l) + '</b></div>' +
      (w ? '<div>주말 근무 <b>' + fmt(w) + '</b></div>' : '') +
      '<div class="tot">합계 <b>' + fmt(e + l + w) + '</b> <span class="muted">(' + days + '일 기록)</span></div>' +
      '<div class="muted">기준 ' + std.in + ' ~ ' + std.out + '</div>';
  }
  function renderDays() {
    const todayK = dateKey(new Date());
    let hh = '', th = '', lh = '';
    for (let i = 0; i < 7; i++) {
      const d = dayAt(i), k = dateKey(d), cls = (k === todayK ? ' today' : '') + (i === 5 ? ' sat' : '') + (i === 6 ? ' sun' : '');
      hh += '<div class="dh' + cls + '" style="grid-column:' + (i + 2) + '"><span class="n">' + d.getDate() + '</span><span class="e">' + EN[i] + '</span></div>';
      th += '<div class="tm" style="grid-column:' + (i + 2) + '" data-i="' + i + '">' + timeLine(i, 'in', '출근') + timeLine(i, 'out', '퇴근') + '<div class="ot">' + otChips(i) + '</div></div>';
      lh += '<div class="ls' + cls + '" style="grid-column:' + (i + 2) + '" data-i="' + i + '">' + itemsHTML(i) + '</div>';
    }
    $('heads').innerHTML = hh; $('times').innerHTML = th; $('lists').innerHTML = lh;
  }
  function timeLine(i, f, label) {
    const v = W.days[i][f];
    return '<div class="tl"><span class="k">' + label + '</span><input type="text" inputmode="numeric" maxlength="5" placeholder="--:--" data-f="' + f + '" value="' + esc(v) + '" aria-label="' + KO[i] + '요일 ' + label + ' 시간">' +
      (v || dateKey(dayAt(i)) !== dateKey(new Date()) ? '' : '<button type="button" class="now" data-f="' + f + '" title="지금 시간으로 체크">지금</button>') + '</div>';
  }
  function otChips(i) {
    const o = overtime(i);
    return (o.e ? '<span class="e">조출 ' + fmt(o.e) + '</span>' : '') + (o.l ? '<span class="l">야근 ' + fmt(o.l) + '</span>' : '') + (o.w ? '<span class="w">근무 ' + fmt(o.w) + '</span>' : '');
  }
  function itemsHTML(i) {
    return W.days[i].items.map((it, j) => '<div class="it' + (it.d ? ' done' : '') + '" data-j="' + j + '"><button type="button" class="cb" aria-label="완료" aria-pressed="' + it.d + '">' + (it.d ? '✓' : '') + '</button><input type="text" maxlength="300" value="' + esc(it.t) + '"></div>').join('') +
      '<div class="it add"><span class="cb"></span><input type="text" maxlength="300" placeholder="+ 할 일" aria-label="' + KO[i] + '요일 할 일 추가"></div>';
  }
  function updateTimeLine(tm, i, f) {
    const inp = tm.querySelector('input[data-f="' + f + '"]'), v = W.days[i][f];
    if (document.activeElement !== inp) inp.value = v;
    const now = tm.querySelector('.now[data-f="' + f + '"]');
    if (v && now) now.remove();
    if (!v && !now && dateKey(dayAt(i)) === dateKey(new Date())) inp.insertAdjacentHTML('afterend', '<button type="button" class="now" data-f="' + f + '" title="지금 시간으로 체크">지금</button>');
    refreshTime(i);
  }
  function refreshTime(i) {
    const tm = document.querySelector('.tm[data-i="' + i + '"]');
    tm.querySelector('.ot').innerHTML = otChips(i);
    renderSum();
  }
  function renderLane() {
    lane.innerHTML = W.tapes.length
      ? W.tapes.map((t, k) => '<div class="tape ' + t.c + '" data-k="' + k + '" style="grid-column:' + (t.a + 1) + ' / ' + (t.b + 2) + '" title="눌러서 고치기">' + esc(t.text || ' ') + '</div>').join('')
      : '<div class="empty">🎀 날짜를 가로로 끌어서 연속 일정 테이프를 붙여 보세요</div>';
  }
  function renderStickers() {
    stk.innerHTML = W.stickers.map((s, k) => '<span class="sk" data-k="' + k + '" style="left:' + s.x + '%;top:' + s.y + '%;--r:' + s.r + 'deg" title="끌어서 옮기기 · 더블클릭으로 떼기">' + esc(s.e) + '</span>').join('');
  }

  // ───────── 습관
  $('habits').addEventListener('input', (e) => {
    const row = e.target.closest('.hb'); if (!row) return;
    const i = +row.dataset.h;
    if (!W.habits[i]) { W.habits.push({ t: '', d: [false, false, false, false, false, false, false] }); }
    W.habits[i].t = e.target.value;
    save();
  });
  $('habits').addEventListener('focusout', (e) => {
    const row = e.target.closest('.hb'); if (!row) return;
    const i = +row.dataset.h, h = W.habits[i];
    if (h && !h.t.trim() && !h.d.some(Boolean)) { W.habits.splice(i, 1); save(); }
    setTimeout(() => { if (!$('habits').contains(document.activeElement)) renderHabits(); }, 0);
  });
  $('habits').addEventListener('click', (e) => {
    const b = e.target.closest('.dots button'); if (!b) return;
    const i = +b.closest('.hb').dataset.h, j = +b.dataset.j;
    if (!W.habits[i]) W.habits.push({ t: '', d: [false, false, false, false, false, false, false] });
    W.habits[i].d[j] = !W.habits[i].d[j];
    save(); renderHabits();
  });

  // ───────── 출퇴근
  $('times').addEventListener('click', (e) => {
    const b = e.target.closest('.now'); if (!b) return;
    const i = +b.closest('.tm').dataset.i;
    W.days[i][b.dataset.f] = nowT();
    save(); updateTimeLine(b.closest('.tm'), i, b.dataset.f);
  });
  $('times').addEventListener('change', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    const tm = inp.closest('.tm'), i = +tm.dataset.i, f = inp.dataset.f, v = normT(inp.value);
    W.days[i][f] = v; inp.value = v;
    save(); updateTimeLine(tm, i, f);
  });
  $('times').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('times').addEventListener('input', (e) => { const inp = e.target.closest('input'); if (inp) { const i = +inp.closest('.tm').dataset.i; const v = normT(inp.value); if (v) { W.days[i][inp.dataset.f] = v; save(); refreshTime(i); } } });

  // ───────── 체크리스트
  const lists = $('lists');
  function focusItem(i, j, end) {
    const col = lists.querySelector('.ls[data-i="' + i + '"]');
    const rows = col.querySelectorAll('.it');
    const inp = (rows[j] || rows[rows.length - 1]).querySelector('input');
    inp.focus(); if (end) inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  function rerenderCol(i) { lists.querySelector('.ls[data-i="' + i + '"]').innerHTML = itemsHTML(i); }
  lists.addEventListener('input', (e) => {
    const row = e.target.closest('.it'); if (!row) return;
    const i = +row.closest('.ls').dataset.i, items = W.days[i].items;
    if (row.classList.contains('add')) {
      if (!e.target.value) return;
      items.push({ t: e.target.value, d: false });
      save(); rerenderCol(i); focusItem(i, items.length - 1, true);
      return;
    }
    items[+row.dataset.j].t = e.target.value; save();
  });
  lists.addEventListener('click', (e) => {
    const b = e.target.closest('.cb'); if (!b || b.tagName !== 'BUTTON') return;
    const i = +b.closest('.ls').dataset.i, j = +b.closest('.it').dataset.j;
    W.days[i].items[j].d = !W.days[i].items[j].d;
    save(); rerenderCol(i);
  });
  lists.addEventListener('keydown', (e) => {
    const row = e.target.closest('.it'); if (!row || e.isComposing) return;
    const i = +row.closest('.ls').dataset.i, items = W.days[i].items, add = row.classList.contains('add'), j = add ? items.length : +row.dataset.j;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (add) return;
      items.splice(j + 1, 0, { t: '', d: false }); save(); rerenderCol(i); focusItem(i, j + 1);
    } else if (e.key === 'Backspace' && !add && !e.target.value) {
      e.preventDefault();
      items.splice(j, 1); save(); rerenderCol(i); focusItem(i, Math.max(0, j - 1), true);
    } else if (e.key === 'ArrowUp' && j > 0) { e.preventDefault(); focusItem(i, j - 1, true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i, j + 1, true); }
  });
  lists.addEventListener('focusout', (e) => {
    const row = e.target.closest('.it'); if (!row || row.classList.contains('add')) return;
    const col = row.closest('.ls'), i = +col.dataset.i;
    setTimeout(() => {
      if (col.contains(document.activeElement)) return;
      const before = W.days[i].items.length;
      W.days[i].items = W.days[i].items.filter((it) => it.t.trim());
      if (W.days[i].items.length !== before) { save(); rerenderCol(i); }
    }, 0);
  });

  // ───────── 메모
  $('notes').addEventListener('input', (e) => { W.notes = e.target.value; save(); });

  // ───────── 마스킹테이프
  function colAt(x) { const r = lane.getBoundingClientRect(); return Math.min(6, Math.max(0, Math.floor((x - r.left) / (r.width / 7)))); }
  let tdrag = null;
  lane.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const t = e.target.closest('.tape');
    if (t) { tapePop(+t.dataset.k, t); return; }
    e.preventDefault();
    const c = colAt(e.clientX);
    tdrag = { a: c, b: c, ghost: document.createElement('div') };
    tdrag.ghost.className = 'ghost';
    tdrag.ghost.style.gridColumn = (c + 1) + ' / ' + (c + 2);
    tdrag.ghost.style.gridRow = '1';
    lane.querySelector('.empty') && lane.querySelector('.empty').remove();
    lane.appendChild(tdrag.ghost);
    lane.setPointerCapture(e.pointerId);
  });
  lane.addEventListener('pointermove', (e) => {
    if (!tdrag) return;
    tdrag.b = colAt(e.clientX);
    const a = Math.min(tdrag.a, tdrag.b), b = Math.max(tdrag.a, tdrag.b);
    tdrag.ghost.style.gridColumn = (a + 1) + ' / ' + (b + 2);
  });
  lane.addEventListener('pointerup', () => {
    if (!tdrag) return;
    const a = Math.min(tdrag.a, tdrag.b), b = Math.max(tdrag.a, tdrag.b), g = tdrag.ghost;
    tdrag = null;
    tapePop(-1, g, { a, b });
  });
  $('tTape').addEventListener('click', (e) => { const d = Math.max(0, Math.min(6, (new Date().getDay() + 6) % 7)); tapePop(-1, e.currentTarget, { a: d, b: Math.min(6, d + 2) }); });

  function tapePop(k, anchor, init) {
    const t = k >= 0 ? { ...W.tapes[k] } : { a: init.a, b: init.b, text: '', c: COLORS[W.tapes.length % 6] };
    const opts = (sel) => KO.map((n, i) => '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + n + ' (' + dayAt(i).getDate() + '일)</option>').join('');
    openPop(anchor, '<h4>' + (k >= 0 ? '테이프 고치기' : '🎀 마스킹테이프 붙이기') + '</h4>' +
      '<div class="r"><span>내용</span><input type="text" id="tpText" maxlength="60" placeholder="예: 제주 출장, 결산 기간" value="' + esc(t.text) + '"></div>' +
      '<div class="r"><span>기간</span><select id="tpA">' + opts(t.a) + '</select>~<select id="tpB">' + opts(t.b) + '</select></div>' +
      '<div class="r"><span>색</span><div class="sws">' + COLORS.map((c) => '<button type="button" class="sw ' + c + (c === t.c ? ' on' : '') + '" data-c="' + c + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
      '<div class="acts">' + (k >= 0 ? '<button type="button" class="del" id="tpDel">떼기</button>' : '') + '<button type="button" id="tpNo">취소</button><button type="button" class="ok" id="tpOk">' + (k >= 0 ? '저장' : '붙이기') + '</button></div>');
    let c = t.c;
    pop.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => { c = b.dataset.c; pop.querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === b)); }));
    const done = () => {
      let a = +$('tpA').value, b = +$('tpB').value; if (b < a) [a, b] = [b, a];
      const nt = { a, b, text: $('tpText').value.trim(), c };
      if (k >= 0) W.tapes[k] = nt; else if (W.tapes.length < 20) W.tapes.push(nt);
      save(); closePop(); renderLane();
    };
    $('tpOk').addEventListener('click', done);
    $('tpText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) done(); });
    $('tpNo').addEventListener('click', () => { closePop(); renderLane(); });
    if (k >= 0) $('tpDel').addEventListener('click', () => { W.tapes.splice(k, 1); save(); closePop(); renderLane(); });
    $('tpText').focus();
  }

  // ───────── 스티커
  let cat = '표정';
  $('tSticker').addEventListener('click', (e) => stickerPop(e.currentTarget));
  function stickerPop(anchor) {
    const draw = () => {
      pop.innerHTML = '<h4>🌷 스티커 고르기</h4><div class="cats">' + Object.keys(EMOJI).map((c) => '<button type="button" data-c="' + c + '" class="' + (c === cat ? 'on' : '') + '">' + c + '</button>').join('') + '</div>' +
        '<div class="emos">' + EMOJI[cat].split(' ').map((em) => '<button type="button" data-e="' + em + '">' + em + '</button>').join('') + '</div>' +
        '<div class="tip">고른 뒤 플래너 아무 곳이나 누르면 붙어요 · 끌어서 옮기기 · 더블클릭으로 떼기</div>';
    };
    openPop(anchor, ''); pop.classList.add('emo'); draw();
    pop.onclick = (e) => {
      const c = e.target.closest('[data-c]'); if (c && c.closest('.cats')) { cat = c.dataset.c; draw(); return; }
      const em = e.target.closest('[data-e]'); if (em) { closePop(); startPlace(em.dataset.e); }
    };
  }
  function startPlace(em) {
    placing = em; stk.classList.add('placing');
    $('hint').hidden = false; $('hint').textContent = em + ' 붙일 곳을 눌러 주세요 (Esc 취소)';
  }
  function stopPlace() { placing = null; stk.classList.remove('placing'); $('hint').hidden = true; }
  function pct(e) { const r = sheet.getBoundingClientRect(); return { x: Math.min(99, Math.max(1, (e.clientX - r.left) / r.width * 100)), y: Math.min(99, Math.max(1, (e.clientY - r.top) / r.height * 100)) }; }
  let sdrag = null;
  stk.addEventListener('pointerdown', (e) => {
    if (placing) {
      if (e.target.closest('.sk')) return;
      const p = pct(e);
      if (W.stickers.length < 60) W.stickers.push({ e: placing, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, r: Math.round(Math.random() * 24 - 12) });
      save(); renderStickers();
      if (!e.shiftKey) stopPlace();
      return;
    }
    const s = e.target.closest('.sk'); if (!s || e.button !== 0) return;
    e.preventDefault();
    sdrag = { k: +s.dataset.k, el: s, moved: false };
    s.classList.add('drag'); s.setPointerCapture(e.pointerId);
  });
  stk.addEventListener('pointermove', (e) => {
    if (!sdrag) return;
    const p = pct(e); sdrag.moved = true;
    sdrag.el.style.left = p.x + '%'; sdrag.el.style.top = p.y + '%';
    sdrag.p = p;
  });
  stk.addEventListener('pointerup', () => {
    if (!sdrag) return;
    const d = sdrag; sdrag = null; d.el.classList.remove('drag');
    if (d.moved && d.p) { W.stickers[d.k].x = Math.round(d.p.x * 10) / 10; W.stickers[d.k].y = Math.round(d.p.y * 10) / 10; save(); }
  });
  stk.addEventListener('dblclick', (e) => { const s = e.target.closest('.sk'); if (s) { W.stickers.splice(+s.dataset.k, 1); save(); renderStickers(); } });
  stk.addEventListener('contextmenu', (e) => { const s = e.target.closest('.sk'); if (s) { e.preventDefault(); W.stickers.splice(+s.dataset.k, 1); save(); renderStickers(); } });
  stk.addEventListener('wheel', (e) => {
    const s = e.target.closest('.sk'); if (!s) return;
    e.preventDefault();
    const st = W.stickers[+s.dataset.k]; st.r = Math.max(-20, Math.min(20, st.r + (e.deltaY > 0 ? 4 : -4)));
    s.style.setProperty('--r', st.r + 'deg'); save();
  }, { passive: false });

  // ───────── 기준 시간
  $('tStd').addEventListener('click', (e) => {
    openPop(e.currentTarget, '<h4>⏰ 조출·야근 기준 시간</h4>' +
      '<div class="r"><span>출근</span><input type="text" id="stIn" maxlength="5" value="' + std.in + '"></div>' +
      '<div class="r"><span>퇴근</span><input type="text" id="stOut" maxlength="5" value="' + std.out + '"></div>' +
      '<div class="tip">출근 기준보다 일찍 오면 조출, 퇴근 기준보다 늦게 가면 야근으로 계산해요. 토·일은 근무 시간 전체를 따로 모아요.</div>' +
      '<div class="acts"><button type="button" id="stNo">취소</button><button type="button" class="ok" id="stOk">저장</button></div>');
    $('stNo').addEventListener('click', closePop);
    $('stOk').addEventListener('click', () => {
      std = { in: normT($('stIn').value) || '09:00', out: normT($('stOut').value) || '18:00' };
      api.plannerStd(std); closePop(); renderDays(); renderSum();
    });
  });

  // ───────── 팝업
  function openPop(anchor, html) {
    pop.className = 'pop'; pop.onclick = null; pop.innerHTML = html; pop.hidden = false;
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8; if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function closePop() { pop.hidden = true; pop.innerHTML = ''; }
  document.addEventListener('pointerdown', (e) => {
    if (pop.hidden || pop.contains(e.target) || e.target.closest('#tTape,#tSticker,#tStd')) return;
    const wasTape = !!pop.querySelector('#tpOk');
    closePop(); if (wasTape) renderLane();
  }, true);

  // ───────── 머리
  $('prev').addEventListener('click', () => { const d = new Date(monday); d.setDate(d.getDate() - 7); go(d); });
  $('next').addEventListener('click', () => { const d = new Date(monday); d.setDate(d.getDate() + 7); go(d); });
  $('today').addEventListener('click', () => go(mondayOf(new Date())));
  $('close').addEventListener('click', () => { if (saveT) flush(); api.plannerToggle(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (placing) { stopPlace(); return; }
    if (!pop.hidden) { closePop(); renderLane(); return; }
    if (saveT) flush();
    api.plannerToggle(false);
  });
  $('rings').innerHTML = '<i></i>'.repeat(26);

  // 창 끌어서 옮기기 (머리·링)
  let drag = null, raf = 0, pend = null;
  for (const h of [$('hd'), $('rings')]) {
    h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY, h };
      h.setPointerCapture(e.pointerId);
    });
    h.addEventListener('pointermove', (e) => {
      if (!drag || drag.h !== h) return;
      pend = { x: drag.wx + e.screenX - drag.sx, y: drag.wy + e.screenY - drag.sy };
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; api.plannerMove(pend.x, pend.y); });
    });
    h.addEventListener('pointerup', () => { drag = null; });
  }

  function theme() {
    if (!S) return;
    const sk = applyTheme(S.settings).sk;
    document.documentElement.style.setProperty('--sun', sk.sun);
    document.documentElement.style.setProperty('--sat', sk.sat);
  }
  window.addEventListener('beforeunload', () => { if (saveT) flush(); });
  api.onCmd((c) => { if (c.type === 'leave') { if (saveT) flush(); pl.classList.add('leaving'); } });
  api.onState((s) => { S = s; theme(); });
  api.init().then((s) => { S = s; theme(); load(); });
  // 자정이 지나면 오늘 표시 갱신
  let lastDay = dateKey(new Date());
  setInterval(() => { const k = dateKey(new Date()); if (k !== lastDay) { lastDay = k; renderDays(); renderHead(); } }, 60000);
})();
