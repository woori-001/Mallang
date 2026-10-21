# 말랑메모

투명하고 말랑한 데스크톱 메모 앱과, 어디서든 같은 메모를 쓰는 모바일 웹앱.

- **모바일 웹앱**: https://woori-001.github.io/Mallang/ (`docs/` 폴더, GitHub Pages)
- **PC 앱 (Windows)**: `desktop/` 폴더 (Electron)

## 계정과 보안
- 아이디·비밀번호로 가입해요. 비밀번호에서 "로그인 비밀값"과 "메모 잠금 열쇠"를 따로 만들어서, 서버에는 로그인 비밀값만 가요.
- 메모와 일정은 기기 안에서 AES-256-GCM으로 잠근 뒤 Supabase(`mallang_items`)에 올라가요. 서버에는 암호문만 있어서 관리자도 내용을 읽을 수 없어요.
- 표마다 행 단위 보안(RLS)으로 자기 데이터만 읽고 쓸 수 있어요.
- 비밀번호를 잊으면 서버의 메모를 되찾을 수 없어요.

## PC 앱 자동 업데이트
`desktop/package.json`의 `version`을 올리고 같은 이름의 값을 올려 main에 푸시하면, GitHub Actions가 설치 파일을 만들어 Releases에 올려요. 설치된 PC 앱은 시작할 때와 6시간마다 새 버전을 확인해 받아 두고, 다음에 껐다 켤 때 적용해요.

## PC 앱 빌드
```
cd desktop
npm install
npm start          # 개발 실행
npm run dist       # 설치 파일 (dist/MallangMemo-Setup-x.y.z.exe)
npm run web        # 공용 파일(cloud-core.js, common.js)을 docs로 복사
```
