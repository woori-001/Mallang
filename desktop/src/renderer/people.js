// 바탕화면에 띄우는 연락망 창
(function () {
  const api = window.api;
  const { ICONS, applyTheme } = window.M;
  const $ = (s) => document.getElementById(s);
  const card = $('card'), head = $('head'), q = $('q');
  const P = 14, MIN_W = 260, MIN_H = 180;
  let S = null, editing = false, dirty = false, timer = null, sentAt = 0;

  $('hIcon').innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.2a5 5 0 0 1 3 5.3"/></svg>';
  $('sIcon').innerHTML = ICONS.search.replace('width="16" height="16"', 'width="14" height="14"');
  $('top').innerHTML = ICONS.pin.replace('width="17" height="17"', 'width="15" height="15"');
  $('close').innerHTML = ICONS.x;
  $('fold').innerHTML = ICONS.chev;
  const folded = () => !!(S && S.peopleWin && S.peopleWin.folded);
  function toggleFold() {
    if (!S) return;
    flush();
    if (editing) setEdit(false);
    try { getSelection().removeAllRanges(); } catch (e) { /* 무시 */ }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const on = !folded();
    S.peopleWin = { ...S.peopleWin, folded: on };
    render();
    api.peopleFold(on);
  }
  $('fold').addEventListener('click', toggleFold);
  head.addEventListener('dblclick', (e) => { if (!e.target.closest('button, input, label')) toggleFold(); });

  const tbl = window.M.tableEditor($('tbl'), {
    head: window.M.CONTACT_HEAD, editable: false,
    copy: (t) => { api.copyText(t); toast('표를 복사했어요'); return Promise.resolve(); },
    onChange: () => { dirty = true; clearTimeout(timer); timer = setTimeout(flush, 400); tbl.filter(q.value); }
  });
  function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false; sentAt = Date.now();
    api.setContacts(tbl.getRows());
  }
  $('tbl').addEventListener('focusout', () => setTimeout(() => { if (!$('tbl').contains(document.activeElement)) flush(); }, 0));

  let toastT = null;
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1300); }

  // 보기 모드: 칸을 누르면 그 내용을 복사
  $('tbl').addEventListener('click', (e) => {
    if (editing) return;
    const td = e.target.closest('td[data-c]');
    if (!td || String(getSelection())) return;
    const t = td.textContent.trim();
    if (!t) return;
    api.copyText(t);
    toast('‘' + (t.length > 20 ? t.slice(0, 20) + '…' : t) + '’ 복사했어요');
  });

  function setEdit(on) {
    if (!on) flush();
    editing = on;
    $('edit').textContent = on ? '완료' : '편집';
    $('edit').classList.toggle('on', on);
    $('edit').setAttribute('aria-pressed', String(on));
    tbl.setEditable(on);
    tbl.filter(q.value);
    if (on) setTimeout(() => tbl.focusFirst(), 30);
  }
  $('edit').addEventListener('click', () => setEdit(!editing));
  $('top').addEventListener('click', () => api.peopleTop(!(S && S.peopleWin && S.peopleWin.top)));
  $('close').addEventListener('click', () => { flush(); api.setSettings({ showPeople: false }); });
  q.addEventListener('input', () => tbl.filter(q.value));
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; tbl.filter(''); } });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); if (folded()) toggleFold(); setTimeout(() => { q.focus(); q.select(); }, folded() ? 0 : 50); }
  });

  function render() {
    if (!S) return;
    const sk = applyTheme(S.settings).sk;
    const a = (S.settings.alpha != null ? S.settings.alpha : 60) / 100;
    card.style.background = window.M.grad(sk, 2, a);
    const f = folded();
    card.classList.toggle('folded', f);
    $('fold').querySelector('.chev').style.transform = f ? 'rotate(0deg)' : 'rotate(180deg)';
    $('fold').setAttribute('aria-label', f ? '펼치기' : '접기');
    $('fold').setAttribute('aria-expanded', String(!f));
    const on = !!(S.peopleWin && S.peopleWin.top);
    $('top').classList.toggle('on', on);
    $('top').setAttribute('aria-pressed', String(on));
    if (!dirty && Date.now() - sentAt > 800) { tbl.setRows(S.contacts || null); tbl.filter(q.value); }
  }

  // 제목줄 끌어서 옮기기
  let drag = null, raf = 0, pend = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, input, label')) return;
    e.preventDefault();
    drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    pend = { x: drag.wx + e.screenX - drag.sx, y: drag.wy + e.screenY - drag.sy };
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; api.peopleMove(pend.x, pend.y, false); });
  });
  head.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    cancelAnimationFrame(raf); raf = 0;
    api.peopleMove(d.wx + e.screenX - d.sx, d.wy + e.screenY - d.sy, true);
  });

  // 크기 조절
  const grip = $('grip');
  let rs = null, rraf = 0, size = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    rs = { sx: e.screenX, sy: e.screenY, w: window.innerWidth - 2 * P, h: window.innerHeight - 2 * P };
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!rs) return;
    size = { w: Math.max(MIN_W, rs.w + e.screenX - rs.sx), h: Math.max(MIN_H, rs.h + e.screenY - rs.sy) };
    if (rraf) return;
    rraf = requestAnimationFrame(() => { rraf = 0; if (size) api.peopleResize(size.w, size.h, false); });
  });
  grip.addEventListener('pointerup', () => {
    if (!rs) return;
    rs = null;
    if (size) api.peopleResize(size.w, size.h, true);
    size = null;
  });

  card.addEventListener('animationend', () => card.classList.remove('enter'));
  api.onCmd((c) => { if (c.type === 'leave') card.classList.add('leaving'); });
  api.onState((s) => { S = s; render(); });
  api.init().then((s) => { S = s; render(); });
})();
