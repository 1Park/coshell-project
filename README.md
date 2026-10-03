# coshell-project

2026년 10월 3일 Coshell 해커톤 프로젝트입니다.

해커톤에서 만든 코드와 아이디어를 이 저장소에 정리합니다.

## 로컬 자동 배포

`main` push → 이 맥의 GitHub Actions runner → 로컬 main pull → 별도 릴리스 폴더에서 `npm ci` / `npm run build` → launchd 서버 재시작 → 헬스 체크.

- 화면: http://localhost:3000
- 상태: http://localhost:3000/healthz (실행 중인 커밋 포함)
- 배포 기록: https://github.com/1Park/coshell-project/actions
- 서버와 runner는 로그인 시 자동 실행됩니다. 맥이 깨어 있고 인터넷에 연결되어 있어야 새 배포를 받습니다.
- 빌드 실패 시 기존 서버를 유지합니다. 재시작 후 30회 헬스 체크에 실패하면 이전 릴리스로 되돌리고 Actions를 실패 처리합니다.
- 로컬 checkout은 깨끗한 `main`으로 유지합니다. 분기되거나 로컬 변경이 있으면 배포를 중단합니다.
- 연속 push는 배포를 직렬화하며 최신 main을 배포합니다. 중간 커밋은 생략될 수 있습니다.

### 프론트 개발 시 유지할 계약

현재 페이지는 배포 확인용이며 프레임워크 의존성이 없습니다. 프론트를 추가할 때 루트 `package.json`의 다음 인터페이스를 유지하세요.

1. `npm ci`가 가능하도록 `package-lock.json`을 커밋합니다.
2. `npm run build`로 배포용 파일을 생성합니다.
3. `npm start`는 빌드한 서버를 포그라운드로 실행합니다. `HOST=127.0.0.1`, `PORT=3000`을 사용합니다.
4. `/healthz`는 HTTP 200과 `{ "status": "ok", "commit": process.env.RELEASE_SHA }`를 반환해야 합니다. 새 커밋이 실제로 실행 중인지 확인하기 위한 계약입니다.

### 이 맥의 구성

- 저장소 변수 `COSHELL_REPO_PATH`: 로컬 checkout 경로
- runner 전용 라벨: `coshell-local`
- Node 22 및 runner: `~/.local/share/coshell/{runtime,runner}`
- 배포 버전: `~/.local/share/coshell/releases/` (자동 삭제하지 않음)
- 현재 버전 링크: `~/.local/share/coshell/current`
- 서버 로그: `~/.local/share/coshell/logs/frontend{,.error}.log`
- 서버 서비스: `~/Library/LaunchAgents/local.coshell.frontend.plist`

```bash
# 서버 재시작
launchctl kickstart -k "gui/$(id -u)/local.coshell.frontend"

# 서버 중지 (다음 로그인 또는 배포 시 다시 시작)
launchctl bootout "gui/$(id -u)/local.coshell.frontend"

# runner 중지 / 시작
cd ~/.local/share/coshell/runner
./svc.sh stop
./svc.sh start
```

수동 재배포는 GitHub Actions의 **Deploy to local Mac → Run workflow → main**을 사용합니다.
runner에는 이 비공개 레포의 신뢰하는 코드만 실행하세요. 비밀 값은 레포에 커밋하지 않습니다.
