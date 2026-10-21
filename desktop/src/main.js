'use strict';
// 말랑메모 - 메인 프로세스
// 메모 창, 목록바, 오늘 일정 위젯, 트레이 아이콘, 자동 저장을 관리합니다.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut, nativeImage, shell, dialog, safeStorage, powerMonitor, clipboard } = require('electron');
const Cloud = require('./cloud-core');
const { Notification } = require('electron');
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* 개발 실행에서는 없을 수 있음 */ }
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const TRASH_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;
const MOBILE_URL = 'https://woori-001.github.io/Mallang/';

const isWin = process.platform === 'win32';
const P = 14;                  // 메모 창 그림자 여백
const FOLD_W = 180, FOLD_H = 32;
const SIDE_W = 370;            // 목록 패널 340 + 탭 30
const WIDGET_W = 284;
const MIN_W = 180, MIN_H = 110, MAX_W = 1400, MAX_H = 1200;
const R = (f) => path.join(__dirname, 'renderer', f);
const PRELOAD = path.join(__dirname, 'preload.js');

// 저장 폴더를 고정 (%APPDATA%\MallangMemo). 한글 앱 이름 때문에 폴더 이름이 비지 않도록 명시합니다.
app.setPath('userData', path.join(app.getPath('appData'), 'MallangMemo'));

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.setAppUserModelId('com.mallang.memo');
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals');

// ───────────────────────── 저장소 ─────────────────────────
let dataDir, dataFile, store, saveTimer, quitting = false;

function defaults() {
  return {
    version: 1,
    settings: { skin: 'lav', font: 'gowun', fontScale: 100, calFont: 'same', calScale: 100, bodyBg: false, alpha: 60, sideAlpha: 55, showToday: true, showPeople: false, pinned: false, autoStart: false },
    nextId: 2,
    memos: [{
      id: 1, slot: 0, x: null, y: null, w: 290, h: 240, type: 'text', title: '말랑메모 시작하기',
      text: '오른쪽 끝 ◀ 탭을 누르면 목록이 열려요.\n제목줄을 더블클릭하면 접히고, 다시 더블클릭하면 펴져요.\n제목을 클릭하면 이름을 바꿀 수 있어요.\nCtrl + Alt + N 으로 어디서나 새 메모!',
      items: [], layer: 'normal', hidden: false, folded: false, mark: 'heart', markColor: '#E8456B'
    }],
    events: {},
    trash: [],
    tombs: [],
    evMeta: {},
    contacts: null,
    cloud: {},
    widget: { x: null, y: null },
    peopleWin: { x: null, y: null, w: 430, h: 380, top: false }
  };
}

function load() {
  dataDir = app.getPath('userData');
  dataFile = path.join(dataDir, 'memo-data.json');
  migrateOld();
  let s = null;
  for (const f of [dataFile, dataFile + '.bak']) {
    try {
      s = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (s && Array.isArray(s.memos)) break;
      s = null;
    } catch (e) { s = null; }
  }
  const d = defaults();
  store = s
    ? { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) }, widget: { ...d.widget, ...(s.widget || {}) }, peopleWin: { ...d.peopleWin, ...(s.peopleWin || {}) }, events: s.events || {} }
    : d;
  store.memos = store.memos.filter((m) => m && typeof m.id === 'number').map((m) => ({
    slot: 0, w: 260, h: 220, type: 'text', title: '', text: '', items: [], layer: 'normal', hidden: false, folded: false, ...m, deleting: false
  }));
  store.trash = Array.isArray(store.trash) ? store.trash.filter((t) => t && typeof t.id === 'number') : [];
  // 동기화용: 메모마다 고유번호(uid)와 내용 수정 시각(mt)
  for (const m of [...store.memos, ...store.trash]) {
    if (!m.uid) { m.uid = Cloud.uid(); m.dirty = true; }
    if (!m.mt) { m.mt = m.updated || m.created || Date.now(); m.dirty = true; }
  }
  store.tombs = Array.isArray(store.tombs) ? store.tombs : [];
  store.evMeta = store.evMeta && typeof store.evMeta === 'object' ? store.evMeta : {};
  store.contacts = store.contacts && Array.isArray(store.contacts.rows) ? { ...store.contacts, rows: sanitizeTable(store.contacts).rows } : null;
  for (const m of [...store.memos, ...store.trash]) if (m.type === 'table') m.table = sanitizeTable(m.table);
  const fixed = store.contacts && fixContactRows(store.contacts.rows);
  if (fixed) store.contacts = { rows: fixed, mt: Math.max(Date.now(), (store.contacts.mt || 0) + 1), dirty: true };
  store.cloud = store.cloud && typeof store.cloud === 'object' ? store.cloud : {};
  store.nextId = Math.max(store.nextId || 1, ...store.memos.map((m) => m.id + 1), ...store.trash.map((m) => m.id + 1), 1);
}

// 1.0.0 버전이 다른 위치에 저장했던 메모를 새 폴더로 옮김
function migrateOld() {
  if (fs.existsSync(dataFile)) return;
  const appData = app.getPath('appData');
  for (const dir of [path.join(appData, '말랑메모'), appData]) {
    const old = path.join(dir, 'memo-data.json');
    try {
      if (!fs.existsSync(old)) continue;
      const j = JSON.parse(fs.readFileSync(old, 'utf8'));
      if (!j || !Array.isArray(j.memos) || !j.settings) continue;
      fs.mkdirSync(dataDir, { recursive: true });
      fs.copyFileSync(old, dataFile);
      for (const f of [old, old + '.bak', old + '.tmp']) {
        if (fs.existsSync(f)) { wipeAndWrite(f, ''); fs.unlinkSync(f); }
      }
      console.log('이전 메모 옮김:', old);
      return;
    } catch (e) { console.error('이전 메모 옮기기 실패', e); }
  }
}

function serialize() {
  const data = { ...store, memos: store.memos.filter((m) => !m.deleting).map(({ deleting, ...m }) => m) };
  return JSON.stringify(data, null, 1);
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = dataFile + '.tmp';
    fs.writeFileSync(tmp, serialize());
    if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, dataFile + '.bak');
    fs.renameSync(tmp, dataFile);
  } catch (e) {
    console.error('저장 실패', e);
  }
}

// 기존 파일 내용을 0으로 덮어쓴 뒤 새 내용으로 교체 (지운 내용이 파일에 남지 않도록)
function wipeAndWrite(file, content) {
  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r+');
    try {
      const zero = Buffer.alloc(Math.min(size, 1 << 20));
      let pos = 0;
      while (pos < size) {
        const n = Math.min(zero.length, size - pos);
        fs.writeSync(fd, zero, 0, n, pos);
        pos += n;
      }
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
  }
  const fd = fs.openSync(file, 'w');
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

// 영구 삭제 후 저장: 본 파일과 직전 저장본(.bak) 모두에서 지운 내용을 없앱니다.
function saveSecure() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const json = serialize();
    const tmp = dataFile + '.tmp';
    if (fs.existsSync(tmp)) wipeAndWrite(tmp, '');
    wipeAndWrite(dataFile, json);
    wipeAndWrite(dataFile + '.bak', json);
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  } catch (e) {
    console.error('보안 저장 실패', e);
  }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

let bcTimer = null;
function snapshot() {
  return {
    settings: store.settings,
    memos: store.memos.filter((m) => !m.deleting),
    events: store.events,
    contacts: store.contacts ? store.contacts.rows : null,
    peopleWin: store.peopleWin,
    trash: store.trash.map((t) => ({
      id: t.id, title: t.title, slot: t.slot, mark: t.mark, markColor: t.markColor, type: t.type,
      preview: t.type === 'table' ? ((t.table && t.table.rows) || []).slice(1).map((r) => r.filter(Boolean).join(' ')).find((x) => x.trim()) || '표' : t.type === 'check' ? (t.items || []).map((x) => x.t).filter(Boolean).slice(0, 3).join(', ') : (t.text || '').split('\n').find((l) => l.trim() && l !== '\u2E3B') || '',
      deletedAt: t.deletedAt, purgeAt: t.deletedAt + TRASH_DAYS * DAY
    })),
    trashDays: TRASH_DAYS,
    cloud: cloudInfo(),
    update: { ...upd, current: app.getVersion() }
  };
}
function broadcast() {
  if (bcTimer) return;
  bcTimer = setTimeout(() => {
    bcTimer = null;
    const s = snapshot();
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('state', s);
  }, 16);
}

const getMemo = (id) => store.memos.find((m) => m.id === id && !m.deleting);

// ───────────────────────── 창 공통 ─────────────────────────
let host = null, side = null, widget = null, peopleWin = null, searchWin = null, tray = null;
const memoWins = new Map();
const focusOnOpen = new Set();
const anims = new WeakMap();

const webPrefs = { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false };
const baseWinOpts = {
  frame: false, transparent: true, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
  skipTaskbar: true, hasShadow: false, show: false, backgroundColor: '#00000000', thickFrame: false, webPreferences: webPrefs
};

const workArea = () => screen.getPrimaryDisplay().workArea;

function boundsFor(m) {
  const w = m.folded ? FOLD_W : m.w;
  const h = m.folded ? FOLD_H : m.h;
  return { x: Math.round(m.x - P), y: Math.round(m.y - P), width: Math.round(w + 2 * P), height: Math.round(h + 2 * P) };
}

function setB(win, b) {
  if (!win || win.isDestroyed()) return;
  const a = anims.get(win);
  if (a) { clearInterval(a); anims.delete(win); }
  win.setBounds({ x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) });
}

// 부드럽게 창 이동/크기 변경
function animateTo(win, target, ms = 340) {
  if (!win || win.isDestroyed()) return;
  const prev = anims.get(win);
  if (prev) clearInterval(prev);
  const from = win.getBounds();
  const start = Date.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const timer = setInterval(() => {
    if (win.isDestroyed()) { clearInterval(timer); return; }
    const t = Math.min(1, (Date.now() - start) / ms);
    const e = ease(t);
    const b = {
      x: Math.round(from.x + (target.x - from.x) * e),
      y: Math.round(from.y + (target.y - from.y) * e),
      width: Math.round(from.width + (target.width - from.width) * e),
      height: Math.round(from.height + (target.height - from.height) * e)
    };
    win.setBounds(b);
    if (t >= 1) { clearInterval(timer); anims.delete(win); win.setBounds(target); }
  }, 16);
  anims.set(win, timer);
}

// 맨 뒤 배치 (Windows API 사용)
let SetWindowPos = null;
if (isWin) {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    SetWindowPos = user32.func('__stdcall', 'SetWindowPos', 'bool', ['intptr', 'intptr', 'int', 'int', 'int', 'int', 'uint']);
  } catch (e) {
    console.error('맨 뒤 배치 기능을 불러오지 못했어요', e);
  }
}
function sendToBottom(win) {
  if (!win || win.isDestroyed()) return;
  if (SetWindowPos) {
    try {
      const buf = win.getNativeWindowHandle();
      const h = buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
      // HWND_BOTTOM = 1, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE = 0x13
      SetWindowPos(h, 1, 0, 0, 0, 0, 0x0013);
    } catch (e) { console.error(e); }
  }
}

function ensurePos(m) {
  const wa = workArea();
  const n = m.id % 6;
  if (m.x == null || m.y == null) {
    m.x = wa.x + Math.round(wa.width / 2) - 180 + n * 28;
    m.y = wa.y + Math.round(wa.height / 3) - 80 + n * 26;
  }
  const w = m.folded ? FOLD_W : m.w;
  const disp = screen.getDisplayMatching({ x: Math.round(m.x), y: Math.round(m.y), width: Math.round(w), height: 40 }).workArea;
  const off = m.x + 60 > disp.x + disp.width || m.x + w - 60 < disp.x || m.y < disp.y - 20 || m.y + 30 > disp.y + disp.height;
  if (off) {
    m.x = wa.x + 140 + n * 28;
    m.y = wa.y + 120 + n * 26;
  }
}

// ───────────────────────── 호스트 (메모 창들의 부모) ─────────────────────────
// 모든 메모 창을 하나의 프로세스에서 열어 메모가 많아도 가볍게 동작합니다.
function createHost() {
  host = new BrowserWindow({ show: false, width: 100, height: 100, skipTaskbar: true, webPreferences: webPrefs });
  host.webContents.setWindowOpenHandler((details) => {
    let u;
    try { u = new URL(details.url); } catch (e) { return { action: 'deny' }; }
    if (u.protocol !== 'file:') return { action: 'deny' };
    const kind = u.searchParams.get('kind');
    if (kind === 'memo') {
      const m = getMemo(Number(u.searchParams.get('id')));
      if (!m) return { action: 'deny' };
      return { action: 'allow', overrideBrowserWindowOptions: { ...baseWinOpts, ...boundsFor(m), alwaysOnTop: m.layer === 'top' } };
    }
    if (kind === 'widget') {
      const wa = workArea();
      const wx = store.widget.x != null ? store.widget.x : wa.x + 20;
      const wy = store.widget.y != null ? store.widget.y : wa.y + wa.height - 260;
      return { action: 'allow', overrideBrowserWindowOptions: { ...baseWinOpts, x: Math.round(wx), y: Math.round(wy), width: WIDGET_W, height: 200 } };
    }
    if (kind === 'search') {
      const wa = workArea();
      return { action: 'allow', overrideBrowserWindowOptions: {
        ...baseWinOpts, x: Math.round(wa.x + (wa.width - SEARCH_W) / 2 - P), y: Math.round(wa.y + wa.height * 0.16 - P),
        width: SEARCH_W + 2 * P, height: 96, alwaysOnTop: true
      } };
    }
    if (kind === 'people') {
      return { action: 'allow', overrideBrowserWindowOptions: { ...baseWinOpts, ...peopleBounds(), alwaysOnTop: !!store.peopleWin.top } };
    }
    return { action: 'deny' };
  });
  host.webContents.on('did-create-window', (win, details) => {
    const u = new URL(details.url);
    const kind = u.searchParams.get('kind');
    win.removeMenu();
    if (kind === 'memo') setupMemoWin(win, Number(u.searchParams.get('id')));
    if (kind === 'widget') setupWidget(win);
    if (kind === 'people') setupPeople(win);
    if (kind === 'search') setupSearch(win);
  });
  host.on('close', (e) => { if (!quitting) e.preventDefault(); });
  host.loadFile(R('host.html'));
}

function hostOpen(url, name) {
  if (host && !host.isDestroyed()) host.webContents.send('host:open', { url, name });
}

// ───────────────────────── 메모 창 ─────────────────────────
function openMemoWin(m) {
  if (!m || m.hidden || m.deleting) return;
  const cur = memoWins.get(m.id);
  if (cur && !cur.isDestroyed()) return;
  ensurePos(m);
  const focus = focusOnOpen.has(m.id) ? '&focus=1' : '';
  hostOpen('memo.html?kind=memo&id=' + m.id + focus, 'memo-' + m.id + '-' + Date.now());
}

function setupMemoWin(win, id) {
  memoWins.set(id, win);
  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    if (focusOnOpen.has(id)) {
      focusOnOpen.delete(id);
      win.show();
      win.focus();
    } else {
      win.showInactive();
    }
    applyLayer(id);
  });
  win.on('blur', () => {
    const m = getMemo(id);
    if (m && m.layer === 'bottom') sendToBottom(win);
  });
  win.on('closed', () => {
    if (memoWins.get(id) === win) memoWins.delete(id);
    // Alt+F4 등으로 닫으면 지우지 않고 숨김 처리
    if (!win.__intentional && !quitting) {
      const m = getMemo(id);
      if (m && !m.hidden) { m.hidden = true; save(); broadcast(); }
    }
  });
}

function closeMemoWin(id, delay = 330) {
  const win = memoWins.get(id);
  if (!win || win.isDestroyed()) return;
  win.__intentional = true;
  memoWins.delete(id);
  win.webContents.send('cmd', { type: 'leave' });
  setTimeout(() => { if (!win.isDestroyed()) win.close(); }, delay);
}

function applyLayer(id) {
  const m = getMemo(id);
  const win = memoWins.get(id);
  if (!m || !win || win.isDestroyed()) return;
  if (m.layer === 'top') {
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setAlwaysOnTop(false);
    if (m.layer === 'bottom') sendToBottom(win);
  }
}

const ALLOWED = ['title', 'text', 'items', 'table', 'type', 'layer', 'hidden', 'folded', 'mark', 'markColor', 'slot', 'ord', 'clip'];  // clip: 드래그해 둔 부분 (이 PC에만)
// 기기끼리 맞추는 내용 (위치·크기·접힘·맨앞/맨뒤·숨김은 기기마다 따로)
const CONTENT = ['title', 'text', 'items', 'table', 'type', 'mark', 'markColor', 'slot', 'ord'];
function touch(m) {
  m.mt = Math.max(Date.now(), (m.mt || 0) + 1);
  m.dirty = true;
  scheduleSync();
}

function updateMemo(id, patch) {
  const m = getMemo(id);
  if (!m || !patch || typeof patch !== 'object') return;
  const prev = { ...m };
  for (const k of ALLOWED) if (k in patch) m[k] = patch[k];
  if (!['text', 'check', 'table'].includes(m.type)) m.type = 'text';
  if ('table' in patch) m.table = patch.table ? sanitizeTable(patch.table) : null;
  if (m.layer !== 'top' && m.layer !== 'bottom') m.layer = 'normal';
  m.updated = Date.now();
  if (CONTENT.some((k) => k in patch && JSON.stringify(prev[k]) !== JSON.stringify(m[k]))) touch(m);

  // 접힌 메모를 펼 때 예전 '모두 접어 정리' 이전 자리로 돌아가기
  if ('folded' in patch && prev.folded && !m.folded && m.ox != null) {
    m.x = m.ox; m.y = m.oy; delete m.ox; delete m.oy;
  }
  save();
  broadcast();

  const win = memoWins.get(id);
  if (m.layer !== prev.layer) applyLayer(id);
  if (m.hidden !== prev.hidden) {
    if (m.hidden) closeMemoWin(id);
    else { focusOnOpen.add(id); openMemoWin(m); }
  }
  if (m.folded !== prev.folded && win && !win.isDestroyed()) {
    if (m.folded) {
      // 내용이 먼저 접히고 나서 창 크기 맞추기
      setTimeout(() => { const mm = getMemo(id); if (mm && mm.folded) setB(win, boundsFor(mm)); }, 320);
    } else {
      const moved = prev.x !== m.x || prev.y !== m.y;
      if (moved) {
        const b = boundsFor(m);
        const cur = win.getBounds();
        setB(win, { x: cur.x, y: cur.y, width: b.width, height: b.height });
        animateTo(win, b);
      } else {
        setB(win, boundsFor(m));
      }
    }
  }
}

function createMemo(opts = {}) {
  const id = store.nextId++;
  const near = opts.near != null ? getMemo(opts.near) : null;
  const m = {
    id, slot: opts.slot != null ? opts.slot : (id - 1) % 5,
    x: near ? near.x + 34 : null, y: near ? near.y + 34 : null,
    w: 260, h: 220, type: 'text', title: '새 메모', text: '', items: [],
    layer: 'normal', hidden: false, folded: false, mark: null, markColor: '#E8456B', created: Date.now(),
    uid: Cloud.uid(), mt: Date.now(), dirty: true
  };
  // 순서를 직접 정해 둔 상태면 새 메모는 맨 위로
  const ords = store.memos.map((x) => x.ord).filter((v) => typeof v === 'number');
  if (ords.length) m.ord = Math.min(...ords) - 1;
  store.memos.push(m);
  scheduleSync();
  focusOnOpen.add(id);
  ensurePos(m);
  openMemoWin(m);
  save();
  broadcast();
  return id;
}

// 삭제 → 휴지통으로 (7일간 되살리기 가능)
function deleteMemo(id) {
  const m = getMemo(id);
  if (!m) return;
  m.deleting = true;
  closeMemoWin(id);
  broadcast();
  setTimeout(() => {
    store.memos = store.memos.filter((x) => x.id !== id);
    const { deleting, ox, oy, ...rest } = m;
    const t = { ...rest, folded: false, hidden: false, deletedAt: Date.now() };
    touch(t);
    store.trash.unshift(t);
    save();
    broadcast();
  }, 340);
}

function restoreMemo(id) {
  const t = store.trash.find((x) => x.id === id);
  if (!t) return;
  store.trash = store.trash.filter((x) => x.id !== id);
  const { deletedAt, ...m } = t;
  m.hidden = false;
  m.deleting = false;
  touch(m);
  store.memos.push(m);
  focusOnOpen.add(m.id);
  ensurePos(m);
  openMemoWin(m);
  save();
  broadcast();
}

// 영구 삭제: 휴지통에서 지우고 파일에서도 흔적을 없앰
function purgeMemos(ids) {
  const set = new Set(ids);
  const before = store.trash.length;
  const gone = store.trash.filter((x) => set.has(x.id));
  store.trash = store.trash.filter((x) => !set.has(x.id));
  if (store.trash.length === before) return;
  // 다른 기기와 서버에서도 지우도록 '지움 표시'만 남김 (내용은 없음)
  for (const g of gone) if (g.uid) store.tombs.push({ uid: g.uid, ts: Math.max(Date.now(), (g.mt || 0) + 1) });
  saveSecure();
  scheduleSync();
  broadcast();
}

function autoPurge() {
  const limit = Date.now() - TRASH_DAYS * DAY;
  const old = store.trash.filter((t) => !t.deletedAt || t.deletedAt < limit).map((t) => t.id);
  if (old.length) purgeMemos(old);
}

function focusMemo(id) {
  const m = getMemo(id);
  if (!m) return;
  if (m.hidden) { updateMemo(id, { hidden: false }); return; }
  const win = memoWins.get(id);
  if (!win || win.isDestroyed()) { focusOnOpen.add(id); openMemoWin(m); return; }
  win.show();
  win.moveTop();
  win.focus();
  win.webContents.send('cmd', { type: 'flash' });
}

// 모두 접기: 지금 자리 그대로 접기만 (배치는 바꾸지 않음)
function foldAll() {
  if (peopleWin && !peopleWin.isDestroyed()) setPeopleFolded(true);
  const list = store.memos.filter((m) => !m.hidden && !m.deleting && !m.folded);
  if (!list.length) return;
  for (const m of list) m.folded = true;
  save();
  broadcast();
  // 내용이 먼저 접히고 나서 창 크기 맞추기
  setTimeout(() => {
    for (const m of list) {
      const win = memoWins.get(m.id);
      const mm = getMemo(m.id);
      if (win && !win.isDestroyed() && mm && mm.folded) setB(win, boundsFor(mm));
    }
  }, 320);
}

function unfoldAll() {
  if (peopleWin && !peopleWin.isDestroyed()) setPeopleFolded(false);
  const list = store.memos.filter((m) => m.folded && !m.hidden && !m.deleting);
  for (const m of list) {
    m.folded = false;
    if (m.ox != null) { m.x = m.ox; m.y = m.oy; }
    delete m.ox; delete m.oy;
  }
  save();
  broadcast();
  for (const m of list) {
    const win = memoWins.get(m.id);
    if (!win || win.isDestroyed()) continue;
    const b = boundsFor(m);
    const cur = win.getBounds();
    setB(win, { x: cur.x, y: cur.y, width: b.width, height: b.height });
    animateTo(win, b, 420);
  }
}

// ───────────────────────── 목록바 ─────────────────────────
function sideBounds() {
  const wa = workArea();
  return { x: wa.x + wa.width - SIDE_W, y: wa.y, width: SIDE_W, height: wa.height };
}
function createSide() {
  side = new BrowserWindow({ ...baseWinOpts, ...sideBounds(), focusable: true, alwaysOnTop: true, webPreferences: webPrefs });
  side.removeMenu();
  side.setAlwaysOnTop(true, 'screen-saver');
  side.setIgnoreMouseEvents(true, { forward: true });
  side.once('ready-to-show', () => side.showInactive());
  side.on('close', (e) => { if (!quitting) e.preventDefault(); });
  side.loadFile(R('sidebar.html'));
}
function placeSide() {
  if (side && !side.isDestroyed()) setB(side, sideBounds());
}
function openSide() {
  if (side && !side.isDestroyed()) side.webContents.send('cmd', { type: 'open' });
}

// ───────────────────────── 오늘 일정 위젯 ─────────────────────────
function openWidget() {
  if (widget && !widget.isDestroyed()) return;
  hostOpen('widget.html?kind=widget', 'widget-' + Date.now());
}
function setupWidget(win) {
  widget = win;
  win.once('ready-to-show', () => { if (!win.isDestroyed()) { win.showInactive(); sendToBottom(win); } });
  win.on('blur', () => sendToBottom(win));
  win.on('closed', () => {
    if (widget === win) widget = null;
    if (!win.__intentional && !quitting && store.settings.showToday) {
      store.settings.showToday = false; save(); broadcast();
    }
  });
}
function closeWidget() {
  if (!widget || widget.isDestroyed()) return;
  const w = widget;
  w.__intentional = true;
  widget = null;
  w.webContents.send('cmd', { type: 'leave' });
  setTimeout(() => { if (!w.isDestroyed()) w.close(); }, 330);
}

// ───────────────────────── 빠른 검색 (Ctrl+Alt+F) ─────────────────────────
const SEARCH_W = 560;
function toggleSearch() {
  if (searchWin && !searchWin.isDestroyed()) { closeSearch(); return; }
  hostOpen('search.html?kind=search', 'search-' + Date.now());
}
function setupSearch(win) {
  searchWin = win;
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.once('ready-to-show', () => { if (!win.isDestroyed()) { win.show(); win.focus(); win.webContents.focus(); } });
  // 다른 곳을 누르면 닫힘 (막 열린 직후의 흔들림은 무시)
  const born = Date.now();
  win.on('blur', () => { if (Date.now() - born > 400) closeSearch(win); });
  win.on('closed', () => { if (searchWin === win) searchWin = null; });
}
function closeSearch(w) {
  w = w || searchWin;
  if (!w || w.isDestroyed()) return;
  if (searchWin === w) searchWin = null;
  w.close();
}
ipcMain.on('search:size', (e, h) => {
  h = num(h);
  if (!searchWin || searchWin.isDestroyed() || h == null) return;
  const b = searchWin.getBounds();
  searchWin.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.round(Math.min(640, Math.max(60, h))) });
});
ipcMain.on('search:close', () => closeSearch());
ipcMain.on('search:open', (e, id) => {
  closeSearch();
  const m = getMemo(id);
  if (!m) return;
  if (m.folded) updateMemo(id, { folded: false });
  setTimeout(() => focusMemo(id), m.hidden ? 0 : 60);
});

// ───────────────────────── 연락망 띄우기 ─────────────────────────
const PEOPLE_MIN_W = 260, PEOPLE_MIN_H = 180;
function peopleBounds() {
  const p = store.peopleWin, wa = workArea();
  const w = p.folded ? FOLD_W : Math.max(PEOPLE_MIN_W, p.w || 430), h = p.folded ? FOLD_H : Math.max(PEOPLE_MIN_H, p.h || 380);
  const x = p.x != null ? p.x : wa.x + wa.width - Math.max(PEOPLE_MIN_W, p.w || 430) - 430;
  const y = p.y != null ? p.y : wa.y + 90;
  return { x: Math.round(x - P), y: Math.round(y - P), width: w + 2 * P, height: h + 2 * P };
}
function openPeople() {
  if (peopleWin && !peopleWin.isDestroyed()) { peopleWin.show(); peopleWin.focus(); return; }
  hostOpen('people.html?kind=people', 'people-' + Date.now());
}
function setupPeople(win) {
  peopleWin = win;
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  win.on('closed', () => {
    if (peopleWin === win) peopleWin = null;
    if (!win.__intentional && !quitting && store.settings.showPeople) {
      store.settings.showPeople = false; save(); broadcast(); buildTrayMenu();
    }
  });
}
function closePeople() {
  if (!peopleWin || peopleWin.isDestroyed()) return;
  const w = peopleWin;
  w.__intentional = true;
  peopleWin = null;
  w.webContents.send('cmd', { type: 'leave' });
  setTimeout(() => { if (!w.isDestroyed()) w.close(); }, 330);
}
ipcMain.on('people:move', (e, x, y, done) => {
  x = num(x); y = num(y);
  if (!peopleWin || peopleWin.isDestroyed() || x == null || y == null) return;
  const b = peopleWin.getBounds();
  peopleWin.setBounds({ x: Math.round(x), y: Math.round(y), width: b.width, height: b.height });
  if (done) { store.peopleWin.x = Math.round(x) + P; store.peopleWin.y = Math.round(y) + P; save(); }
});
ipcMain.on('people:resize', (e, w, h, done) => {
  w = num(w); h = num(h);
  if (!peopleWin || peopleWin.isDestroyed() || w == null || h == null || store.peopleWin.folded) return;
  w = Math.round(Math.min(1400, Math.max(PEOPLE_MIN_W, w)));
  h = Math.round(Math.min(1200, Math.max(PEOPLE_MIN_H, h)));
  const b = peopleWin.getBounds();
  peopleWin.setBounds({ x: b.x, y: b.y, width: w + 2 * P, height: h + 2 * P });
  if (done) { store.peopleWin.w = w; store.peopleWin.h = h; save(); broadcast(); }
});
// 연락망 창 접기/펴기 (메모처럼: 접을 땐 내용 먼저, 펼 땐 창 먼저)
function setPeopleFolded(on) {
  on = !!on;
  if (!!store.peopleWin.folded === on) return;
  store.peopleWin.folded = on;
  save();
  broadcast();
  const w = peopleWin;
  if (!w || w.isDestroyed()) return;
  if (on) setTimeout(() => { if (!w.isDestroyed() && store.peopleWin.folded) setB(w, peopleBounds()); }, 320);
  else setB(w, peopleBounds());
}
ipcMain.on('people:fold', (e, on) => setPeopleFolded(on));
ipcMain.on('people:top', (e, on) => {
  store.peopleWin.top = !!on;
  if (peopleWin && !peopleWin.isDestroyed()) peopleWin.setAlwaysOnTop(!!on, 'floating');
  save(); broadcast();
});

// ───────────────────────── 설정 / 트레이 ─────────────────────────
function updateSettings(patch) {
  const prev = { ...store.settings };
  if ('calScale' in patch) patch.calScale = Math.min(150, Math.max(70, Number(patch.calScale) || 100));
  if ('calFont' in patch && typeof patch.calFont !== 'string') delete patch.calFont;
  if ('bodyBg' in patch) patch.bodyBg = !!patch.bodyBg;
  const keys = ['skin', 'font', 'fontScale', 'calFont', 'calScale', 'bodyBg', 'alpha', 'sideAlpha', 'showToday', 'showPeople', 'pinned', 'autoStart'];
  if ('fontScale' in patch) patch.fontScale = Math.min(170, Math.max(70, Number(patch.fontScale) || 100));
  for (const k of keys) if (k in patch) store.settings[k] = patch[k];
  const s = store.settings;
  if (s.autoStart !== prev.autoStart) {
    try { app.setLoginItemSettings({ openAtLogin: !!s.autoStart }); } catch (e) { console.error(e); }
  }
  if (s.showToday !== prev.showToday) { if (s.showToday) openWidget(); else closeWidget(); }
  if (s.showPeople !== prev.showPeople) { if (s.showPeople) openPeople(); else closePeople(); buildTrayMenu(); }
  save();
  broadcast();
  buildTrayMenu();
}

function showAllHidden() {
  for (const m of store.memos) if (m.hidden && !m.deleting) updateMemo(m.id, { hidden: false });
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '새 메모  (Ctrl+Alt+N)', click: () => createMemo() },
    { label: '목록 열기', click: openSide },
    { label: '메모 검색  (Ctrl+Alt+F)', click: () => toggleSearch() },
    { label: '모두 접기  (Ctrl+Alt+↑)', click: () => foldAll() },
    { label: '모두 펴기  (Ctrl+Alt+↓)', click: () => unfoldAll() },
    { label: '숨긴 메모 모두 보이기', click: showAllHidden },
    { type: 'separator' },
    { label: '오늘 일정 위젯', type: 'checkbox', checked: !!store.settings.showToday, click: (i) => updateSettings({ showToday: i.checked }) },
    { label: '연락망 띄우기', type: 'checkbox', checked: !!store.settings.showPeople, click: (i) => updateSettings({ showPeople: i.checked }) },
    { label: '윈도우 시작 시 자동 실행', type: 'checkbox', checked: !!store.settings.autoStart, click: (i) => updateSettings({ autoStart: i.checked }) },
    { label: '메모 저장 폴더 열기', click: () => shell.openPath(dataDir) },
    upd.state === 'ready'
      ? { label: '새 버전 ' + upd.version + ' 지금 적용', click: applyUpdate }
      : { label: '업데이트 확인 (지금 ' + app.getVersion() + ')', click: checkUpdateNow },
    { type: 'separator' },
    { label: '말랑메모 종료', click: () => { quitting = true; app.quit(); } }
  ]));
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'tray.png'));
  const hi = path.join(__dirname, 'tray@2x.png');
  if (fs.existsSync(hi)) img.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(hi) });
  tray = new Tray(img);
  tray.setToolTip('말랑메모');
  tray.on('click', openSide);
  tray.on('double-click', () => createMemo());
  buildTrayMenu();
}

// ───────────────────────── IPC ─────────────────────────
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

ipcMain.handle('init', () => snapshot());
ipcMain.on('host:ready', () => {
  for (const m of store.memos) if (!m.hidden && !m.deleting) openMemoWin(m);
  if (store.settings.showToday) openWidget();
  if (store.settings.showPeople) openPeople();
});
ipcMain.on('memo:update', (e, id, patch) => updateMemo(id, patch));
ipcMain.handle('memo:create', (e, opts) => createMemo(opts || {}));
ipcMain.on('memo:delete', (e, id) => deleteMemo(id));
ipcMain.on('trash:restore', (e, id) => restoreMemo(id));
ipcMain.on('trash:purge', (e, id) => purgeMemos([id]));
ipcMain.on('trash:empty', () => purgeMemos(store.trash.map((t) => t.id)));
ipcMain.on('memo:focus', (e, id) => focusMemo(id));
ipcMain.on('memo:foldAll', foldAll);
ipcMain.on('memo:unfoldAll', unfoldAll);
// ───────── 자석 정렬: 옮길 때 다른 메모·화면 가장자리에 착 붙음 ─────────
const SNAP = 14;   // 이 거리(px) 안에 들어오면 붙음
const GAP = 6;     // 붙었을 때 메모 사이 간격
function snapPos(m, x, y) {
  const w = m.folded ? FOLD_W : m.w;
  const h = m.folded ? FOLD_H : m.h;
  const disp = screen.getDisplayMatching({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }).workArea;
  const others = store.memos.filter((o) => o.id !== m.id && !o.hidden && !o.deleting && o.x != null).map((o) => ({
    x: o.x, y: o.y, w: o.folded ? FOLD_W : o.w, h: o.folded ? FOLD_H : o.h
  }));
  let bx = null, by = null, dx = SNAP + 1, dy = SNAP + 1;
  const tryX = (v) => { const d = Math.abs(v - x); if (d < dx) { dx = d; bx = v; } };
  const tryY = (v) => { const d = Math.abs(v - y); if (d < dy) { dy = d; by = v; } };
  // 화면 가장자리
  tryX(disp.x + GAP); tryX(disp.x + disp.width - w - GAP);
  tryY(disp.y + GAP); tryY(disp.y + disp.height - h - GAP);
  for (const o of others) {
    // 세로로 가까운 메모끼리만 가로 정렬, 가로로 가까운 메모끼리만 세로 정렬
    const nearV = y < o.y + o.h + SNAP * 3 && y + h > o.y - SNAP * 3;
    const nearH = x < o.x + o.w + SNAP * 3 && x + w > o.x - SNAP * 3;
    if (nearV) {
      tryX(o.x);                 // 왼쪽 끝 맞춤
      tryX(o.x + o.w - w);       // 오른쪽 끝 맞춤
      tryX(o.x + o.w + GAP);     // 오른쪽에 붙이기
      tryX(o.x - w - GAP);       // 왼쪽에 붙이기
    }
    if (nearH) {
      tryY(o.y);                 // 위쪽 맞춤
      tryY(o.y + o.h - h);       // 아래쪽 맞춤
      tryY(o.y + o.h + GAP);     // 아래에 쌓기
      tryY(o.y - h - GAP);       // 위에 쌓기
    }
  }
  return { x: bx != null ? bx : x, y: by != null ? by : y };
}

ipcMain.on('memo:move', (e, id, x, y, done) => {
  const m = getMemo(id);
  const win = memoWins.get(id);
  x = num(x); y = num(y);
  if (!m || !win || win.isDestroyed() || x == null || y == null) return;
  const sp = snapPos(m, x + P, y + P);
  win.setPosition(Math.round(sp.x - P), Math.round(sp.y - P));
  m.x = Math.round(sp.x);
  m.y = Math.round(sp.y);
  if (done) {
    delete m.ox; delete m.oy;   // 직접 옮긴 자리를 기억
    save();
    broadcast();
  }
});
ipcMain.on('memo:resize', (e, id, w, h, done) => {
  const m = getMemo(id);
  const win = memoWins.get(id);
  w = num(w); h = num(h);
  if (!m || !win || win.isDestroyed() || w == null || h == null || m.folded) return;
  m.w = Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));
  m.h = Math.round(Math.min(MAX_H, Math.max(MIN_H, h)));
  setB(win, boundsFor(m));
  if (done) { save(); broadcast(); }
});
ipcMain.on('settings:update', (e, patch) => { if (patch && typeof patch === 'object') updateSettings(patch); });
ipcMain.on('events:set', (e, key, list) => {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(list)) return;
  const clean = list.slice(0, 50).map((ev) => ({
    t: String(ev.t || '').slice(0, 10), title: String(ev.title || '').slice(0, 200), c: ['lav', 'mint', 'pink', 'sky'].includes(ev.c) ? ev.c : 'lav'
  }));
  if (clean.length) store.events[key] = clean; else delete store.events[key];
  markEvent(key);
  save();
  broadcast();
});
ipcMain.on('contacts:set', (e, rows) => {
  if (!Array.isArray(rows)) return;
  const clean = sanitizeTable({ rows }).rows;
  if (store.contacts && JSON.stringify(store.contacts.rows) === JSON.stringify(clean)) return;
  const prev = (store.contacts && store.contacts.mt) || 0;
  store.contacts = { rows: clean, mt: Math.max(Date.now(), prev + 1), dirty: true };
  scheduleSync();
  save();
  broadcast();
});
ipcMain.on('side:ignore', (e, ignore) => {
  if (side && !side.isDestroyed()) side.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on('side:focus', () => { if (side && !side.isDestroyed()) side.focus(); });
ipcMain.on('widget:move', (e, x, y, done) => {
  x = num(x); y = num(y);
  if (!widget || widget.isDestroyed() || x == null || y == null) return;
  widget.setPosition(Math.round(x), Math.round(y));
  if (done) { store.widget = { x: Math.round(x), y: Math.round(y) }; save(); }
});
ipcMain.on('widget:size', (e, h) => {
  h = num(h);
  if (!widget || widget.isDestroyed() || h == null) return;
  const b = widget.getBounds();
  widget.setBounds({ x: b.x, y: b.y, width: WIDGET_W, height: Math.round(Math.min(600, Math.max(80, h))) });
});
ipcMain.on('open:data', () => shell.openPath(dataDir));
ipcMain.on('clip:write', (e, t) => { if (typeof t === 'string' && t) clipboard.writeText(t.slice(0, 200000)); });

// ───────────────────────── 백업 내보내기 / 가져오기 (비밀번호 암호화) ─────────────────────────
const BK_FORMAT = 'mallang-memo-backup';
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function encryptBackup(obj, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(String(password), salt, 32, SCRYPT);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return JSON.stringify({
    format: BK_FORMAT, v: 1, created: new Date().toISOString(),
    kdf: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, cipher: 'aes-256-gcm',
    salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64')
  });
}

function decryptBackup(text, password) {
  const env = JSON.parse(text);
  if (!env || env.format !== BK_FORMAT) throw new Error('format');
  const key = crypto.scryptSync(String(password), Buffer.from(env.salt, 'base64'), 32, { N: env.N, r: env.r, p: env.p, maxmem: SCRYPT.maxmem });
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  d.setAuthTag(Buffer.from(env.tag, 'base64'));
  const plain = Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8');
  return JSON.parse(plain);
}

function stamp() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
}

ipcMain.handle('backup:export', async (e, password) => {
  if (typeof password !== 'string' || password.length < 4) return { error: '비밀번호는 4자 이상으로 정해 주세요' };
  const parent = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(parent, {
    title: '백업 파일 저장',
    defaultPath: path.join(app.getPath('documents'), '말랑메모-백업-' + stamp() + '.mallang'),
    filters: [{ name: '말랑메모 백업', extensions: ['mallang'] }]
  });
  if (r.canceled || !r.filePath) return { canceled: true };
  try {
    // 휴지통에 있는 메모는 백업에 넣지 않음
    const payload = {
      app: '말랑메모', exported: Date.now(),
      memos: store.memos.filter((m) => !m.deleting).map(({ deleting, dirty, ...m }) => m),
      events: store.events, settings: store.settings,
      contacts: store.contacts ? store.contacts.rows : null
    };
    fs.writeFileSync(r.filePath, encryptBackup(payload, password));
    return { ok: true, file: path.basename(r.filePath), count: payload.memos.length };
  } catch (err) {
    console.error(err);
    return { error: '백업 파일을 저장하지 못했어요' };
  }
});

ipcMain.handle('backup:import', async (e, password) => {
  if (typeof password !== 'string' || !password) return { error: '비밀번호를 입력해 주세요' };
  const parent = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(parent, {
    title: '백업 파일 가져오기',
    defaultPath: app.getPath('documents'),
    properties: ['openFile'],
    filters: [{ name: '말랑메모 백업', extensions: ['mallang'] }]
  });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
  let data;
  try {
    data = decryptBackup(fs.readFileSync(r.filePaths[0], 'utf8'), password);
  } catch (err) {
    return { error: '비밀번호가 맞지 않거나 백업 파일이 아니에요' };
  }
  if (!data || !Array.isArray(data.memos)) return { error: '백업 파일 내용을 읽지 못했어요' };

  // 지금 메모는 그대로 두고, 백업의 메모를 추가합니다 (같은 메모는 건너뜀)
  const sig = (m) => [m.title || '', m.type, m.text || '', JSON.stringify(m.items || []), JSON.stringify((m.table && m.table.rows) || [])].join('\u0001');
  const have = new Set(store.memos.map(sig));
  let added = 0, skipped = 0;
  for (const src of data.memos) {
    if (!src || typeof src !== 'object') continue;
    if (have.has(sig(src))) { skipped++; continue; }
    const m = {
      slot: 0, w: 260, h: 220, type: 'text', title: '', text: '', items: [], layer: 'normal', folded: false, mark: null, markColor: '#E8456B',
      ...src, id: store.nextId++, hidden: false, deleting: false, uid: Cloud.uid(), mt: Date.now(), dirty: true
    };
    delete m.ox; delete m.oy;
    if (!['check', 'table'].includes(m.type)) m.type = 'text';
    m.table = m.type === 'table' ? sanitizeTable(m.table) : null;
    store.memos.push(m);
    have.add(sig(m));
    ensurePos(m);
    openMemoWin(m);
    added++;
  }
  let evAdded = 0;
  if (data.events && typeof data.events === 'object') {
    for (const [k, list] of Object.entries(data.events)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(list)) continue;
      const cur = store.events[k] || [];
      const key = (ev) => (ev.t || '') + '\u0001' + (ev.title || '');
      const seen = new Set(cur.map(key));
      for (const ev of list) {
        if (!ev || seen.has(key(ev))) continue;
        cur.push({ t: String(ev.t || ''), title: String(ev.title || ''), c: ['lav', 'mint', 'pink', 'sky'].includes(ev.c) ? ev.c : 'lav' });
        seen.add(key(ev));
        evAdded++;
        markEvent(k);
      }
      if (cur.length) store.events[k] = cur;
    }
  }
  // 연락망: 없는 줄만 덧붙임 (머리글이 같을 때)
  if (Array.isArray(data.contacts) && data.contacts.length > 1) {
    const inc = sanitizeTable({ rows: data.contacts }).rows;
    if (!store.contacts) store.contacts = { rows: inc, mt: Date.now(), dirty: true };
    else {
      const have2 = new Set(store.contacts.rows.map((r) => JSON.stringify(r)));
      const add = inc.slice(1).filter((r) => r.some((c) => c.trim()) && !have2.has(JSON.stringify(r)));
      if (add.length && store.contacts.rows[0].length === inc[0].length) {
        store.contacts = { rows: sanitizeTable({ rows: store.contacts.rows.concat(add) }).rows, mt: Math.max(Date.now(), store.contacts.mt + 1), dirty: true };
      }
    }
  }
  save();
  broadcast();
  scheduleSync();
  return { ok: true, added, skipped, events: evAdded };
});


// ───────────────────────── 자동 업데이트 ─────────────────────────
// GitHub(woori-001/Mallang) Releases에서 새 버전을 찾아 조용히 받아 두고,
// 다 받으면 알려줘요. 바로 적용하지 않아도 앱을 끌 때 자동으로 설치돼요.
const upd = { state: 'idle', version: '', percent: 0, message: '' };
function setUpd(p) { Object.assign(upd, p); broadcast(); buildTrayMenu(); }
function setupUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => setUpd({ state: 'checking', message: '' }));
  autoUpdater.on('update-available', (i) => setUpd({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => setUpd({ state: 'latest' }));
  autoUpdater.on('download-progress', (p) => setUpd({ state: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => {
    setUpd({ state: 'ready', version: i.version, percent: 100 });
    try {
      const n = new Notification({ title: '말랑메모 새 버전 ' + i.version, body: '준비됐어요. 누르면 바로 적용돼요. (나중에 앱을 끌 때 자동으로 적용돼요)', icon: path.join(__dirname, 'tray@2x.png') });
      n.on('click', applyUpdate);
      n.show();
    } catch (e) { /* 알림을 못 띄워도 괜찮음 */ }
  });
  autoUpdater.on('error', (e) => { console.error('업데이트 확인 실패', e && e.message); setUpd({ state: 'error', message: '업데이트를 확인하지 못했어요' }); });
  const check = () => { if (upd.state !== 'downloading' && upd.state !== 'ready') autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 15000);
  setInterval(check, 6 * 60 * 60 * 1000);
}
function checkUpdateNow() {
  if (!autoUpdater || !app.isPackaged) { setUpd({ state: 'latest' }); return; }
  if (upd.state === 'ready') { applyUpdate(); return; }
  autoUpdater.checkForUpdates().catch(() => {});
}
function applyUpdate() {
  if (!autoUpdater || upd.state !== 'ready') return;
  saveNow();
  quitting = true;
  setImmediate(() => autoUpdater.quitAndInstall(true, true));   // 조용히 설치하고 다시 켜기
}
ipcMain.on('update:check', checkUpdateNow);
ipcMain.on('update:apply', applyUpdate);

// ───────────────────────── 계정 · 동기화 ─────────────────────────
// 메모 내용은 비밀번호로 만든 열쇠로 이 PC 안에서 잠근 뒤 서버에 올라갑니다.
let cloudKey = null;              // 잠금 열쇠 (메모리에만)
let syncTimer = null, syncing = false, syncAgain = false;
const cloudRun = { state: 'off', lastSync: 0, message: '' };
const holder = {
  session: null,
  onSession: (s) => { Object.assign(store.cloud, { access: s.access, refresh: s.refresh, exp: s.exp, userId: s.userId }); save(); }
};

function markEvent(k) {
  const prev = store.evMeta[k] || {};
  store.evMeta[k] = { ...prev, mt: Math.max(Date.now(), (prev.mt || 0) + 1), dirty: true };
  scheduleSync();
}

function cloudInfo() {
  return {
    signedIn: !!(store && store.cloud && store.cloud.username && cloudKey),
    username: (store && store.cloud && store.cloud.username) || '',
    state: cloudRun.state, lastSync: cloudRun.lastSync, message: cloudRun.message,
    mobileUrl: MOBILE_URL
  };
}
function setCloud(state, message) {
  cloudRun.state = state;
  if (message != null) cloudRun.message = message;
  if (state === 'ok') { cloudRun.lastSync = Date.now(); cloudRun.message = ''; }
  broadcast();
}

function boxKey(raw) {
  const b64 = Cloud.toB64(raw);
  try {
    if (safeStorage.isEncryptionAvailable()) return { box: safeStorage.encryptString(b64).toString('base64'), type: 'safe' };
  } catch (e) { /* 아래로 */ }
  return { box: b64, type: 'plain' };
}
function unboxKey(c) {
  if (!c || !c.keyBox) return null;
  try {
    const b64 = c.keyType === 'safe' ? safeStorage.decryptString(Buffer.from(c.keyBox, 'base64')) : c.keyBox;
    return Cloud.fromB64(b64);
  } catch (e) { return null; }
}

async function cloudStart() {
  const c = store.cloud;
  if (!c.username || !c.refresh) return;
  const raw = unboxKey(c);
  if (!raw) { setCloud('error', '다시 로그인해 주세요'); return; }
  cloudKey = await Cloud.importKey(raw);
  holder.session = { access: c.access, refresh: c.refresh, exp: c.exp || 0, userId: c.userId };
  setCloud('idle');
  scheduleSync(500);
}

function scheduleSync(delay = 1500) {
  if (!cloudKey || !holder.session) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delay);
}

// 연락망 예전 기본 머리글(직급·휴대폰 포함)이면 두 칸을 빼서 자리 내선 연락망으로
const OLD_CONTACT_HEAD = '부서|이름|직급|내선|휴대폰|이메일';
function fixContactRows(rows) {
  if (!rows || !rows[0] || rows[0].join('|') !== OLD_CONTACT_HEAD) return null;
  return rows.map((r) => r.filter((c, i) => i !== 2 && i !== 4));
}
// 표: { rows: [[머리글], [칸...]] } · 최대 500줄 × 12칸
function sanitizeTable(t) {
  let rows = t && Array.isArray(t.rows) ? t.rows : [];
  rows = rows.slice(0, 500).map((r) => (Array.isArray(r) ? r : []).slice(0, 12).map((c) => String(c == null ? '' : c).slice(0, 1000)));
  if (!rows.length) rows = [['', '', '']];
  const n = Math.max(1, ...rows.map((r) => r.length));
  rows = rows.map((r) => (r.length < n ? r.concat(Array(n - r.length).fill('')) : r));
  if (rows.length < 2) rows.push(Array(n).fill(''));
  return { rows };
}
const sanitizeItems = (a) => (Array.isArray(a) ? a.slice(0, 500).map((x) => ({ t: String((x && x.t) || '').slice(0, 2000), d: !!(x && x.d) })) : []);
const sanitizeEvents = (a) => (Array.isArray(a) ? a.slice(0, 50).map((ev) => ({
  t: String((ev && ev.t) || '').slice(0, 10), title: String((ev && ev.title) || '').slice(0, 200),
  c: ['lav', 'mint', 'pink', 'sky'].includes(ev && ev.c) ? ev.c : 'lav'
})) : []);
function contentOf(d) {
  return {
    title: String(d.title || '').slice(0, 200),
    text: String(d.text || '').slice(0, 200000),
    items: sanitizeItems(d.items),
    type: ['check', 'table'].includes(d.type) ? d.type : 'text',
    table: d.type === 'table' || d.table ? sanitizeTable(d.table) : null,
    mark: ['heart', 'star', 'flag', 'alert', 'check'].includes(d.mark) ? d.mark : null,
    markColor: /^#[0-9a-fA-F]{6}$/.test(d.markColor || '') ? d.markColor : '#E8456B',
    slot: Number.isInteger(d.slot) ? ((d.slot % 5) + 5) % 5 : 0,
    ord: typeof d.ord === 'number' && isFinite(d.ord) ? d.ord : null
  };
}
function payloadOf(m, trashed) {
  const c = {};
  for (const k of CONTENT) c[k] = m[k];
  return { ...c, trashed: !!trashed, deletedAt: trashed ? m.deletedAt : null };
}

let needSecureSave = false;
function applyRemote(item) {
  if (item.kind === 'event') {
    const k = item.id;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
    const incoming = item.deleted ? [] : sanitizeEvents(item.data && item.data.list);
    const meta = store.evMeta[k] || {};
    if (meta.merge) {
      // 처음 로그인할 때: 이 PC 일정과 서버 일정을 합침
      const cur = store.events[k] || [];
      const key = (e) => e.t + '\u0001' + e.title;
      const seen = new Set(cur.map(key));
      const merged = cur.concat(incoming.filter((e) => !seen.has(key(e))));
      if (merged.length) store.events[k] = merged; else delete store.events[k];
      store.evMeta[k] = { mt: Math.max(Date.now(), item.ts + 1), dirty: true };
    } else {
      if (incoming.length) store.events[k] = incoming; else delete store.events[k];
      store.evMeta[k] = { mt: item.ts, dirty: false };
    }
    return;
  }
  if (item.kind === 'contact') {
    if (item.id !== 'main') return;
    const rows = item.deleted ? null : sanitizeTable(item.data).rows;
    const fixed = fixContactRows(rows);
    store.contacts = fixed ? { rows: fixed, mt: item.ts + 1, dirty: true } : rows ? { rows, mt: item.ts, dirty: false } : null;
    return;
  }
  if (item.kind !== 'memo') return;
  const u = item.id;
  const m = store.memos.find((x) => x.uid === u && !x.deleting);
  const t = store.trash.find((x) => x.uid === u);
  if (item.deleted) {
    if (m) { closeMemoWin(m.id); store.memos = store.memos.filter((x) => x !== m); }
    if (t) store.trash = store.trash.filter((x) => x !== t);
    store.tombs = store.tombs.filter((x) => x.uid !== u);
    store.tombs.push({ uid: u, ts: item.ts, done: true });
    needSecureSave = true;
    return;
  }
  const d = item.data || {};
  const c = contentOf(d);
  const meta = { mt: item.ts, dirty: false };
  if (d.trashed) {
    const deletedAt = Number(d.deletedAt) || Date.now();
    if (m) {
      closeMemoWin(m.id);
      store.memos = store.memos.filter((x) => x !== m);
      const { deleting, ox, oy, ...rest } = m;
      store.trash.unshift({ ...rest, ...c, ...meta, folded: false, hidden: false, deletedAt });
    } else if (t) {
      Object.assign(t, c, meta, { deletedAt });
    } else {
      store.trash.unshift({ id: store.nextId++, uid: u, x: null, y: null, w: 260, h: 220, layer: 'normal', hidden: false, folded: false, ...c, ...meta, deletedAt });
    }
    return;
  }
  if (m) {
    Object.assign(m, c, meta);
  } else {
    let n;
    if (t) {
      store.trash = store.trash.filter((x) => x !== t);
      const { deletedAt, ...rest } = t;
      n = { ...rest, ...c, ...meta, hidden: false, deleting: false };
    } else {
      n = { id: store.nextId++, uid: u, x: null, y: null, w: 260, h: 220, layer: 'normal', hidden: false, folded: false, created: Date.now(), ...c, ...meta };
      const lay = store.layoutCache && store.layoutCache[u];
      if (lay) {
        for (const k of ['x', 'y', 'w', 'h', 'folded', 'layer', 'hidden', 'ox', 'oy']) if (lay[k] !== undefined && lay[k] !== null) n[k] = lay[k];
        delete store.layoutCache[u];
      }
    }
    store.memos.push(n);
    ensurePos(n);
    openMemoWin(n);
  }
}

function localTs(kind, id) {
  if (kind === 'event') return (store.evMeta[id] && !store.evMeta[id].merge && store.evMeta[id].mt) || 0;
  if (kind === 'contact') return (store.contacts && store.contacts.mt) || 0;
  const m = store.memos.find((x) => x.uid === id) || store.trash.find((x) => x.uid === id);
  if (m) return m.mt || 0;
  const tomb = store.tombs.find((x) => x.uid === id);
  return tomb ? tomb.ts : 0;
}

function dirtyList() {
  const out = [];
  for (const m of store.memos) if (m.dirty && !m.deleting && m.uid) out.push({ kind: 'memo', id: m.uid, ts: m.mt, data: payloadOf(m, false) });
  for (const t of store.trash) if (t.dirty && t.uid) out.push({ kind: 'memo', id: t.uid, ts: t.mt, data: payloadOf(t, true) });
  for (const tb of store.tombs) if (!tb.done) out.push({ kind: 'memo', id: tb.uid, ts: tb.ts, deleted: true });
  for (const [k, meta] of Object.entries(store.evMeta)) {
    if (meta && meta.dirty && !meta.merge) out.push({ kind: 'event', id: k, ts: meta.mt, data: { list: store.events[k] || [] } });
  }
  if (store.contacts && store.contacts.dirty) out.push({ kind: 'contact', id: 'main', ts: store.contacts.mt, data: { rows: store.contacts.rows } });
  return out;
}

function markPushed(kind, id, ts) {
  if (kind === 'contact') { if (store.contacts && store.contacts.mt === ts) store.contacts.dirty = false; return; }
  if (kind === 'event') {
    const meta = store.evMeta[id];
    if (meta && meta.mt === ts) meta.dirty = false;
    return;
  }
  const m = store.memos.find((x) => x.uid === id) || store.trash.find((x) => x.uid === id);
  if (m && m.mt === ts) m.dirty = false;
  for (const tb of store.tombs) if (tb.uid === id && tb.ts === ts) tb.done = true;
}

async function runSync() {
  if (!cloudKey || !holder.session) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  setCloud('syncing');
  try {
    needSecureSave = false;
    const r = await Cloud.syncOnce({
      holder, key: cloudKey, cursor: store.cloud.cursor,
      localTs, apply: applyRemote, dirty: dirtyList, pushed: markPushed
    });
    // 처음 로그인 때 합치기 표시 정리
    for (const meta of Object.values(store.evMeta)) if (meta && meta.merge) { meta.merge = false; meta.dirty = true; meta.mt = Date.now(); syncAgain = true; }
    store.cloud.cursor = r.cursor || store.cloud.cursor;
    // 오래된 지움 표시 정리 (30일)
    store.tombs = store.tombs.filter((x) => !x.done || x.ts > Date.now() - 30 * DAY);
    if (needSecureSave) saveSecure(); else save();
    setCloud('ok');
  } catch (e) {
    console.error('동기화 실패', e && e.code);
    if (e && (e.code === 'session_expired' || e.code === 'signed_out')) {
      cloudLogout(true);
      setCloud('error', Cloud.message(e));
    } else {
      setCloud('error', Cloud.message(e));
    }
  } finally {
    syncing = false;
    broadcast();
    if (syncAgain) { syncAgain = false; scheduleSync(800); }
  }
}

async function cloudSignIn(mode, username, password) {
  username = Cloud.normUser(username);
  if (!Cloud.validUser(username)) return { error: Cloud.message({ code: 'invalid_username' }) };
  if (typeof password !== 'string' || password.length < 8) return { error: '비밀번호는 8자 이상으로 정해 주세요' };
  try {
    const k = await Cloud.deriveKeys(username, password);
    if (mode === 'signup') await Cloud.signup(username, k.secret);
    const session = await Cloud.login(username, k.secret);
    const box = boxKey(k.keyRaw);
    store.cloud = { username, access: session.access, refresh: session.refresh, exp: session.exp, userId: session.userId, keyBox: box.box, keyType: box.type, cursor: null };
    holder.session = session;
    cloudKey = await Cloud.importKey(k.keyRaw);
    // 이 PC 메모를 모두 올리고, 일정은 서버 것과 합침
    for (const m of [...store.memos, ...store.trash]) m.dirty = true;
    for (const tb of store.tombs) tb.done = false;
    for (const k2 of Object.keys(store.events)) store.evMeta[k2] = { mt: 0, dirty: true, merge: true };
    if (store.contacts) store.contacts.dirty = true;
    save();
    setCloud('idle');
    scheduleSync(100);
    return { ok: true };
  } catch (e) {
    return { error: Cloud.message(e) };
  }
}

// 진행 중인 맞추기가 끝날 때까지 기다린 뒤 한 번 더 맞춤
async function syncAndWait() {
  for (let i = 0; i < 100 && syncing; i++) await new Promise((r) => setTimeout(r, 100));
  clearTimeout(syncTimer);
  await runSync();
  for (let i = 0; i < 100 && syncing; i++) await new Promise((r) => setTimeout(r, 100));
}

// 로그아웃: 서버에 다 올린 뒤 이 PC에서 메모·일정을 지움 (다시 로그인하면 서버에서 돌아옴)
// 메모 자리·크기·접힘 같은 배치 정보만 남겨 두어, 돌아올 때 원래 자리에 나타남 (내용은 남기지 않음)
async function cloudSignOut(force) {
  if (cloudKey && holder.session) {
    try { await syncAndWait(); } catch (e) { /* 아래에서 남은 개수로 판단 */ }
  }
  const left = cloudKey ? dirtyList().length : 0;
  if (left && !force) return { unsynced: left };
  store.layoutCache = store.layoutCache || {};
  for (const m of store.memos) {
    if (!m.uid || m.deleting) continue;
    store.layoutCache[m.uid] = { x: m.x, y: m.y, w: m.w, h: m.h, folded: !!m.folded, layer: m.layer, hidden: !!m.hidden, ox: m.ox, oy: m.oy };
  }
  for (const m of store.memos) closeMemoWin(m.id);
  store.memos = [];
  store.trash = [];
  store.tombs = [];
  store.events = {};
  store.evMeta = {};
  store.contacts = null;
  cloudLogout(true);
  saveSecure();
  broadcast();
  return { ok: true };
}

function cloudLogout(keepName) {
  clearTimeout(syncTimer);
  const name = store.cloud.username;
  store.cloud = keepName ? { username: name } : {};
  holder.session = null;
  cloudKey = null;
  cloudRun.state = 'off';
  cloudRun.message = '';
  save();
  broadcast();
}

ipcMain.handle('cloud:signin', (e, mode, username, password) => cloudSignIn(mode === 'signup' ? 'signup' : 'login', username, password));
ipcMain.handle('cloud:logout', (e, force) => cloudSignOut(!!force));
ipcMain.on('cloud:sync', () => scheduleSync(0));
ipcMain.on('cloud:copyUrl', () => clipboard.writeText(MOBILE_URL));
ipcMain.on('cloud:openUrl', () => shell.openExternal(MOBILE_URL));

// ───────────────────────── 시작 / 종료 ─────────────────────────
app.on('second-instance', openSide);

app.whenReady().then(() => {
  load();
  if (isWin) {
    try { store.settings.autoStart = app.getLoginItemSettings().openAtLogin; } catch (e) { /* 무시 */ }
  }
  autoPurge();
  setInterval(autoPurge, 60 * 60 * 1000);
  cloudStart().catch((e) => console.error(e));
  setupUpdater();
  setInterval(() => scheduleSync(0), 20000);
  powerMonitor.on('resume', () => scheduleSync(2000));
  powerMonitor.on('unlock-screen', () => scheduleSync(1000));
  createHost();
  createSide();
  createTray();
  globalShortcut.register('CommandOrControl+Alt+N', () => createMemo());
  try {
    globalShortcut.register('CommandOrControl+Alt+Down', () => unfoldAll());   // 모두 펴기
    globalShortcut.register('CommandOrControl+Alt+Up', () => foldAll());       // 모두 접기
    globalShortcut.register('CommandOrControl+Alt+F', () => toggleSearch());
  } catch (e) { console.error('단축키 등록 실패', e); }
  screen.on('display-metrics-changed', placeSide);
  screen.on('display-added', placeSide);
  screen.on('display-removed', placeSide);
  // 개발용 점검 스크립트 (일반 실행에서는 동작하지 않음)
  if (process.env.MALLANG_DEBUG_SCRIPT) {
    try {
      require(process.env.MALLANG_DEBUG_SCRIPT)({ store, side: () => side, memoWins, createMemo, updateMemo, foldAll, unfoldAll, updateSettings, ipcMain, deleteMemo, restoreMemo, purgeMemos, encryptBackup, decryptBackup, dataFile: () => dataFile, cloudSignIn, cloudSignOut, runSync, Cloud, cloudInfo });
    } catch (e) { console.error(e); }
  }
});

app.on('window-all-closed', () => { /* 트레이에 남아 계속 실행 */ });
app.on('before-quit', () => { quitting = true; saveNow(); });
app.on('will-quit', () => globalShortcut.unregisterAll());
