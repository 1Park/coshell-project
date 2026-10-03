# coshell Task MCP

Claude Code에서 버그 티켓의 Task 브랜치를 만들고(`task_start`), 작업 결과를 메인 컨텍스트에 머지(`task_merge`)하는 MCP 서버입니다. REST API 없이 데이터 폴더의 JSON 파일을 직접 읽고 씁니다.

## 실행

```bash
cd mcp
npm ci
npm run seed   # 샘플 티켓 BUG-123 생성 (이미 있으면 건너뜀, --force로 덮어쓰기)
npm start      # http://0.0.0.0:3001/mcp
```

| 환경변수 | 기본값 | 설명 |
|---|---|---|
| `DATA_DIR` | `~/.local/share/coshell/data` | 데이터 폴더. 배포 폴더는 매번 새로 만들어지므로 반드시 repo 밖에 둡니다. 백엔드와 같은 경로를 써야 합니다. |
| `PORT` | `3001` | 프론트가 3000을 사용합니다. |
| `HOST` | `0.0.0.0` | Tailscale로 다른 기기에서 접속하려면 `127.0.0.1`이 아니어야 합니다. |

상태 확인: `GET /healthz`

맥미니에서는 main push 시 `scripts/deploy-local.sh`가 프론트 배포 후 launchd 서비스 `local.coshell.mcp`로 자동 실행합니다 (`DATA_DIR=~/.local/share/coshell/data`, 로그 `~/.local/share/coshell/logs/mcp{,.error}.log`). MCP 배포가 실패해도 프론트는 되돌리지 않습니다.

## Claude Code에 연결

repo 루트의 `.mcp.json`이 서버를 등록합니다. 각자 셸에 아래 두 값을 설정한 뒤 repo에서 Claude Code를 열고, 처음 한 번 사용을 승인하면 됩니다. `/mcp`로 연결 상태를 볼 수 있습니다.

```bash
export CORAID_MCP_URL=http://<맥미니 MagicDNS 이름>:3001/mcp
export CORAID_USER=eunhak
```

`CORAID_USER`는 coraid 로그인이 붙기 전까지 쓰는 목업입니다. `X-Coraid-User` 헤더로 전달되며, 서버에서는 `src/auth.mjs`만 바꾸면 실제 인증으로 교체할 수 있습니다.

## 툴

| 툴 | 입력 | 동작 |
|---|---|---|
| `task_start` | `ticket_id` | `main.json`을 읽어 지침과 메인 컨텍스트를 반환하고, `open` 상태의 브랜치 파일을 만듭니다. |
| `task_merge` | `summary`, `work_log?`, `branch_id?`, `ticket_id?` | `main.json`의 `context`에 헤더를 달아 summary를 이어 붙이고, 브랜치를 `merged`로 바꿉니다. `branch_id`를 생략하면 현재 사용자의 열린 브랜치가 하나일 때 그 브랜치를 사용합니다. |
| `task_status` | `branch_id?` | 브랜치 하나를 조회하거나, 생략하면 현재 사용자의 열린 브랜치 목록을 반환합니다. |

사람의 승인은 Claude Code 대화 안에서 받습니다. Claude가 summary를 먼저 보여주고, 사용자가 승인하면 `task_merge`를 호출합니다.

## 프롬프트 수정

툴 설명과 `task_start`가 반환하는 지침은 `prompts/`의 마크다운 파일입니다. 요청마다 새로 읽으므로 서버를 재시작하지 않아도 바로 반영됩니다. `<!-- -->` 주석은 제거되고, 지침 파일에서는 `{{ticket_id}}`, `{{title}}`, `{{branch_id}}`, `{{main_context}}`를 쓸 수 있습니다.

## 데이터 형식

```
$DATA_DIR/tickets/{ticket_id}/
  main.json                  # 티켓은 사람이 만듭니다. MCP는 context와 updated_at만 수정합니다.
  branches/{branch_id}.json  # MCP가 만들고 수정합니다.
```

`main.json`

```json
{
  "ticket_id": "BUG-123",
  "title": "로그인 타임아웃 버그",
  "context": "...\n\n[Task · eunhak · 2026-10-03 14:20]\n작업 요약...",
  "discussions": [],
  "created_at": "2026-10-03T00:00:00.000Z",
  "updated_at": "2026-10-03T05:20:00.000Z"
}
```

브랜치 파일 (Question 브랜치도 같은 형식이며 `type`이 `question`이고 `work_log` 대신 `messages`를 씁니다)

```json
{
  "branch_id": "task-a1b2c3",
  "type": "task",
  "ticket_id": "BUG-123",
  "author": "eunhak",
  "status": "merged",
  "base_context_at": "2026-10-03T00:00:00.000Z",
  "summary": "작업 요약...",
  "work_log": ["auth.ts 수정", "12 passed"],
  "created_at": "2026-10-03T05:00:00.000Z",
  "merged_at": "2026-10-03T05:20:00.000Z"
}
```

- `status`: Task는 `open`과 `merged`만 사용합니다.
- `base_context_at`: 브랜치를 만들 때의 `main.json` `updated_at`입니다.
- 헤더 시간은 한국 시간, 나머지 시각 필드는 UTC ISO 형식입니다.
