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
// 접은 메모 크기 (%) : 메모마다 정한 값(fs) → 없으면 전체 설정(foldScale)
const clampFs = (v) => Math.min(250, Math.max(50, Math.round(Number(v) || 100)));   // 접은 메모 가로 길이 %
const foldScale = (m) => clampFs((m && m.fs) || (store && store.settings && store.settings.foldScale) || 100);
const foldW = (m) => Math.round(FOLD_W * foldScale(m) / 100);
const foldH = () => FOLD_H;   // 높이는 그대로, 가로만 조절
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
    settings: { skin: 'lav', font: 'gowun', fontScale: 100, titleScale: 100, titleBold: true, calFont: 'same', calScale: 100, peopleFont: 'same', peopleScale: 100, bodyBg: false, alpha: 60, sideAlpha: 55, showToday: true, showPeople: false, clockMode: 30, clockAlpha: 75, clockScale: 100, clockDark: false, foldScale: 100, noticeOn: true, pinned: false, autoStart: false },
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
    groups: [],
    shared: {},
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
  store.shared = store.shared && typeof store.shared === 'object' ? store.shared : {};
  if (!store.installedAt) store.installedAt = Date.now();
  store.openGroups = store.openGroups && typeof store.openGroups === 'object' ? store.openGroups : {};   // 목록바에서 열어 둔 그룹 폴더 (기본은 닫힘)
  store.layoutSync = store.layoutSync && typeof store.layoutSync === 'object' ? store.layoutSync : { mt: 0, dirty: false };
  if (store.shared.contacts && !Array.isArray(store.shared.contacts)) delete store.shared.contacts;
  store.groups = Array.isArray(store.groups) ? store.groups.filter((g) => g && typeof g.id === 'string').map((g) => ({ id: g.id, name: String(g.name || '그룹').slice(0, 40), color: Number(g.color) || 0 })) : [];
  { const gids = new Set(store.groups.map((g) => g.id)); for (const m of store.memos) if (m.group && !gids.has(m.group)) delete m.group; }
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
    contacts: store.shared.contacts || (store.contacts ? store.contacts.rows : null),
    contactsShared: !!store.shared.contacts,
    notices: store.shared.notices || [],
    isAdmin: !!(store.cloud && store.cloud.admin),                         // 회사 공통 연락망
    canEditContacts: !store.shared.contacts || !!store.cloud.admin,   // 공통 연락망은 관리자만 고침
    groups: store.groups,
    openGroups: store.openGroups,
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
  const w = m.folded ? foldW(m) : m.w;
  const h = m.folded ? foldH(m) : m.h;
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
  const w = m.folded ? foldW(m) : m.w;
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
    if (kind === 'notice') {
      const detail = u.searchParams.get('view') === '1';
      return { action: 'allow', overrideBrowserWindowOptions: { ...baseWinOpts, ...(detail ? noticeDetailBounds() : noticeToastBounds()), alwaysOnTop: true } };
    }
    if (kind === 'clock') {
      return { action: 'allow', overrideBrowserWindowOptions: { ...baseWinOpts, ...clockBounds(), alwaysOnTop: true, focusable: false } };
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
    if (kind === 'clock') setupClock(win, u.searchParams.get('mode'));
    if (kind === 'notice') setupNotice(win, u.searchParams.get('view') === '1');
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

const ALLOWED = ['title', 'text', 'items', 'table', 'type', 'layer', 'hidden', 'folded', 'mark', 'markColor', 'slot', 'ord', 'clip', 'group', 'fs'];  // group: 이 PC에서 묶은 그룹  // clip: 드래그해 둔 부분 (이 PC에만)
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
  if ('group' in patch && (!patch.group || !store.groups.some((g) => g.id === patch.group))) delete m.group;
  if (m.group && m.group !== prev.group && !applyingLayout) stackIntoGroup(m);
  if (m.layer !== 'top' && m.layer !== 'bottom') m.layer = 'normal';
  m.updated = Date.now();
  if (CONTENT.some((k) => k in patch && JSON.stringify(prev[k]) !== JSON.stringify(m[k]))) touch(m);
  if (['layer', 'hidden', 'folded', 'group', 'x', 'y'].some((k) => prev[k] !== m[k])) layoutTouched(m);

  // 접힌 메모를 펼 때 예전 '모두 접어 정리' 이전 자리로 돌아가기
  let restored = false;
  if ('folded' in patch && prev.folded && !m.folded && m.ox != null) {
    m.x = m.ox; m.y = m.oy; delete m.ox; delete m.oy; restored = true;
  }
  // 화면 오른쪽에 있는 메모는 오른쪽 끝을 그대로 두고 왼쪽으로 펼쳐요 (옆 모니터로 넘어가지 않게)
  if (!!m.folded !== !!prev.folded && !restored && m.x != null && !applyingLayout) {
    anchorFold(m, !!m.folded);
  }
  // 접은 크기를 바꾸면: 화면 오른쪽·아래쪽 메모는 그쪽 끝을 그대로 두고 크기만 바뀌게
  let fsMoved = false;
  if ('fs' in patch) {
    if (m.fs != null) m.fs = clampFs(m.fs); else delete m.fs;
    if (m.folded && foldScale(prev) !== foldScale(m) && m.x != null) { keepEdges(m, foldW(prev), foldH(prev), foldW(m), foldH(m)); fsMoved = true; }
    layoutTouched(m);
  }
  save();
  broadcast();

  const win = memoWins.get(id);
  if (m.layer !== prev.layer) applyLayer(id);
  if (m.hidden !== prev.hidden) {
    if (m.hidden) closeMemoWin(id);
    else { focusOnOpen.add(id); openMemoWin(m); }
  }
  if (fsMoved && win && !win.isDestroyed()) setB(win, boundsFor(m));
  if (m.folded !== prev.folded && win && !win.isDestroyed()) {
    if (m.folded) {
      // 내용이 먼저 접히고 나서 창 크기 맞추기
      setTimeout(() => { const mm = getMemo(id); if (mm && mm.folded) setB(win, boundsFor(mm)); }, 320);
    } else {
      const moved = prev.x !== m.x || prev.y !== m.y;
      if ((m.ar || m.ab) && !restored) {
        setB(win, boundsFor(m));   // 오른쪽·아래 기준: 창은 바로 펼친 자리로, 메모는 오른쪽에서 왼쪽으로 커짐
      } else if (moved) {
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
    id, slot: opts.slot != null ? opts.slot : (near ? near.slot : (id - 1) % 5),
    x: near ? near.x + 34 : null, y: near ? near.y + 34 : null,
    w: near && opts.text ? near.w : 260, h: 220, type: 'text',
    title: typeof opts.title === 'string' ? opts.title.slice(0, 200) : '새 메모',
    text: typeof opts.text === 'string' ? opts.text.slice(0, 200000) : '', items: [],
    layer: 'normal', hidden: false, folded: false, mark: null, markColor: '#E8456B', created: Date.now(),
    uid: Cloud.uid(), mt: Date.now(), dirty: true, lt: Date.now()
  };
  markLayout();
  // 분리해서 만든 메모: 원래 메모로 되돌릴 수 있게 기억 (이 PC에만)
  if (opts.splitFrom && typeof opts.splitFrom.uid === 'string') {
    m.splitFrom = { uid: opts.splitFrom.uid, part: typeof opts.text === 'string' ? opts.text : '', before: String(opts.splitFrom.before || '').slice(0, 200000), after: String(opts.splitFrom.after || '').slice(0, 200000) };
  }
  // 같은 그룹의 메모에서 만들면 그 그룹에 넣기
  const grp = opts.group !== undefined ? opts.group : (near && near.group);
  if (grp && store.groups.some((g) => g.id === grp)) m.group = grp;
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

// 접기·펴기 기준 정하기: 화면 오른쪽 절반이면 오른쪽 끝 기준
// 화면 아래쪽 절반이면 아래 끝 기준 → 위로 펼쳐짐 (오른쪽 아래면 왼쪽 위 대각선으로)
function anchorFold(m, folding) {
  if (m.x == null) return;
  const fromW = folding ? m.w : foldW(m), toW = folding ? foldW(m) : m.w;
  const fromH = folding ? m.h : foldH(m), toH = folding ? foldH(m) : m.h;
  const d = screen.getDisplayMatching({ x: Math.round(m.x), y: Math.round(m.y), width: Math.round(fromW), height: Math.round(fromH) }).workArea;
  m.ar = m.x + fromW / 2 > d.x + d.width / 2;
  m.ab = m.y + fromH / 2 > d.y + d.height / 2;
  if (m.ar) m.x = Math.max(d.x, m.x + fromW - toW);
  if (m.ab) m.y = Math.max(d.y, m.y + fromH - toH);
}
// 크기만 바뀔 때 화면 오른쪽·아래쪽이면 그쪽 끝 고정
function keepEdges(m, fromW, fromH, toW, toH) {
  const d = screen.getDisplayMatching({ x: Math.round(m.x), y: Math.round(m.y), width: Math.round(fromW), height: Math.round(fromH) }).workArea;
  if (m.x + fromW / 2 > d.x + d.width / 2) m.x = Math.max(d.x, m.x + fromW - toW);
  if (m.y + fromH / 2 > d.y + d.height / 2) m.y = Math.max(d.y, m.y + fromH - toH);
}
// 모두 접기: 지금 자리 그대로 접기만 (배치는 바꾸지 않음)
function foldAll() {
  if (peopleWin && !peopleWin.isDestroyed()) setPeopleFolded(true);
  const list = store.memos.filter((m) => !m.hidden && !m.deleting && !m.folded);
  if (!list.length) return;
  for (const m of list) { anchorFold(m, true); m.folded = true; }
  layoutTouched(null, list);
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
    if (m.ox == null) anchorFold(m, false);
    m.folded = false;
    if (m.ox != null) { m.x = m.ox; m.y = m.oy; }
    delete m.ox; delete m.oy;
  }
  layoutTouched(null, list);
  save();
  broadcast();
  for (const m of list) {
    const win = memoWins.get(m.id);
    if (!win || win.isDestroyed()) continue;
    const b = boundsFor(m);
    if (m.ar || m.ab) { setB(win, b); continue; }   // 오른쪽·아래 기준 메모는 왼쪽·위로 펼침
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

// ───────────────────────── 말랑이 시계 알림 (정각·30분) ─────────────────────────
let clockWin = null, clockTimer = null, clockLast = '', clockMode = null;
const CLOCK_W = 250, CLOCK_H = 96;

function clockBounds() {
  const s = (store.settings.clockScale || 100) / 100;
  const w = Math.round(CLOCK_W * s) + 2 * P + 20, h = Math.round(CLOCK_H * s) + 2 * P + 40;
  const wa = workArea();
  const p = store.clockPos || { x: wa.x + wa.width / 2, y: wa.y + 110 };
  // 화면 밖이면 기본 자리로
  const d = screen.getDisplayNearestPoint({ x: Math.round(p.x), y: Math.round(p.y) }).workArea;
  // 시계 판 기준으로 화면 안에 (창 여백은 화면 밖이어도 괜찮음)
  const ii = cleanInset(store.clockInset) || { l: (w - Math.round(CLOCK_W * s * 0.9)) / 2, t: (h - Math.round(CLOCK_H * s * 0.75)) / 2, w: Math.round(CLOCK_W * s * 0.9), h: Math.round(CLOCK_H * s * 0.75) };
  const q = { x: Math.min(d.x + d.width - ii.w, Math.max(d.x, p.x - w / 2 + ii.l)) - ii.l, y: Math.min(d.y + d.height - ii.h, Math.max(d.y, p.y - h / 2 + ii.t)) - ii.t };
  return { x: Math.round(q.x), y: Math.round(q.y), width: w, height: h };
}
function showClock(mode) {
  if (clockWin && !clockWin.isDestroyed()) {
    clockWin.setBounds(clockBounds());
    clockWin.webContents.send('cmd', { type: 'clock', mode });
    return;
  }
  hostOpen('clock.html?kind=clock&mode=' + mode, 'clock-' + Date.now());
}
function setupClock(win, mode) {
  clockWin = win;
  clockMode = mode;
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces && win.setVisibleOnAllWorkspaces(true);
  if (mode !== 'place') win.setIgnoreMouseEvents(true);   // 클릭은 아래 창으로 그대로
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.showInactive(); });
  win.on('closed', () => { if (clockWin === win) clockWin = null; });
}
function closeClock() { if (clockWin && !clockWin.isDestroyed()) clockWin.close(); clockWin = null; }
ipcMain.on('clock:done', () => { if (clockMode !== 'place') closeClock(); });
// 시계 판이 화면 끝 가까이 오면 끝에 딱 붙이기 (창의 투명 여백은 화면 밖으로 나가도 됨)
const CLOCK_SNAP = 22;
function cleanInset(i) {
  if (!i || typeof i !== 'object') return null;
  const o = {};
  for (const k of ['l', 't', 'w', 'h']) { const v = num(i[k]); if (v == null || v < 0 || v > 2000) return null; o[k] = Math.round(v); }
  return o.w > 0 && o.h > 0 ? o : null;
}
function snapClock(x, y, i) {
  if (!i) return { x, y };
  let px = x + i.l, py = y + i.t;
  const d = screen.getDisplayNearestPoint({ x: Math.round(px + i.w / 2), y: Math.round(py + i.h / 2) }).workArea;
  const R = d.x + d.width - i.w, B = d.y + d.height - i.h;
  if (Math.abs(px - d.x) < CLOCK_SNAP) px = d.x; else if (Math.abs(px - R) < CLOCK_SNAP) px = R;
  if (Math.abs(py - d.y) < CLOCK_SNAP) py = d.y; else if (Math.abs(py - B) < CLOCK_SNAP) py = B;
  px = Math.min(R, Math.max(d.x, px)); py = Math.min(B, Math.max(d.y, py));
  return { x: px - i.l, y: py - i.t };
}
ipcMain.on('clock:move', (e, x, y, done, inset) => {
  x = num(x); y = num(y);
  if (!clockWin || clockWin.isDestroyed() || x == null || y == null) return;
  const i = cleanInset(inset);
  if (i) store.clockInset = i;
  const p = snapClock(x, y, i);
  const b = clockWin.getBounds();
  clockWin.setBounds({ x: Math.round(p.x), y: Math.round(p.y), width: b.width, height: b.height });
  if (done) { store.clockPos = { x: Math.round(p.x + b.width / 2), y: Math.round(p.y + b.height / 2) }; save(); }
});
ipcMain.on('clock:place', (e, on) => {
  closeClock();
  if (on) setTimeout(() => showClock('place'), 120);
});
ipcMain.on('clock:preview', () => { closeClock(); setTimeout(() => showClock('show'), 120); });
function tickClock() {
  const mode = store.settings.clockMode;
  if (!mode) return;
  const d = new Date(), m = d.getMinutes();
  if (d.getSeconds() > 40) return;
  if (!(m === 0 || (mode === 30 && m === 30))) return;
  const key = d.toDateString() + ' ' + d.getHours() + ':' + m;
  if (clockLast === key) return;
  clockLast = key;
  if (clockWin && clockMode === 'place') return;   // 위치를 고르는 중엔 건너뜀
  closeClock();
  showClock('show');
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
ipcMain.on('search:open', (e, id, q) => {
  closeSearch();
  const m = getMemo(id);
  if (!m) return;
  const wasHidden = m.hidden;
  if (m.folded) updateMemo(id, { folded: false });
  setTimeout(() => focusMemo(id), wasHidden ? 0 : 60);
  // 찾은 글자를 메모 안에서 바로 보여주기 (창이 새로 열리면 조금 늦게)
  if (typeof q === 'string' && q.trim()) {
    const send = () => { const w = memoWins.get(id); if (w && !w.isDestroyed()) w.webContents.send('cmd', { type: 'find', q: q.trim().slice(0, 100) }); };
    setTimeout(send, 450);
    if (wasHidden) setTimeout(send, 1400);
  }
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
  if ('peopleFont' in patch && typeof patch.peopleFont !== 'string') delete patch.peopleFont;
  if ('peopleScale' in patch) patch.peopleScale = Math.min(160, Math.max(70, Number(patch.peopleScale) || 100));
  if ('bodyBg' in patch) patch.bodyBg = !!patch.bodyBg;
  if ('titleBold' in patch) patch.titleBold = !!patch.titleBold;
  if ('titleScale' in patch) patch.titleScale = Math.min(170, Math.max(70, Number(patch.titleScale) || 100));
  const keys = ['skin', 'font', 'fontScale', 'titleScale', 'titleBold', 'calFont', 'calScale', 'peopleFont', 'peopleScale', 'bodyBg', 'alpha', 'sideAlpha', 'showToday', 'showPeople', 'clockMode', 'clockAlpha', 'clockScale', 'clockDark', 'foldScale', 'noticeOn', 'pinned', 'autoStart'];
  if ('noticeOn' in patch) patch.noticeOn = !!patch.noticeOn;
  if ('foldScale' in patch) patch.foldScale = clampFs(patch.foldScale);
  if ('clockMode' in patch) patch.clockMode = [0, 30, 60].includes(Number(patch.clockMode)) ? Number(patch.clockMode) : 30;
  if ('clockAlpha' in patch) patch.clockAlpha = Math.min(100, Math.max(20, Number(patch.clockAlpha) || 75));
  if ('clockScale' in patch) patch.clockScale = Math.min(150, Math.max(70, Number(patch.clockScale) || 100));
  if ('clockDark' in patch) patch.clockDark = !!patch.clockDark;
  if ('fontScale' in patch) patch.fontScale = Math.min(170, Math.max(70, Number(patch.fontScale) || 100));
  const oldFold = new Map(store.memos.filter((m) => m.folded && m.fs == null && m.x != null && !m.hidden && !m.deleting).map((m) => [m, [foldW(m), foldH(m)]]));
  for (const k of keys) if (k in patch) store.settings[k] = patch[k];
  const s = store.settings;
  if (s.foldScale !== prev.foldScale) {
    // 전체 접은 크기 바뀜 → 접힌 메모 창 크기 맞추기
    for (const [m, [w0, h0]] of oldFold) {
      keepEdges(m, w0, h0, foldW(m), foldH(m));
      const win = memoWins.get(m.id);
      if (win && !win.isDestroyed()) setB(win, boundsFor(m));
    }
  }
  if (!applyingLayout && SYNC_SETTINGS.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(s[k]))) { store.layoutSync.settingsT = Date.now(); markLayout(); }
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
const GAP = 0;     // 붙었을 때 메모 사이 간격 (메모잇·에스메모처럼 딱 붙게)
function snapPos(m, x, y, skip) {
  const w = m.folded ? foldW(m) : m.w;
  const h = m.folded ? foldH(m) : m.h;
  const disp = screen.getDisplayMatching({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }).workArea;
  const others = store.memos.filter((o) => o.id !== m.id && !o.hidden && !o.deleting && o.x != null && !(skip && skip.has(o))).map((o) => ({
    x: o.x, y: o.y, w: o.folded ? foldW(o) : o.w, h: o.folded ? foldH(o) : o.h
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
  const mates = m.group ? store.memos.filter((o) => o !== m && o.group === m.group && !o.hidden && !o.deleting && o.x != null) : [];
  const sp = snapPos(m, x + P, y + P, new Set(mates));
  win.setPosition(Math.round(sp.x - P), Math.round(sp.y - P));
  const dx = Math.round(sp.x) - m.x, dy = Math.round(sp.y) - m.y;
  m.x = Math.round(sp.x);
  m.y = Math.round(sp.y);
  // 같은 그룹 메모는 함께 이동
  for (const o of mates) {
    o.x += dx; o.y += dy;
    const ow = memoWins.get(o.id);
    if (ow && !ow.isDestroyed() && (dx || dy)) ow.setPosition(Math.round(o.x - P), Math.round(o.y - P));
    if (done) { delete o.ox; delete o.oy; }
  }
  if (done) {
    delete m.ox; delete m.oy;   // 직접 옮긴 자리를 기억
    layoutTouched(m, mates);
    save();
    broadcast();
  }
});
// 그룹에 넣으면 그 그룹 메모들 맨 아래에 이어 붙이기 (멀리 떨어져 있어도 한데 모이게)
function stackIntoGroup(m) {
  const mates = store.memos.filter((o) => o !== m && o.group === m.group && !o.hidden && !o.deleting && o.x != null);
  if (!mates.length || m.x == null) return;
  const left = mates.reduce((a, o) => (o.y < a.y || (o.y === a.y && o.x < a.x) ? o : a), mates[0]);   // 맨 위 메모 줄에 맞춤
  const bottom = Math.max(...mates.filter((o) => Math.abs(o.x - left.x) < 40).map((o) => o.y + (o.folded ? foldH(o) : o.h)));
  m.x = left.x;
  m.y = bottom + GAP;
  // 화면 아래로 넘치면 옆 줄 맨 위로
  const wa = screen.getDisplayMatching({ x: Math.round(left.x), y: Math.round(left.y), width: 10, height: 10 }).workArea;
  const h = m.folded ? foldH(m) : m.h;
  if (m.y + h > wa.y + wa.height) {
    const colW = Math.max(...mates.filter((o) => Math.abs(o.x - left.x) < 40).map((o) => (o.folded ? foldW(o) : o.w)));
    m.x = left.x + colW + GAP;
    m.y = left.y;
  }
  delete m.ox; delete m.oy;
  const win = memoWins.get(m.id);
  if (win && !win.isDestroyed()) animateTo(win, boundsFor(m), 380);
}
// ───────── 그룹: 이 PC에서 메모를 묶어 함께 옮기고, 함께 숨기고, 함께 접기 ─────────
const GROUP_COLORS = 6;
ipcMain.handle('group:create', (e, name, memoId) => {
  const used = new Set(store.groups.map((g) => g.color));
  let color = 0; while (used.has(color) && color < GROUP_COLORS) color++;
  const g = { id: 'g' + Cloud.uid().replace(/-/g, '').slice(0, 10), name: String(name || '').trim().slice(0, 40) || '새 그룹 ' + (store.groups.length + 1), color: color % GROUP_COLORS };
  store.groups.push(g);
  const m = memoId != null ? getMemo(memoId) : null;
  if (m) m.group = g.id;
  groupsTouched(); save(); broadcast();
  return g.id;
});
ipcMain.on('group:open', (e, gid, open) => {
  if (typeof gid !== 'string') return;
  if (open) store.openGroups[gid] = true; else delete store.openGroups[gid];
  save(); broadcast();
});
ipcMain.on('group:rename', (e, gid, name) => {
  const g = store.groups.find((x) => x.id === gid);
  if (!g || typeof name !== 'string' || !name.trim()) return;
  g.name = name.trim().slice(0, 40);
  groupsTouched(); save(); broadcast();
});
ipcMain.on('group:remove', (e, gid) => {
  store.groups = store.groups.filter((x) => x.id !== gid);
  for (const m of [...store.memos, ...store.trash]) if (m.group === gid) delete m.group;
  groupsTouched(); save(); broadcast();
});
ipcMain.on('group:hide', (e, gid, hidden) => {
  for (const m of store.memos.filter((x) => x.group === gid && !x.deleting && !!x.hidden !== !!hidden)) updateMemo(m.id, { hidden: !!hidden });
});
ipcMain.on('group:fold', (e, gid, folded) => {
  for (const m of store.memos.filter((x) => x.group === gid && !x.deleting && !x.hidden && !!x.folded !== !!folded)) updateMemo(m.id, { folded: !!folded });
});
// 접힌 메모 옆 끝을 끌어서 가로 길이 조절 (left: 왼쪽 끝을 끄는 중 → 오른쪽 끝 고정)
ipcMain.on('memo:foldResize', (e, id, w, left, done) => {
  const m = getMemo(id);
  const win = memoWins.get(id);
  w = num(w);
  if (!m || !win || win.isDestroyed() || w == null || !m.folded || m.x == null) return;
  const right = m.x + foldW(m);
  m.fs = clampFs(w / FOLD_W * 100);
  if (left) m.x = right - foldW(m);
  setB(win, boundsFor(m));
  if (done) { layoutTouched(m); save(); broadcast(); }
});
ipcMain.on('memo:resize', (e, id, w, h, done) => {
  const m = getMemo(id);
  const win = memoWins.get(id);
  w = num(w); h = num(h);
  if (!m || !win || win.isDestroyed() || w == null || h == null || m.folded) return;
  m.w = Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));
  m.h = Math.round(Math.min(MAX_H, Math.max(MIN_H, h)));
  setB(win, boundsFor(m));
  if (done) { layoutTouched(m); save(); broadcast(); }
});
ipcMain.on('settings:update', (e, patch) => { if (patch && typeof patch === 'object') updateSettings(patch); });
// 반복 일정에서 이 날만 빼기
ipcMain.on('events:skip', (e, srcKey, idx, dayKey) => {
  const list = store.events[srcKey];
  const ev = list && list[idx];
  if (!ev || !ev.r || typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
  ev.x = Array.isArray(ev.x) ? ev.x : [];
  if (!ev.x.includes(dayKey)) ev.x.push(dayKey);
  markEvent(srcKey);
  save();
  broadcast();
});
ipcMain.on('events:set', (e, key, list) => {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(list)) return;
  const clean = sanitizeEvents(list);
  if (clean.length) store.events[key] = clean; else delete store.events[key];
  markEvent(key);
  save();
  broadcast();
});
ipcMain.on('contacts:set', (e, rows) => {
  if (!Array.isArray(rows)) return;
  const clean = sanitizeTable({ rows }).rows;
  if (store.shared.contacts) {
    // 공통 연락망: 관리자만 고칠 수 있고, 고치면 모두에게 올라감
    if (!store.cloud.admin) return;
    if (JSON.stringify(store.shared.contacts) === JSON.stringify(clean)) return;
    store.shared.contacts = clean;
    store.shared.dirty = true;
    save(); broadcast(); scheduleSync(600);
    return;
  }
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
// 따로 정한 접은 크기 모두 지우고 전체 설정 따르기
ipcMain.on('fold:resetAll', () => { for (const m of store.memos.filter((x) => x.fs && !x.deleting)) updateMemo(m.id, { fs: null }); });
// 메모 속 링크 열기 (웹 주소만)
ipcMain.on('link:open', (e, raw) => {
  let u = String(raw || '').trim().slice(0, 2000);
  if (/^www\./i.test(u)) u = 'https://' + u;
  try { const p = new URL(u); if (p.protocol === 'http:' || p.protocol === 'https:') shell.openExternal(p.href); } catch (err) { /* 잘못된 주소 */ }
});
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

// ───────── 메모잇 백업 가져오기 (SQLite 파일) ─────────
const FILETIME_EPOCH = 11644473600000;   // 1601-01-01 ~ 1970-01-01 (ms)
const fromFiletime = (v) => { const n = Number(v); return n > 1e16 ? Math.round(n / 10000 - FILETIME_EPOCH) : null; };   // BigInt도 받음
function slotFromColorref(c) {
  // 메모잇 색(COLORREF: 0x00BBGGRR) → 말랑메모 메모 색 5가지 중 가까운 것
  c = Number(c || 0) >>> 0;
  const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 18) return 0;                     // 흰색·회색 계열
  let h;
  if (mx === r) h = ((g - b) / (mx - mn)) * 60; else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60; else h = (4 + (r - g) / (mx - mn)) * 60;
  if (h < 0) h += 360;
  if (h >= 30 && h < 75) return 0;                // 노랑·주황
  if (h >= 75 && h < 190) return 1;               // 초록·민트
  if (h >= 190 && h < 255) return 3;              // 파랑
  if (h >= 255 && h < 320) return 4;              // 보라
  return 2;                                       // 빨강·분홍
}
ipcMain.handle('import:memoit', async (e) => {
  const parent = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(parent, {
    title: '메모잇 백업 파일 고르기',
    defaultPath: app.getPath('documents'),
    properties: ['openFile'],
    filters: [{ name: '메모잇 백업 (memodb...)', extensions: ['*'] }]
  });
  if (r.canceled || !r.filePaths || !r.filePaths[0]) return { canceled: true };
  let db;
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(r.filePaths[0], { readOnly: true });
    db.prepare('select count(*) n from memo').get();
  } catch (err) {
    try { if (db) db.close(); } catch (e2) { /* 무시 */ }
    return { error: '메모잇 백업 파일이 아니에요. 메모잇에서 백업한 memodb 파일을 골라 주세요' };
  }
  try {
    const cols = new Set(db.prepare('pragma table_info(memo)').all().map((c) => c.name));
    const has = (c) => cols.has(c);
    const q = (sql) => { const st = db.prepare(sql); st.setReadBigInts(true); return st.all(); };   // 메모잇 시간 값이 커서 BigInt로 읽음
    const rows = q('select * from memo' + (has('is_deleted') ? ' where coalesce(is_deleted, 0) = 0' : '') + ' order by _id');
    const sig = (m) => (m.title || '') + '\u0001' + (m.text || '');
    const have = new Set(store.memos.map(sig));
    let added = 0, skipped = 0;
    const ords = store.memos.map((x) => x.ord).filter((v) => typeof v === 'number');
    let ord = ords.length ? Math.min(...ords) : null;
    for (const row of rows) {
      const text = String(row.data == null ? '' : row.data).replace(/\r\n?/g, '\n').replace(/\u0000/g, '').replace(/\n+$/, '').slice(0, 200000);
      let title = String(row.title || '').replace(/\s+/g, ' ').trim();
      if (!title && !text.trim()) { skipped++; continue; }
      if (!title) { const f = text.split('\n').map((l) => l.trim()).find(Boolean) || ''; title = f.length > 30 ? f.slice(0, 30) + '…' : f; }
      if (have.has(title + '\u0001' + text)) { skipped++; continue; }
      const L = Number(row.winrect_left), T = Number(row.winrect_top), R = Number(row.winrect_right), B = Number(row.winrect_bottom);
      const okRect = [L, T, R, B].every(Number.isFinite) && R - L > 40 && B - T > 30;
      const created = fromFiletime(row.cretime) || Date.now();
      const m = {
        id: store.nextId++, slot: slotFromColorref(row.titlebkcolor), type: 'text', title: title.slice(0, 200), text, items: [],
        x: okRect ? L : null, y: okRect ? T : null,
        w: okRect ? Math.min(MAX_W, Math.max(MIN_W, R - L)) : 260, h: okRect ? Math.min(MAX_H, Math.max(MIN_H, B - T)) : 220,
        layer: 'normal', hidden: Number(row.show) === 0, folded: !!Number(row.fold),   // 메모잇은 기본이 '항상 위'라 따라가지 않음
        mark: null, markColor: '#E8456B', created, updated: fromFiletime(row.lastmodifytime) || created,
        uid: Cloud.uid(), mt: Date.now(), dirty: true, lt: Date.now()
      };
      if (ord != null) m.ord = --ord;
      // 메모잇 분류 → 그룹
      const cat = has('category') ? String(row.category || '').trim() : '';
      if (cat) {
        let g = store.groups.find((x) => x.name === cat);
        if (!g) { g = { id: 'g' + Cloud.uid().replace(/-/g, '').slice(0, 10), name: cat.slice(0, 40), color: store.groups.length % 6 }; store.groups.push(g); store.layoutSync.groupsT = Date.now(); }
        m.group = g.id;
      }
      store.memos.push(m);
      have.add(sig(m));
      ensurePos(m);
      if (!m.hidden) openMemoWin(m);
      added++;
    }
    // 메모잇 달력 → 캘린더 일정 (한 줄 = 일정 하나)
    let evAdded = 0;
    try {
      const cal = q('select * from calendar');
      for (const c of cal) {
        if (Number(c.is_deleted)) continue;
        const d = String(c.id_date || '');
        if (!/^\d{8}$/.test(d)) continue;
        const k = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
        const lines = String(c.text || '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        const cur = store.events[k] || [];
        const seen = new Set(cur.map((x) => x.title));
        let changed = false;
        for (const l of lines) {
          if (seen.has(l) || cur.length >= 50) continue;
          cur.push({ t: '', title: l.slice(0, 200), c: 'lav' }); seen.add(l); evAdded++; changed = true;
        }
        if (changed) { store.events[k] = cur; markEvent(k); }
      }
    } catch (err) { /* 달력이 없는 백업 */ }
    markLayout();
    save();
    broadcast();
    scheduleSync();
    return { ok: true, added, skipped, events: evAdded };
  } catch (err) {
    console.error(err);
    return { error: '메모잇 백업을 읽지 못했어요' };
  } finally {
    try { db.close(); } catch (e2) { /* 무시 */ }
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
        cur.push(cleanEvent(ev));
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

// ───────── 배치·꾸미기 맞추기 (같은 계정이면 어느 PC에서든 같은 배치) ─────────
// 메모마다 배치 시각(lt)을 따로 두어, 한 PC에서 옮긴 메모만 다른 PC에 반영돼요.
const LAYOUT_KEYS = ['x', 'y', 'w', 'h', 'folded', 'layer', 'hidden', 'group', 'ox', 'oy', 'fs'];
const SYNC_SETTINGS = ['skin', 'font', 'fontScale', 'titleScale', 'titleBold', 'calFont', 'calScale', 'peopleFont', 'peopleScale', 'bodyBg', 'alpha', 'sideAlpha', 'foldScale'];
let applyingLayout = false;
function markLayout() {
  if (applyingLayout || !store.layoutSync) return;
  store.layoutSync.mt = Math.max(Date.now(), (store.layoutSync.mt || 0) + 1);
  store.layoutSync.dirty = true;
  if (cloudKey && holder.session) scheduleSync(4000);
}
function layoutTouched(m, more) {
  if (applyingLayout) return;
  const now = Date.now();
  if (m) m.lt = now;
  for (const o of more || []) o.lt = now;
  markLayout();
}
function groupsTouched() { if (!applyingLayout) { store.layoutSync.groupsT = Date.now(); markLayout(); } }
function layoutPayload() {
  const memos = {};
  for (const m of store.memos) {
    if (!m.uid || m.deleting) continue;
    const l = { t: m.lt || 0 };
    for (const k of LAYOUT_KEYS) if (m[k] !== undefined && m[k] !== null) l[k] = m[k];
    memos[m.uid] = l;
  }
  const settings = {};
  for (const k of SYNC_SETTINGS) settings[k] = store.settings[k];
  return { memos, groups: store.groups, groupsT: store.layoutSync.groupsT || 0, settings, settingsT: store.layoutSync.settingsT || 0 };
}
function cleanLayout(l) {
  const o = {};
  for (const k of ['x', 'y', 'w', 'h', 'ox', 'oy']) if (typeof l[k] === 'number' && isFinite(l[k])) o[k] = Math.round(l[k]);
  if (o.w != null) o.w = Math.min(MAX_W, Math.max(MIN_W, o.w));
  if (o.h != null) o.h = Math.min(MAX_H, Math.max(MIN_H, o.h));
  o.folded = !!l.folded; o.hidden = !!l.hidden;
  o.layer = ['top', 'bottom'].includes(l.layer) ? l.layer : 'normal';
  o.group = typeof l.group === 'string' ? l.group : null;
  o.fs = typeof l.fs === 'number' && isFinite(l.fs) ? clampFs(l.fs) : null;
  return o;
}
function applyLayout(d) {
  if (!d || typeof d !== 'object') return;
  applyingLayout = true;
  try {
    if (Array.isArray(d.groups) && (d.groupsT || 0) > (store.layoutSync.groupsT || 0)) {
      store.groups = d.groups.filter((g) => g && typeof g.id === 'string').map((g) => ({ id: g.id, name: String(g.name || '그룹').slice(0, 40), color: Number(g.color) || 0 }));
      store.layoutSync.groupsT = d.groupsT;
    }
    if (d.settings && (d.settingsT || 0) > (store.layoutSync.settingsT || 0)) {
      const p = {};
      for (const k of SYNC_SETTINGS) if (d.settings[k] !== undefined) p[k] = d.settings[k];
      updateSettings(p);
      store.layoutSync.settingsT = d.settingsT;
    }
    const gids = new Set(store.groups.map((g) => g.id));
    for (const [uid, raw] of Object.entries(d.memos || {})) {
      if (!raw || !(raw.t > 0)) continue;
      const l = cleanLayout(raw);
      if (l.group && !gids.has(l.group)) l.group = null;
      const m = store.memos.find((x) => x.uid === uid && !x.deleting);
      if (!m) {
        // 아직 이 PC에 없는 메모: 도착하면 이 자리에 나타나게
        const lc = store.layoutCache = store.layoutCache || {};
        if (!lc[uid] || (lc[uid].t || 0) < raw.t) lc[uid] = { ...l, t: raw.t };
        continue;
      }
      if ((m.lt || 0) >= raw.t) continue;
      m.lt = raw.t;
      const moved = l.x != null && (l.x !== m.x || l.y !== m.y || l.w !== m.w || l.h !== m.h);
      if (l.x != null) { m.x = l.x; m.y = l.y; }
      if (l.w != null) { m.w = l.w; m.h = l.h; }
      if (l.ox != null) { m.ox = l.ox; m.oy = l.oy; } else { delete m.ox; delete m.oy; }
      ensurePos(m);
      updateMemo(m.id, { folded: l.folded, layer: l.layer, hidden: l.hidden, group: l.group, fs: l.fs });
      const win = memoWins.get(m.id);
      if (moved && win && !win.isDestroyed() && !m.hidden) animateTo(win, boundsFor(m), 380);
    }
  } finally { applyingLayout = false; }
  save();
  broadcast();
}

// 분리 되돌리기: 분리한 내용을 원래 메모의 원래 자리로 돌려놓고, 분리된 메모는 없앰
ipcMain.handle('memo:unsplit', (e, id) => {
  const m = getMemo(id);
  if (!m || !m.splitFrom) return { error: 'none' };
  const src = store.memos.find((x) => x.uid === m.splitFrom.uid && !x.deleting);
  if (!src) return { error: 'gone' };
  const part = m.type === 'check' ? (m.items || []).map((x) => x.t).join('\n') : (m.text || '');
  let text;
  if ((src.text || '') === m.splitFrom.after && part === m.splitFrom.part) {
    text = m.splitFrom.before;            // 그대로면 분리 전 글로 정확히 되돌림
  } else {
    text = (src.text ? src.text + '\n' : '') + part;   // 원래 메모가 그 사이 바뀌었으면 맨 끝에 붙임
  }
  if (src.type === 'text') updateMemo(src.id, { text });
  else return { error: 'type' };
  // 원래 메모 창에 글을 바로 다시 그리게 (쓰던 중이어도)
  const sw = memoWins.get(src.id);
  if (sw && !sw.isDestroyed()) sw.webContents.send('cmd', { type: 'settext', text });
  // 분리된 메모는 휴지통을 거치지 않고 바로 없앰 (내용은 원래 메모로 돌아갔으니)
  m.deleting = true;
  closeMemoWin(id);
  setTimeout(() => {
    store.memos = store.memos.filter((x) => x.id !== id);
    store.tombs.push({ uid: m.uid, ts: Math.max(Date.now(), (m.mt || 0) + 1) });
    save(); broadcast(); scheduleSync();
  }, 340);
  focusMemo(src.id);
  return { ok: true, src: src.id };
});

ipcMain.on('layout:pushAll', () => {
  const now = Date.now();
  for (const m of store.memos) if (!m.deleting) m.lt = now;
  store.layoutSync.groupsT = now;
  store.layoutSync.settingsT = now;
  markLayout();
  save();
  scheduleSync(0);
});

// 회사 공통 연락망 받아오기 (관리자는 고친 것을 먼저 올림)
async function syncShared() {
  try {
    if (store.cloud.admin == null || !store.shared.adminAt || Date.now() - store.shared.adminAt > 6 * 3600 * 1000) {
      store.cloud.admin = await Cloud.isAdmin(holder);
      store.shared.adminAt = Date.now();
    }
    if (store.cloud.admin && store.shared.dirty && store.shared.contacts) {
      await Cloud.putShared(holder, 'contacts', { rows: store.shared.contacts });
      store.shared.dirty = false;
    }
    const sh = await Cloud.getShared(holder, 'contacts');
    if (sh && sh.data && Array.isArray(sh.data.rows)) {
      if (!store.shared.dirty) store.shared.contacts = sanitizeTable({ rows: sh.data.rows }).rows;
      store.shared.at = sh.updatedAt;
    } else if (store.cloud.admin && store.contacts && store.contacts.rows.length > 1) {
      // 처음: 관리자의 연락망을 회사 공통으로 올림
      await Cloud.putShared(holder, 'contacts', { rows: store.contacts.rows });
      store.shared.contacts = store.contacts.rows.map((r) => r.slice());
    }
    // 공지 (관리자가 올린 것)
    const nt = await Cloud.getShared(holder, 'notices');
    if (nt && nt.data && Array.isArray(nt.data.list)) store.shared.notices = cleanNotices(nt.data.list);
    broadcast();
    checkNotice();
  } catch (e) { console.error('공통 연락망·공지', e && e.code); }
}

// ───────── 공지: 관리자가 올리면 모든 사용자에게 작게 알림 → 내용 보기 ─────────
function cleanNotices(list) {
  return list.filter((n) => n && typeof n.id === 'string').slice(0, 30).map((n) => ({
    id: n.id.slice(0, 40), title: String(n.title || '공지').slice(0, 80), body: String(n.body || '').slice(0, 5000), upd: !!n.upd, at: Number(n.at) || 0
  }));
}
let noticeWin = null;
function checkNotice() {
  const list = store.shared.notices || [];
  const n = list[0];
  if (!n || store.settings.noticeOn === false) return;
  if (store.noticeSeen === n.id) return;
  if (!store.noticeSeen && n.at && store.installedAt && n.at < store.installedAt - 7 * DAY) { store.noticeSeen = n.id; save(); return; }   // 설치 훨씬 전 공지는 건너뜀
  store.noticeSeen = n.id;
  save();
  openNotice(n.id, false);
}
function openNotice(id, detail) {
  if (noticeWin && !noticeWin.isDestroyed()) noticeWin.close();
  hostOpen('notice.html?kind=notice&id=' + encodeURIComponent(id) + (detail ? '&view=1' : ''), 'notice-' + Date.now());
}
const NOTICE_TOAST = { w: 380, h: 150 };
function noticeToastBounds() {
  const wa = workArea();
  return { x: wa.x + wa.width - NOTICE_TOAST.w - 6, y: wa.y + wa.height - NOTICE_TOAST.h - 6, width: NOTICE_TOAST.w, height: NOTICE_TOAST.h };
}
function noticeDetailBounds(h) {
  const wa = workArea();
  const w = 520, hh = Math.round(Math.min(wa.height - 40, Math.max(260, h || 420)));
  return { x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - hh) / 2), width: w, height: hh };
}
function setupNotice(win, detail) {
  noticeWin = win;
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.once('ready-to-show', () => { if (win.isDestroyed()) return; if (detail) { win.show(); win.focus(); } else win.showInactive(); });
  win.on('closed', () => { if (noticeWin === win) noticeWin = null; });
}
ipcMain.on('notice:expand', (e, h) => {
  if (!noticeWin || noticeWin.isDestroyed()) return;
  noticeWin.setBounds(noticeDetailBounds(num(h)));
  noticeWin.show(); noticeWin.focus();
});
ipcMain.on('notice:size', (e, h) => {
  if (!noticeWin || noticeWin.isDestroyed()) return;
  const b = noticeWin.getBounds();
  if (b.width > NOTICE_TOAST.w) noticeWin.setBounds(noticeDetailBounds(num(h)));
});
ipcMain.on('notice:close', () => { if (noticeWin && !noticeWin.isDestroyed()) noticeWin.close(); });
ipcMain.on('notice:open', (e, id) => { if (typeof id === 'string') openNotice(id, true); });
ipcMain.handle('notice:send', async (e, n) => {
  if (!store.cloud.admin || !holder.session) return { error: '관리자 계정으로 로그인해야 보낼 수 있어요' };
  if (!n || typeof n.title !== 'string' || !n.title.trim()) return { error: '제목을 써 주세요' };
  const item = { id: 'n' + Date.now().toString(36), title: n.title.trim(), body: String(n.body || '').trim(), upd: !!n.upd, at: Date.now() };
  try {
    const cur = await Cloud.getShared(holder, 'notices');
    const list = cleanNotices([item].concat((cur && cur.data && cur.data.list) || []));
    await Cloud.putShared(holder, 'notices', { list });
    store.shared.notices = list;
    store.noticeSeen = item.id;   // 보낸 사람에게는 다시 띄우지 않음
    save(); broadcast();
    return { ok: true };
  } catch (err) {
    return { error: Cloud.message(err) };
  }
});

function scheduleSync(delay = 1500) {
  if (!cloudKey || !holder.session) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delay);
}

// 연락망 예전 기본 머리글이면 자리 내선 연락망(부서·이름·내선)으로 정리
function fixContactRows(rows) {
  if (!rows || !rows[0]) return null;
  let out = rows, changed = false;
  if (out[0].join('|') === '부서|이름|직급|내선|휴대폰|이메일') { out = out.map((r) => r.filter((c, i) => i !== 2 && i !== 4)); changed = true; }
  // 비어 있는 이메일 칸은 빼기 (자리 내선 연락망)
  if (out[0].join('|') === '부서|이름|내선|이메일' && out.slice(1).every((r) => !String(r[3] || '').trim())) { out = out.map((r) => r.slice(0, 3)); changed = true; }
  return changed ? out : null;
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
// 일정: t 시간 · title · c 색 · r 반복(d 매일, wd 평일, w 매주, m 매월, y 매년) · x 반복에서 뺀 날짜들
const cleanEvent = (ev) => {
  const o = {
    t: String((ev && ev.t) || '').slice(0, 10), title: String((ev && ev.title) || '').slice(0, 200),
    c: ['lav', 'mint', 'pink', 'sky'].includes(ev && ev.c) ? ev.c : 'lav'
  };
  if (ev && ['d', 'wd', 'w', 'm', 'y'].includes(ev.r)) {
    o.r = ev.r;
    if (Array.isArray(ev.x)) o.x = ev.x.filter((k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k)).slice(-400);
  }
  return o;
};
const sanitizeEvents = (a) => (Array.isArray(a) ? a.slice(0, 50).map(cleanEvent) : []);
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
  if (item.kind === 'layout') {
    if (item.id === 'pc' && !item.deleted) applyLayout(item.data);
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
        for (const k of ['x', 'y', 'w', 'h', 'folded', 'layer', 'hidden', 'ox', 'oy', 'group']) if (lay[k] !== undefined && lay[k] !== null) n[k] = lay[k];
        if (n.group && !store.groups.some((g) => g.id === n.group)) delete n.group;
        if (lay.t) n.lt = lay.t;
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
  if (kind === 'layout') return 0;   // 배치는 메모마다 시각을 비교해 합침
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
  if (store.layoutSync && store.layoutSync.dirty) out.push({ kind: 'layout', id: 'pc', ts: store.layoutSync.mt, data: layoutPayload() });
  return out;
}

function markPushed(kind, id, ts) {
  if (kind === 'contact') { if (store.contacts && store.contacts.mt === ts) store.contacts.dirty = false; return; }
  if (kind === 'layout') { if (store.layoutSync && store.layoutSync.mt === ts) store.layoutSync.dirty = false; return; }
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
    await syncShared();
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
    // 배치: 다른 PC에서 정한 배치를 먼저 받고, 이 PC에서 옮긴 메모는 그 뒤에 올림
    store.layoutSync = { mt: 0, dirty: false, groupsT: 0, settingsT: 0 };
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
    store.layoutCache[m.uid] = { x: m.x, y: m.y, w: m.w, h: m.h, folded: !!m.folded, layer: m.layer, hidden: !!m.hidden, ox: m.ox, oy: m.oy, group: m.group };
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
  setInterval(() => scheduleSync(0), 5 * 60 * 1000);   // 5분마다 다른 기기·공통 연락망 맞추기
  clockTimer = setInterval(tickClock, 10 * 1000);         // 정각·30분 말랑이 시계
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
