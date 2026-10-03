# Task 브랜치 MCP (Claude Code)

**Status:** Implemented — 맥미니 배포 완료 (`3ce2f52`). 코드: `mcp/`

## Problem

로컬 Claude Code에서 버그를 고치는 동안 쌓인 작업 과정은 그 세션 안에만 남는다.
PRD는 이 작업 결과를 티켓의 Main(AI용 컴팩트 줄글)에 모으기를 요구하지만, 로컬 세션이
Main을 불러오거나 결과를 Main에 반영할 통로가 없다.

## Goals

- `task_start`: 티켓의 Main을 Claude Code 세션에 주입하고 Task 브랜치를 만든다.
- `task_merge`: 작업 요약을 사람 승인 후 Main에 이어 붙이고 브랜치를 닫는다.
- 1브랜치 1회 머지, 부분 머지 불가.
- REST API 없이 맥미니의 JSON 파일을 직접 읽고 쓴다 (데모용, DB 없음).

## Non-goals

- Question Branch, Discussion — 웹 담당.
- 웹 승인 화면 — Task는 Claude Code 대화 안에서 승인한다 (아래 승인 흐름 참조).
- compact 프롬프트 문구 — 다른 팀원이 준비 중이며 `mcp/prompts/`에 끼워 넣는다.
- 실제 coraid 로그인 — 지금은 헤더 목업.
- 동시 쓰기 안전성(원자적 쓰기, 잠금) — 데모라 고려하지 않는다.

## 구성

```
Claude Code ──(MCP, Streamable HTTP)──▶ MCP 서버 (맥미니 :3001) ──▶ ~/.local/share/coshell/data/
                                                                        ▲
웹 프론트 ──▶ 백엔드 서버 ──────────────────────────────────────────────┘
```

- MCP 서버와 백엔드는 서로 호출하지 않고, 같은 데이터 폴더를 공유한다.
- 엔드포인트: `http://won-macmini:3001/mcp` (Tailscale, 포트포워딩 불필요). 상태 확인: `/healthz`
- stateless 모드: 요청마다 서버 인스턴스를 새로 만들고 파일을 새로 읽는다. 재시작해도 잃는 상태가 없다.
- 배포: main push → `scripts/deploy-local.sh`가 프론트 배포 후 launchd 서비스 `local.coshell.mcp`로 재시작.
  MCP 단계가 실패해도 프론트는 되돌리지 않는다.

### Claude Code 연결

repo 루트 `.mcp.json`이 서버를 등록한다. 각자 아래 값을 설정하고 `coshell-project`에서 Claude Code를 연 뒤,
처음 한 번 사용을 승인한다.

```bash
export CORAID_MCP_URL=http://won-macmini:3001/mcp
export CORAID_USER=eunhak
```

`CORAID_USER`는 `X-Coraid-User` 헤더로 전달되어 브랜치 작성자가 된다. 없으면 `anonymous`.

## Tool 1: `task_start`

Task 브랜치를 만들고, 작업 지침과 Main 컨텍스트를 반환한다. 툴 결과 텍스트가 그대로 Claude Code 세션의
컨텍스트가 되므로, 이것이 "브랜치 세팅 프롬프트 주입"이다.

| 입력 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `ticket_id` | string | 예 | 작업할 티켓 (예: `BUG-123`) |

**동작**

1. `tickets/{ticket_id}/main.json`을 읽는다. 없으면 에러.
2. `branches/task-xxxxxx.json`을 `status: "open"`으로 만든다. `base_context_at`에는 Main의 `updated_at`을 기록한다.
3. `prompts/task_start.instructions.md`에 값을 채워 반환한다.

**반환 (현재 임시 문구)**

```
티켓 BUG-123(로그인 타임아웃 버그)의 Task 브랜치 task-e0b222에서 작업을 시작합니다.

아래 메인 컨텍스트를 참고해 작업하세요. 작업이 끝나면 결과를 요약해 사용자에게 보여주고,
사용자가 승인하면 task_merge를 branch_id "task-e0b222"와 함께 호출하세요.

--- 메인 컨텍스트 ---
로그인 요청이 간헐적으로 5초 만에 타임아웃된다. ...
```

## Tool 2: `task_merge`

작업 요약을 Main에 헤더와 함께 이어 붙이고 브랜치를 `merged`로 닫는다.

| 입력 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `summary` | string | 예 | Main에 이어 붙일 작업 요약. Claude Code가 작성한다. |
| `work_log` | string[] | 아니요 | 작업 과정 기록 (변경 파일, 테스트 결과 등). 브랜치 파일에만 저장. |
| `branch_id` | string | 아니요 | 머지할 브랜치. 생략하면 아래 규칙으로 찾는다. |
| `ticket_id` | string | 아니요 | `branch_id`를 모를 때 열린 브랜치를 찾을 범위. |

**브랜치 찾기 규칙** — 세션이 바뀌거나 대화가 요약되어 `branch_id`를 잃어도 머지할 수 있도록:

- `branch_id`가 있으면 그 브랜치.
- 없으면 현재 사용자의 `open` Task 브랜치를 찾는다 (`ticket_id`가 있으면 그 티켓 안에서).
  하나면 그 브랜치, 여러 개면 목록과 함께 에러, 없으면 에러.

**동작**

1. 브랜치가 `open`이 아니면 에러 (1회 머지 강제).
2. Main의 `context` 끝에 아래 형식으로 이어 붙이고 `updated_at`을 갱신한다. 다른 필드는 건드리지 않는다.
   ```
   [Task · {브랜치 작성자} · {YYYY-MM-DD HH:mm, 한국 시간}]
   {summary}
   ```
3. 브랜치에 `summary`, `work_log`를 저장하고 `status: "merged"`, `merged_at`을 기록한다.
   브랜치 파일은 지우지 않고 이력으로 남긴다.

**반환**

```
BUG-123 메인 컨텍스트에 머지했습니다 (task-e0b222).

[Task · eunhak · 2026-10-04 04:30]
타임아웃을 5s→30s로 늘리고 재시도 1회 추가. 테스트 통과.
```

## 보조 툴: `task_status`

`branch_id`를 주면 브랜치 JSON을, 생략하면 현재 사용자의 열린 Task 브랜치 목록을 반환한다.
`branch_id`를 잃었을 때 확인용이며 데이터를 바꾸지 않는다.

## 승인 흐름

웹 승인 단계는 없다. 승인은 Claude Code 대화 안에서 `task_merge` 호출 **전에** 끝난다.

```
작업 완료 → Claude가 summary를 보여줌 → 사용자 "좋아" → task_merge → open에서 바로 merged
                                      └ 사용자 "다시 써" → 호출하지 않음 → 브랜치는 open 유지
```

그래서 Task는 `open`과 `merged`만 사용한다. `pending_approval`, `rejected`는 공통 스키마에만 남겨 둔다.
Claude Code가 MCP 툴 실행 전에 허용 여부를 묻는 것도 승인 단계 역할을 한다.

## 데이터 형식

보드와 카드 필드, Question 브랜치까지 포함한 전체 형식은 [data-format.md](data-format.md)를 따른다.
아래는 Task MCP가 읽고 쓰는 부분이다.

```
$DATA_DIR/tickets/{ticket_id}/
  main.json                  # 사람이 만든다. MCP는 context, updated_at만 수정
  branches/{branch_id}.json  # MCP가 만들고 수정
```

**`main.json`**

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

- `context`는 문자열 하나. 머지 이력은 헤더와 브랜치 파일로 충분해서 별도 필드를 두지 않는다.
- `discussions` 구조는 Discussion 담당이 정한다.

**브랜치 파일** — Question Branch와 같은 형식을 쓰고 `type`으로 구분한다.

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

| 필드 | Task | Question |
|---|---|---|
| `type` | `"task"` | `"question"` |
| 원본 데이터 | `work_log` | `messages` (채팅 원문) |
| `status` | `open` → `merged` | 웹 정책에 따름 |
| 생성 | `task_start` | 웹 채팅 시작 |
| `summary` 작성 | 로컬 Claude Code | 웹의 auto-compact |

헤더 시간은 한국 시간, 그 밖의 시각 필드는 UTC ISO 형식이다.

## 에러 메시지 (임시)

| 상황 | 메시지 |
|---|---|
| 티켓 없음 | `티켓 {id}이(가) 없습니다.` |
| 잘못된 ID 형식 (영문, 숫자, `-`, `_` 외) | `잘못된 ticket_id: {id}` |
| 브랜치 없음 | `브랜치 {id}이(가) 없습니다.` |
| 열린 브랜치 없음 | `열린 Task 브랜치가 없습니다. task_start로 먼저 시작하세요.` |
| 열린 브랜치 여러 개 | `열린 Task 브랜치가 여러 개입니다. branch_id를 지정하세요: ...` |
| 이미 머지됨 | `이미 머지된 브랜치입니다: {id}` |

## 프롬프트 교체

툴 설명과 `task_start` 지침은 `mcp/prompts/*.md`에 있고 요청마다 새로 읽는다. 파일만 바꿔 push하면 반영된다.
`<!-- -->` 주석은 제거되며, 지침 파일에서는 `{{ticket_id}}`, `{{title}}`, `{{branch_id}}`, `{{main_context}}`를 쓸 수 있다.

| 파일 | 용도 |
|---|---|
| `task_start.description.md` | `task_start` 툴 설명 (Claude가 언제 호출할지 판단) |
| `task_start.instructions.md` | `task_start`가 반환하는 지침 (브랜치 세팅 프롬프트) |
| `task_merge.description.md` | `task_merge` 툴 설명. summary 작성 기준을 여기에 적는다 |
| `task_status.description.md` | `task_status` 툴 설명 |

## Open questions

1. **Main 포맷**: Task는 자유 텍스트에 `[Task · 작성자 · 시간]` 헤더를 붙인다.
   Question 머지도 `[Question · ...]`로 맞추면 웹에서 같은 방식으로 표시할 수 있다.
2. **프롬프트 문구 확정**: 현재 `mcp/prompts/`는 임시 문구.
3. **실제 인증**: coraid 로그인이 붙으면 `mcp/src/auth.mjs`만 교체한다.

## Decisions

- **데이터 위치는 맥미니로 통일** (브라우저 저장 안 함). Question Branch와 Main도 맥미니의 `DATA_DIR`에
  이 문서의 형식으로 저장한다. `question-branch-merge.md`의 localStorage 안은 웹 담당이 이에 맞춰 수정한다.
  백엔드는 요청마다 파일을 새로 읽어야 MCP가 바꾼 내용이 웹에 보인다.
