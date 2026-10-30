// 주간 플래너 (관리자 베타): 출퇴근·조출/야근, 요일별 할 일, 마스킹테이프, 이모지 스티커
(function () {
  const api = window.api;
  const { esc, dateKey, applyTheme, ICONS } = window.M;
  const $ = (id) => document.getElementById(id);
  const EN = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const KO = ['월', '화', '수', '목', '금', '토', '일'];
  const COLORS = ['peach', 'mint', 'sky', 'lav', 'lemon', 'pink', 'stripe', 'dot'];
  const BASE_ROWS = 8;
  const EMOJI = {
    '표정': '😀 😊 🥰 😍 😎 🤓 🥳 😴 🤯 😭 😤 🤔 😇 🫠 😵‍💫 🙃 😋 🤗 😌 🥲 😱 🫡 🤩 😮‍💨',
    '하트': '❤️ 🧡 💛 💚 💙 💜 🩷 🤍 🖤 💖 💗 💝 ✨ ⭐ 🌟 💫 ⚡ 🔥 💯 🎵',
    '업무': '💼 📌 📎 ✏️ 📝 📅 ⏰ ☕ 🍱 💻 📞 📦 ✅ ❗ ❓ 📊 📈 🗂️ 🖨️ 📮 🔔 🔑 🧾 🏢',
    '날씨': '☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ⛄ 🌈 🌙 🌸 🌷 🌻 🍀 🍂 🍁 🌊 🎃 👻 🦇 🎄 🎅 🎁 🧣',
    '음식': '🍰 🎂 🍩 🍪 🍫 🍕 🍔 🍜 🍣 🍙 🍓 🍑 🍎 🍋 🍉 🍺 🍷 🧋 🥤 🍦',
    '동물': '🐰 🐻 🐱 🐶 🐥 🐧 🦊 🐹 🐼 🐨 🐸 🐷 🦄 🐳 🦋 🐝',
    '기타': '🎉 🎈 🎀 💐 🏃 🧘 ✈️ 🚗 🏠 🏥 💊 💰 🛒 🎮 📚 🎬 🎧 📷 🏆 🎯 💡 🧸 🎨 ⚽'
  };
  const pl = $('pl'), sheet = $('sheet'), lane = $('lane'), stk = $('stk'), pop = $('pop'), lists = $('lists');
  $('prev').innerHTML = ICONS.left; $('next').innerHTML = ICONS.right; $('close').innerHTML = ICONS.right;

  let S = null, std = { in: '09:00', out: '18:00', alpha: null };
  let monday = mondayOf(new Date());
  let W = blank();
  let saveT = 0, placing = null;

  function blank() { return { notes: '', days: Array.from({ length: 7 }, () => ({ in: '', out: '', items: [] })), tapes: [], stickers: [], habits: [] }; }
  function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  function dayAt(i) { const x = new Date(monday); x.setDate(x.getDate() + i); return x; }
  const keyOf = () => dateKey(monday);
  const isToday = (i) => dateKey(dayAt(i)) === dateKey(new Date());
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
  function overtime(i) { return otDay(W.days[i], i); }
  function otDay(d, i) {
    const a = toMin(d.in);
    let b = toMin(d.out);
    const r = { e: 0, l: 0, w: 0 };
    // 연장근무는 30분 단위로만 인정 (예: 18:30 퇴근 기준, 20:01 퇴근 → 1:30)
    const u30 = (m) => Math.floor(Math.max(0, m) / 30) * 30;
    if (i >= 5) { if (a != null && b != null) { if (b < a) b += 1440; r.w = u30(b - a); } return r; }
    if (a != null) r.e = u30(toMin(std.in) - a);
    if (b != null) { if (a != null && b < a) b += 1440; r.l = u30(b - toMin(std.out)); }
    return r;
  }

  // 저장: 끝에 남은 빈 줄은 빼고
  function save() { clearTimeout(saveT); saveT = setTimeout(flush, 350); }
  function flush() {
    clearTimeout(saveT); saveT = 0;
    const out = { ...W, days: W.days.map((d) => { const items = d.items.slice(); while (items.length && !items[items.length - 1].t.trim()) items.pop(); return { ...d, items }; }) };
    api.plannerSet(keyOf(), out);
  }

  async function load() {
    const r = await api.plannerGet(keyOf());
    if (r) { W = r.week; std = { in: '09:00', out: '18:00', alpha: null, ...(r.std || {}) }; } else W = blank();
    theme(); render();
  }
  function go(d) { if (saveT) flush(); closePop(); monday = d; load(); }

  // ───────── 높이: 내용만큼 창 높이를 맞춤 (화면보다 크면 표 안에서 스크롤)
  const baseRows = BASE_ROWS;
  let fitRaf = 0;
  function fit() {
    if (fitRaf) return;
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0;
      const plS = getComputedStyle(pl);
      const need = 8 + 8 + parseFloat(plS.paddingTop) + parseFloat(plS.paddingBottom) + $('hd').offsetHeight + parseFloat(plS.rowGap || 10) + sheet.scrollHeight;
      api.plannerSize(Math.ceil(need));
      stk.style.setProperty('--stk-h', sheet.scrollHeight + 'px');
    });
  }
  window.addEventListener('resize', fit);

  // ───────── 그리기
  function render() { renderHead(); renderSum(); renderDays(); renderLane(); renderStickers(); $('notes').value = W.notes; fit(); }
  function renderHead() {
    const a = dayAt(0), b = dayAt(6);
    // 목요일이 속한 달 기준 주차
    const th = dayAt(3), first = mondayOf(new Date(th.getFullYear(), th.getMonth(), 1));
    let n = Math.round((monday - first) / (7 * 864e5)) + 1;
    if (new Date(first.getTime() + 3 * 864e5).getMonth() !== th.getMonth()) n -= 1;
    $('label').textContent = (th.getMonth() + 1) + '월 ' + n + '주차';
    $('range').textContent = th.getFullYear() + '. ' + (a.getMonth() + 1) + '. ' + a.getDate() + ' – ' + (b.getMonth() + 1) + '. ' + b.getDate();
    $('today').classList.toggle('on', keyOf() === dateKey(mondayOf(new Date())));
  }
  // 한 줄: "주간 합계 1:00" (마우스를 올리면 조출·야근 나눠서)
  function sumLine(t) {
    const tip = '조출 ' + fmt(t.e) + ' · 야근 ' + fmt(t.l) + (t.w ? ' · 주말 ' + fmt(t.w) : '') + ' · ' + t.days + '일 기록';
    return '<div class="sl" title="' + tip + '"><span>' + t.label + '</span><b>' + fmt(t.e + t.l + t.w) + '</b></div>';
  }
  function weekTotal() {
    const t = { e: 0, l: 0, w: 0, days: 0, label: '주간 합계' };
    for (let i = 0; i < 7; i++) { const o = overtime(i); t.e += o.e; t.l += o.l; t.w += o.w; if (W.days[i].in || W.days[i].out) t.days++; }
    return t;
  }
  // 월간 합계: 이번 주 목요일이 속한 달의 날짜만 (앞뒤 주에 걸친 날짜도 그 달이면 포함)
  let monthSeq = 0;
  async function monthTotal() {
    const th = dayAt(3), y = th.getFullYear(), m = th.getMonth(), seq = ++monthSeq;
    const keys = [];
    for (let d = mondayOf(new Date(y, m, 1)); d <= new Date(y, m + 1, 0); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) keys.push(dateKey(d));
    const weeks = await api.plannerWeeks(keys);
    if (seq !== monthSeq) return null;
    weeks[keyOf()] = W;   // 지금 보고 있는 주는 화면 것(아직 저장 전 포함)
    const t = { e: 0, l: 0, w: 0, days: 0, label: '월간 합계', m: m + 1 };
    for (const k of keys) {
      const wk = weeks[k]; if (!wk) continue;
      const p = k.split('-').map(Number);
      for (let i = 0; i < 7; i++) {
        const dt = new Date(p[0], p[1] - 1, p[2] + i);
        if (dt.getMonth() !== m || !wk.days[i]) continue;
        const o = otDay(wk.days[i], i); t.e += o.e; t.l += o.l; t.w += o.w; if (wk.days[i].in || wk.days[i].out) t.days++;
      }
    }
    return t;
  }
  let sumT = 0;
  function renderSum() {
    $('sum').innerHTML = sumLine(weekTotal()) + '<div id="msum">' + (($('msum') && $('msum').innerHTML) || '') + '</div><div class="muted std">기준 ' + std.in + ' ~ ' + std.out + '</div>';
    clearTimeout(sumT);
    sumT = setTimeout(async () => {
      const t = await monthTotal();
      const el = $('msum'); if (!t || !el) return;
      el.innerHTML = sumLine(t);
    }, 120);
  }
  function renderDays() {
    let ch = '', hh = '', th = '', lh = '';
    for (let i = 0; i < 7; i++) {
      const d = dayAt(i), hol = window.M.holiday(dateKey(d)), cls = (isToday(i) ? ' today' : '') + (i === 5 && !hol ? ' sat' : '') + (i === 6 || hol ? ' sun' : ''), gc = 'grid-column:' + (i + 2);
      ch += '<div class="col' + cls + '" style="' + gc + '"></div>';
      hh += '<div class="dh' + cls + '" style="' + gc + '"><span class="n">' + d.getDate() + '</span><span class="e">' + EN[i] + '</span>' + (hol ? '<span class="hol" title="' + esc(hol) + '">' + esc(hol) + '</span>' : '') + '</div>';
      th += '<div class="tm" style="' + gc + '" data-i="' + i + '">' + timeLine(i, 'in', '출근') + timeLine(i, 'out', '퇴근') + '</div>';
      lh += '<div class="ls" style="' + gc + '" data-i="' + i + '">' + itemsHTML(i) + '</div>';
    }
    $('cols').innerHTML = ch; $('heads').innerHTML = hh; $('times').innerHTML = th; lists.innerHTML = lh;
  }
  const nowBtn = (f) => '<button type="button" class="now" data-f="' + f + '" title="지금 시간으로 체크">지금</button>';
  function timeLine(i, f, label) {
    const v = W.days[i][f];
    // 오늘 비어 있는 칸은 입력칸 대신 '지금' 버튼 (누르면 지금 시간이 찍히고, 그다음엔 고칠 수 있음)
    return '<div class="tl"><span class="k">' + label + '</span>' + (!v && isToday(i) ? nowBtn(f) : '') +
      '<input type="text" inputmode="numeric" maxlength="5" placeholder="--:--" data-f="' + f + '" value="' + esc(v) + '" aria-label="' + KO[i] + '요일 ' + label + ' 시간"' + (!v && isToday(i) ? ' hidden' : '') + '><span class="ot" data-ot="' + f + '">' + otChip(i, f) + '</span></div>';
  }
  // 출근 옆엔 조출, 퇴근 옆엔 야근 (주말은 퇴근 옆에 근무 시간)
  function otChip(i, f) {
    const o = overtime(i);
    if (f === 'in') return o.e ? '<span class="e">조출 ' + fmt(o.e) + '</span>' : '';
    return o.l ? '<span class="l">야근 ' + fmt(o.l) + '</span>' : (o.w ? '<span class="w">근무 ' + fmt(o.w) + '</span>' : '');
  }
  // 줄 수 = 기본 8줄, 마지막으로 쓴 줄 아래에 늘 빈 줄 하나
  function rowCount(i) {
    const it = W.days[i].items;
    let last = -1;
    for (let j = it.length - 1; j >= 0; j--) if (it[j].t.trim()) { last = j; break; }
    return Math.max(baseRows, last + 2, it.length);
  }
  function rowHTML(i, j) {
    const it = W.days[i].items[j] || { t: '', d: false }, blank = !it.t.trim();
    return '<div class="it' + (it.d && !blank ? ' done' : '') + (blank ? ' blank' : '') + '" data-j="' + j + '"><button type="button" class="cb" tabindex="-1" aria-label="완료" aria-pressed="' + !!it.d + '">' + (it.d && !blank ? '✓' : '') + '</button>' +
      '<input type="text" maxlength="300" value="' + esc(it.t) + '" aria-label="' + KO[i] + '요일 할 일 ' + (j + 1) + '"></div>';
  }
  function itemsHTML(i) { let h = ''; for (let j = 0, n = rowCount(i); j < n; j++) h += rowHTML(i, j); return h; }
  function updateTimeLine(tm, i, f) {
    const inp = tm.querySelector('input[data-f="' + f + '"]'), v = W.days[i][f];
    if (document.activeElement !== inp) inp.value = v;
    const now = tm.querySelector('.now[data-f="' + f + '"]');
    if (v && now) { now.remove(); inp.hidden = false; }
    if (!v && !now && isToday(i) && document.activeElement !== inp) { inp.insertAdjacentHTML('beforebegin', nowBtn(f)); inp.hidden = true; }
    tm.querySelectorAll('.ot').forEach((x) => { x.innerHTML = otChip(i, x.dataset.ot); });
    renderSum();
  }
  function renderLane() {
    lane.innerHTML = W.tapes.length
      ? W.tapes.map((t, k) => '<div class="tape ' + t.c + '" data-k="' + k + '" style="grid-column:' + (t.a + 1) + ' / ' + (t.b + 2) + '" title="눌러서 고치기">' + esc(t.text || ' ') + '</div>').join('')
      : '<div class="empty">🎀 날짜를 가로로 끌어서 연속 일정 테이프를 붙여 보세요</div>';
    fit();
  }
  function renderStickers() {
    stk.innerHTML = W.stickers.map((s, k) => '<span class="sk" data-k="' + k + '" style="left:' + s.x + '%;top:' + s.y + '%;--r:' + s.r + 'deg" title="끌어서 옮기기 · 휠로 기울이기 · 더블클릭으로 떼기">' + esc(s.e) + '</span>').join('');
  }

  // ───────── 출퇴근
  $('times').addEventListener('click', (e) => {
    const b = e.target.closest('.now'); if (!b) return;
    const tm = b.closest('.tm'), i = +tm.dataset.i;
    W.days[i][b.dataset.f] = nowT();
    save(); updateTimeLine(tm, i, b.dataset.f);
  });
  $('times').addEventListener('change', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    const tm = inp.closest('.tm'), i = +tm.dataset.i, f = inp.dataset.f, v = normT(inp.value);
    W.days[i][f] = v; inp.value = v;
    save(); updateTimeLine(tm, i, f);
  });
  $('times').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('times').addEventListener('input', (e) => {
    const inp = e.target.closest('input'); if (!inp) return;
    const tm = inp.closest('.tm'), i = +tm.dataset.i, v = normT(inp.value);
    if (v) { W.days[i][inp.dataset.f] = v; save(); updateTimeLine(tm, i, inp.dataset.f); }
  });

  // ───────── 할 일
  const colEl = (i) => lists.querySelector('.ls[data-i="' + i + '"]');
  function focusRow(i, j, end) {
    const rows = colEl(i).querySelectorAll('.it');
    const inp = (rows[j] || rows[rows.length - 1]).querySelector('input');
    inp.focus(); if (end) inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  function rerenderCol(i) { colEl(i).innerHTML = itemsHTML(i); fit(); }
  function ensure(i, j) { const it = W.days[i].items; while (it.length <= j) it.push({ t: '', d: false }); return it[j]; }
  function syncRow(row, i, j) {
    const it = W.days[i].items[j], blank = !it.t.trim();
    row.classList.toggle('blank', blank);
    row.classList.toggle('done', !!it.d && !blank);
    row.querySelector('.cb').textContent = it.d && !blank ? '✓' : '';
  }
  lists.addEventListener('input', (e) => {
    const row = e.target.closest('.it'); if (!row) return;
    const col = row.closest('.ls'), i = +col.dataset.i, j = +row.dataset.j;
    ensure(i, j).t = e.target.value;
    syncRow(row, i, j);
    // 마지막 줄을 쓰기 시작하면 아래에 한 줄 더
    const n = col.querySelectorAll('.it').length;
    if (n < rowCount(i)) { col.insertAdjacentHTML('beforeend', rowHTML(i, n)); fit(); }
    save();
  });
  lists.addEventListener('click', (e) => {
    const b = e.target.closest('.cb'); if (!b) return;
    const row = b.closest('.it'), i = +row.closest('.ls').dataset.i, j = +row.dataset.j, it = W.days[i].items[j];
    if (!it || !it.t.trim()) { row.querySelector('input').focus(); return; }
    it.d = !it.d; save(); syncRow(row, i, j);
  });
  lists.addEventListener('keydown', (e) => {
    const row = e.target.closest('.it'); if (!row || e.isComposing) return;
    const i = +row.closest('.ls').dataset.i, j = +row.dataset.j, items = W.days[i].items;
    if (e.key === 'Enter') {
      e.preventDefault();
      // 다음 줄이 비어 있으면 그 줄로, 차 있으면 사이에 빈 줄 끼우기
      const next = items[j + 1];
      if (next && next.t.trim() && items[j] && items[j].t.trim()) { items.splice(j + 1, 0, { t: '', d: false }); save(); rerenderCol(i); }
      focusRow(i, j + 1);
    } else if (e.key === 'Backspace' && !e.target.value && j < items.length && j > 0) {
      e.preventDefault();
      items.splice(j, 1); save(); rerenderCol(i); focusRow(i, j - 1, true);
    } else if (e.key === 'ArrowUp' && j > 0) { e.preventDefault(); focusRow(i, j - 1, true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(i, j + 1, true); }
  });
  // 칸을 벗어나면 넘쳐 생긴 빈 줄 정리
  lists.addEventListener('focusout', (e) => {
    const col = e.target.closest('.ls'); if (!col) return;
    const i = +col.dataset.i;
    setTimeout(() => {
      if (col.contains(document.activeElement)) return;
      const it = W.days[i].items;
      while (it.length && !it[it.length - 1].t.trim()) it.pop();
      if (col.querySelectorAll('.it').length !== rowCount(i)) rerenderCol(i);
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
    const em = lane.querySelector('.empty'); if (em) em.remove();
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
  $('tTape').addEventListener('click', (e) => { const d = (new Date().getDay() + 6) % 7; tapePop(-1, e.currentTarget, { a: d, b: Math.min(6, d + 2) }); });

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
        '<div class="tip">고른 뒤 플래너 아무 곳이나 누르면 붙어요<br>끌어서 옮기기 · 휠로 기울이기 · 더블클릭으로 떼기</div>';
    };
    openPop(anchor, ''); pop.classList.add('emo'); draw(); placePop(anchor);
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
  function pct(e) { const r = stk.getBoundingClientRect(); return { x: Math.min(99, Math.max(1, (e.clientX - r.left) / r.width * 100)), y: Math.min(99, Math.max(1, (e.clientY - r.top) / r.height * 100)) }; }
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
    const p = pct(e); sdrag.moved = true; sdrag.p = p;
    sdrag.el.style.left = p.x + '%'; sdrag.el.style.top = p.y + '%';
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

  // ───────── 설정: 기준 시간 · 투명도
  const defAlpha = () => (S && S.settings ? (S.settings.sideAlpha != null ? S.settings.sideAlpha : 55) : 55);
  const curAlpha = () => (std.alpha != null ? std.alpha : (document.documentElement.classList.contains('paper') ? 100 : defAlpha()));
  let setBefore = null;
  $('tSet').addEventListener('click', (e) => {
    const before = setBefore = std.alpha;
    openPop(e.currentTarget, '<h4>⚙️ 플래너 설정</h4>' +
      '<div class="r"><span>출근</span><input type="text" id="stIn" maxlength="5" value="' + std.in + '"></div>' +
      '<div class="r"><span>퇴근</span><input type="text" id="stOut" maxlength="5" value="' + std.out + '"></div>' +
      '<div class="tip" style="margin:-2px 0 10px">출근 기준보다 일찍 오면 조출, 퇴근 기준보다 늦게 가면 야근이에요. 토·일은 근무 시간 전체를 따로 모아요.</div>' +
      '<div class="r"><span>투명도</span><input type="range" id="stA" min="20" max="100" step="1" value="' + curAlpha() + '"><span class="val" id="stAV">' + curAlpha() + '%</span></div>' +
      '<div class="acts"><button type="button" id="stNo">취소</button><button type="button" class="ok" id="stOk">저장</button></div>');
    $('stA').addEventListener('input', (ev) => { $('stAV').textContent = ev.target.value + '%'; std.alpha = +ev.target.value; theme(); });
    $('stNo').addEventListener('click', () => { std.alpha = before; theme(); closePop(); });
    $('stOk').addEventListener('click', () => {
      std = { in: normT($('stIn').value) || '09:00', out: normT($('stOut').value) || '18:00', alpha: +$('stA').value };
      api.plannerStd(std); closePop(); renderDays(); renderSum(); fit();
    });
  });

  // ───────── 팝업
  function placePop(anchor) {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.min(window.innerWidth - w - 12, Math.max(24, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8; if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function openPop(anchor, html) {
    pop.className = 'pop'; pop.onclick = null; pop.innerHTML = html; pop.hidden = false;
    placePop(anchor);
  }
  function closePop() { pop.hidden = true; pop.innerHTML = ''; }
  document.addEventListener('pointerdown', (e) => {
    if (pop.hidden || pop.contains(e.target) || e.target.closest('#tTape,#tSticker,#tSet')) return;
    const wasTape = !!pop.querySelector('#tpOk'), wasSet = !!pop.querySelector('#stOk');
    closePop(); if (wasTape) renderLane();
    if (wasSet) { std.alpha = setBefore; theme(); }   // 저장 안 한 투명도 되돌리기
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

  // ───────── 스킨 · 투명도
  function hexRGB(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255].join(','); }
  function theme() {
    if (!S) return;
    const sk = applyTheme(S.settings).sk, st = document.documentElement.style;
    st.setProperty('--sun', sk.sun); st.setProperty('--sat', sk.sat);
    if (sk.base) st.setProperty('--base', sk.base);
    const a = curAlpha() / 100;
    let bg;
    if (sk.panelRGB) bg = 'rgba(' + sk.panelRGB + ',' + Math.round((0.35 + 0.65 * a) * 100) / 100 + ')';
    else if (sk.paper && hexRGB(sk.base)) bg = 'rgba(' + hexRGB(sk.base) + ',' + a + ')';
    else bg = 'rgba(var(--glass),' + a + ')';
    st.setProperty('--plbg', bg);
    // 유리 스킨은 카드도 투명도를 따라 살짝 옅어짐
    if (!sk.paper && !sk.panelRGB) st.setProperty('--card', 'rgba(var(--glass),' + Math.round(Math.min(0.85, 0.35 + 0.6 * a) * 100) / 100 + ')'); else st.removeProperty('--card');
  }

  window.addEventListener('beforeunload', () => { if (saveT) flush(); });
  const slider = $('slider');
  // 왼쪽 끝을 끌어서 넓이 조절
  const grip = $('grip');
  let gdrag = null, graf = 0, gw = 0;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    gdrag = { sx: e.screenX, w: window.innerWidth - 30 };
    grip.classList.add('on'); grip.setPointerCapture(e.pointerId); api.plannerShape(false);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!gdrag) return;
    gw = gdrag.w - (e.screenX - gdrag.sx);
    if (graf) return;
    graf = requestAnimationFrame(() => { graf = 0; api.plannerWidth(gw, false); });
  });
  grip.addEventListener('pointerup', (e) => {
    if (!gdrag) return;
    const w = gdrag.w - (e.screenX - gdrag.sx); gdrag = null; grip.classList.remove('on');
    api.plannerWidth(w, true); fit();
  });
  // 다른 PC에서 고친 내용이 들어오면 다시 그림 (지금 쓰는 중이면 손 뗀 뒤에)
  let reloadT = 0;
  function remoteReload() {
    clearTimeout(reloadT);
    const busy = saveT || placing || !pop.hidden || (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName));
    if (busy) { reloadT = setTimeout(remoteReload, 2000); return; }
    const y = sheet.scrollTop; load().then(() => { sheet.scrollTop = y; });
  }
  api.onCmd((c) => { if (c.type === 'plReload') remoteReload(); });
  api.onCmd((c) => { if (c.type === 'leave') { if (saveT) flush(); closePop(); stopPlace(); api.plannerShape(false); slider.classList.remove('in'); } });
  slider.addEventListener('transitionend', (e) => { if (e.target === slider && slider.classList.contains('in')) api.plannerShape(true); });
  $('ptab').addEventListener('click', () => { if (saveT) flush(); api.plannerToggle(false); });
  $('ltab').addEventListener('click', () => { if (saveT) flush(); api.plannerList(); });
  api.onState((s) => { S = s; theme(); });
  api.init().then((s) => { S = s; theme(); load().then(() => requestAnimationFrame(() => requestAnimationFrame(() => slider.classList.add('in')))); });
  // 자정이 지나면 오늘 표시 갱신
  let lastDay = dateKey(new Date());
  setInterval(() => { const k = dateKey(new Date()); if (k !== lastDay) { lastDay = k; renderDays(); renderHead(); fit(); } }, 60000);
})();
