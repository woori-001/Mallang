// 스킨, 글꼴, 기호 등 모든 창이 함께 쓰는 값
(function () {
  const SKINS = {
    lav: {
      name: '라벤더 글래스', base: '#EEF0FB', b: ['#FFCADB', '#CFC8FF', '#C6F0DF', '#C7E0FF'],
      a1: '#5F67DE', a2: '#8E6FE6', ink: '#2E3150', sub: '#535877', sun: '#C2416A', sat: '#4A5BD6', glow: 'rgba(110,100,230,0.32)',
      pal: [[[255, 243, 196], [255, 222, 214]], [[204, 243, 224], [196, 229, 255]], [[255, 214, 222], [255, 200, 232]], [[204, 226, 255], [214, 206, 255]], [[226, 214, 255], [246, 214, 255]]]
    },
    peach: {
      name: '피치 소다', base: '#F8EEE6', b: ['#FFC7A6', '#FFDCC6', '#FFE9D2', '#FBB995'],
      a1: '#C4531E', a2: '#EA8B57', ink: '#3D2A20', sub: '#6E5244', sun: '#C2416A', sat: '#3E64C8', glow: 'rgba(230,120,70,0.32)',
      pal: [[[255, 228, 206], [255, 206, 180]], [[255, 241, 214], [255, 224, 192]], [[255, 214, 206], [255, 192, 192]], [[238, 244, 216], [216, 236, 200]], [[255, 232, 224], [250, 212, 228]]]
    },
    blue: {
      name: '소프트 블루', base: '#E7ECF4', b: ['#C7D9F6', '#DCE6F7', '#BCD1F2', '#E2E9F6'],
      a1: '#3566D8', a2: '#5B8DEF', ink: '#26324A', sub: '#4E5A72', sun: '#C2416A', sat: '#3566D8', glow: 'rgba(60,110,230,0.32)',
      pal: [[[232, 240, 252], [212, 226, 250]], [[240, 244, 252], [224, 232, 246]], [[214, 232, 255], [196, 216, 250]], [[236, 240, 248], [220, 226, 242]], [[212, 226, 250], [226, 220, 252]]]
    },
    pink: {
      name: '핑크 다이어리', base: '#FBEFF2', b: ['#FFC3D2', '#C6EEDD', '#FFD8E2', '#D4F2E6'],
      a1: '#C23A6E', a2: '#E57AA0', ink: '#3E2631', sub: '#6E4E5C', sun: '#C2416A', sat: '#2E8A66', glow: 'rgba(220,90,140,0.30)',
      pal: [[[255, 220, 230], [255, 204, 220]], [[206, 242, 226], [190, 234, 214]], [[255, 244, 226], [255, 230, 214]], [[255, 210, 222], [250, 222, 240]], [[222, 244, 214], [206, 238, 226]]]
    }
  };

  const FONTS = [
    { id: 'gowun', name: '고운돋움', fam: "'Gowun Dodum', sans-serif", size: 14 },
    { id: 'plex', name: 'IBM Plex Sans KR · 단정한 고딕', fam: "'IBM Plex Sans KR', sans-serif", size: 14 },
    { id: 'serif', name: 'Noto Serif KR · 명조', fam: "'Noto Serif KR', serif", size: 14 },
    { id: 'jua', name: '주아 · 동글동글', fam: "'Jua', sans-serif", size: 15 },
    { id: 'gaegu', name: '개구 · 손글씨', fam: "'Gaegu', cursive", size: 17 },
    { id: 'pen', name: '나눔손글씨 펜', fam: "'Nanum Pen Script', cursive", size: 20 }
  ];

  const MARKS = {
    heart: 'M12 20.5s-7.6-4.6-9.7-9.2C.8 8 2.9 4.5 6.5 4.5c2.1 0 3.7 1.2 5.5 3.3 1.8-2.1 3.4-3.3 5.5-3.3 3.6 0 5.7 3.5 4.2 6.8-2.1 4.6-9.7 9.2-9.7 9.2z',
    star: 'M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5-4.8-4.5 6.5-.8z',
    flag: 'M5 3h1.8v18H5zM8 4h11l-2.6 4.2L19 12.4H8z',
    alert: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.1 5h2.2v7h-2.2zm0 8.6h2.2v2.2h-2.2z',
    check: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.3 14.3L6.4 12l1.5-1.5 2.8 2.8 5.5-5.5 1.5 1.5z'
  };
  // 기호마다 실제 그림 크기가 달라서, 같은 크기로 보이도록 각자 화면 틀을 맞춤
  const MARK_VB = {
    heart: '0.6 1 22.8 22.8',
    star: '2.3 1.8 19.4 19.4',
    flag: '2.6 2.6 18.8 18.8',
    alert: '1.6 1.6 20.8 20.8',
    check: '1.6 1.6 20.8 20.8'
  };
  const MARK_NAMES = { heart: '하트', star: '별', flag: '깃발', alert: '느낌표', check: '체크' };
  const MARK_COLORS = [
    { hex: '#E8456B', name: '빨강' }, { hex: '#F5A524', name: '주황' }, { hex: '#2FA57C', name: '초록' },
    { hex: '#3A7FD4', name: '파랑' }, { hex: '#8E6FE6', name: '보라' }, { hex: '#3E3A4A', name: '먹색' }
  ];
  const EVENT_COLORS = { lav: '#7466E4', mint: '#2A9D74', pink: '#D4508A', sky: '#3A7FD4' };

  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const grad = (skin, slot, a) => {
    const p = skin.pal[((slot % 5) + 5) % 5];
    return 'linear-gradient(155deg, ' + rgba(p[0], a) + ', ' + rgba(p[1], a) + ')';
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const dateKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

  // 스킨·글꼴을 CSS 변수로 적용
  function applyTheme(settings) {
    const sk = SKINS[settings.skin] || SKINS.lav;
    const f = FONTS.find((x) => x.id === settings.font) || FONTS[0];
    const r = document.documentElement.style;
    r.setProperty('--ink', sk.ink);
    r.setProperty('--sub', sk.sub);
    r.setProperty('--a1', sk.a1);
    r.setProperty('--a2', sk.a2);
    r.setProperty('--glow', sk.glow);
    r.setProperty('--accent', 'linear-gradient(135deg, ' + sk.a1 + ', ' + sk.a2 + ')');
    r.setProperty('--memo-font', f.fam);
    r.setProperty('--memo-size', f.size + 'px');
    return { sk, f };
  }

  const ICONS = {
    plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    list: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6l1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5M11 6h10M11 12h10M11 18h10"/></svg>',
    front: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14M12 20V9M7 14l5-5 5 5"/></svg>',
    back: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20h14M12 4v11M7 10l5 5 5-5"/></svg>',
    eyeOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3 4.1M6.2 6.2C4 7.6 2.6 9.9 2 12c1 2.5 5 7 10 7 1.6 0 3-.4 4.3-1"/></svg>',
    eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    starLine: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
    chev: '<svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>',
    x: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    pin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v7"/></svg>',
    left: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    right: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    foldAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4l5 5 5-5M7 20l5-5 5 5"/></svg>',
    dots: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    unfoldAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9l5-5 5 5M7 15l5 5 5-5"/></svg>'
  };
  const markSvg = (mark, color, size) =>
    MARKS[mark] ? '<svg class="mark" width="' + size + '" height="' + size + '" viewBox="' + (MARK_VB[mark] || '0 0 24 24') + '" aria-hidden="true"><path d="' + MARKS[mark] + '" fill="' + esc(color) + '" fill-rule="evenodd"/></svg>' : '';

  window.M = { SKINS, FONTS, MARKS, MARK_NAMES, MARK_COLORS, EVENT_COLORS, ICONS, rgba, grad, esc, pad, dateKey, applyTheme, markSvg };
})();
