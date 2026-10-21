// PC 앱과 모바일 웹앱이 같이 쓰는 파일을 docs 폴더로 복사
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'src');
const web = path.join(__dirname, '..', '..', 'docs');
fs.copyFileSync(path.join(src, 'cloud-core.js'), path.join(web, 'cloud-core.js'));
fs.copyFileSync(path.join(src, 'renderer', 'common.js'), path.join(web, 'common.js'));
fs.copyFileSync(path.join(src, 'renderer', 'table.css'), path.join(web, 'table.css'));
console.log('웹앱 공용 파일 복사 완료');
