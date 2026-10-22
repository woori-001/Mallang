// 윈도우 실제 환경 점검: 딱 붙인 메모 두 개에서 아래 메모 윗부분을 눌렀을 때 어느 창이 받는지 + 여백이 하얗게 칠해지는지
module.exports = (ctx) => {
  const { store, createMemo, updateMemo, memoWins, updateSettings } = ctx;
  const { desktopCapturer, screen } = require('electron');
  const fs = require('fs'), path = require('path');
  const OUT = process.env.WT_OUT || '.';
  const tag = process.env.WT_TAG || 'run';
  const log = (...a) => { const s = 'T> ' + a.join(' '); console.log(s); fs.appendFileSync(path.join(OUT, tag + '.txt'), s + '\n'); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const koffi = require('koffi');
  const u32 = koffi.load('user32.dll');
  const SetCursorPos = u32.func('__stdcall', 'SetCursorPos', 'bool', ['int', 'int']);
  const mouse_event = u32.func('__stdcall', 'mouse_event', 'void', ['uint', 'uint', 'uint', 'uint', 'uintptr']);
  const click = async (x, y) => { SetCursorPos(x, y); await wait(120); mouse_event(0x0002, 0, 0, 0, 0); await wait(60); mouse_event(0x0004, 0, 0, 0, 0); await wait(400); };
  const hook = "window.__pd = 0; document.addEventListener('pointerdown', () => { window.__pd++; }, true); 1";
  setTimeout(async () => {
    try {
      log('scale', screen.getPrimaryDisplay().scaleFactor, JSON.stringify(screen.getPrimaryDisplay().workArea));
      if (process.env.WT_SKIN) updateSettings({ skin: process.env.WT_SKIN });
      createMemo({ title: '위 메모 A' }); await wait(1500);
      const A = store.memos[store.memos.length - 1];
      createMemo({ title: '아래 메모 B' }); await wait(1500);
      const B = store.memos[store.memos.length - 1];
      updateMemo(A.id, { folded: true }); updateMemo(B.id, { folded: true }); await wait(900);
      const wa = memoWins.get(A.id), wb = memoWins.get(B.id);
      // A 바로 아래에 B (간격 0)
      A.x = 400; A.y = 300; B.x = 400; B.y = 332;
      wb.setBounds({ x: 400 - 14, y: 332 - 14, width: 208, height: 60 });
      wa.setBounds({ x: 400 - 14, y: 300 - 14, width: 208, height: 60 });
      wb.moveTop(); await wait(200); wa.moveTop(); await wait(1500);   // A가 위에
      for (const w of [wa, wb]) await w.webContents.executeJavaScript(hook);
      log('A', JSON.stringify(wa.getBounds()), 'B', JSON.stringify(wb.getBounds()));
      // B 윗부분 (A의 투명 여백이 덮는 곳)
      await click(470, 337);
      const pa = await wa.webContents.executeJavaScript('window.__pd'), pb = await wb.webContents.executeJavaScript('window.__pd');
      log('click B-top -> A got', pa, 'B got', pb, pb > 0 && pa === 0 ? 'PASS' : 'FAIL');
      // B 가운데
      await click(470, 348);
      log('click B-mid -> A', await wa.webContents.executeJavaScript('window.__pd'), 'B', await wb.webContents.executeJavaScript('window.__pd'));
      SetCursorPos(900, 700); await wait(600);
      // 화면 찍기
      const src = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
      const img = src[0].thumbnail;
      fs.writeFileSync(path.join(OUT, tag + '.png'), img.toPNG());
      const sz = img.getSize(), bmp = img.toBitmap();
      const px = (x, y) => { const i = (y * sz.width + x) * 4; return [bmp[i + 2], bmp[i + 1], bmp[i]]; };
      const sx = sz.width / screen.getPrimaryDisplay().size.width;
      const at = (x, y) => px(Math.round(x * sx), Math.round(y * sx));
      log('pixel padding-left of A', JSON.stringify(at(392, 316)), 'far', JSON.stringify(at(392, 600)), 'inside A', JSON.stringify(at(470, 316)));
    } catch (e) { log('ERR', e && e.stack); }
    setTimeout(() => process.exit(0), 500);
  }, 8000);
};
