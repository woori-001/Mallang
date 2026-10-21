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

  let memo = null, settings = null, sk = null;
  let items = [];
  let localSize = null;

  $('fold').innerHTML = ICONS.chev;
  $('bNew').innerHTML = ICONS.plus;
  $('bMark').innerHTML = ICONS.starLine;
  $('more').innerHTML = ICONS.dots;
  $('bType').innerHTML = ICONS.list;
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
  function render(first) {
    if (!memo || !settings) return;
    sk = applyTheme(settings).sk;
    const a = (settings.alpha != null ? settings.alpha : 60) / 100;
    card.style.background = grad(sk, memo.slot || 0, a);
    card.classList.toggle('folded', !!memo.folded);
    const w = memo.folded ? FOLD_W : (localSize ? localSize.w : memo.w);
    const h = memo.folded ? FOLD_H : (localSize ? localSize.h : memo.h);
    card.style.width = w + 'px';
    card.style.height = h + 'px';

    const fold = $('fold');
    fold.querySelector('.chev').style.transform = memo.folded ? 'rotate(0deg)' : 'rotate(180deg)';
    fold.setAttribute('aria-label', memo.folded ? '펼치기' : '접기');
    fold.setAttribute('aria-expanded', String(!memo.folded));
    head.title = memo.folded ? '더블클릭하면 펼쳐져요' : '';

    $('markIcon').innerHTML = memo.mark ? markSvg(memo.mark, memo.markColor || '#E8456B', 18) : '';
    if (document.activeElement !== title) title.value = memo.title || '';

    const setOn = (el, on) => { el.classList.toggle('on', on); el.setAttribute('aria-pressed', String(on)); };
    setOn($('bTop'), memo.layer === 'top');
    setOn($('bBottom'), memo.layer === 'bottom');
    setOn($('bType'), memo.type === 'check');
    setOn($('bMark'), !picker.hidden);

    const isCheck = memo.type === 'check';
    text.hidden = isCheck;
    checks.hidden = !isCheck;
    if (!isCheck && document.activeElement !== text && text.value !== (memo.text || '')) text.value = memo.text || '';
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

  // ───────── 본문 ─────────
  const saveText = debounce(() => api.update(id, { text: text.value }), 250);
  text.addEventListener('input', () => { memo.text = text.value; saveText(); });
  text.addEventListener('blur', () => saveText.flush());

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
        else text.focus();
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
    send({ folded: !memo.folded });
    render();
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
  $('bNew').addEventListener('click', () => { closeTools(); render(); api.create({ near: id }); });
  $('bType').addEventListener('click', () => {
    if (memo.type === 'check') {
      send({ type: 'text', text: items.map((x) => x.t).filter((t) => t.trim()).join('\n') });
    } else {
      const lines = (text.value || '').split('\n').filter((l) => l.trim());
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
    if (!tools.hidden && !tools.contains(t) && !more.contains(t) && !picker.contains(t) && !$('confirm').contains(t)) { closeTools(); render(); }
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

  // ───────── 단축키 ─────────
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); api.create({ near: id }); }
  });

  // ───────── 메인과 연결 ─────────
  card.addEventListener('animationend', () => card.classList.remove('enter', 'flash'));
  api.onCmd((c) => {
    if (c.type === 'leave') card.classList.add('leaving');
    if (c.type === 'flash') {
      card.classList.remove('flash', 'enter');
      void card.offsetWidth;
      card.classList.add('flash');
    }
  });
  api.onState((s) => {
    settings = s.settings;
    const m = s.memos.find((x) => x.id === id);
    if (!m) return;
    memo = { ...m };
    render(false);
  });
  api.init().then((s) => {
    settings = s.settings;
    const m = s.memos.find((x) => x.id === id);
    if (!m) return;
    memo = { ...m };
    render(true);
    if (wantFocus) {
      setTimeout(() => {
        if (memo.type === 'check') renderItemsFocus(items.length - 1);
        else if (!memo.text && memo.title === '새 메모') startEdit();
        else text.focus();
      }, 120);
    }
  });
})();
