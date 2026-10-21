// 오른쪽 가장자리 목록바
(function () {
  const api = window.api;
  const { SKINS, FONTS, ICONS, EVENT_COLORS, grad, rgba, esc, dateKey, applyTheme, markSvg, memoOrder } = window.M;
  const $ = (s) => document.getElementById(s);
  const body = document.body, tab = $('tab'), panel = $('panel');
  const MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const EV_ORDER = ['lav', 'mint', 'pink', 'sky'];

  let S = null, sk = null;
  let view = 'memo', q = '';
  const now = new Date();
  let calY = now.getFullYear(), calM = now.getMonth(), sel = dateKey(now);
  let evList = [], evKey = null;

  // 아이콘 채우기
  $('pin').innerHTML = ICONS.pin;
  $('newMemo').innerHTML = ICONS.plus + '<span>새 메모</span>';
  $('searchIcon').innerHTML = ICONS.search;
  $('pSearchIcon').innerHTML = ICONS.search;
  $('foldAll').innerHTML = ICONS.foldAll + '<span>모두 접기</span>';
  $('unfoldAll').innerHTML = ICONS.unfoldAll + '<span>모두 펴기</span>';
  $('calPrev').innerHTML = ICONS.left;
  $('calNext').innerHTML = ICONS.right;
  $('addEv').innerHTML = ICONS.plus.replace('width="15" height="15"', 'width="13" height="13"') + '<span>일정 추가</span>';

  window.M.guardHTML($('list'), $('grid'), $('evList'), $('skins'), $('fonts'), $('today'), $('trashBtn'), $('acState'), $('mFoot'));

  // ───────── 열기 / 닫기 ─────────
  let ignoring = true, closeTimer = null;
  const isOpen = () => body.classList.contains('open');
  const bkBusy = () => !document.getElementById('bkForm').hidden || !document.getElementById('sConfirm').hidden;
  const pinned = () => !!(S && S.settings.pinned);
  function setIgnore(v) {
    if (v === ignoring) return;
    ignoring = v;
    api.sideIgnore(v);
  }
  function open() {
    clearTimeout(closeTimer);
    if (isOpen()) return;
    body.classList.add('open');
    tab.setAttribute('aria-expanded', 'true');
    setIgnore(false);
    renderAll();
  }
  function close() {
    clearTimeout(closeTimer);
    if (!isOpen() || pinned()) return;
    body.classList.remove('open');
    tab.setAttribute('aria-expanded', 'false');
    if (panel.contains(document.activeElement)) document.activeElement.blur();
  }
  // 마우스가 탭·목록 위에 있을 때만 클릭을 받고, 나머지는 아래 창으로 통과
  document.addEventListener('mousemove', (e) => {
    const t = e.target;
    setIgnore(!(tab.contains(t) || (isOpen() && panel.contains(t))));
  });
  document.addEventListener('mouseleave', () => setIgnore(true));
  // 열기·닫기는 ◀▶ 탭을 눌러서만 (마우스가 지나가도 열리지 않음)
  tab.addEventListener('click', () => {
    if (isOpen()) {
      if (pinned()) api.setSettings({ pinned: false });
      body.classList.remove('open');
      tab.setAttribute('aria-expanded', 'false');
      if (panel.contains(document.activeElement)) document.activeElement.blur();
    } else open();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen() && !bkBusy() && !pinned()) { close(); tab.focus(); }
  });
  $('pin').addEventListener('click', () => api.setSettings({ pinned: !pinned() }));

  // ───────── 탭 ─────────
  document.querySelectorAll('.segb').forEach((b) => b.addEventListener('click', () => { view = b.dataset.tab; renderAll(); }));

  // ───────── 전체 그리기 ─────────
  function renderAll() {
    if (!S) return;
    const t = applyTheme(S.settings);
    sk = t.sk;
    const st = document.documentElement.style;
    st.setProperty('--sun', sk.sun);
    st.setProperty('--sat', sk.sat);
    panel.style.background = 'rgba(var(--glass),' + ((S.settings.sideAlpha != null ? S.settings.sideAlpha : 55) / 100) + ')';
    const d = new Date();
    const c = S.cloud || {};
    const dateTxt = (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일';
    if (c.signedIn) {
      const st = c.state === 'error' ? 'error' : (c.state === 'syncing' ? 'syncing' : '');
      $('today').innerHTML = esc(dateTxt) + ' · <span class="syncDot ' + st + '"></span>' + esc(c.username);
    } else {
      $('today').textContent = dateTxt + ' · 자동 저장됨';
    }
    $('pin').classList.toggle('on', pinned());
    $('pin').setAttribute('aria-pressed', String(pinned()));
    if (pinned() && !isOpen()) open();
    document.querySelectorAll('.segb').forEach((b) => {
      const on = b.dataset.tab === view;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('vMemo').hidden = view !== 'memo';
    $('vCal').hidden = view !== 'cal';
    $('vPeople').hidden = view !== 'people';
    $('vStyle').hidden = view !== 'style';
    $('vAcct').hidden = view !== 'acct';
    renderUpdate();
    if (view === 'acct') renderAcct();
    if (view === 'memo') renderMemos();
    if (view === 'cal') renderCal();
    if (view === 'people') renderPeople();
    if (view === 'style') renderStyle();
  }

  // ───────── 연락망 ─────────
  let peopleTimer = null, peopleDirty = false, peopleSent = 0;
  const people = window.M.tableEditor($('people'), {
    head: window.M.CONTACT_HEAD,
    copy: (t) => api.copyText(t),
    onChange: (rows) => {
      peopleDirty = true;
      clearTimeout(peopleTimer);
      peopleTimer = setTimeout(flushPeople, 400);
      people.filter($('pq').value);
    }
  });
  function flushPeople() {
    clearTimeout(peopleTimer);
    if (!peopleDirty) return;
    peopleDirty = false;
    peopleSent = Date.now();
    api.setContacts(people.getRows());
  }
  $('people').addEventListener('focusout', () => setTimeout(() => { if (!$('people').contains(document.activeElement)) flushPeople(); }, 0));
  $('peopleToggle').addEventListener('click', () => { flushPeople(); api.setSettings({ showPeople: !S.settings.showPeople }); });
  let peopleEditing = false, pToastT = null;
  const peopleGv = window.M.contactView($('peopleGv'), {
    store: 'mallang.side.closed',
    onPick: (v, row, el) => {
      api.copyText(v);
      el.classList.add('picked');
      setTimeout(() => el.classList.remove('picked'), 600);
      $('pFoot').textContent = '‘' + v + '’ 복사했어요';
      clearTimeout(pToastT);
      pToastT = setTimeout(() => { $('pFoot').textContent = footText(); }, 1500);
    }
  });
  const footText = () => (peopleEditing ? '엑셀에서 복사해 붙여넣을 수 있어요 · Tab·Enter로 이동' : '누르면 번호가 복사돼요 · 부서 이름을 누르면 접혀요');
  $('pEdit').addEventListener('click', () => {
    peopleEditing = !peopleEditing;
    if (!peopleEditing) flushPeople();
    $('pEdit').textContent = peopleEditing ? '완료' : '편집';
    $('pEdit').classList.toggle('on', peopleEditing);
    $('pEdit').setAttribute('aria-pressed', String(peopleEditing));
    $('people').hidden = !peopleEditing;
    $('peopleGv').hidden = peopleEditing;
    $('pFoot').textContent = footText();
    if (!peopleEditing) { peopleGv.setRows(people.getRows()); peopleGv.filter($('pq').value); }
    else setTimeout(() => people.focusFirst(), 30);
  });
  function renderPeople() {
    $('peopleToggle').setAttribute('aria-pressed', String(!!S.settings.showPeople));
    if (!peopleEditing) peopleGv.setRows(S.contacts || [window.M.CONTACT_HEAD]);
    // 방금 보낸 내용보다 늦게 도착한 예전 상태로 되돌아가지 않게
    if (!peopleDirty && Date.now() - peopleSent > 800) people.setRows(S.contacts || null);
  }
  const pFilter = () => { people.filter($('pq').value); peopleGv.filter($('pq').value); };
  $('pq').addEventListener('input', pFilter);
  $('pq').addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('pq').value = ''; pFilter(); } });

  // ───────── 메모 목록 ─────────
  function matches(m) {
    if (!q) return true;
    const hay = [m.title, m.text, ...(m.items || []).map((x) => x.t)].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  }
  function metaOf(m) {
    const kind = m.type === 'table'
      ? '표 · ' + Math.max(0, ((m.table && m.table.rows) || []).length - 1) + '줄'
      : m.type === 'check'
      ? '체크리스트 ' + (m.items || []).filter((x) => x.d).length + '/' + (m.items || []).length
      : ((m.text || '').split('\n').find((l) => l.trim() && l !== window.M.DIVIDER) || '빈 메모').slice(0, 40);
    const where = m.hidden ? '숨김' : (m.layer === 'top' ? '항상 위' : (m.layer === 'bottom' ? '맨 뒤' : (m.folded ? '접힘' : '')));
    return where ? where + ' · ' + kind : kind;
  }
  function renderMemos() {
    $('memoTools').hidden = trashMode;
    $('trashHead').hidden = !trashMode;
    const tn = (S.trash || []).length;
    $('trashBtn').innerHTML = ICONS.trash.replace('width="15" height="15"', 'width="13" height="13"') + '<span>휴지통 ' + tn + '</span>';
    $('trashBtn').hidden = trashMode;
    if (trashMode) { renderTrash(); return; }
    const memos = S.memos.filter(matches).slice().sort(memoOrder);
    const listEl = $('list');
    if (!memos.length) {
      const c0 = S.cloud || {};
      listEl.innerHTML = '<div class="empty">' + (q ? '찾는 메모가 없어요' : (!c0.signedIn && c0.username ? '로그아웃 상태예요. 계정 탭에서 다시 로그인하면 메모가 돌아와요' : '메모가 없어요. 새 메모를 만들어 보세요')) + '</div>';
    } else {
      listEl.innerHTML = memos.map((m) => {
        const a = m.hidden ? 0.4 : 0.92;
        return '<div class="row' + (m.hidden ? ' hidden' : '') + '" data-id="' + m.id + '" style="background:' + grad(sk, m.slot || 0, a) + '">' +
          '<button class="ib" type="button" data-act="fold" aria-label="' + (m.folded ? '펼치기' : '접기') + '" aria-expanded="' + !m.folded + '" title="' + (m.folded ? '펼치기' : '접기') + '">' +
            ICONS.chev.replace('class="chev"', 'class="chev" style="transform:rotate(' + (m.folded ? 0 : 180) + 'deg)"') + '</button>' +
          '<button class="rmain" type="button" data-act="focus" title="메모 보기">' +
            '<span class="rtitle">' + (m.mark ? markSvg(m.mark, m.markColor || '#E8456B', 16) : '') + '<span>' + esc(m.title || '제목 없음') + '</span></span>' +
            '<span class="rmeta">' + esc(metaOf(m)) + '</span>' +
          '</button>' +
          '<button class="ib" type="button" data-act="hide" aria-label="' + (m.hidden ? '다시 보이기' : '숨기기') + '" title="' + (m.hidden ? '다시 보이기' : '숨기기') + '">' + (m.hidden ? ICONS.eyeOff : ICONS.eye) + '</button>' +
          '<button class="ib del" type="button" data-act="del" aria-label="삭제" title="삭제">' + ICONS.trash + '</button>' +
        '</div>';
      }).join('');
    }
    const hidden = S.memos.filter((m) => m.hidden).length;
    const folded = S.memos.filter((m) => m.folded).length;
    $('mFoot').textContent = '전체 ' + S.memos.length + '개 · 접힘 ' + folded + '개 · 숨김 ' + hidden + '개';
  }
  // ───────── 휴지통 ─────────
  let trashMode = false;
  const DAY = 24 * 60 * 60 * 1000;
  function renderTrash() {
    const list = S.trash || [];
    const el = $('list');
    $('mFoot').textContent = '휴지통 ' + list.length + '개';
    if (!list.length) {
      el.innerHTML = '<div class="empty">휴지통이 비어 있어요</div>';
      return;
    }
    const now = Date.now();
    el.innerHTML = list.map((t) => {
      const left = Math.ceil((t.purgeAt - now) / DAY);
      const when = left <= 1 ? '오늘 자동 영구 삭제' : left + '일 후 자동 영구 삭제';
      return '<div class="row trow" data-tid="' + t.id + '">' +
        '<span class="tswatch" style="background:' + grad(sk, t.slot || 0, 1) + '"></span>' +
        '<div class="rmain">' +
          '<span class="rtitle">' + (t.mark ? markSvg(t.mark, t.markColor || '#E8456B', 16) : '') + '<span>' + esc(t.title || '제목 없음') + '</span></span>' +
          '<span class="rmeta">' + esc(when + (t.preview ? ' · ' + t.preview : '')) + '</span>' +
        '</div>' +
        '<button class="tbtn" type="button" data-act="restore" title="메모로 되살리기">되살리기</button>' +
        '<button class="tbtn tdel" type="button" data-act="purge" title="PC에서도 완전히 지워요">영구 삭제</button>' +
      '</div>';
    }).join('');
  }
  // 확인 팝업
  let confirmResolve = null;
  function askConfirm(title, desc, yesLabel) {
    $('scTitle').textContent = title;
    $('scDesc').textContent = desc;
    $('scYes').textContent = yesLabel;
    $('sConfirm').hidden = false;
    api.sideFocus();
    setTimeout(() => $('scNo').focus(), 30);
    return new Promise((res) => { confirmResolve = res; });
  }
  function answerConfirm(v) {
    $('sConfirm').hidden = true;
    if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(v); }
  }
  $('scNo').addEventListener('click', () => answerConfirm(false));
  $('scYes').addEventListener('click', () => answerConfirm(true));
  $('sConfirm').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); answerConfirm(false); } });
  $('sConfirm').addEventListener('pointerdown', (e) => { if (e.target === $('sConfirm')) answerConfirm(false); });
  $('trashBtn').addEventListener('click', () => { trashMode = true; renderMemos(); });
  $('trashBack').innerHTML = ICONS.left + '<span>메모 목록</span>';
  $('trashBack').addEventListener('click', () => { trashMode = false; renderMemos(); });
  $('emptyTrash').addEventListener('click', async () => {
    const n = (S.trash || []).length;
    if (!n) return;
    if (await askConfirm('휴지통을 비울까요?', '메모 ' + n + '개가 PC에서도 완전히 지워져요. 되돌릴 수 없어요.', '모두 영구 삭제')) api.emptyTrash();
  });

  $('list').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const trow = b.closest('.trow');
    if (trow) {
      const tid = Number(trow.dataset.tid);
      if (b.dataset.act === 'restore') api.restore(tid);
      if (b.dataset.act === 'purge') {
        const t = (S.trash || []).find((x) => x.id === tid);
        askConfirm('영구 삭제할까요?', '"' + ((t && t.title) || '제목 없음') + '" 메모가 PC에서도 완전히 지워져요. 되돌릴 수 없어요.', '영구 삭제').then((ok) => { if (ok) api.purge(tid); });
      }
      return;
    }
    const id = Number(b.closest('.row').dataset.id);
    const m = S.memos.find((x) => x.id === id);
    if (!m) return;
    const act = b.dataset.act;
    if (act === 'fold') api.update(id, { folded: !m.folded });
    if (act === 'focus') api.focus(id);
    if (act === 'hide') api.update(id, { hidden: !m.hidden });
    if (act === 'del') {
      askConfirm('이 메모를 삭제할까요?', '"' + (m.title || '제목 없음') + '" 메모는 휴지통에서 7일 동안 되살릴 수 있어요.', '삭제').then((ok) => { if (ok) api.remove(id); });
    }
  });

  // ───────── 백업 ─────────
  let bkMode = null;
  function bkMsg(text, kind) {
    const el = $('bkMsg');
    el.textContent = text || '';
    el.className = 'bkMsg' + (kind ? ' ' + kind : '');
  }
  function openBk(mode) {
    bkMode = mode;
    $('bkForm').hidden = false;
    $('bkPw').value = '';
    $('bkPw2').value = '';
    $('bkPw2Wrap').hidden = mode !== 'export';
    $('bkTitle').textContent = mode === 'export' ? '백업 파일 비밀번호 정하기' : '백업 파일 비밀번호 입력';
    $('bkHint').textContent = mode === 'export'
      ? '이 비밀번호를 잊으면 백업 파일을 열 수 없어요. 꼭 기억해 두세요. (4자 이상)'
      : '가져온 메모는 지금 메모에 추가돼요. 지금 메모는 지워지지 않아요.';
    $('bkGo').textContent = mode === 'export' ? '파일로 저장' : '파일 고르기';
    bkMsg('');
    api.sideFocus();
    setTimeout(() => $('bkPw').focus(), 50);
  }
  function closeBk() {
    bkMode = null;
    $('bkForm').hidden = true;
    $('bkPw').value = '';
    $('bkPw2').value = '';
  }
  $('bkExportBtn').addEventListener('click', () => openBk('export'));
  $('bkImportBtn').addEventListener('click', () => openBk('import'));
  $('bkCancel').addEventListener('click', () => { closeBk(); bkMsg(''); });
  $('bkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('bkPw').value;
    if (bkMode === 'export') {
      if (pw.length < 4) { bkMsg('비밀번호는 4자 이상으로 정해 주세요', 'err'); return; }
      if (pw !== $('bkPw2').value) { bkMsg('비밀번호 확인이 서로 달라요', 'err'); return; }
      bkMsg('저장할 곳을 골라 주세요…');
      const r = await api.exportBackup(pw);
      if (r.canceled) { bkMsg(''); return; }
      if (r.error) { bkMsg(r.error, 'err'); return; }
      closeBk();
      bkMsg('메모 ' + r.count + '개를 "' + r.file + '" 파일로 백업했어요.', 'ok');
    } else if (bkMode === 'import') {
      if (!pw) { bkMsg('비밀번호를 입력해 주세요', 'err'); return; }
      bkMsg('백업 파일을 골라 주세요…');
      const r = await api.importBackup(pw);
      if (r.canceled) { bkMsg(''); return; }
      if (r.error) { bkMsg(r.error, 'err'); return; }
      closeBk();
      bkMsg('메모 ' + r.added + '개' + (r.events ? ', 일정 ' + r.events + '개' : '') + '를 되살렸어요.' + (r.skipped ? ' (이미 있는 메모 ' + r.skipped + '개는 건너뛰었어요)' : ''), 'ok');
    }
  });
  $('newMemo').addEventListener('click', () => api.create({}));
  $('foldAll').title = '모두 접기 (Ctrl+Alt+↑)';
  $('unfoldAll').title = '모두 펴기 (Ctrl+Alt+↓)';
  $('foldAll').addEventListener('click', () => api.foldAll());
  $('unfoldAll').addEventListener('click', () => api.unfoldAll());
  $('q').addEventListener('input', (e) => { q = e.target.value.trim(); renderMemos(); });
  $('q').addEventListener('focus', () => api.sideFocus());

  // ───────── 캘린더 ─────────
  function renderCal() {
    $('calNum').textContent = String(calM + 1);
    $('calEn').textContent = MONTH_EN[calM] + ' ' + calY;
    const todayK = dateKey(new Date());
    const start = new Date(calY, calM, 1).getDay();
    const daysIn = new Date(calY, calM + 1, 0).getDate();
    const count = Math.ceil((start + daysIn) / 7) * 7;
    let html = '';
    for (let i = 0; i < count; i++) {
      const dt = new Date(calY, calM, i - start + 1);
      if (dt.getMonth() !== calM) { html += '<div class="cell"></div>'; continue; }
      const k = dateKey(dt);
      const evs = (S.events[k] || []);
      const wd = dt.getDay();
      const color = wd === 0 ? 'var(--sun)' : (wd === 6 ? 'var(--sat)' : 'var(--ink)');
      html += '<div class="cell"><button class="day' + (k === todayK ? ' today' : '') + (k === sel ? ' sel' : '') + '" type="button" data-k="' + k + '" style="color:' + color + '" aria-pressed="' + (k === sel) + '" aria-label="' + (dt.getMonth() + 1) + '월 ' + dt.getDate() + '일' + (evs.length ? ', 일정 ' + evs.length + '개' : '') + '">' +
        '<span>' + dt.getDate() + '</span><span class="dots">' + evs.slice(0, 3).map((ev) => '<i style="background:' + EVENT_COLORS[ev.c] + '"></i>').join('') + '</span></button></div>';
    }
    $('grid').innerHTML = html;
    const sp = sel.split('-').map(Number);
    const sd = new Date(sp[0], sp[1] - 1, sp[2]);
    $('selLabel').textContent = (sd.getMonth() + 1) + '월 ' + sd.getDate() + '일 ' + WD[sd.getDay()] + '요일';
    const tt = $('todayToggle');
    tt.setAttribute('aria-pressed', String(!!S.settings.showToday));
    if (evKey !== sel || !$('evList').contains(document.activeElement)) {
      evKey = sel;
      evList = (S.events[sel] || []).map((x) => ({ ...x }));
      renderEvents();
    }
  }
  function renderEvents(focusIdx) {
    const el = $('evList');
    if (!evList.length) {
      el.innerHTML = '<div class="empty">일정이 없어요</div>';
      return;
    }
    el.innerHTML = evList.map((ev, i) =>
      '<div class="ev" data-i="' + i + '">' +
        '<button class="evc" type="button" data-act="color" style="background:' + EVENT_COLORS[ev.c] + '" aria-label="일정 색 바꾸기" title="색 바꾸기"></button>' +
        '<input class="evt" type="time" data-f="t" value="' + esc(/^\d{2}:\d{2}$/.test(ev.t) ? ev.t : '') + '" aria-label="시간 (비우면 종일)">' +
        '<input class="evn" type="text" data-f="title" value="' + esc(ev.title) + '" placeholder="일정 이름" spellcheck="false" aria-label="일정 이름">' +
        '<button class="ib" type="button" data-act="del" aria-label="일정 삭제" title="삭제">' + ICONS.x + '</button>' +
      '</div>'
    ).join('');
    if (focusIdx != null) {
      const inp = el.querySelector('.ev[data-i="' + focusIdx + '"] .evn');
      if (inp) inp.focus();
    }
  }
  let evSaveT = null;
  const saveEvents = (now) => {
    clearTimeout(evSaveT);
    const key = evKey;
    const list = evList.map((x) => ({ ...x }));
    const run = () => api.setEvents(key, list);
    if (now) run(); else evSaveT = setTimeout(run, 300);
  };
  $('grid').addEventListener('click', (e) => {
    const b = e.target.closest('.day');
    if (!b) return;
    if (evSaveT) saveEvents(true);
    sel = b.dataset.k;
    renderCal();
  });
  $('calPrev').addEventListener('click', () => { if (calM === 0) { calM = 11; calY--; } else calM--; renderCal(); });
  $('calNext').addEventListener('click', () => { if (calM === 11) { calM = 0; calY++; } else calM++; renderCal(); });
  $('calToday').addEventListener('click', () => { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); sel = dateKey(d); renderCal(); });
  $('addEv').addEventListener('click', () => {
    if (evKey !== sel) { evKey = sel; evList = (S.events[sel] || []).map((x) => ({ ...x })); }
    evList.push({ t: '', title: '', c: EV_ORDER[evList.length % 4] });
    renderEvents(evList.length - 1);
    saveEvents(true);
    api.sideFocus();
  });
  $('evList').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = Number(b.closest('.ev').dataset.i);
    if (b.dataset.act === 'color') {
      evList[i].c = EV_ORDER[(EV_ORDER.indexOf(evList[i].c) + 1) % 4];
      b.style.background = EVENT_COLORS[evList[i].c];
      saveEvents(true);
    }
    if (b.dataset.act === 'del') {
      evList.splice(i, 1);
      renderEvents();
      saveEvents(true);
    }
  });
  $('evList').addEventListener('input', (e) => {
    const inp = e.target.closest('input');
    if (!inp) return;
    const i = Number(inp.closest('.ev').dataset.i);
    evList[i][inp.dataset.f] = inp.value;
    saveEvents(false);
  });
  $('evList').addEventListener('focusin', () => api.sideFocus());
  $('evList').addEventListener('focusout', () => { if (evSaveT) saveEvents(true); });
  $('todayToggle').addEventListener('click', () => api.setSettings({ showToday: !S.settings.showToday }));

  // ───────── 꾸미기 ─────────
  function renderStyle() {
    const s = S.settings;
    $('skins').innerHTML = Object.keys(SKINS).map((id) => {
      const k = SKINS[id];
      return '<button class="skin soft' + (s.skin === id ? ' on' : '') + '" type="button" data-skin="' + id + '" aria-pressed="' + (s.skin === id) + '" style="--sc:' + k.a1 + ';--sg:' + k.glow + '">' +
        '<span class="prev" style="background:linear-gradient(135deg,' + k.b[0] + ',' + k.b[1] + ' 55%,' + k.b[2] + ')">' +
          '<i style="background:' + rgba(k.pal[0][0], 0.85) + '"></i><i style="background:' + rgba(k.pal[1][1], 0.85) + '"></i><b style="background:' + k.a1 + '"></b>' +
        '</span><span>' + k.name + '</span></button>';
    }).join('');
    $('fonts').innerHTML = FONTS.map((f) =>
      '<button class="font soft' + (s.font === f.id ? ' on' : '') + '" type="button" data-font="' + f.id + '" aria-pressed="' + (s.font === f.id) + '">' +
        '<span class="fs"><span style="font-family:' + f.fam.replace(/"/g, '') + ';font-size:' + f.size + 'px">오늘의 메모, 가나다</span><span class="fn">' + f.name + '</span></span>' +
        (s.font === f.id ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>' : '') +
      '</button>'
    ).join('');
    if (document.activeElement !== $('alpha')) $('alpha').value = s.alpha;
    if (document.activeElement !== $('sideAlpha')) $('sideAlpha').value = s.sideAlpha;
    const fsv = s.fontScale || 100;
    if (document.activeElement !== $('fontScale')) $('fontScale').value = fsv;
    $('fontScaleV').textContent = fsv + '%';
    $('calFont').innerHTML = window.M.calFontOptions(s).map((o) => '<option value="' + o.id + '"' + ((s.calFont || 'same') === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('');
    const csv = s.calScale || 100;
    if (document.activeElement !== $('calScale')) $('calScale').value = csv;
    $('calScaleV').textContent = csv + '%';
    $('alphaV').textContent = s.alpha + '%';
    $('sideAlphaV').textContent = s.sideAlpha + '%';
    $('autoStart').setAttribute('aria-pressed', String(!!s.autoStart));
    $('bodyBg').setAttribute('aria-pressed', String(!!s.bodyBg));
  }
  $('skins').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (b) api.setSettings({ skin: b.dataset.skin }); });
  $('fonts').addEventListener('click', (e) => { const b = e.target.closest('[data-font]'); if (b) api.setSettings({ font: b.dataset.font }); });
  const setFs = (v) => { v = Math.min(170, Math.max(70, v)); $('fontScale').value = v; $('fontScaleV').textContent = v + '%'; api.setSettings({ fontScale: v }); };
  $('fontScale').addEventListener('input', (e) => setFs(Number(e.target.value)));
  $('fsDown').addEventListener('click', () => setFs((S.settings.fontScale || 100) - 10));
  $('fsUp').addEventListener('click', () => setFs((S.settings.fontScale || 100) + 10));
  $('calFont').addEventListener('change', (e) => api.setSettings({ calFont: e.target.value }));
  const setCs = (v) => { v = Math.min(150, Math.max(70, v)); $('calScale').value = v; $('calScaleV').textContent = v + '%'; api.setSettings({ calScale: v }); };
  $('calScale').addEventListener('input', (e) => setCs(Number(e.target.value)));
  $('csDown').addEventListener('click', () => setCs((S.settings.calScale || 100) - 10));
  $('csUp').addEventListener('click', () => setCs((S.settings.calScale || 100) + 10));
  $('alpha').addEventListener('input', (e) => { $('alphaV').textContent = e.target.value + '%'; api.setSettings({ alpha: Number(e.target.value) }); });
  $('sideAlpha').addEventListener('input', (e) => {
    $('sideAlphaV').textContent = e.target.value + '%';
    panel.style.background = 'rgba(var(--glass),' + (Number(e.target.value) / 100) + ')';
    api.setSettings({ sideAlpha: Number(e.target.value) });
  });
  $('bodyBg').addEventListener('click', () => api.setSettings({ bodyBg: !S.settings.bodyBg }));
  $('autoStart').addEventListener('click', () => api.setSettings({ autoStart: !S.settings.autoStart }));
  $('openData').addEventListener('click', () => api.openData());

  // ───────── 업데이트 ─────────
  function renderUpdate() {
    const u = S.update || {};
    $('updBar').hidden = u.state !== 'ready';
    if (u.state === 'ready') $('updBar').textContent = '새 버전 ' + u.version + ' 준비됐어요 · 지금 적용';
    const st = { checking: '확인 중…', downloading: '새 버전 ' + (u.version || '') + ' 받는 중 ' + (u.percent || 0) + '%', latest: '최신 버전이에요', ready: '새 버전 ' + u.version + ' 준비됨', error: u.message || '' }[u.state] || '';
    $('verTxt').textContent = '버전 ' + (u.current || '') + (st ? ' · ' + st : '');
    $('verCheck').textContent = u.state === 'ready' ? '지금 적용' : '업데이트 확인';
    $('verCheck').disabled = u.state === 'checking' || u.state === 'downloading';
  }
  $('updBar').addEventListener('click', () => api.applyUpdate());
  $('verCheck').addEventListener('click', () => { const u = S.update || {}; if (u.state === 'ready') api.applyUpdate(); else api.checkUpdate(); });

  // ───────── 계정 ─────────
  let acMode = 'login', acBusy = false;
  function ago(t) {
    if (!t) return '';
    const s2 = Math.round((Date.now() - t) / 1000);
    if (s2 < 10) return '방금';
    if (s2 < 60) return s2 + '초 전';
    if (s2 < 3600) return Math.round(s2 / 60) + '분 전';
    return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  function renderAcct() {
    const c = S.cloud || {};
    $('acOut').hidden = !!c.signedIn;
    $('acIn').hidden = !c.signedIn;
    if (c.signedIn) {
      $('acName').textContent = c.username;
      $('acAvatar').textContent = (c.username || '?').slice(0, 1).toUpperCase();
      const el = $('acState');
      el.className = 'acState ' + (c.state || '');
      const txt = c.state === 'syncing' ? '맞추는 중…'
        : c.state === 'error' ? (c.message || '맞추지 못했어요')
        : c.state === 'ok' ? '맞춤 완료 · ' + ago(c.lastSync)
        : '연결 중…';
      el.innerHTML = '<i></i><span>' + esc(txt) + '</span>';
      $('acUrl').textContent = c.mobileUrl || '';
    } else {
      $('acModeLogin').classList.toggle('on', acMode === 'login');
      $('acModeSignup').classList.toggle('on', acMode === 'signup');
      $('acModeLogin').setAttribute('aria-selected', String(acMode === 'login'));
      $('acModeSignup').setAttribute('aria-selected', String(acMode === 'signup'));
      $('acPw2Wrap').hidden = acMode !== 'signup';
      $('acWarn').hidden = acMode !== 'signup';
      $('acPw').autocomplete = acMode === 'signup' ? 'new-password' : 'current-password';
      $('acGo').textContent = acBusy ? (acMode === 'signup' ? '가입하는 중…' : '로그인하는 중…') : (acMode === 'signup' ? '가입하고 시작하기' : '로그인');
      $('acGo').disabled = acBusy;
      if (c.message && !$('acMsg').textContent) { $('acMsg').textContent = c.message; $('acMsg').className = 'bkMsg err'; }
      if (c.username && !$('acUser').value) $('acUser').value = c.username;
    }
  }
  function acSetMode(m) { acMode = m; $('acMsg').textContent = ''; renderAcct(); }
  $('acModeLogin').addEventListener('click', () => acSetMode('login'));
  $('acModeSignup').addEventListener('click', () => acSetMode('signup'));
  ['acUser', 'acPw', 'acPw2'].forEach((i) => $(i).addEventListener('focus', () => api.sideFocus()));
  $('acForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (acBusy) return;
    const u = $('acUser').value.trim().toLowerCase();
    const pw = $('acPw').value;
    const msg = (t, k) => { $('acMsg').textContent = t; $('acMsg').className = 'bkMsg' + (k ? ' ' + k : ''); };
    if (!/^[a-z0-9_]{3,20}$/.test(u)) { msg('아이디는 영어 소문자·숫자·밑줄(_)로 3~20자예요', 'err'); return; }
    if (pw.length < 8) { msg('비밀번호는 8자 이상으로 정해 주세요', 'err'); return; }
    if (acMode === 'signup' && pw !== $('acPw2').value) { msg('비밀번호 확인이 서로 달라요', 'err'); return; }
    acBusy = true; msg(''); renderAcct();
    const r = await api.cloudSignIn(acMode, u, pw);
    acBusy = false;
    if (r && r.ok) {
      $('acPw').value = ''; $('acPw2').value = '';
      msg('');
    } else {
      msg((r && r.error) || '로그인하지 못했어요', 'err');
    }
    renderAcct();
  });
  $('acSync').addEventListener('click', () => api.cloudSync());
  $('acLogout').addEventListener('click', async () => {
    if (!(await askConfirm('로그아웃할까요?', '이 PC에서 메모와 일정이 사라져요. 같은 아이디로 다시 로그인하면 그대로 돌아와요.', '로그아웃'))) return;
    $('acLogout').textContent = '올리는 중…';
    let r = await api.cloudLogout(false);
    if (r && r.unsynced) {
      $('acLogout').textContent = '로그아웃';
      const ok = await askConfirm('아직 올라가지 않은 변경이 있어요', '인터넷 연결 문제로 ' + r.unsynced + '개가 서버에 올라가지 못했어요. 지금 로그아웃하면 이 변경은 사라져요.', '그래도 로그아웃');
      if (!ok) return;
      r = await api.cloudLogout(true);
    }
    $('acLogout').textContent = '로그아웃';
  });
  $('acCopy').addEventListener('click', () => {
    api.copyMobileUrl();
    $('acCopy').textContent = '복사했어요';
    setTimeout(() => { $('acCopy').textContent = '주소 복사'; }, 1600);
  });
  $('acOpen').addEventListener('click', () => api.openMobileUrl());

  // ───────── 연결 ─────────
  api.onCmd((c) => { if (c.type === 'open') { open(); api.sideFocus(); } });
  api.onState((s) => { S = s; renderAll(); });
  api.init().then((s) => { S = s; renderAll(); });
  setInterval(() => { if (isOpen()) renderAll(); }, 60000);
})();
