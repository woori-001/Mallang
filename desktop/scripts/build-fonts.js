// 필요한 글꼴만 골라 src/renderer/fonts 로 복사 (woff2만, 오프라인 사용)
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'src/renderer/fonts');
const files = path.join(out, 'files');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(files, { recursive: true });
const pick = {
  'gowun-dodum': ['400'],
  'ibm-plex-sans-kr': ['400', '500', '600', '700'],
  'noto-serif-kr': ['400', '600'],
  'jua': ['400'],
  'gaegu': ['400', '700'],
  'nanum-pen-script': ['400'],
  'nanum-gothic': ['400', '700'],
  'nanum-myeongjo': ['400'],
  'gowun-batang': ['400'],
  'do-hyeon': ['400'],
  'sunflower': ['500'],
  'dongle': ['400'],
  'single-day': ['400'],
  'gamja-flower': ['400'],
  'hi-melody': ['400'],
  'poor-story': ['400'],
  'poppins': ['400', '500', '600', '700'],
  'noto-sans-kr': ['400', '700'],
};
let css = '';
for (const [pkg, weights] of Object.entries(pick)) {
  const dir = path.join(root, 'node_modules/@fontsource', pkg);
  for (const w of weights) {
    let c = fs.readFileSync(path.join(dir, w + '.css'), 'utf8');
    // 한글/라틴 외 서브셋(키릴, 베트남어 등)은 제외
    c = c.replace(/\/\*[^*]*\*\/\s*@font-face\s*{[^}]*}/g, (block) => {
      if (/(cyrillic|vietnamese|greek|devanagari)/.test(block)) return '';
      return block;
    });
    c = c.replace(/, url\([^)]*\.woff\) format\('woff'\)/g, '');
    for (const m of c.matchAll(/url\(\.\/files\/([^)]+\.woff2)\)/g)) {
      fs.copyFileSync(path.join(dir, 'files', m[1]), path.join(files, m[1]));
    }
    css += c + '\n';
  }
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log('fonts copied:', fs.readdirSync(files).length);
