// Ctrl+Alt+F 빠른 검색 창
(function () {
  const api = window.api;
  const { ICONS, esc, grad, markSvg, applyTheme, rowMatches } = window.M;
  const $ = (s) => document.getElementById(s);
  const q = $('q'), res = $('res'), box = $('box');
  $('icon').innerHTML = ICONS.search.replace('width="16" height="16"', 'width="22" height="22"');
  let S = null, sk = null, items = [], sel = 0, closing = false;

  const lower = (x) => String(x || '').toLowerCase();
  function hi(text, needle) {
    // 찾은 글자를 강조 (대소문자 무시)
    const t = String(text || ''), n = needle.toLowerCase();
    if (!n) return esc(t);
    let out = '', i = 0;
    const lt = t.toLowerCase();
    for (;;) {
      const j = lt.indexOf(n, i);
      if (j < 0) { out += esc(t.slice(i)); break; }
      out += esc(t.slice(i, j)) + '<mark>' + esc(t.slice(j, j + n.length)) + '</mark>';
      i = j + n.length;
    }
    return out;
  }
  function bodyOf(m) {
    if (m.type === 'check') return (m.items || []).map((x) => x.t).join('\n');
    return window.M.stripDividers(m.text || '');
  }
  function snippet(m, n) {
    const lines = bodyOf(m).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!n) return lines.slice(0, 2).join(' · ');
    const k = lines.findIndex((l) => l.toLowerCase().includes(n));
    if (k < 0) return lines.slice(0, 2).join(' · ');
    let l = lines[k];
    const j = l.toLowerCase().indexOf(n);
    if (j > 24) l = '…' + l.slice(j - 18);
    return l;
  }
  const kindTag = (m) => [m.hidden ? '숨김' : m.folded ? '접힘' : '', m.type === 'table' ? '표' : m.type === 'check' ? '체크리스트' : ''].filter(Boolean).join(' · ');

  function search(keep) {
    if (!S) return;
    const raw = q.value.trim(), n = raw.toLowerCase();
    const memos = S.memos.map((m) => {
      const t = lower(m.title), b = lower(bodyOf(m));
      let score = -1;
      if (!n) score = 0;
      else if (t.startsWith(n)) score = 4;
      else if (t.includes(n)) score = 3;
      else if (b.includes(n)) score = 2;
      return { m, score };
    }).filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || (b.m.updated || b.m.mt || 0) - (a.m.updated || a.m.mt || 0))
      .slice(0, n ? 30 : 8);
    let people = [];
    const rows = S.contacts || [];
    if (n && rows.length > 1) people = rows.slice(1).filter((r) => r.some((c) => c.trim()) && rowMatches(r, raw)).slice(0, 6);
    items = [];
    let html = '';
    if (memos.length) {
      html += '<div class="sec">' + (n ? '메모' : '최근 메모') + '</div>';
      for (const { m } of memos) {
        const i = items.length;
        items.push({ kind: 'memo', id: m.id });
        const tag = kindTag(m);
        html += '<div class="it" role="option" data-i="' + i + '">' +
          (m.mark ? '<span class="mk">' + markSvg(m.mark, m.markColor || '#E8456B', 16) + '</span>' : '<span class="dot" style="background:' + grad(sk, m.slot || 0, 1) + '"></span>') +
          '<div class="txt"><div class="t">' + hi(m.title || '제목 없음', n) + '</div><div class="s">' + hi(snippet(m, n), n) + '</div></div>' +
          (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div>';
      }
    }
    if (people.length) {
      const head = rows[0];
      const ext = head.findIndex((h) => /내선|전화|번호/.test(h));
      html += '<div class="sec">연락망 · Enter 누르면 ' + (ext >= 0 ? esc(head[ext]) : '내용') + ' 복사</div>';
      for (const r of people) {
        const i = items.length;
        const copy = ext >= 0 && r[ext].trim() ? r[ext].trim() : r.filter((c) => c.trim()).join(' ');
        items.push({ kind: 'person', copy });
        html += '<div class="it" role="option" data-i="' + i + '"><span class="mk" style="color:var(--a1)">' + ICONS.phone + '</span>' +
          '<div class="txt"><div class="t">' + r.map((c, k) => (k === ext || !c.trim() ? '' : hi(c, n))).filter(Boolean).join(' · ') + '</div></div>' +
          (ext >= 0 && r[ext].trim() ? '<span class="tag">' + hi(r[ext], n) + '</span>' : '') + '</div>';
      }
    }
    if (n && !items.length) html = '<div class="none">찾는 메모가 없어요</div>';
    res.innerHTML = html;
    sel = keep ? Math.max(0, Math.min(sel, items.length - 1)) : 0;
    $('foot').hidden = !items.length;
    q.setAttribute('aria-expanded', String(!!items.length));
    mark();
    fit();
  }
  function mark() {
    res.querySelectorAll('.it').forEach((el) => el.classList.toggle('on', Number(el.dataset.i) === sel));
    const on = res.querySelector('.it.on');
    if (on) { on.scrollIntoView({ block: 'nearest' }); q.setAttribute('aria-activedescendant', ''); }
  }
  function fit() { requestAnimationFrame(() => api.searchSize(box.getBoundingClientRect().height + 28)); }
  function choose(i) {
    const it = items[i];
    if (!it || closing) return;
    if (it.kind === 'memo') { closing = true; api.searchOpen(it.id); return; }
    api.copyText(it.copy);
    const el = res.querySelector('.it[data-i="' + i + '"] .tag') || res.querySelector('.it[data-i="' + i + '"] .t');
    if (el) { el.textContent = '복사했어요'; el.classList.add('copied'); }
    closing = true;
    setTimeout(() => api.searchClose(), 550);
  }

  q.addEventListener('input', () => search(false));
  q.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { sel = (sel + 1) % items.length; mark(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { sel = (sel - 1 + items.length) % items.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); api.searchClose(); } });
  res.addEventListener('mousemove', (e) => { const it = e.target.closest('.it'); if (it && Number(it.dataset.i) !== sel) { sel = Number(it.dataset.i); mark(); } });
  res.addEventListener('mousedown', (e) => e.preventDefault());
  res.addEventListener('click', (e) => { const it = e.target.closest('.it'); if (it) choose(Number(it.dataset.i)); });

  function apply(s) {
    S = s;
    sk = applyTheme(S.settings).sk;
    search(true);
  }
  api.onState((s) => { if (!closing) apply(s); });
  api.init().then((s) => { apply(s); q.focus(); });
  window.addEventListener('focus', () => q.focus());
})();
