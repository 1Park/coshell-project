# Task 브랜치 MCP (Claude Code)

**Status:** Implemented — 맥미니 배포. 코드: `mcp/`

## Problem

로컬 Claude Code에서 버그를 고치는 동안 쌓인 작업 과정은 그 세션 안에만 남는다.
PRD는 이 작업 결과를 티켓의 Main(AI용 컴팩트 줄글)에 모으기를 요구하지만, 로컬 세션이
Main을 불러오거나 결과를 Main에 반영할 통로가 없다.

## Goals

- `task_start`: 티켓 정보와 Main을 Claude Code 세션에 주입하고 Task 브랜치를 만든다.
- `task_merge`: 사람이 승인한 완료 보고서를 Main에 이어 붙이고 브랜치를 닫는다.
- Task 상태(`in_progress`, `blocked`, `in_review`)를 기록한다. `done`은 사람이 정한다.
- 1브랜치 1회 머지, 부분 머지 불가.
- REST API 없이 맥미니의 JSON 파일을 직접 읽고 쓴다 (데모용, DB 없음).

## Non-goals

- Question Branch, Discussion 작성 — 웹 담당.
- 웹에서 Task 시작이나 승인 — Task는 Claude Code 대화 안에서만 진행한다.
- 실제 coraid 로그인 — 지금은 헤더 목업.
- 동시 쓰기 안전성(원자적 쓰기, 잠금) — 데모라 고려하지 않는다.

## 구성

```
Claude Code ──(MCP, Streamable HTTP)──▶ coraid MCP 서버 (맥미니 :3001) ──▶ ~/.local/share/coshell/data/
                                                                               ▲
웹 프론트 ──▶ 백엔드 서버 ─────────────────────────────────────────────────────┘
```

- MCP 서버와 백엔드는 서로 호출하지 않고, 같은 데이터 폴더를 공유한다.
- 엔드포인트: `http://won-macmini:3001/mcp` (Tailscale, 포트포워딩 불필요). 상태 확인: `/healthz`
- stateless 모드: 요청마다 서버 인스턴스를 새로 만들고 파일을 새로 읽는다. 재시작해도 잃는 상태가 없다.
- 배포: main push → `scripts/deploy-local.sh`가 프론트 배포 후 시드(`data/tickets/`를 `DATA_DIR`로 복사,
  이미 있으면 건너뜀)를 실행하고 launchd 서비스 `local.coshell.mcp`를 재시작한다.
  MCP 단계가 실패해도 프론트는 되돌리지 않는다.

### Claude Code 연결

repo 루트 `.mcp.json`이 `coraid`라는 이름으로 서버를 등록한다. 각자 아래 값을 설정하고 `coshell-project`에서
Claude Code를 연 뒤, 처음 한 번 사용을 승인한다.

```bash
export CORAID_MCP_URL=http://won-macmini:3001/mcp
export CORAID_USER=eunhak
```

`CORAID_USER`는 `X-Coraid-User` 헤더로 전달되어 브랜치 작성자가 된다. 없으면 `anonymous`.

## 툴

AI에게 보이는 프롬프트와 메시지는 모두 영어다 ([coraid-prompts.md](coraid-prompts.md) 기준).
서버에 연결되면 `prompts/server.instructions.md`가 서버 지침으로 Claude Code에 전달된다.

### `task_start`

Task 브랜치를 만들고 작업 지침과 티켓 컨텍스트를 반환한다. 툴 결과 텍스트가 그대로 Claude Code 세션의
컨텍스트가 되므로, 이것이 "브랜치 세팅 프롬프트 주입"이다.

| 입력 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `ticket_id` | string | 예 | 작업할 티켓 (예: `BUG-104`) |

1. `tickets/{ticket_id}/main.json`을 읽는다. 없으면 에러.
2. `branches/task-xxxxxx.json`을 `status: "open"`, `task_status: "in_progress"`로 만든다.
   `base_context_at`에는 Main의 `updated_at`을 기록한다.
3. `prompts/task_start.instructions.md`에 티켓 제목, 설명, Main 컨텍스트, Discussion, `branch_id`를 채워 반환한다.

반환 예시 (줄임):

```
CoRAID Task started.

Task pointers:
- ticket_id: BUG-104
- branch_id: task-467891

Ticket title: ...
Ticket description: ...
Common context (append-only): (empty)
Discussion:
- sm · 2026-10-03T07:00:00.000Z: Retry works on desktop, ...

Required flow:
1. Read the ticket description, common context, and discussion above. ...
6. Show the exact report to me and ask: "Do you approve submitting this report to CoRAID?"
7. Only after I approve, call task_merge with branch_id "task-467891", the report as summary, and a work_log.
```

### `task_update_status`

진행 중인 Task의 상태를 바꾼다. 대부분의 상태는 자동이고, Claude가 직접 부르는 경우는 막혔을 때와 재개할 때뿐이다.

| 입력 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `task_status` | `"in_progress"` \| `"blocked"` | 예 | `blocked`는 진행할 수 없을 때, `in_progress`는 재개할 때 |
| `note` | string | `blocked`일 때 예 | 막힌 이유 또는 재개한 이유 |
| `branch_id`, `ticket_id` | string | 아니요 | 아래 브랜치 찾기 규칙 |

브랜치 파일의 `task_status`, `status_note`, `task_status_updated_at`만 바꾸고, Main에는 쓰지 않는다.

### `task_merge`

사람이 승인한 완료 보고서를 Main에 헤더와 함께 이어 붙이고 브랜치를 닫는다.

| 입력 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `summary` | string | 예 | 사용자가 승인한 완료 보고서 (URL, Change summary, Changed files, Test results, Remaining issues) |
| `work_log` | string[] | 아니요 | 작업 과정 기록. 브랜치 파일에만 저장. |
| `branch_id`, `ticket_id` | string | 아니요 | 아래 브랜치 찾기 규칙 |

1. 브랜치가 `open`이 아니면 에러 (1회 머지 강제).
2. Main의 `context` 끝에 아래 형식으로 이어 붙이고 `updated_at`을 갱신한다. 다른 필드는 건드리지 않는다.
   ```
   [Task · {브랜치 작성자} · {YYYY-MM-DD HH:mm, 한국 시간}]
   {summary}
   ```
3. 브랜치에 `summary`, `work_log`를 저장하고 `status: "merged"`, `merged_at`, `task_status: "in_review"`를 기록한다.
   브랜치 파일은 지우지 않고 이력으로 남긴다.

### `task_status`

`branch_id`를 주면 브랜치 JSON을, 생략하면 현재 사용자의 열린 Task 브랜치 목록(`branch_id · ticket · task_status · 생성 시각`)을
반환한다. 데이터를 바꾸지 않는다.

### 브랜치 찾기 규칙

`task_update_status`와 `task_merge`는 세션이 바뀌거나 대화가 요약되어 `branch_id`를 잃어도 동작하도록:

- `branch_id`가 있으면 그 브랜치.
- 없으면 현재 사용자의 `open` Task 브랜치를 찾는다 (`ticket_id`가 있으면 그 티켓 안에서).
  하나면 그 브랜치, 여러 개면 목록과 함께 에러, 없으면 에러.
- 이미 머지된 브랜치면 에러.

## Task 상태

| 상태 | 누가 정하나 |
|---|---|
| `in_progress` | `task_start`가 자동으로 설정. 막혔다가 재개할 때는 Claude가 `task_update_status`로 설정 |
| `blocked` | Claude가 `task_update_status`로 설정 (이유 필수) |
| `in_review` | `task_merge`가 자동으로 설정 |
| `done` | 사람이 설정 (PR 머지 후). MCP로는 설정할 수 없다. |

브랜치 `status`(`open` → `merged`)는 머지 여부, `task_status`는 작업 진행 상태로 서로 다른 필드다.

## 승인 흐름

웹 승인 단계는 없다. 승인은 Claude Code 대화 안에서 `task_merge` 호출 **전에** 끝난다.

```
작업 완료 → Claude가 보고서를 보여주고 승인 여부를 물음 → 사용자 "좋아" → task_merge → merged, in_review
                                                  └ 사용자 "다시 써" → 호출하지 않음 → 브랜치는 open 유지
```

## 데이터 형식

보드와 카드 필드, Question 브랜치까지 포함한 전체 형식은 [data/README.md](../../data/README.md)를 따른다.
Task MCP는 `main.json`의 `context`, `updated_at`만 고치고, `branches/task-*.json`을 만들고 고친다.

Task 브랜치 파일:

```json
{
  "branch_id": "task-a1b2c3",
  "type": "task",
  "ticket_id": "BUG-104",
  "author": "eunhak",
  "status": "merged",
  "task_status": "in_review",
  "status_note": null,
  "task_status_updated_at": "2026-10-03T05:20:00.000Z",
  "base_context_at": "2026-10-03T00:00:00.000Z",
  "summary": "URL: N/A\n\nChange summary:\n- ...",
  "work_log": ["edited Composer.tsx", "npm test: passed"],
  "created_at": "2026-10-03T05:00:00.000Z",
  "merged_at": "2026-10-03T05:20:00.000Z"
}
```

헤더 시간은 한국 시간, 그 밖의 시각 필드는 UTC ISO 형식이다.

## 에러 메시지

| 상황 | 메시지 |
|---|---|
| 티켓 없음 | `Ticket {id} does not exist.` |
| 잘못된 ID 형식 (영문, 숫자, `-`, `_` 외) | `Invalid ticket_id: {id}` |
| 브랜치 없음 | `Branch {id} does not exist.` |
| 열린 브랜치 없음 | `No open Task branch. Call task_start first.` |
| 열린 브랜치 여러 개 | `Multiple open Task branches. Specify branch_id: ...` |
| 이미 머지됨 | `Branch already merged: {id}` |
| `blocked`인데 이유 없음 | `A note explaining the block is required.` |

## 프롬프트 파일

`mcp/prompts/*.md`는 요청마다 새로 읽으므로, 파일만 바꿔 push하면 반영된다. `<!-- -->` 주석은 제거된다.
지침 파일에서는 `{{ticket_id}}`, `{{title}}`, `{{description}}`, `{{branch_id}}`, `{{main_context}}`, `{{discussions}}`를 쓸 수 있다.

| 파일 | 용도 | coraid-prompts.md 출처 |
|---|---|---|
| `server.instructions.md` | 서버 지침 (연결 시 전달) | Server Instructions |
| `task_start.description.md` | `task_start` 툴 설명 | `get_task_context` |
| `task_start.instructions.md` | `task_start`가 반환하는 지침 | Task Handoff Prompt의 흐름과 규칙 |
| `task_update_status.description.md` | `task_update_status` 툴 설명 | `update_task_status` |
| `task_merge.description.md` | `task_merge` 툴 설명과 보고서 형식 | Completion Report Prompt |
| `task_status.description.md` | `task_status` 툴 설명 | `get_my_sessions` |

설계 문서와 다르게 정한 점:

- 툴 이름은 기존 `task_*`를 유지한다 (설계 문서도 해커톤에서는 유지 가능하다고 명시).
- 완료 보고서는 항목별 입력값 대신 보고서 텍스트 하나(`summary`)로 받는다. Author ID는 헤더에 자동으로 붙어서 뺐다.
- 상태 변경은 Main에 로그로 남기지 않고 브랜치 파일에만 기록한다.
- `task_start`는 시작만 한다. Claude는 받은 맥락을 요약하고 멈추며, 이후 작업은 사람이 지시한다.
  설계 문서의 "start working"과 "PR 같은 결과물 준비" 단계는 뺐다.
- 커밋, push, PR은 사람이 요청할 때만 한다. push 시점은 사람이 정한다.

## Backlog

1. **QB → Task 연결** (QB 담당): Task가 출발한 Question 세션(`personal_session_id`)을 MCP가 읽게 하는 것.
   지금 QB는 브라우저에 저장되고 머지 후 삭제되어 MCP가 읽을 수 없다.
2. **QB에서 Task로 넘어가는 프롬프트 정리**: 웹의 Task 시작 프롬프트(`fe/src/lib/task-start-prompt.ts`)와
   coraid-prompts.md의 Task Handoff Prompt(`get_task_context`, `task_id` 사용)가 서로 다르다. 웹에서 Task를 직접
   진행하지는 않으므로, QB에서 Claude Code로 넘기는 프롬프트를 어떻게 둘지 나중에 정한다.
3. **`done` 설정 방법**: 사람이 `done`으로 바꾸는 화면이나 방법이 아직 없다.
4. **실제 인증**: coraid 로그인이 붙으면 `mcp/src/auth.mjs`만 교체한다.
5. **MCP에 없는 기능 요청 처리**: 지금은 없는 기능을 따로 막지 않는다. 데이터 변경은 MCP 툴로만 가능하고,
   잘못된 사용(`done` 설정, 재머지, 이유 없는 `blocked`)은 서버가 거부한다. 남은 위험은 Claude가 할 수 없는 일을
   했다고 말하는 경우로, 필요하면 서버 지침에 "제공되지 않는 CoRAID 작업은 할 수 없다고 안내하라"는 규칙을 추가한다.
6. **다른 사용자의 브랜치 조작**: `branch_id`를 알면 다른 사람의 Task도 상태 변경이나 머지가 가능하다.
   실제 인증을 붙일 때 작성자 확인을 함께 추가한다.

## Decisions

- **데이터 위치는 맥미니로 통일** (브라우저 저장 안 함). 자세한 형식은 [data/README.md](../../data/README.md).
- **Main 포맷**: 자유 텍스트에 `[Task · 작성자 · 시간]` 헤더를 붙여 이어 붙인다.
- **MCP 서버 이름은 `coraid`**.
