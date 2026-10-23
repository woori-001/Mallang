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

  window.M.guardHTML($('list'), $('grid'), $('evList'), $('skins'), $('today'), $('trashBtn'), $('acState'), $('mFoot'));

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
    panel.style.background = sk.paper ? sk.base : 'rgba(var(--glass),' + ((S.settings.sideAlpha != null ? S.settings.sideAlpha : 55) / 100) + ')';
    updateSky(sk.season);
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
  const footText = () => (peopleEditing ? (S && S.contactsShared ? '고치면 모든 사용자에게 바로 반영돼요 · Tab·Enter로 이동' : '엑셀에서 복사해 붙여넣을 수 있어요 · Tab·Enter로 이동') : '누르면 번호가 복사돼요 · 부서 이름을 누르면 접혀요');
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
    // 회사 공통 연락망은 관리자만 고칠 수 있음
    $('pEdit').hidden = S.canEditContacts === false && !peopleEditing;
    $('pShared').hidden = !S.contactsShared;
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
    // 그룹 이름을 고치는 중이면 목록을 다시 그리지 않음 (쓰던 글자가 날아가지 않게)
    if (renamingGroup && document.activeElement && document.activeElement.classList.contains('gname-in')) return;
    const memos = S.memos.filter(matches).slice().sort(memoOrder);
    const listEl = $('list');
    if (!memos.length) {
      const c0 = S.cloud || {};
      listEl.innerHTML = '<div class="empty">' + (q ? '찾는 메모가 없어요' : (!c0.signedIn && c0.username ? '로그아웃 상태예요. 계정 탭에서 다시 로그인하면 메모가 돌아와요' : '메모가 없어요. 새 메모를 만들어 보세요')) + '</div>';
    } else {
      const rowOf = (m) => {
        const a = m.hidden ? 0.4 : 0.92;
        return '<div class="row' + (m.hidden ? ' hidden' : '') + '" draggable="true" data-id="' + m.id + '" title="끌어서 그룹 폴더에 넣거나 뺄 수 있어요" style="background:' + grad(sk, m.slot || 0, a) + '">' +
          '<button class="ib" type="button" data-act="fold" aria-label="' + (m.folded ? '펼치기' : '접기') + '" aria-expanded="' + !m.folded + '" title="' + (m.folded ? '펼치기' : '접기') + '">' +
            ICONS.chev.replace('class="chev"', 'class="chev" style="transform:rotate(' + (m.folded ? 0 : 180) + 'deg)"') + '</button>' +
          '<button class="rmain" type="button" data-act="focus" title="메모 보기">' +
            '<span class="rtitle">' + (m.mark ? markSvg(m.mark, m.markColor || '#E8456B', 16) : '') + '<span>' + esc(m.title || '제목 없음') + '</span></span>' +
            '<span class="rmeta">' + esc(metaOf(m)) + '</span>' +
          '</button>' +
          '<button class="ib" type="button" data-act="hide" aria-label="' + (m.hidden ? '다시 보이기' : '숨기기') + '" title="' + (m.hidden ? '다시 보이기' : '숨기기') + '">' + (m.hidden ? ICONS.eyeOff : ICONS.eye) + '</button>' +
          '<button class="ib del" type="button" data-act="del" aria-label="삭제" title="삭제">' + ICONS.trash + '</button>' +
        '</div>';
      };
      // 그룹별로 묶어서 보여주기 (그룹 없는 메모는 아래에)
      const groups = S.groups || [];
      const C = window.M.GROUP_COLORS;
      let html = '';
      for (const g of groups) {
        const mem = memos.filter((m) => m.group === g.id);
        if (q && !mem.length) continue;
        const allHidden = mem.length > 0 && mem.every((m) => m.hidden);
        const allFolded = mem.length > 0 && mem.filter((m) => !m.hidden).every((m) => m.folded);
        const closed = !openGroups[g.id] && !q;   // 기본은 닫힘, 열어 둔 폴더만 열림
        html += '<div class="grp' + (closed ? ' closed' : '') + (allHidden ? ' ghidden' : '') + '" data-g="' + esc(g.id) + '">' +
          '<div class="ghead">' +
            '<button class="ib gtog" type="button" data-gact="toggle" aria-expanded="' + !closed + '" title="' + (closed ? '폴더 열기' : '폴더 닫기') + '">' + (closed ? ICONS.folder : ICONS.folderOpen).replace('width="15" height="15"', 'width="17" height="17"') + '</button>' +
            (renamingGroup === g.id
              ? '<input class="gname-in" data-gact="rename-in" value="' + esc(g.name) + '" maxlength="40" spellcheck="false">'
              : '<span class="gname" data-gact="rename" title="더블클릭해서 이름 바꾸기">' + esc(g.name) + '</span>') +
            '<span class="gcnt">' + mem.length + '</span>' +
            '<button class="ib" type="button" data-gact="fold" title="' + (allFolded ? '그룹 모두 펴기' : '그룹 모두 접기') + '" aria-label="' + (allFolded ? '그룹 모두 펴기' : '그룹 모두 접기') + '">' + (allFolded ? ICONS.unfoldAll : ICONS.foldAll) + '</button>' +
            '<button class="ib" type="button" data-gact="hide" title="' + (allHidden ? '그룹 보이기' : '그룹 숨기기') + '" aria-label="' + (allHidden ? '그룹 보이기' : '그룹 숨기기') + '">' + (allHidden ? ICONS.eyeOff : ICONS.eye) + '</button>' +
            '<button class="ib" type="button" data-gact="remove" title="그룹 풀기 (메모는 그대로)" aria-label="그룹 풀기">' + ICONS.x + '</button>' +
          '</div>' +
          '<div class="gbody">' + (mem.length ? mem.map(rowOf).join('') : '<div class="gempty">메모 ⋯ 메뉴의 폴더 버튼으로 이 그룹에 넣을 수 있어요</div>') + '</div>' +
        '</div>';
      }
      const rest = memos.filter((m) => !m.group || !groups.some((g) => g.id === m.group));
      if (groups.length) html += '<div class="ungrp" data-g=""><div class="nogrp">그룹 없음' + (rest.length ? '' : ' · 여기로 끌어 놓으면 그룹에서 빠져요') + '</div>' + rest.map(rowOf).join('') + '</div>';
      else html += rest.map(rowOf).join('');
      listEl.innerHTML = html;
      const gi = listEl.querySelector('.gname-in');
      if (gi && document.activeElement !== gi) { gi.focus(); gi.select(); }
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

  // ───────── 끌어서 그룹에 넣기·빼기 ─────────
  let dragId = null;
  const zoneOf = (el) => el && el.closest('.grp, .ungrp');
  $('list').addEventListener('dragstart', (e) => {
    const row = e.target.closest && e.target.closest('.row[data-id]');
    if (!row) return;
    dragId = Number(row.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', 'mallang-memo:' + dragId); } catch (err) { /* 무시 */ }
    requestAnimationFrame(() => row.classList.add('dragging'));
    document.body.classList.add('dnd');
  });
  $('list').addEventListener('dragend', () => {
    dragId = null;
    document.body.classList.remove('dnd');
    $('list').querySelectorAll('.dragging, .dropOn').forEach((x) => x.classList.remove('dragging', 'dropOn'));
  });
  $('list').addEventListener('dragover', (e) => {
    if (dragId == null) return;
    const z = zoneOf(e.target);
    if (!z) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!z.classList.contains('dropOn')) {
      $('list').querySelectorAll('.dropOn').forEach((x) => x.classList.remove('dropOn'));
      z.classList.add('dropOn');
    }
  });
  $('list').addEventListener('dragleave', (e) => {
    const z = zoneOf(e.target);
    if (z && !z.contains(e.relatedTarget)) z.classList.remove('dropOn');
  });
  $('list').addEventListener('drop', (e) => {
    if (dragId == null) return;
    const z = zoneOf(e.target);
    if (!z) return;
    e.preventDefault();
    const gid = z.dataset.g || null;
    const m = S.memos.find((x) => x.id === dragId);
    if (m && (m.group || null) !== gid) {
      api.update(dragId, { group: gid });
      if (gid && !openGroups[gid]) api.groupOpen(gid, true);
    }
    z.classList.remove('dropOn');
  });

  // ───────── 그룹 ─────────
  // 폴더 열림 상태: 기본은 닫힘, 열고 닫은 그대로 기억 (PC에 저장 · 다시 켜도, 다시 로그인해도)
  const openGroups = new Proxy({}, { get: (t, k) => !!(S && S.openGroups && S.openGroups[k]) });
  let renamingGroup = null;
  $('newGroup').innerHTML = ICONS.folder + '<span>새 그룹</span>';
  $('newGroup').addEventListener('click', async () => {
    const gid = await api.groupCreate('');
    api.groupOpen(gid, true);
    renamingGroup = gid;
    renderMemos();
  });
  function finishRename(input, ok) {
    const gid = renamingGroup;
    renamingGroup = null;
    if (ok && gid && input.value.trim()) api.groupRename(gid, input.value.trim());
    renderMemos();
  }
  $('list').addEventListener('keydown', (e) => {
    const inp = e.target.closest('.gname-in');
    if (!inp || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); finishRename(inp, true); }
    if (e.key === 'Escape') { e.preventDefault(); finishRename(inp, false); }
  });
  $('list').addEventListener('focusout', (e) => { const inp = e.target.closest && e.target.closest('.gname-in'); if (inp && renamingGroup) finishRename(inp, true); });
  $('list').addEventListener('dblclick', (e) => {
    const n = e.target.closest('.gname');
    if (!n) return;
    renamingGroup = n.closest('.grp').dataset.g;
    renderMemos();
  });
  $('list').addEventListener('click', (e) => {
    const gb = e.target.closest('[data-gact]');
    if (gb && gb.tagName === 'BUTTON') {
      const grp = gb.closest('.grp');
      const gid = grp.dataset.g;
      const mem = S.memos.filter((m) => m.group === gid);
      const act = gb.dataset.gact;
      if (act === 'toggle') { S.openGroups = { ...(S.openGroups || {}) }; if (S.openGroups[gid]) delete S.openGroups[gid]; else S.openGroups[gid] = true; api.groupOpen(gid, !!S.openGroups[gid]); renderMemos(); }
      if (act === 'hide') api.groupHide(gid, !(mem.length && mem.every((m) => m.hidden)));
      if (act === 'fold') api.groupFold(gid, !(mem.length && mem.filter((m) => !m.hidden).every((m) => m.folded)));
      if (act === 'remove') {
        const g = (S.groups || []).find((x) => x.id === gid);
        askConfirm('그룹을 풀까요?', '"' + ((g && g.name) || '그룹') + '" 그룹만 없어지고, 안에 있던 메모는 그대로 남아요.', '그룹 풀기').then((ok) => { if (ok) api.groupRemove(gid); });
      }
      return;
    }
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
    if (!b.closest('.row')) return;
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
  $('memoitBtn').addEventListener('click', async () => {
    bkMsg('메모잇 백업 파일(memodb_날짜)을 골라 주세요…');
    const r = await api.importMemoit();
    if (r.canceled) { bkMsg(''); return; }
    if (r.error) { bkMsg(r.error, 'err'); return; }
    bkMsg('메모잇에서 메모 ' + r.added + '개' + (r.events ? ', 달력 일정 ' + r.events + '개' : '') + '를 가져왔어요' + (r.skipped ? ' (이미 있거나 빈 메모 ' + r.skipped + '개는 건너뜀)' : ''), 'ok');
  });
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
    const rec = window.M.recurring(S.events);
    for (let i = 0; i < count; i++) {
      const dt = new Date(calY, calM, i - start + 1);
      if (dt.getMonth() !== calM) { html += '<div class="cell"></div>'; continue; }
      const k = dateKey(dt);
      const evs = window.M.eventsOn(S.events, k, rec).map((x) => x.ev);
      const wd = dt.getDay();
      const color = wd === 0 ? 'var(--sun)' : (wd === 6 ? 'var(--sat)' : 'var(--ink)');
      html += '<div class="cell"><button class="day' + (wd === 0 ? ' sun' : '') + (k === todayK ? ' today' : '') + (k === sel ? ' sel' : '') + '" type="button" data-k="' + k + '" style="color:' + color + '" aria-pressed="' + (k === sel) + '" aria-label="' + (dt.getMonth() + 1) + '월 ' + dt.getDate() + '일' + (evs.length ? ', 일정 ' + evs.length + '개' : '') + '">' +
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
  const REP_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>';
  function renderEvents(focusIdx) {
    const el = $('evList');
    // 다른 날에서 반복되어 오는 일정 (보기 · 이 날만 빼기 · 시작한 날로 가서 고치기)
    const rec = window.M.eventsOn(S.events, sel).filter((x) => !x.own);
    if (!evList.length && !rec.length) {
      el.innerHTML = '<div class="empty">일정이 없어요</div>';
      return;
    }
    const repSel = (ev) => '<select class="evr" data-f="r" aria-label="반복" title="반복">' + window.M.REPEATS.map((o) => '<option value="' + o[0] + '"' + ((ev.r || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';
    el.innerHTML = rec.map((x) => {
      const sp = x.k.split('-').map(Number);
      return '<div class="ev rec" data-src="' + x.k + '" data-si="' + x.i + '">' +
        '<span class="evc" style="background:' + EVENT_COLORS[x.ev.c] + '"></span>' +
        '<span class="evt">' + esc(/^\d{2}:\d{2}$/.test(x.ev.t) ? x.ev.t : '종일') + '</span>' +
        '<button class="evn evgo" type="button" data-act="go" title="' + sp[1] + '/' + sp[2] + '부터 반복 · 눌러서 고치기">' + esc(x.ev.title || '(이름 없음)') + '</button>' +
        '<span class="evrep">' + REP_ICON + window.M.REPEAT_NAME[x.ev.r] + '</span>' +
        '<button class="ib" type="button" data-act="skip" aria-label="이 날만 빼기" title="이 날만 빼기">' + ICONS.x + '</button>' +
      '</div>';
    }).join('') + evList.map((ev, i) =>
      '<div class="ev' + (ev.r ? ' hasrep' : '') + '" data-i="' + i + '">' +
        '<button class="evc" type="button" data-act="color" style="background:' + EVENT_COLORS[ev.c] + '" aria-label="일정 색 바꾸기" title="색 바꾸기"></button>' +
        '<input class="evt" type="time" data-f="t" value="' + esc(/^\d{2}:\d{2}$/.test(ev.t) ? ev.t : '') + '" aria-label="시간 (비우면 종일)">' +
        '<input class="evn" type="text" data-f="title" value="' + esc(ev.title) + '" placeholder="일정 이름" spellcheck="false" aria-label="일정 이름">' +
        repSel(ev) +
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
    const recRow = b.closest('.ev.rec');
    if (recRow) {
      const src = recRow.dataset.src, si = Number(recRow.dataset.si);
      if (b.dataset.act === 'go') { if (evSaveT) saveEvents(true); sel = src; const p = src.split('-').map(Number); calY = p[0]; calM = p[1] - 1; renderCal(); }
      if (b.dataset.act === 'skip') {
        const p = src.split('-').map(Number);
        askConfirm('이 날 일정만 뺄까요?', '반복은 그대로 두고 이 날만 빠져요. 반복 전체를 지우려면 시작한 날(' + p[1] + '/' + p[2] + ')에서 지우세요.', '이 날만 빼기').then((ok) => { if (ok) api.skipEvent(src, si, sel); });
      }
      return;
    }
    const i = Number(b.closest('.ev').dataset.i);
    if (b.dataset.act === 'color') {
      evList[i].c = EV_ORDER[(EV_ORDER.indexOf(evList[i].c) + 1) % 4];
      b.style.background = EVENT_COLORS[evList[i].c];
      saveEvents(true);
    }
    if (b.dataset.act === 'del') {
      const del = () => { evList.splice(i, 1); renderEvents(); saveEvents(true); };
      if (evList[i].r) askConfirm('반복 일정을 지울까요?', '"' + (evList[i].title || '이름 없음') + '" ' + window.M.REPEAT_NAME[evList[i].r] + ' 반복이 모두 지워져요.', '모두 지우기').then((ok) => { if (ok) del(); });
      else del();
    }
  });
  $('evList').addEventListener('input', (e) => {
    const inp = e.target.closest('input, select');
    if (!inp || !inp.closest('.ev[data-i]')) return;
    const i = Number(inp.closest('.ev').dataset.i);
    if (inp.dataset.f === 'r') {
      if (inp.value) evList[i].r = inp.value; else { delete evList[i].r; delete evList[i].x; }
      inp.closest('.ev').classList.toggle('hasrep', !!inp.value);
      saveEvents(true);
      return;
    }
    evList[i][inp.dataset.f] = inp.value;
    saveEvents(false);
  });
  $('evList').addEventListener('focusin', () => api.sideFocus());
  $('evList').addEventListener('focusout', () => { if (evSaveT) saveEvents(true); });
  $('todayToggle').addEventListener('click', () => api.setSettings({ showToday: !S.settings.showToday }));

  // ───────── 꾸미기 ─────────
  // 계절 스킨: 목록바 배경에 눈 내리기 / 박쥐 날기
  let skyKind = null;
  function updateSky(kind) {
    if (kind === skyKind) return;
    skyKind = kind || null;
    const sky = $('sky');
    if (!sky) return;
    let h = '';
    if (kind === 'xmas') {
      const flake = (z) => '<svg width="' + z + '" height="' + z + '" viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2 2.5M12 2l2 2.5M12 22l-2-2.5M12 22l2-2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
      for (let i = 0; i < 18; i++) h += '<i class="snow" style="left:' + ((i * 37) % 100) + '%;--r:' + (i % 2 ? 200 : -160) + 'deg;animation-duration:' + (10 + (i * 13) % 9) + 's;animation-delay:-' + ((i * 7) % 14) + 's">' + flake(8 + (i * 7) % 9) + '</i>';
    } else if (kind === 'halloween') {
      const bat = '<svg width="34" height="17" viewBox="0 0 60 30"><path d="M30 10 C27 6 25 6 24 9 C18 4 8 4 2 12 C8 11 12 14 13 19 C16 15 20 15 22 19 C24 16 27 17 30 22 C33 17 36 16 38 19 C40 15 44 15 47 19 C48 14 52 11 58 12 C52 4 42 4 36 9 C35 6 33 6 30 10 Z" fill="#0F0A18" opacity=".85"/><circle cx="28" cy="12" r="1.3" fill="#FFD34D"/><circle cx="32" cy="12" r="1.3" fill="#FFD34D"/></svg>';
      for (let i = 0; i < 6; i++) h += '<i class="bat" style="left:' + (4 + (i * 29) % 70) + '%;top:' + (10 + (i * 41) % 80) + '%;animation-duration:' + (2.6 + (i % 3) * .6) + 's;animation-delay:-' + (i * .7) + 's">' + bat + '</i>';
    }
    sky.innerHTML = h;
  }

  function renderStyle() {
    const s = S.settings;
    const openSk = S.openSkins || [];
    $('skins').innerHTML = Object.keys(SKINS).filter((id) => !SKINS[id].season || openSk.includes(id) || S.isAdmin || s.skin === id).map((id) => {
      const k = SKINS[id];
      return '<button class="skin' + (s.skin === id ? ' on' : '') + '" type="button" data-skin="' + id + '" aria-pressed="' + (s.skin === id) + '" title="' + esc(k.name) + '" style="--sc:' + k.a1 + '">' +
        (k.bunny ? '<span class="sw swDraw" style="background:' + (k.season ? k.b[0] : '') + '"><img src="' + k.bunny + '" alt="" draggable="false"></span>'
          : '<span class="sw" style="background:linear-gradient(135deg,' + k.b[0] + ',' + k.b[2] + ')"><b style="background:linear-gradient(135deg,' + k.a1 + ',' + k.a2 + ')"></b></span>') +
        '<span class="sn">' + esc(k.name) + (k.season && !openSk.includes(id) ? '<em class="sbeta">베타</em>' : '') + '</span></button>';
    }).join('');
    if (document.activeElement !== $('fontSel')) {
      $('fontSel').innerHTML = FONTS.map((f) => '<option value="' + f.id + '"' + (s.font === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>').join('');
    }
    const tsv = s.titleScale || 100;
    if (document.activeElement !== $('titleScale')) $('titleScale').value = tsv;
    $('titleScaleV').textContent = tsv + '%';
    const fdv = s.foldScale || 100;
    if (document.activeElement !== $('foldScale')) $('foldScale').value = fdv;
    $('foldScaleV').textContent = fdv + '%';
    const own = (S.memos || []).filter((m) => m.fs && !m.deleting).length;
    $('fsClear').hidden = !own;
    $('fsClear').textContent = '따로 길이를 정한 메모 ' + own + '개도 이 길이로 맞추기';
    $('titleBold').setAttribute('aria-pressed', String(s.titleBold !== false));
    if (document.activeElement !== $('alpha')) $('alpha').value = s.alpha;
    if (document.activeElement !== $('sideAlpha')) $('sideAlpha').value = s.sideAlpha;
    const fsv = s.fontScale || 100;
    if (document.activeElement !== $('fontScale')) $('fontScale').value = fsv;
    $('fontScaleV').textContent = fsv + '%';
    $('calFont').innerHTML = window.M.calFontOptions(s).map((o) => '<option value="' + o.id + '"' + ((s.calFont || 'same') === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('');
    if (document.activeElement !== $('peopleFont')) $('peopleFont').innerHTML = window.M.calFontOptions(s).map((o) => '<option value="' + o.id + '"' + ((s.peopleFont || 'same') === o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('');
    const ppv = s.peopleScale || 100;
    if (document.activeElement !== $('peopleScale')) $('peopleScale').value = ppv;
    $('peopleScaleV').textContent = ppv + '%';
    const csv = s.calScale || 100;
    if (document.activeElement !== $('calScale')) $('calScale').value = csv;
    $('calScaleV').textContent = csv + '%';
    $('alphaV').textContent = s.alpha + '%';
    $('sideAlphaV').textContent = s.sideAlpha + '%';
    $('autoStart').setAttribute('aria-pressed', String(!!s.autoStart));
    $('noticeOn').setAttribute('aria-pressed', String(s.noticeOn !== false));
    const cm = s.clockMode == null ? 30 : s.clockMode;
    document.querySelectorAll('[data-cm]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.cm) === cm)));
    $('clockOpts').hidden = !cm;
    if (document.activeElement !== $('clockAlpha')) $('clockAlpha').value = s.clockAlpha != null ? s.clockAlpha : 75;
    $('clockAlphaV').textContent = (s.clockAlpha != null ? s.clockAlpha : 75) + '%';
    if (document.activeElement !== $('clockScale')) $('clockScale').value = s.clockScale || 100;
    $('clockScaleV').textContent = (s.clockScale || 100) + '%';
    $('clockDark').setAttribute('aria-pressed', String(!!s.clockDark));
    window.M.syncRanges($('vStyle'));
    $('bodyBg').setAttribute('aria-pressed', String(!!s.bodyBg));
  }
  $('skins').addEventListener('click', (e) => { const b = e.target.closest('[data-skin]'); if (b) api.setSettings({ skin: b.dataset.skin }); });
  document.querySelectorAll('[data-cm]').forEach((b) => b.addEventListener('click', () => api.setSettings({ clockMode: Number(b.dataset.cm) })));
  $('clockAlpha').addEventListener('input', (e) => { $('clockAlphaV').textContent = e.target.value + '%'; api.setSettings({ clockAlpha: Number(e.target.value) }); });
  $('clockAlpha').addEventListener('change', () => api.clockPreview());
  $('clockScale').addEventListener('input', (e) => { $('clockScaleV').textContent = e.target.value + '%'; api.setSettings({ clockScale: Number(e.target.value) }); });
  $('clockScale').addEventListener('change', () => api.clockPreview());
  $('clockDark').addEventListener('click', () => { api.setSettings({ clockDark: !S.settings.clockDark }); setTimeout(() => api.clockPreview(), 80); });
  $('clockPreview').addEventListener('click', () => api.clockPreview());
  $('clockPlace').addEventListener('click', () => api.clockPlace(true));
  $('noticeOn').addEventListener('click', () => api.setSettings({ noticeOn: S.settings.noticeOn === false }));
  $('fontSel').addEventListener('change', (e) => api.setSettings({ font: e.target.value }));
  $('foldScale').addEventListener('input', (e) => { $('foldScaleV').textContent = e.target.value + '%'; api.setSettings({ foldScale: Number(e.target.value) }); });
  $('fsClear').addEventListener('click', () => api.foldSizeReset());
  $('titleScale').addEventListener('input', (e) => { $('titleScaleV').textContent = e.target.value + '%'; api.setSettings({ titleScale: Number(e.target.value) }); });
  $('titleBold').addEventListener('click', () => api.setSettings({ titleBold: S.settings.titleBold === false }));
  const setFs = (v) => { v = Math.min(170, Math.max(70, v)); $('fontScale').value = v; $('fontScaleV').textContent = v + '%'; api.setSettings({ fontScale: v }); };
  $('fontScale').addEventListener('input', (e) => setFs(Number(e.target.value)));
  $('calFont').addEventListener('change', (e) => api.setSettings({ calFont: e.target.value }));
  $('peopleFont').addEventListener('change', (e) => api.setSettings({ peopleFont: e.target.value }));
  $('peopleScale').addEventListener('input', (e) => { $('peopleScaleV').textContent = e.target.value + '%'; api.setSettings({ peopleScale: Number(e.target.value) }); });
  const setCs = (v) => { v = Math.min(150, Math.max(70, v)); $('calScale').value = v; $('calScaleV').textContent = v + '%'; api.setSettings({ calScale: v }); };
  $('calScale').addEventListener('input', (e) => setCs(Number(e.target.value)));
  $('alpha').addEventListener('input', (e) => { $('alphaV').textContent = e.target.value + '%'; api.setSettings({ alpha: Number(e.target.value) }); });
  $('sideAlpha').addEventListener('input', (e) => {
    $('sideAlphaV').textContent = e.target.value + '%';
    if (!sk || !sk.paper) panel.style.background = 'rgba(var(--glass),' + (Number(e.target.value) / 100) + ')';
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
  // 관리자: 계절 스킨 공개·숨기기
  function renderSkinAdmin() {
    $('skAdmin').hidden = !S.isAdmin;
    if (!S.isAdmin) return;
    const openSk = S.openSkins || [];
    $('skList').innerHTML = Object.keys(SKINS).filter((id) => SKINS[id].season).map((id) => {
      const on = openSk.includes(id);
      return '<div class="skRow"><span class="skName">' + esc(SKINS[id].name) + '</span><span class="skState' + (on ? ' on' : '') + '">' + (on ? '모두 공개 중' : '나만 보기 (베타)') + '</span>' +
        '<button type="button" class="pill soft skBtn" data-skopen="' + id + '" data-on="' + (on ? '0' : '1') + '">' + (on ? '숨기기' : '공개하기') + '</button></div>';
    }).join('');
  }
  $('skList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-skopen]'); if (!b) return;
    b.disabled = true; $('skMsg').textContent = '';
    const r = await api.skinOpen(b.dataset.skopen, b.dataset.on === '1');
    b.disabled = false;
    $('skMsg').className = 'bkMsg ' + (r && r.ok ? 'ok' : 'err');
    $('skMsg').textContent = r && r.ok ? (b.dataset.on === '1' ? '공개했어요. 다른 사람들 PC에는 몇 분 안에 보여요.' : '숨겼어요. 이미 쓰고 있는 사람은 그대로 써요.') : ((r && r.error) || '잠시 후 다시 해 주세요');
  });
  function renderNotices() {
    renderSkinAdmin();
    $('ntAdmin').hidden = !S.isAdmin;
    const list = S.notices || [];
    const pad = (n) => (n < 10 ? '0' : '') + n;
    $('ntList').innerHTML = list.length
      ? list.slice(0, 8).map((n) => { const d = new Date(n.at); return '<button type="button" class="ntItem" data-nid="' + esc(n.id) + '"><b>' + esc(n.title) + '</b><span>' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '</span></button>'; }).join('')
      : '<div class="bkInfo">아직 공지가 없어요</div>';
  }
  $('ntList').addEventListener('click', (e) => { const b = e.target.closest('[data-nid]'); if (b) api.noticeOpen(b.dataset.nid); });
  $('ntSend').addEventListener('click', async () => {
    const title = $('ntTitle').value.trim();
    if (!title) { $('ntMsg').textContent = '제목을 써 주세요'; $('ntMsg').className = 'bkMsg err'; return; }
    const ok = await askConfirm('공지를 보낼까요?', '"' + title + '" 공지가 말랑메모를 쓰는 모든 사용자에게 떠요.', '보내기');
    if (!ok) return;
    $('ntSend').disabled = true;
    const r = await api.noticeSend({ title, body: $('ntBody').value, upd: $('ntUpd').checked });
    $('ntSend').disabled = false;
    if (r && r.ok) { $('ntTitle').value = ''; $('ntBody').value = ''; $('ntMsg').textContent = '보냈어요 · 다른 사용자에게 5분 안에 떠요'; $('ntMsg').className = 'bkMsg ok'; }
    else { $('ntMsg').textContent = (r && r.error) || '보내지 못했어요'; $('ntMsg').className = 'bkMsg err'; }
  });
  function renderAcct() {
    const c = S.cloud || {};
    renderNotices();
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
  $('acLayout').addEventListener('click', () => {
    askConfirm('이 PC 배치를 적용할까요?', '같은 아이디로 로그인한 다른 PC의 메모 자리·크기·접힘·그룹·꾸미기가 이 PC와 똑같이 바뀌어요.', '적용').then((ok) => {
      if (!ok) return;
      api.layoutPushAll();
      $('acLayout').textContent = '적용했어요 · 다른 PC는 몇 분 안에 바뀌어요';
      setTimeout(() => { $('acLayout').textContent = '이 PC 배치를 다른 PC에 적용'; }, 4000);
    });
  });
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
