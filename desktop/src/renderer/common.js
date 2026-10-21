// 스킨, 글꼴, 기호 등 모든 창이 함께 쓰는 값
(function () {
  // on: 포인트색 위 글자색, dark: 어두운 스킨
  const SKINS = {
    lav: {
      name: '라벤더 글래스', base: '#EEF0FB', b: ['#FFCADB', '#CFC8FF', '#C6F0DF', '#C7E0FF'],
      a1: '#5F67DE', a2: '#8E6FE6', ink: '#2E3150', sub: '#535877', sun: '#C2416A', sat: '#4A5BD6', glow: 'rgba(110,100,230,0.32)', on: '#FFFFFF',
      pal: [[[255, 243, 196], [255, 222, 214]], [[204, 243, 224], [196, 229, 255]], [[255, 214, 222], [255, 200, 232]], [[204, 226, 255], [214, 206, 255]], [[226, 214, 255], [246, 214, 255]]]
    },
    peach: {
      name: '피치 소다', base: '#FDF1EE', b: ['#FFC9BE', '#FFDCD2', '#FFE9E1', '#FBB8AE'],
      a1: '#E36F69', a2: '#F59C8D', ink: '#45302E', sub: '#74524F', sun: '#D6456E', sat: '#4A6BD0', glow: 'rgba(227,111,105,0.32)', on: '#FFFFFF',
      pal: [[[255, 232, 220], [255, 212, 204]], [[255, 242, 230], [255, 224, 210]], [[255, 218, 222], [255, 200, 212]], [[250, 236, 214], [255, 222, 200]], [[255, 226, 234], [248, 214, 230]]]
    },
    pink: {
      name: '핑크 다이어리', base: '#FDF0F4', b: ['#FFC6D6', '#CBEFDF', '#FFDCE6', '#FBD0DE'],
      a1: '#EA6A9A', a2: '#F6A2BE', ink: '#45283A', sub: '#76506A', sun: '#D9487A', sat: '#2E8A66', glow: 'rgba(234,106,154,0.30)', on: '#FFFFFF',
      pal: [[[255, 222, 232], [255, 206, 222]], [[214, 244, 230], [200, 238, 222]], [[255, 240, 232], [255, 226, 226]], [[255, 214, 228], [252, 224, 238]], [[230, 246, 222], [214, 240, 230]]]
    },
    cotton: {
      name: '코튼 캔디', base: '#F5F3FC', b: ['#FFD0E4', '#C9E4FF', '#FFE3F0', '#D6E8FF'],
      a1: '#E46FA4', a2: '#7FA6EE', ink: '#2E2C4A', sub: '#5A5878', sun: '#D6457A', sat: '#4A6BD6', glow: 'rgba(200,120,200,0.30)', on: '#FFFFFF',
      pal: [[[255, 224, 238], [226, 232, 255]], [[214, 234, 255], [236, 226, 255]], [[255, 236, 244], [255, 222, 236]], [[222, 240, 255], [212, 230, 255]], [[244, 228, 255], [255, 228, 240]]]
    },
    aurora: {
      name: '오로라 글래스', base: '#EFF1FC', b: ['#C9CCFF', '#BFEDE6', '#F6D3EA', '#C7E3F7'],
      a1: '#5A63E8', a2: '#2E9BC9', ink: '#1B2440', sub: '#4A5578', sun: '#C2416A', sat: '#4C63D8', glow: 'rgba(90,99,232,0.30)', on: '#FFFFFF',
      pal: [[[226, 228, 255], [214, 240, 248]], [[214, 244, 238], [206, 236, 248]], [[246, 224, 240], [232, 226, 255]], [[222, 236, 252], [214, 226, 255]], [[236, 232, 255], [220, 246, 240]]]
    },
    blue: {
      name: '소프트 블루', base: '#E7ECF4', b: ['#C7D9F6', '#DCE6F7', '#BCD1F2', '#E2E9F6'],
      a1: '#3566D8', a2: '#5B8DEF', ink: '#26324A', sub: '#4E5A72', sun: '#C2416A', sat: '#3566D8', glow: 'rgba(60,110,230,0.32)', on: '#FFFFFF',
      pal: [[[232, 240, 252], [212, 226, 250]], [[240, 244, 252], [224, 232, 246]], [[214, 232, 255], [196, 216, 250]], [[236, 240, 248], [220, 226, 242]], [[212, 226, 250], [226, 220, 252]]]
    },
    sky: {
      name: '스카이 블루', base: '#EEF8FE', b: ['#B5E3F8', '#D3EFFB', '#C8F0EA', '#A9DBF5'],
      a1: '#1D8ECC', a2: '#56B8EA', ink: '#1D3346', sub: '#4A6276', sun: '#D0496E', sat: '#1D8ECC', glow: 'rgba(33,150,214,0.30)', on: '#FFFFFF',
      pal: [[[220, 242, 253], [206, 234, 250]], [[226, 247, 244], [208, 240, 236]], [[236, 246, 254], [218, 236, 250]], [[214, 238, 252], [226, 232, 255]], [[232, 250, 240], [214, 240, 252]]]
    },
    forest: {
      name: '포레스트 민트', base: '#EFF9F4', b: ['#BDEBD5', '#9FDCCB', '#D2F2E3', '#C4E8DF'],
      a1: '#13926B', a2: '#3FBE84', ink: '#1C3A30', sub: '#4A6A5E', sun: '#C8466E', sat: '#2F7FB8', glow: 'rgba(19,151,110,0.28)', on: '#FFFFFF',
      pal: [[[222, 246, 234], [206, 238, 226]], [[214, 242, 238], [200, 234, 228]], [[236, 248, 226], [222, 242, 214]], [[226, 240, 250], [214, 240, 236]], [[244, 250, 232], [226, 244, 230]]]
    },
    honey: {
      name: '선샤인 허니', base: '#FFF9EA', b: ['#FFE28A', '#FFD27A', '#FFEBA8', '#FFF1C2'],
      a1: '#E8A408', a2: '#FFC94A', ink: '#3B3018', sub: '#6B5B36', sun: '#C8463C', sat: '#3A6CC0', glow: 'rgba(224,154,0,0.30)', on: '#2A2214',
      pal: [[[255, 246, 204], [255, 234, 180]], [[255, 240, 214], [255, 226, 190]], [[248, 244, 210], [240, 236, 190]], [[255, 236, 200], [255, 222, 176]], [[252, 248, 226], [246, 238, 200]]]
    },
    midnight: {
      name: '미드나잇', dark: true, base: '#16181D', b: ['#2A3A64', '#1E3442', '#3A2C52', '#1C3448'],
      a1: '#4C8DFF', a2: '#6FB3FF', ink: '#E9ECF1', sub: '#AEB6C4', sun: '#FF8FA8', sat: '#7FBDFF', glow: 'rgba(76,141,255,0.30)', on: '#FFFFFF',
      pal: [[[62, 68, 84], [52, 58, 76]], [[46, 70, 74], [42, 60, 78]], [[74, 56, 78], [62, 52, 80]], [[48, 62, 92], [44, 56, 84]], [[72, 64, 54], [60, 56, 68]]]
    }
  };

  const FONTS = [
    { id: 'gowun', name: '고운돋움', fam: "'Gowun Dodum', sans-serif", size: 14 },
    { id: 'plex', name: 'IBM Plex Sans KR · 단정한 고딕', fam: "'IBM Plex Sans KR', sans-serif", size: 14 },
    { id: 'nanumgothic', name: '나눔고딕', fam: "'Nanum Gothic', sans-serif", size: 14 },
    { id: 'sunflower', name: '해바라기 · 또렷한 고딕', fam: "'Sunflower', sans-serif", size: 14 },
    { id: 'dohyeon', name: '도현 · 굵은 제목체', fam: "'Do Hyeon', sans-serif", size: 15 },
    { id: 'serif', name: 'Noto Serif KR · 명조', fam: "'Noto Serif KR', serif", size: 14 },
    { id: 'nanummyeongjo', name: '나눔명조', fam: "'Nanum Myeongjo', serif", size: 14 },
    { id: 'gowunbatang', name: '고운바탕 · 부드러운 명조', fam: "'Gowun Batang', serif", size: 14 },
    { id: 'jua', name: '주아 · 동글동글', fam: "'Jua', sans-serif", size: 15 },
    { id: 'dongle', name: '동글 · 통통한 글씨', fam: "'Dongle', sans-serif", size: 22 },
    { id: 'singleday', name: '싱글데이 · 귀여운 글씨', fam: "'Single Day', cursive", size: 15 },
    { id: 'gaegu', name: '개구 · 손글씨', fam: "'Gaegu', cursive", size: 17 },
    { id: 'gamja', name: '감자꽃 · 손글씨', fam: "'Gamja Flower', cursive", size: 17 },
    { id: 'himelody', name: '하이멜로디 · 손글씨', fam: "'Hi Melody', cursive", size: 17 },
    { id: 'poorstory', name: '푸어스토리 · 손글씨', fam: "'Poor Story', cursive", size: 16 },
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
    r.setProperty('--on', sk.on || '#FFFFFF');
    r.setProperty('--glass', sk.dark ? '46, 51, 62' : '255, 255, 255');
    r.setProperty('--line-soft', sk.dark ? 'rgba(255,255,255,.12)' : 'rgba(80,80,140,.18)');
    document.documentElement.classList.toggle('dark', !!sk.dark);
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

  // 목록 순서: 직접 정한 순서(ord)가 있으면 그 순서, 없으면 최근 수정한 것부터
  function memoOrder(a, b) {
    const ha = typeof a.ord === 'number', hb = typeof b.ord === 'number';
    if (ha && hb) return a.ord - b.ord || (b.mt || 0) - (a.mt || 0);
    if (ha !== hb) return ha ? 1 : -1;
    return (b.mt || 0) - (a.mt || 0);
  }

  window.M = { memoOrder, SKINS, FONTS, MARKS, MARK_NAMES, MARK_COLORS, EVENT_COLORS, ICONS, rgba, grad, esc, pad, dateKey, applyTheme, markSvg };
})();
