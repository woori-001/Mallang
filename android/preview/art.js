// 확인용: 진짜 모바일 앱(docs/)을 열어서, 앱이 위젯에 넘기는 데이터(스킨 그림 포함)를 그대로 받아 파일로 저장
// 예시 일정·꾸미기는 확인용 가짜 데이터 (실제 사용자 데이터 아님)
// 사용: node android/preview/art.js <출력 폴더>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..', 'docs'), out = process.argv[2] || 'preview-out';
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/json' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(8765);
(async () => {
  const b = await chromium.launch();
  const runs = [['lav', 100], ['peach', 100], ['midnight', 100], ['draw', 100], ['lav', 45]];
  for (const [skin, alpha] of runs) {
    const p = await b.newPage({ viewport: { width: 400, height: 800 } });
    await p.route(/supabase/, (r) => r.abort());
    await p.addInitScript(([skin, alpha]) => {
      window.__w = []; window.MallangAndroid = { saveWidget: (j) => window.__w.push(j), version: () => 1 };
      const t = new Date(), k = (o) => { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + o); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      const ev = (title, tm, c) => ({ title, t: tm, c });
      const events = {
        [k(0)]: [ev('주간 회의', '09:30', 'lav'), ev('거래처 미팅', '15:00', 'pink'), ev('보고서 마감', '', 'mint')],
        [k(1)]: [ev('김과장 생일', '', 'pink')], [k(2)]: [ev('교육', '10:00', 'sky')], [k(5)]: [ev('연차', '', 'mint'), ev('병원', '14:00', 'pink')],
        [k(-3)]: [ev('정산', '11:00', 'lav')], [k(9)]: [ev('외근', '13:00', 'pink')], [k(12)]: [ev('워크숍', '', 'mint'), ev('출장', '09:00', 'lav')]
      };
      const deco = {}; const put = (d, f, v) => { const m = d.slice(0, 7); deco[m] = deco[m] || { bg: {}, stk: {}, tape: [] }; deco[m][f][d] = v; };
      put(k(1), 'bg', '#FFE1E1'); put(k(1), 'stk', '🎂'); put(k(7), 'bg', '#DDF3DA'); put(k(7), 'stk', '✈️'); put(k(12), 'stk', '⭐');
      const tm = k(6).slice(0, 7); deco[tm] = deco[tm] || { bg: {}, stk: {}, tape: [] };
      deco[tm].tape.push({ s: k(6), e: k(8), t: '결산 기간', c: 'lemon' }, { s: k(13), e: k(17), t: '제주 출장', c: 'sky' });
      localStorage.setItem('mallang.state.v1', JSON.stringify({ memos: [], trash: [], tombs: [], events, evMeta: {}, deco, decoMeta: {}, contacts: null, shared: {}, cursor: null }));
      localStorage.setItem('mallang.prefs.v1', JSON.stringify({ skin, widgetAlpha: alpha }));
    }, [skin, alpha]);
    await p.goto('http://localhost:8765/index.html');
    for (let i = 0; i < 60; i++) {   // 앱이 위젯 데이터를 넘길 때까지 (최대 30초)
      if (await p.evaluate(() => window.__w.length > 0 && !!JSON.parse(window.__w[window.__w.length - 1]).art)) break;
      await p.waitForTimeout(500);
    }
    await p.waitForTimeout(1500);
    const j = await p.evaluate(() => window.__w[window.__w.length - 1]);
    const name = skin + (alpha !== 100 ? '-a' + alpha : '') + '.json';
    fs.writeFileSync(path.join(out, name), j);
    console.log(name, j.length);
    await p.close();
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
