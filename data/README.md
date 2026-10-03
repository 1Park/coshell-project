# CoRAID 데이터 형식 (맥미니 로컬 JSON)

**Status:** Draft — pending review

> repo의 `data/`는 **시드(초기값)**다. 프론트가 빌드할 때 이 JSON을 가져와 보드 초기 데이터로 쓴다.
> 실행 중에 바뀌는 실제 데이터는 맥미니의 `~/.local/share/coshell/data`(`DATA_DIR`)에 둔다.
> repo 안의 파일은 배포할 때마다 새 릴리스 폴더로 다시 풀리므로, 실행 중에 이 폴더에 쓴 내용은 남지 않는다.

## Problem

대시보드(칸반 보드, 카드, 댓글)와 Question 브랜치는 코드에 하드코딩된 시드와 각자의 브라우저 localStorage에
저장된다. 그래서 팀원마다 다른 보드를 보고, Claude Code에서 머지한 Task 결과(맥미니 `main.json`)가 웹에
나타나지 않는다. 보드 티켓(`BUG-101`~`110`)과 MCP 샘플 티켓(`BUG-123`)도 서로 연결되지 않는다.

## Goals

- 모든 데이터를 맥미니의 한 폴더에 JSON으로 저장하고, 웹 백엔드와 MCP 서버가 같은 파일을 읽고 쓴다.
- 이미 배포된 Task MCP 형식(`docs/specs/task-mcp.md`)을 깨지 않고 확장한다.
- 프론트 store(`board.ts`, `branches.ts`, `sessions.ts`, `question-branch.ts`)가 옮겨 올 수 있는 형식.

## Non-goals

- DB, 다중 사용자 동시 편집, 원자적 쓰기와 잠금 (데모 범위).
- REST API 상세 설계 — 아래 "API 초안"은 참고용이다.
- UI 전용 상태(열린 패널, 선택한 탭 등) — 브라우저에 남겨도 된다.

## 공통 규칙

1. **위치**: `DATA_DIR` 환경변수, 기본값 `~/.local/share/coshell/data`. 배포 폴더는 push마다 새로 만들어지므로
   repo 안에 두지 않는다. 웹 백엔드와 MCP 서버가 같은 값을 쓴다.
2. **원본은 파일 하나뿐**: 브라우저는 데이터를 저장하지 않고 항상 API로 받아온다.
3. **캐시 금지**: 서버는 요청마다 파일을 새로 읽는다. 다른 서버가 바꾼 내용이 바로 보여야 한다.
4. **모르는 필드 보존**: 파일을 고칠 때는 전체를 읽고, 바꿀 필드만 바꾸고, 나머지는 그대로 다시 쓴다.
5. **필드 이름은 snake_case**: 이미 배포된 MCP 형식을 따른다. 프론트에 camelCase가 필요하면 API에서 변환한다.
6. **시각**: UTC ISO 8601 문자열 (`2026-10-03T05:20:00.000Z`). Main 헤더만 한국 시간으로 표시한다.
7. **ID 형식**: 파일 경로에 들어가므로 영문, 숫자, `-`, `_`만 쓴다 (`^[A-Za-z0-9_-]+$`).

| 대상 | ID 형식 | 예시 |
|---|---|---|
| 티켓 | `BUG-{번호}` | `BUG-108` |
| Task 브랜치 | `task-{16진수 6자리}` | `task-a1b2c3` |
| Question 브랜치 | `q-{16진수 6자리}` | `q-9f8e7d` |
| Discussion 항목 | `d-{임의 문자열}` | `d-m1x2k3-ab12` |
| 컬럼 | `col-{이름}` | `col-review` |
| 멤버 | 로그인 이름 (`CORAID_USER`와 같은 값) | `eunhak` |

## 폴더 구조

`data/`는 맥미니의 `DATA_DIR`(`~/.local/share/coshell/data`)이다.

```
data/
  board.json             # { columns: [{ id, title, card_ids }], labels, members }
  tickets/
    BUG-123/
      main.json          # { 카드 필드, context: "컴팩트 줄글", discussions: [...], updated_at }
      branches/
        task-a1b2c3.json # Task 브랜치 (MCP가 작성)
        q-9f8e7d.json    # Question 브랜치 (웹이 작성)
```

`tickets/` 아래는 Task MCP가 이미 쓰고 있는 구조 그대로이고, 보드 화면에 필요한 컬럼·라벨·멤버만
`board.json` 하나로 추가했다.

## 파일별 쓰기 담당

| 파일 / 필드 | 쓰는 쪽 |
|---|---|
| `board.json` | 웹 백엔드 |
| `main.json`의 카드 필드, `discussions` | 웹 백엔드 |
| `main.json`의 `context` | 웹 백엔드 (Question 머지), MCP (Task 머지) |
| `main.json`의 `updated_at` | 파일을 고친 쪽 |
| `branches/task-*.json` | MCP |
| `branches/q-*.json` | 웹 백엔드 |

`context`만 두 서버가 함께 쓴다. 데모는 시연을 순서대로 하므로 충돌을 고려하지 않는다.

## `board.json`

보드 전체 구성. 카드가 어느 컬럼에 몇 번째로 있는지는 **여기의 `card_ids`만** 기준으로 삼는다.

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "accent": "bg-zinc-400", "card_ids": ["BUG-101", "BUG-102"] },
    { "id": "col-progress", "title": "In Progress", "accent": "bg-sky-500", "card_ids": ["BUG-104"] },
    { "id": "col-review", "title": "In Review", "accent": "bg-amber-500", "card_ids": ["BUG-108"] },
    { "id": "col-done", "title": "Done", "accent": "bg-emerald-500", "card_ids": [] }
  ],
  "labels": {
    "bug": { "id": "bug", "name": "Bug", "dot": "bg-rose-500", "text": "text-rose-600 dark:text-rose-400" },
    "frontend": { "id": "frontend", "name": "Frontend", "dot": "bg-sky-500", "text": "text-sky-600 dark:text-sky-400" }
  },
  "members": {
    "eunhak": { "id": "eunhak", "name": "Eunhak", "initials": "EH", "color": "bg-violet-600" },
    "won": { "id": "won", "name": "Won Park", "initials": "WP", "color": "bg-amber-600" }
  },
  "updated_at": "2026-10-03T05:20:00.000Z"
}
```

| 필드 | 설명 |
|---|---|
| `columns[].card_ids` | 카드 순서. 카드 이동은 이 배열만 바꾼다. |
| `columns[].accent` | 컬럼 색 (Tailwind 클래스). 현재 `BoardColumn.accent`와 같다. |
| `labels` | 현재 `Label` 구조 그대로. 기본 라벨과 사용자가 추가한 라벨을 모두 저장한다. |
| `members` | 현재 `Member` 구조. **`id`는 로그인 이름**이며, 브랜치 `author`, Discussion `author_id`, 카드 `assignees`가 모두 이 값을 가리킨다. 지금 코드의 목업 멤버(`jh`, `sm` 등)는 실제 팀원으로 바꾼다 (위 값은 예시). |

## `tickets/{id}/main.json`

티켓 하나의 모든 정보. 카드 필드는 현재 `BoardCard`에서 가져오고, 이미 배포된 MCP 필드는 그대로 둔다.

```json
{
  "ticket_id": "BUG-108",
  "title": "Composer jumps on iOS Safari",
  "description": "The virtual keyboard covers the composer. Needs visualViewport handling.",
  "labels": ["bug", "frontend"],
  "priority": "urgent",
  "assignees": ["eunhak"],
  "start_date": "2026-09-27T00:00:00.000Z",
  "due_date": "2026-10-03T00:00:00.000Z",
  "context": "iOS Safari에서 가상 키보드가 composer를 가린다. ...\n\n[Question · won · 2026-10-03 13:10]\nvisualViewport.resize로 고정하기로 결정.\n\n[Task · eunhak · 2026-10-03 14:20]\nresize 리스너 추가, iOS 17/18에서 확인.",
  "discussions": [
    {
      "id": "d-m1x2k3-ab12",
      "author_id": "won",
      "text": "@eunhak 수정 끝나면 VoiceOver로도 확인 부탁해요.",
      "mentions": ["eunhak"],
      "ai": false,
      "created_at": "2026-10-03T04:00:00.000Z"
    }
  ],
  "created_at": "2026-09-27T00:00:00.000Z",
  "updated_at": "2026-10-03T05:20:00.000Z"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `ticket_id` | string | 폴더 이름과 같다. |
| `title`, `description` | string | 카드 제목과 설명. |
| `labels` | string[] | `board.json`의 `labels` 키. |
| `priority` | `"low"` \| `"medium"` \| `"high"` \| `"urgent"` | |
| `assignees` | string[] | 멤버 `id`. |
| `start_date`, `due_date` | string \| null | |
| `context` | string | **AI용 Main 컨텍스트.** 머지된 내용이 헤더와 함께 이어 붙는다 (아래 참조). 새 티켓은 `""`. |
| `discussions` | object[] | 메인 스트림 원문 대화 = 지금의 카드 댓글. |
| `created_at`, `updated_at` | string | `updated_at`은 이 파일이 마지막으로 바뀐 시각. |

**Discussion 항목**

| 필드 | 설명 |
|---|---|
| `id` | `d-` 접두어. |
| `author_id` | 멤버 `id`. |
| `text` | 원문. |
| `mentions` | 핑 대상 멤버 `id` 목록. 없으면 `[]`. (P1 핑 추천에서 사용) |
| `ai` | AI가 쓴 항목이면 `true`. 현재 코드처럼 AI 항목은 수정·삭제할 수 없다. |
| `created_at` | |

**저장하지 않는 값**: 현재 `BoardCard`의 `columnId`, `comments`, `attachments`는 파일에 두지 않는다.
API가 응답할 때 `columnId`는 `board.json`에서, `comments`는 `discussions.length`로 계산하고,
`attachments`는 `0`으로 채운다.

**Question 머지 결과는 Discussion이 아니라 `context`에 들어간다.** 현재 코드는 머지 결과를 AI 댓글로
추가하는데([TicketPanel.tsx](../fe/src/components/ticket/TicketPanel.tsx)), 이를 `context`에 이어 붙이도록 바꾼다.

### Main 컨텍스트에 이어 붙이는 형식

Task와 Question 모두 같은 형식이다.

```
{기존 context}

[{Task|Question} · {author} · {YYYY-MM-DD HH:mm, 한국 시간}]
{summary}
```

- 기존 `context`가 비어 있으면 앞의 빈 줄 없이 헤더부터 시작한다.
- 기존 내용은 고치거나 다시 요약하지 않고 끝에만 붙인다.

## `tickets/{id}/branches/{branch_id}.json`

Task와 Question이 같은 형식을 쓰고 `type`으로 구분한다. 머지된 브랜치도 지우지 않고 `status: "merged"`로
남긴다 (1회 머지 강제와 이력 확인용). UI는 `open` 브랜치만 보여준다.

**공통 필드**

| 필드 | 타입 | 설명 |
|---|---|---|
| `branch_id` | string | `task-` 또는 `q-` 접두어. |
| `type` | `"task"` \| `"question"` | |
| `ticket_id` | string | |
| `author` | string | 멤버 `id`. |
| `status` | `"open"` \| `"merged"` | 머지는 `open`에서 바로 `merged`로 바뀐다. |
| `base_context_at` | string \| null | 브랜치를 만들 때 `main.json`의 `updated_at`. |
| `summary` | string \| null | 머지된 요약. 머지 전에는 `null`. |
| `created_at`, `merged_at` | string, string \| null | |

**Task 전용** (이미 배포된 형식, MCP가 작성)

```json
{
  "branch_id": "task-a1b2c3",
  "type": "task",
  "ticket_id": "BUG-108",
  "author": "eunhak",
  "status": "merged",
  "base_context_at": "2026-10-03T04:00:00.000Z",
  "summary": "resize 리스너 추가, iOS 17/18에서 확인.",
  "work_log": ["Composer.tsx 수정", "iOS 17/18 시뮬레이터 확인"],
  "created_at": "2026-10-03T05:00:00.000Z",
  "merged_at": "2026-10-03T05:20:00.000Z"
}
```

| 필드 | 설명 |
|---|---|
| `work_log` | 작업 과정 기록 (string[]). |

**Question 전용** (웹 백엔드가 작성)

```json
{
  "branch_id": "q-9f8e7d",
  "type": "question",
  "title": "visualViewport 지원 범위",
  "ticket_id": "BUG-108",
  "author": "won",
  "status": "open",
  "base_context_at": "2026-10-03T04:00:00.000Z",
  "summary": null,
  "messages": [
    { "role": "user", "content": "visualViewport는 iOS 몇부터 지원돼?", "at": "2026-10-03T04:10:00.000Z" },
    { "role": "assistant", "content": "iOS 13부터 지원합니다. ...", "at": "2026-10-03T04:10:05.000Z" }
  ],
  "revision": 2,
  "created_at": "2026-10-03T04:09:00.000Z",
  "merged_at": null
}
```

| 필드 | 설명 |
|---|---|
| `title` | 브랜치 탭 이름. 첫 질문으로 자동 지정하고 사용자가 바꿀 수 있다 (최대 40자). |
| `messages` | 채팅 원문. `role`은 `"user"` 또는 `"assistant"`, `content`는 일반 텍스트. assistant-ui의 `UIMessage`(parts 구조)는 저장할 때 텍스트로 바꾸고, 불러올 때 다시 변환한다. |
| `revision` | 메시지가 추가될 때마다 1 증가. compact 미리보기가 최신 대화 기준인지 확인하는 데 쓴다 (현재 `question-branch.ts`의 동작). |

**Question 머지 흐름**: compact 미리보기는 파일에 저장하지 않는다. 서버가 미리보기와 그때의 `revision`을
돌려주고, 사용자가 승인하면 그 `revision`과 compact 문장을 함께 보낸다. 서버는 `revision`이 그대로일 때만
`context`에 이어 붙이고 브랜치를 `merged`로 바꾼다.

## 시드 데이터

- 지금 `board.ts`의 시드(`BUG-101`~`110`, 컬럼 4개, 라벨, 댓글)를 이 형식으로 옮겨 하나의 시드 세트로 만든다.
  데모 시나리오에 쓸 티켓에는 `context` 초기값을 채워 둔다.
- MCP 시드 스크립트(`mcp/scripts/seed.mjs`)도 이 `data/tickets/`를 맥미니 `DATA_DIR`로 복사한다.
- 시드는 파일이 없을 때만 만들고, 이미 있는 데이터는 덮어쓰지 않는다 (배포 때마다 실행되기 때문).

## API 초안 (참고)

웹 백엔드([fe/server/api.mjs](../fe/server/api.mjs))에 추가할 엔드포인트. 상세 설계는 별도로 정한다.

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/api/board` | `board.json`과 모든 티켓의 카드 필드를 합쳐 반환 |
| POST | `/api/tickets` | 티켓 생성 (`main.json` 생성 + 컬럼 `card_ids`에 추가) |
| PATCH | `/api/tickets/:id` | 카드 필드 수정 |
| DELETE | `/api/tickets/:id` | 컬럼에서 제거하고 티켓 폴더 삭제 |
| POST | `/api/tickets/:id/move` | 컬럼과 순서 변경 (`board.json`만 수정) |
| GET | `/api/tickets/:id` | `main.json` 전체 (context, discussions 포함) |
| POST / PATCH / DELETE | `/api/tickets/:id/discussions[/:did]` | Discussion 추가·수정·삭제 |
| GET / POST | `/api/tickets/:id/branches` | Question 브랜치 목록·생성 |
| POST | `/api/branches/:bid/messages` | 질문 전송, 답변 저장 |
| POST | `/api/branches/:bid/preview` | compact 미리보기 생성 |
| POST | `/api/branches/:bid/merge` | 승인된 compact를 `context`에 이어 붙이고 `merged` 처리 |
| POST | `/api/labels`, `/api/columns` | 라벨, 컬럼 추가 (`board.json`) |

웹에서 Task 머지 결과를 바로 보려면, 프론트가 열려 있는 티켓의 `main.json`을 몇 초마다 다시 불러온다.

## Open questions

1. **실제 팀원 목록**: `members`의 `id`, 이름, 색. 로그인 이름은 `CORAID_USER`와 같아야 한다.
2. **Question 브랜치 저장 이전**: 현재 Question 브랜치 코드(`question-branch.ts`, `question-branch-chat.ts`,
   `branches.ts`, `TicketChat`)는 브라우저 저장을 기준으로 한다. 서버 저장으로 옮기면서 구조를 어떻게 정리할지 정한다.
3. **티켓 삭제**: 폴더를 지울지, `tickets/_deleted/`로 옮길지.
