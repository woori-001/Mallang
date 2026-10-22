// 메모 창
(function () {
  const api = window.api;
  const { ICONS, MARKS, MARK_NAMES, MARK_COLORS, grad, esc, markSvg, applyTheme } = window.M;
  const qs = new URLSearchParams(location.search);
  const id = Number(qs.get('id'));
  const wantFocus = qs.get('focus') === '1';
  const $ = (s) => document.getElementById(s);

  const card = $('card'), head = $('head'), title = $('title'), text = $('text');
  const checks = $('checks'), itemsEl = $('items'), chip = $('chip'), picker = $('picker'), grip = $('grip');
  const FOLD_W = 180, FOLD_H = 32, MIN_W = 180, MIN_H = 110;
  // 접은 크기 (%) : 이 메모 값 → 없으면 전체 설정
  const foldPct = () => Math.min(250, Math.max(50, Math.round(Number((memo && memo.fs) || (settings && settings.foldScale) || 100))));
  const foldW = () => (fLocalW != null ? fLocalW : Math.round(FOLD_W * foldPct() / 100)), foldH = () => FOLD_H;
  let fLocalW = null;

  let memo = null, settings = null, sk = null, groups = [], lastFolded = null, arT = null;
  let items = [];
  let localSize = null;

  $('fold').innerHTML = ICONS.chev;
  $('hNew').innerHTML = ICONS.plus;
  $('bMark').innerHTML = ICONS.starLine;
  $('more').innerHTML = ICONS.dots;
  $('bType').innerHTML = ICONS.list;
  $('bTable').innerHTML = ICONS.table;
  $('bGroup').innerHTML = ICONS.folder;
  $('grpDot').innerHTML = ICONS.folder.replace('width="15" height="15"', 'width="14" height="14"');
  $('bSplit').innerHTML = ICONS.scissors;
  $('splitChip').innerHTML = ICONS.scissors + '<span>새 메모로 분리</span>';
  $('bTop').innerHTML = ICONS.front;
  $('bBottom').innerHTML = ICONS.back;
  $('bHide').innerHTML = ICONS.eyeOff;
  $('bDel').innerHTML = ICONS.trash;
  $('addItem').innerHTML = ICONS.plus.replace('width="15" height="15"', 'width="18" height="18"') + '<span>항목 추가</span>';
  title.placeholder = '제목 없음';

  const debounce = (fn, ms) => {
    let t;
    const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    f.flush = () => { clearTimeout(t); fn(); };
    return f;
  };
  function send(patch) {
    Object.assign(memo, patch);
    api.update(id, patch);
  }

  // ───────── 그리기 ─────────
  const setOn = (el, on) => { el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); };
  function render(first) {
    if (!memo || !settings) return;
    sk = applyTheme(settings).sk;
    const a = (settings.alpha != null ? settings.alpha : 60) / 100;
    if (sk.paper) {
      // 종이 스킨: 흰 종이 + 메모 색 머리띠 (투명도 없음)
      const p = sk.pal[(memo.slot || 0) % 5][0];
      card.style.setProperty('--tint', 'rgb(' + p.join(',') + ')');
      card.style.background = sk.draw ? '#FBFAF5' : (memo.folded ? 'var(--tint)' : '#FFFFFF');
    } else card.style.background = grad(sk, memo.slot || 0, a);
    // 오른쪽 기준으로 접고 펼 때는 메모가 오른쪽 끝에 붙은 채로 줄고 늘어나게
    // 아래쪽 메모는 아래 끝에 붙은 채로 (위로 펼쳐짐)
    if (lastFolded !== null && lastFolded !== !!memo.folded && (memo.ar || memo.ab)) {
      card.classList.toggle('ar', !!memo.ar);
      card.classList.toggle('ab', !!memo.ab);
      clearTimeout(arT);
      arT = setTimeout(() => card.classList.remove('ar', 'ab'), 700);
    }
    lastFolded = !!memo.folded;
    card.classList.toggle('folded', !!memo.folded);
    card.classList.toggle('bodybg', !!settings.bodyBg);
    const w = memo.folded ? foldW() : (localSize ? localSize.w : memo.w);
    const h = memo.folded ? foldH() : (localSize ? localSize.h : memo.h);
    card.style.width = w + 'px';
    card.style.height = h + 'px';

    const fold = $('fold');
    fold.querySelector('.chev').style.transform = memo.folded ? 'rotate(0deg)' : 'rotate(180deg)';
    fold.setAttribute('aria-label', memo.folded ? '펼치기' : '접기');
    fold.setAttribute('aria-expanded', String(!memo.folded));
    head.title = memo.folded ? '더블클릭하면 펼쳐져요' : '';

    const g = memo.group && groups.find((x) => x.id === memo.group);
    const gd = $('grpDot');
    gd.hidden = !g;
    if (g) { gd.title = '그룹: ' + g.name; gd.setAttribute('aria-label', '그룹 ' + g.name); }
    setOn($('bGroup'), !gpicker.hidden);
    $('bUnsplit').hidden = !memo.splitFrom;
    if (!gpicker.hidden && document.activeElement !== $('gName')) renderGroups();
    $('markIcon').innerHTML = memo.mark ? markSvg(memo.mark, memo.markColor || '#E8456B', 18) : '';
    if (document.activeElement !== title) title.value = memo.title || '';

    setOn($('bTop'), memo.layer === 'top');
    setOn($('bBottom'), memo.layer === 'bottom');
    setOn($('bType'), memo.type === 'check');
    setOn($('bTable'), memo.type === 'table');
    setOn($('bMark'), !picker.hidden);

    const isCheck = memo.type === 'check', isTable = memo.type === 'table';
    text.hidden = isCheck || isTable;
    checks.hidden = !isCheck;
    tblEl.hidden = !isTable;
    $('bDiv').hidden = isCheck || isTable;
    // 아직 저장 안 한 표 내용이 있으면 화면 것을 그대로 둠
    if (isTable && (tablePending || tbl.isEditing())) memo.table = { rows: tbl.getRows() };
    else if (isTable) tbl.setRows((memo.table && memo.table.rows) || null);
    if (!isCheck && !isTable && !text.contains(document.activeElement) && document.activeElement !== text && ed.getText() !== (memo.text || '')) ed.setText(memo.text || '');
    if (isCheck) {
      const incoming = memo.items || [];
      const focusedIn = itemsEl.contains(document.activeElement);
      if (first || !focusedIn || incoming.length !== items.length) {
        items = incoming.map((x) => ({ t: x.t || '', d: !!x.d }));
        renderItems();
      }
    }

    chip.hidden = memo.layer === 'normal' || !!memo.folded;
    chip.textContent = memo.layer === 'top' ? '항상 위' : '맨 뒤';
    if (!picker.hidden && document.activeElement !== $('customColor')) renderPicker();
    if (memo.hidden) card.classList.add('leaving');
    if (memo.clip && !squash(fullText()).includes(squash(memo.clip))) { memo.clip = null; api.update(id, { clip: null }); }
    renderClip();
  }

  // ───────── 체크리스트 ─────────
  function renderItems(focusIdx, caret) {
    itemsEl.innerHTML = items.map((it, i) =>
      '<div class="item' + (it.d ? ' done' : '') + '" data-i="' + i + '">' +
        '<button class="chk" type="button" data-act="toggle" aria-pressed="' + !!it.d + '" aria-label="완료 표시">' + ICONS.check + '</button>' +
        '<input class="itxt" data-i="' + i + '" value="' + esc(it.t) + '" spellcheck="false" placeholder="할 일" aria-label="항목 ' + (i + 1) + '">' +
        '<button class="ib idel" type="button" data-act="idel" tabindex="-1" aria-label="항목 삭제">' + ICONS.x + '</button>' +
      '</div>'
    ).join('');
    if (focusIdx != null) {
      const inp = itemsEl.querySelector('.itxt[data-i="' + focusIdx + '"]');
      if (inp) {
        inp.focus();
        const c = caret == null ? inp.value.length : caret;
        inp.setSelectionRange(c, c);
      }
    }
  }
  const saveItems = () => send({ items: items.map((x) => ({ t: x.t, d: !!x.d })) });
  const saveItemsSoon = debounce(saveItems, 250);

  itemsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const row = b.closest('.item');
    const i = Number(row.dataset.i);
    if (b.dataset.act === 'toggle') {
      items[i].d = !items[i].d;
      row.classList.toggle('done', items[i].d);
      b.setAttribute('aria-pressed', String(items[i].d));
      saveItems();
    } else if (b.dataset.act === 'idel') {
      items.splice(i, 1);
      renderItems(items.length ? Math.max(0, i - 1) : null);
      saveItems();
    }
  });
  itemsEl.addEventListener('input', (e) => {
    const inp = e.target.closest('.itxt');
    if (!inp) return;
    items[Number(inp.dataset.i)].t = inp.value;
    saveItemsSoon();
  });
  itemsEl.addEventListener('keydown', (e) => {
    const inp = e.target.closest('.itxt');
    if (!inp || e.isComposing || e.keyCode === 229) return;
    const i = Number(inp.dataset.i);
    if (e.key === 'Enter') {
      e.preventDefault();
      const pos = inp.selectionStart;
      const rest = inp.value.slice(pos);
      items[i].t = inp.value.slice(0, pos);
      items.splice(i + 1, 0, { t: rest, d: false });
      renderItems(i + 1, 0);
      saveItems();
    } else if (e.key === 'Backspace' && inp.selectionStart === 0 && inp.selectionEnd === 0 && i > 0) {
      e.preventDefault();
      const prev = items[i - 1];
      const c = prev.t.length;
      prev.t += items[i].t;
      items.splice(i, 1);
      renderItems(i - 1, c);
      saveItems();
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      renderItemsFocus(i - 1);
    } else if (e.key === 'ArrowDown' && i < items.length - 1) {
      e.preventDefault();
      renderItemsFocus(i + 1);
    }
  });
  function renderItemsFocus(i) {
    const inp = itemsEl.querySelector('.itxt[data-i="' + i + '"]');
    if (inp) inp.focus();
  }
  $('addItem').addEventListener('click', () => {
    items.push({ t: '', d: false });
    renderItems(items.length - 1);
    saveItems();
  });

  // ───────── 표 ─────────
  const tblEl = $('tbl');
  let tablePending = false;
  const saveTable = debounce(() => {
    if (!tablePending || !memo) return;
    tablePending = false;
    const rows = tbl.getRows();
    api.update(id, { table: { rows }, text: window.M.tableToText(rows) });
  }, 300);
  const tbl = window.M.tableEditor(tblEl, {
    onChange: (rows) => { tablePending = true; memo.table = { rows }; memo.text = window.M.tableToText(rows); saveTable(); },
    copy: (t) => api.copyText(t)
  });
  tblEl.addEventListener('focusout', () => saveTable.flush());

  // ───────── 본문 ─────────
  const saveText = debounce(() => api.update(id, { text: memo.text }), 250);
  const ed = window.M.lineEditor(text, () => { memo.text = ed.getText(); saveText(); });
  text.addEventListener('blur', () => saveText.flush());
  $('bDiv').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12h18"/><path d="M8 6h8M8 18h8" opacity=".45"/></svg>';
  $('bDiv').addEventListener('click', () => {
    if (memo.type !== 'text') return;
    closeTools(); render();
    ed.insertDivider();
  });

  // ───────── 제목줄: 드래그 이동 / 클릭해서 제목 편집 / 더블클릭 접기 ─────────
  let drag = null, editTimer = null, movePending = null, moveRaf = 0;
  function queueMove(x, y) {
    movePending = { x, y };
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      if (movePending) api.move(id, movePending.x, movePending.y, false);
    });
  }
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;
    if (e.target === title && !title.readOnly) return;
    e.preventDefault();
    drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY, moved: false, onTitle: e.target === title };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.screenX - drag.sx, dy = e.screenY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    drag.moved = true;
    clearTimeout(editTimer);
    queueMove(drag.wx + dx, drag.wy + dy);
  });
  head.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    try { head.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    if (d.moved) {
      cancelAnimationFrame(moveRaf);
      moveRaf = 0;
      const dx = e.screenX - d.sx, dy = e.screenY - d.sy;
      api.move(id, d.wx + dx, d.wy + dy, true);
    } else if (d.onTitle && !memo.folded) {
      clearTimeout(editTimer);
      editTimer = setTimeout(startEdit, 260);
    }
  });
  head.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    if (e.target === title && !title.readOnly) return;
    clearTimeout(editTimer);
    toggleFold();
  });

  function startEdit() {
    card.classList.add('titling');
    title.readOnly = false;
    title.focus();
    title.select();
  }
  title.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      title.blur();
      if (!memo.folded) {
        if (memo.type === 'check') renderItemsFocus(0);
        else if (memo.type === 'table') tbl.focusFirst();
        else ed.focusEnd();
      }
    }
    if (e.key === 'Escape') { title.value = memo.title || ''; title.blur(); }
  });
  title.addEventListener('blur', () => {
    card.classList.remove('titling');
    title.readOnly = true;
    title.setSelectionRange(0, 0);
    const v = title.value.trim();
    if (v !== (memo.title || '')) send({ title: v });
    title.value = v;
  });

  function toggleFold() {
    closeTools();
    closePicker();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    try { getSelection().removeAllRanges(); title.setSelectionRange(0, 0); } catch (e) { /* 무시 */ }
    // 어느 쪽으로 접고 펼지는 메인이 정해서 알려줌 (자리 기억 포함)
    api.update(id, { folded: !memo.folded });
  }

  // ───────── ⋯ 도구 막대 ─────────
  const tools = $('tools'), more = $('more');
  function openTools() {
    tools.hidden = false;
    more.classList.add('on');
    more.setAttribute('aria-expanded', 'true');
    more.setAttribute('aria-label', '메뉴 닫기');
  }
  function closeTools() {
    if (tools.hidden) return;
    closePicker();
    gpicker.hidden = true;
    tools.hidden = true;
    more.classList.remove('on');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-label', '메뉴 열기');
  }
  more.addEventListener('click', () => { if (tools.hidden) openTools(); else closeTools(); render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !tools.hidden && $('confirm').hidden) { closeTools(); render(); more.focus(); }
  });

  // ───────── 버튼 ─────────
  $('fold').addEventListener('click', toggleFold);
  $('hNew').addEventListener('click', () => { closeTools(); render(); api.create({ near: id }); });
  const currentText = () => (memo.type === 'check' ? items.map((x) => x.t).filter((t) => t.trim()).join('\n')
    : memo.type === 'table' ? window.M.tableToText(tbl.getRows()) : ed.getText());
  $('bTable').addEventListener('click', () => {
    if (memo.type === 'table') saveTable.flush();
    if (memo.type === 'table') send({ type: 'text', text: window.M.tableToText(tbl.getRows()), table: null });
    else {
      const t = window.M.textToTable(currentText());
      send({ type: 'table', table: t, text: window.M.tableToText(t.rows) });
    }
    // 표는 넓게 쓰는 경우가 많아 창이 작으면 조금 넓혀요
    if (memo.type === 'table' && memo.w < 340 && !memo.folded) { memo.w = 340; memo.h = Math.max(memo.h, 240); api.resize(id, memo.w, memo.h, true); }
    render(true);
    if (memo.type === 'table') setTimeout(() => tbl.focusFirst(), 60);
  });
  $('bType').addEventListener('click', () => {
    if (memo.type === 'check') {
      send({ type: 'text', text: currentText() });
    } else {
      const lines = window.M.stripDividers(currentText()).split('\n').filter((l) => l.trim());
      send({ type: 'check', items: lines.length ? lines.map((t) => ({ t, d: false })) : [{ t: '', d: false }] });
    }
    render(true);
    if (memo.type === 'check' && !memo.items[0].t) renderItems(0);
  });
  $('bTop').addEventListener('click', () => { send({ layer: memo.layer === 'top' ? 'normal' : 'top' }); render(); });
  $('bBottom').addEventListener('click', () => { send({ layer: memo.layer === 'bottom' ? 'normal' : 'bottom' }); render(); });
  $('bHide').addEventListener('click', () => {
    card.classList.add('leaving');
    send({ hidden: true });
  });
  // 삭제 확인 팝업
  const confirmEl = $('confirm');
  function openConfirm() {
    closePicker();
    confirmEl.hidden = false;
    render();
    setTimeout(() => $('cNo').focus(), 30);
  }
  function closeConfirm() {
    confirmEl.hidden = true;
    render();
  }
  $('bDel').addEventListener('click', openConfirm);
  $('cNo').addEventListener('click', () => { closeConfirm(); closeTools(); render(); });
  $('cYes').addEventListener('click', () => {
    saveText.flush();
    if (memo.type === 'table') saveTable.flush();
    confirmEl.hidden = true;
    card.classList.add('leaving');
    api.remove(id);
  });
  confirmEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeConfirm(); }
  });
  confirmEl.addEventListener('pointerdown', (e) => { if (e.target === confirmEl) closeConfirm(); });

  // ───────── 중요 표시 · 색 고르기 ─────────
  $('bMark').addEventListener('click', () => {
    if (picker.hidden) { picker.hidden = false; renderPicker(); } else closePicker();
    render();
  });
  function closePicker() {
    if (picker.hidden) return;
    picker.hidden = true;
    $('bMark').classList.remove('on');
  }
  function renderPicker() {
    const color = memo.markColor || '#E8456B';
    $('pMarks').innerHTML = Object.keys(MARKS).map((k) =>
      '<button class="popt' + (memo.mark === k ? ' on' : '') + '" style="--pc:' + esc(color) + '" type="button" data-mark="' + k + '" aria-label="' + MARK_NAMES[k] + '" title="' + MARK_NAMES[k] + '" aria-pressed="' + (memo.mark === k) + '">' + markSvg(k, color, 22) + '</button>'
    ).join('') + '<button class="ptext" type="button" data-mark="">없음</button>';
    $('pColors').innerHTML = MARK_COLORS.map((c) =>
      '<button class="swatch' + (c.hex.toLowerCase() === color.toLowerCase() ? ' on' : '') + '" style="background:' + c.hex + ';--pc:' + c.hex + '" type="button" data-color="' + c.hex + '" aria-label="' + c.name + '" title="' + c.name + '"></button>'
    ).join('') +
      '<label class="custom" title="직접 고르기"><span class="sr">기호 색 직접 고르기</span><input id="customColor" type="color" value="' + esc(color.toLowerCase()) + '"></label>';
    $('pSlots').innerHTML = [0, 1, 2, 3, 4].map((s) =>
      '<button class="swatch slotsw' + ((memo.slot || 0) === s ? ' on' : '') + '" style="background:' + grad(sk, s, 1) + ';--pc:' + sk.a1 + '" type="button" data-slot="' + s + '" aria-label="메모 색 ' + (s + 1) + '"></button>'
    ).join('');
  }
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('mark' in b.dataset) send({ mark: b.dataset.mark || null, markColor: memo.markColor || '#E8456B' });
    else if (b.dataset.color) send({ markColor: b.dataset.color, mark: memo.mark || 'heart' });
    else if (b.dataset.slot != null) send({ slot: Number(b.dataset.slot) });
    render();
    renderPicker();
  });
  picker.addEventListener('change', (e) => {
    if (e.target.id === 'customColor') {
      send({ markColor: e.target.value, mark: memo.mark || 'heart' });
      render();
      renderPicker();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (!picker.hidden && !picker.contains(t) && !$('bMark').contains(t)) { closePicker(); render(); }
    if (!gpicker.hidden && !gpicker.contains(t) && !$('bGroup').contains(t)) { closeGroups(); render(); }
    if (!tools.hidden && !tools.contains(t) && !more.contains(t) && !picker.contains(t) && !gpicker.contains(t) && !$('confirm').contains(t)) { closeTools(); render(); }
  });

  // ───────── 그룹 ─────────
  const gpicker = $('gpicker');
  function renderGroups() {
    const C = window.M.GROUP_COLORS;
    $('gList').innerHTML = groups.map((g) =>
      '<button type="button" class="gopt' + (memo.group === g.id ? ' on' : '') + '" data-g="' + esc(g.id) + '" aria-pressed="' + (memo.group === g.id) + '">' +
        ICONS.folder.replace('width="15" height="15"', 'width="13" height="13"') + '<span>' + esc(g.name) + '</span></button>').join('') +
      (memo.group ? '<button type="button" class="ptext" data-g="">그룹에서 빼기</button>' : '') +
      (groups.length ? '' : '<span class="gnone">아직 그룹이 없어요. 아래에서 만들어 보세요</span>');
  }
  function closeGroups() { if (!gpicker.hidden) { gpicker.hidden = true; } }
  $('bGroup').addEventListener('click', () => {
    closePicker();
    if (gpicker.hidden) { gpicker.hidden = false; renderGroups(); } else closeGroups();
    render();
  });
  $('gList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const gid = b.dataset.g || null;
    send({ group: memo.group === gid ? null : gid });
    if (!gid) delete memo.group;
    renderGroups(); render();
  });
  $('gNew').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('gName').value.trim();
    const gid = await api.groupCreate(name, id);
    $('gName').value = '';
    memo.group = gid;
    showHint('그룹을 만들고 이 메모를 넣었어요');
  });

  // ───────── 분리: 드래그한 부분을 새 메모로 ─────────
  let hintT = null;
  function showHint(t) { const h = $('hint'); h.textContent = t; h.classList.add('show'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('show'), 1800); }
  function textRange() {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    return text.contains(r.commonAncestorContainer) || r.commonAncestorContainer === text ? r : null;
  }
  function splitSelection() {
    if (memo.type !== 'text') { showHint('일반 글 메모에서 쓸 수 있어요'); return; }
    const r = textRange();
    const part = r ? String(getSelection()).replace(/\u00A0/g, ' ').replace(/^\n+|\n+$/g, '') : '';
    if (!part.trim()) { showHint('분리할 내용을 먼저 드래그해 주세요'); return; }
    const beforeText = ed.getText();
    const before = beforeText.split('\n');
    r.deleteContents();
    getSelection().removeAllRanges();
    // 줄을 통째로 고른 경우 남는 빈 줄 하나를 정리
    const after = ed.getText().split('\n');
    const empties = (arr) => arr.filter((l) => !l.trim()).length;
    let extra = empties(after) - empties(before);
    if (extra > 0) {
      let k = 0; while (k < after.length && after[k] === before[k]) k++;
      while (extra > 0 && k < after.length && !after[k].trim()) { after.splice(k, 1); extra--; }
    }
    const rest = after.join('\n').replace(/^\n+|\n+$/g, '');
    ed.setText(rest);
    memo.text = rest;
    saveText.flush();
    const first = part.split('\n').map((l) => l.trim()).find((l) => l && l !== window.M.DIVIDER) || '';
    api.create({ near: id, title: first.length > 24 ? first.slice(0, 24) + '…' : (first || '분리한 메모'), text: part, splitFrom: { uid: memo.uid, before: beforeText, after: rest } })
      .then((nid) => { lastSplit = nid; showUndo(); });
    $('splitChip').hidden = true;
    closeTools(); render();
  }
  // 분리 되돌리기: 분리한 직후 원래 메모에 10초간 '되돌리기', 분리된 메모의 ⋯ 메뉴에는 계속
  let lastSplit = null, undoT = null;
  function showUndo() {
    const u = $('undoChip');
    u.hidden = false;
    clearTimeout(undoT);
    undoT = setTimeout(() => { u.hidden = true; lastSplit = null; }, 10000);
  }
  async function undoSplit(nid) {
    const r = await api.unsplit(nid);
    if (r && r.ok) showHint('분리를 되돌렸어요');
    else if (r && r.error === 'gone') showHint('원래 메모가 없어서 되돌릴 수 없어요');
    else showHint('되돌릴 수 없어요');
  }
  $('undoChip').innerHTML = '<span>새 메모로 분리했어요</span><b>되돌리기</b>';
  $('undoChip').addEventListener('click', () => {
    $('undoChip').hidden = true; clearTimeout(undoT);
    if (lastSplit != null) undoSplit(lastSplit);
    lastSplit = null;
  });
  $('bUnsplit').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  $('bUnsplit').addEventListener('click', () => { closeTools(); render(); undoSplit(id); });
  $('bSplit').addEventListener('click', splitSelection);
  $('splitChip').addEventListener('pointerdown', (e) => e.preventDefault());   // 누를 때 선택이 풀리지 않게
  $('splitChip').addEventListener('click', splitSelection);
  document.addEventListener('selectionchange', () => {
    const r = memo && memo.type === 'text' && !memo.folded ? textRange() : null;
    $('splitChip').hidden = !(r && String(getSelection()).trim());
  });

  // ───────── 메모 안에서 찾기 (Ctrl+F) ─────────
  const findBar = $('findBar'), findQ = $('findQ');
  const chevSvg = (d) => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  $('findPrev').innerHTML = chevSvg('M6 15l6-6 6 6');
  $('findNext').innerHTML = chevSvg('M6 9l6 6 6-6');
  $('findX').innerHTML = ICONS.x;
  const HL = window.CSS && CSS.highlights;
  let fMatches = [], fCur = -1, lastCmd = { q: '', at: 0 };
  function clearFind() {
    if (HL) { HL.delete('mfind'); HL.delete('mfindcur'); }
    itemsEl.querySelectorAll('.fhit, .fcur').forEach((x) => x.classList.remove('fhit', 'fcur'));
  }
  function collectFind(qs) {
    const out = [], n = qs.toLowerCase();
    if (!n) return out;
    if (memo.type === 'check') {
      itemsEl.querySelectorAll('.item').forEach((row) => { const v = (row.querySelector('.itxt').value || '').toLowerCase(); let i = v.indexOf(n); while (i >= 0) { out.push({ row }); i = v.indexOf(n, i + n.length); } });
      return out;
    }
    const root = memo.type === 'table' ? tblEl.querySelector('table') : text;
    if (!root) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const v = node.nodeValue.toLowerCase();
      let i = v.indexOf(n);
      while (i >= 0) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + n.length); out.push({ range: r }); i = v.indexOf(n, i + n.length); }
    }
    return out;
  }
  function paintFind() {
    clearFind();
    const ranges = fMatches.filter((x) => x.range).map((x) => x.range);
    if (HL && ranges.length) HL.set('mfind', new Highlight(...ranges));
    fMatches.forEach((x) => { if (x.row) x.row.classList.add('fhit'); });
    const m = fMatches[fCur];
    $('findN').textContent = (fCur + 1) + '/' + fMatches.length;
    if (!m) return;
    if (m.range) {
      if (HL) HL.set('mfindcur', new Highlight(m.range));
      const el = m.range.startContainer.parentElement;
      if (el) {
        // 찾은 줄이 보이게 스크롤
        const box = memo.type === 'table' ? tblEl.querySelector('.tblScroll') : text;
        const rr = m.range.getBoundingClientRect(), br = box.getBoundingClientRect();
        if (rr.top < br.top + 8 || rr.bottom > br.bottom - 8) box.scrollTop += rr.top - br.top - br.height / 2;
        if (box.scrollWidth > box.clientWidth && (rr.left < br.left || rr.right > br.right)) box.scrollLeft += rr.left - br.left - br.width / 2;
      }
    } else if (m.row) {
      m.row.classList.add('fcur');
      m.row.scrollIntoView({ block: 'nearest' });
    }
  }
  function runFind(keep) {
    const qs = findQ.value.trim();
    fMatches = collectFind(qs);
    findBar.classList.toggle('none', !!qs && !fMatches.length);
    if (!fMatches.length) { fCur = -1; clearFind(); $('findN').textContent = qs ? '없음' : ''; return; }
    fCur = keep ? Math.min(Math.max(fCur, 0), fMatches.length - 1) : 0;
    paintFind();
  }
  function stepFind(d) { if (!fMatches.length) return; fCur = (fCur + d + fMatches.length) % fMatches.length; paintFind(); }
  function openFind(qs) {
    if (memo.folded) toggleFold();
    closeTools();
    const sel = String(getSelection()).trim();
    findBar.hidden = false;
    card.classList.add('finding');
    if (qs != null) findQ.value = qs;
    else if (sel && sel.length < 80 && !sel.includes('\n')) findQ.value = sel;
    setTimeout(() => { findQ.focus(); findQ.select(); runFind(false); }, memo.folded ? 380 : 20);
  }
  function closeFind() {
    findBar.hidden = true;
    card.classList.remove('finding');
    clearFind();
    fMatches = []; fCur = -1;
  }
  findQ.addEventListener('input', () => runFind(false));
  findQ.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
  });
  $('findNext').addEventListener('click', () => stepFind(1));
  $('findPrev').addEventListener('click', () => stepFind(-1));
  $('findX').addEventListener('click', closeFind);
  // 내용을 고치면 찾은 표시도 다시
  let refindT = null;
  const refind = () => { if (!findBar.hidden) { clearTimeout(refindT); refindT = setTimeout(() => runFind(true), 200); } };
  text.addEventListener('input', refind);
  itemsEl.addEventListener('input', refind);
  tblEl.addEventListener('input', refind);

  // ───────── 접힌 메모: 옆 끝을 끌어서 가로 길이 조절 ─────────
  let fr = null, frRaf = 0;
  function frMove(e) {
    if (!fr) return;
    const dx = e.screenX - fr.sx;
    fLocalW = Math.min(FOLD_W * 2.5, Math.max(FOLD_W * 0.5, Math.round(fr.w + (fr.left ? -dx : dx))));
    if (frRaf) return;
    frRaf = requestAnimationFrame(() => {
      frRaf = 0;
      if (fLocalW == null || !fr) return;
      api.foldResize(id, fLocalW, fr.left, false);
      card.style.width = fLocalW + 'px';
    });
  }
  function frEnd() {
    window.removeEventListener('pointermove', frMove, true);
    window.removeEventListener('pointerup', frEnd, true);
    window.removeEventListener('pointercancel', frEnd, true);
    if (!fr) return;
    const f = fr; fr = null;
    if (fLocalW != null) { memo.fs = Math.round(fLocalW / FOLD_W * 100); api.foldResize(id, fLocalW, f.left, true); }
    fLocalW = null;
    setTimeout(() => card.classList.remove('noanim', 'fresizing'), 50);
    render();
  }
  card.querySelectorAll('.fedge').forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !memo.folded) return;
      e.preventDefault(); e.stopPropagation();
      fr = { sx: e.screenX, w: foldW(), left: h.classList.contains('l') };
      card.classList.add('noanim', 'fresizing');
      try { h.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      window.addEventListener('pointermove', frMove, true);
      window.addEventListener('pointerup', frEnd, true);
      window.addEventListener('pointercancel', frEnd, true);
    });
    h.addEventListener('dblclick', (e) => e.stopPropagation());
  });

  // ───────── 크기 조절 ─────────
  let rs = null, resizeRaf = 0;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || memo.folded) return;
    e.preventDefault();
    rs = { sx: e.screenX, sy: e.screenY, w: memo.w, h: memo.h };
    card.classList.add('noanim');
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!rs) return;
    const w = Math.max(MIN_W, Math.round(rs.w + e.screenX - rs.sx));
    const h = Math.max(MIN_H, Math.round(rs.h + e.screenY - rs.sy));
    localSize = { w, h };
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      if (!localSize) return;
      api.resize(id, localSize.w, localSize.h, false);
      card.style.width = localSize.w + 'px';
      card.style.height = localSize.h + 'px';
    });
  });
  grip.addEventListener('pointerup', (e) => {
    if (!rs) return;
    rs = null;
    try { grip.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    if (localSize) {
      memo.w = localSize.w;
      memo.h = localSize.h;
      api.resize(id, memo.w, memo.h, true);
    }
    localSize = null;
    setTimeout(() => card.classList.remove('noanim'), 50);
    render();
  });

  // ───────── 드래그해 둔 부분 기억 ─────────
  // 메모에서 글자를 드래그하면 기억해 두고, 접힌 상태에서 메모를 누르고 Ctrl+C 하면 그 부분을 복사해요.
  const clipBadge = $('clipBadge');
  clipBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  const squash = (x) => String(x).replace(/[\s|]+/g, '');
  function fullText() { return [memo.title || '', memo.text || '', ...(memo.items || []).map((x) => x.t)].join('\n'); }
  function remember(str) {
    if (!str || !str.trim() || !memo || str === memo.clip) return;
    memo.clip = str;
    api.update(id, { clip: str });
    renderClip();
  }
  function renderClip() {
    const c = memo && memo.clip;
    clipBadge.hidden = !c;
    if (c) {
      const short = c.replace(/\s+/g, ' ').trim();
      head.title = (memo.folded ? '더블클릭하면 펼쳐져요 · ' : '') + 'Ctrl+C 로 "' + (short.length > 30 ? short.slice(0, 30) + '…' : short) + '" 복사';
    }
  }
  function selFrom(el) {
    if (!el || el.selectionStart == null || el.selectionEnd <= el.selectionStart) return '';
    return el.value.slice(el.selectionStart, el.selectionEnd);
  }
  function liveSelection() {
    const a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) { const s = selFrom(a); if (s) return s; }
    const s = window.getSelection ? String(window.getSelection()) : '';
    return s;
  }
  const watchSel = (e) => { const el = e.target; if (el && (text.contains(el) || tblEl.contains(el))) { const s = String(getSelection()).replace(/\u00A0/g, ' '); if (s) remember(s); return; } if (el && el.classList && el.classList.contains('itxt')) { const s = selFrom(el); if (s) remember(s); } };
  for (const ev of ['select', 'mouseup', 'keyup']) document.addEventListener(ev, watchSel, true);
  // 제목을 고칠 때 전체 선택되는 것까지 기억하면 안 되므로, 내용 칸에서 복사한 것만 기억
  document.addEventListener('copy', () => { const a = document.activeElement; if (a === title) return; const s = liveSelection(); if (s) remember(s); });
  let copiedT = null;
  function flashCopied() {
    const el = $('copied');
    el.textContent = '복사했어요';
    el.classList.add('show');
    card.classList.remove('copyflash'); void card.offsetWidth; card.classList.add('copyflash');
    clearTimeout(copiedT);
    copiedT = setTimeout(() => el.classList.remove('show'), 1200);
  }

  // ───────── 단축키 ─────────
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC') && !e.isComposing) {
      // 접힌 메모는 내용이 안 보이므로 남아 있는 선택과 상관없이 기억해 둔 부분을 복사
      if (memo && memo.clip && (memo.folded || !liveSelection())) {
        e.preventDefault();
        api.copyText(memo.clip);
        flashCopied();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); api.create({ near: id }); }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key.toLowerCase() === 'f' || e.code === 'KeyF')) { e.preventDefault(); openFind(null); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) { e.preventDefault(); splitSelection(); }
    // 분리 직후 Ctrl+Z = 분리 되돌리기
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'z' || e.code === 'KeyZ') && lastSplit != null && !$('undoChip').hidden) { e.preventDefault(); $('undoChip').click(); }
  });

  // ───────── 메인과 연결 ─────────
  card.addEventListener('animationend', () => card.classList.remove('enter', 'flash'));
  api.onCmd((c) => {
    if (c.type === 'leave') card.classList.add('leaving');
    if (c.type === 'find' && typeof c.q === 'string') {
      // 검색 창에서 연 메모: 찾은 글자를 바로 보여줌 (같은 요청이 두 번 오면 한 번만)
      if (c.q === lastCmd.q && Date.now() - lastCmd.at < 2500) return;
      lastCmd = { q: c.q, at: Date.now() };
      setTimeout(() => openFind(c.q), memo && memo.folded ? 400 : 60);
    }
    if (c.type === 'settext' && typeof c.text === 'string') { memo.text = c.text; ed.setText(c.text); }
    if (c.type === 'flash') {
      card.classList.remove('flash', 'enter');
      void card.offsetWidth;
      card.classList.add('flash');
    }
  });
  api.onState((s) => {
    settings = s.settings;
    groups = s.groups || [];
    const m = s.memos.find((x) => x.id === id);
    if (!m) return;
    memo = { ...m };
    render(false);
  });
  api.init().then((s) => {
    settings = s.settings;
    groups = s.groups || [];
    const m = s.memos.find((x) => x.id === id);
    if (!m) return;
    memo = { ...m };
    render(true);
    if (wantFocus) {
      setTimeout(() => {
        if (memo.type === 'check') renderItemsFocus(items.length - 1);
        else if (memo.type === 'table') tbl.focusFirst();
        else if (!memo.text && memo.title === '새 메모') startEdit();
        else ed.focusEnd();
      }, 120);
    }
  });

  // ───────── 링크: 메모에 적은 웹 주소를 누르면 바로 열기 ─────────
  const LHL = window.CSS && CSS.highlights;
  const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
  let links = [];
  function scanLinks() {
    links = [];
    if (memo && memo.type !== 'check') {
      const root = memo.type === 'table' ? tblEl : text;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const v = node.nodeValue;
        if (v.indexOf('http') < 0 && v.indexOf('www.') < 0 && v.indexOf('HTTP') < 0 && v.indexOf('WWW.') < 0) continue;
        URL_RE.lastIndex = 0;
        let m;
        while ((m = URL_RE.exec(v))) {
          let u = m[0].replace(/[.,;:!?)\]}>」』。、]+$/, '');
          if (u.length < 5) continue;
          const r = document.createRange();
          r.setStart(node, m.index); r.setEnd(node, m.index + u.length);
          links.push({ r, u });
        }
      }
    }
    if (LHL) { if (links.length) LHL.set('mlink', new Highlight(...links.map((l) => l.r))); else LHL.delete('mlink'); }
  }
  const scanSoon = debounce(scanLinks, 150);
  new MutationObserver(scanSoon).observe(card, { childList: true, subtree: true, characterData: true });
  function linkAt(x, y) {
    for (const l of links) {
      for (const b of l.r.getClientRects()) if (x >= b.left - 1 && x <= b.right + 1 && y >= b.top - 1 && y <= b.bottom + 1) return l;
    }
    return null;
  }
  let downAt = null;
  card.addEventListener('pointermove', (e) => {
    if (!links.length || (memo && memo.folded)) return;
    const on = !!linkAt(e.clientX, e.clientY);
    text.classList.toggle('onlink', on && !text.hidden);
    tblEl.classList.toggle('onlink', on && !tblEl.hidden);
    text.title = on ? '누르면 링크가 열려요' : '';
  });
  card.addEventListener('pointerdown', (e) => { downAt = e.button === 0 ? { x: e.clientX, y: e.clientY } : null; }, true);
  card.addEventListener('click', (e) => {
    if (!downAt || !links.length || memo.folded) return;
    const moved = Math.abs(e.clientX - downAt.x) > 4 || Math.abs(e.clientY - downAt.y) > 4;
    downAt = null;
    if (moved) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;   // 드래그로 고르는 중이면 열지 않기
    const l = linkAt(e.clientX, e.clientY);
    if (!l) return;
    api.openLink(l.u);
    showHint('링크를 열었어요');
  });
})();
