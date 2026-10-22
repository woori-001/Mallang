// 공지 알림: 오른쪽 아래 작은 알림 → 내용 보기
(function () {
  const api = window.api;
  const $ = (s) => document.getElementById(s);
  const qs = new URLSearchParams(location.search);
  const id = qs.get('id');
  let detail = qs.get('view') === '1', S = null;
  $('tX').innerHTML = window.M.ICONS.x;
  const pad = (n) => (n < 10 ? '0' : '') + n;
  function fmt(t) { const d = new Date(t); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function note() { return (S && S.notices || []).find((n) => n.id === id); }
  function fitDetail() { requestAnimationFrame(() => { const m = $('modal'); const need = m.offsetHeight + 28 + ($('mBody').scrollHeight - $('mBody').clientHeight); api.noticeSize(need); }); }
  function render() {
    const n = note();
    if (!n) return;
    window.M.applyTheme(S.settings);
    $('tTitle').textContent = n.title;
    $('mTitle').textContent = n.title;
    const v = /\d+\.\d+\.\d+/.exec(n.title);
    $('mVer').textContent = n.upd ? '업데이트' + (v ? ' ' + v[0] : '') : '';
    $('mDate').textContent = n.at ? fmt(n.at) : '';
    $('mBody').textContent = n.body || '';
    document.body.classList.toggle('detail', detail);
    $('toast').hidden = detail;
    $('modal').hidden = !detail;
    if (detail) fitDetail();
  }
  $('tOpen').addEventListener('click', () => { detail = true; render(); api.noticeExpand(420); setTimeout(fitDetail, 60); });
  $('tLater').addEventListener('click', () => api.noticeClose());
  $('tX').addEventListener('click', () => api.noticeClose());
  $('mOk').addEventListener('click', () => api.noticeClose());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.noticeClose(); });
  api.onState((s) => { S = s; render(); });
  api.init().then((s) => { S = s; render(); });
})();
