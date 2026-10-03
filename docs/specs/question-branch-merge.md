# Question Branch 머지 플로우 (웹)

**Status:** Draft — pending review

## Problem

티켓별 AI 대화가 하나의 스트림에 쌓이면 Main( AI용 컴팩트 줄글)이 오염된다.
PRD가 요구하는 규율 — 브랜치 단위 격리, 사람이 선택할 때만 auto-compact 머지,
1브랜치 1회 머지, 머지 후 브랜치 삭제 — 를 강제하는 웹 UI와 데이터 모델이 없다.
현재 FE에는 브랜치 개념 자체가 없으며, 모든 대화가 단일 세션으로 저장된다.

## Goals

- 웹 채팅 시작 = Question Branch 자동 생성 (티켓당 N개, 격리된 대화)
- 브랜치 목록 표시 (티켓 패널 내 탭/섹션)
- 머지 플로우: 브랜치 선택 → auto-compact 미리보기 → 사람 승인 → Main 반영 → 브랜치 삭제
- 1회성 강제: 머지된 브랜치는 삭제되고 UI에서 사라짐. 부분머지 UI를 제공하지 않음
- 브랜치 대화는 로컬 JSON에 기록 (웹 로컬 JSON 접근 방식은 미결정 — Open questions 참조)
- 승인 전에는 Main이 오염되지 않음 (미리보기는 별도 상태)

## Non-goals

- Task (MCP) 브랜치 — MCP/BE 세션 담당. FE는 승인 화면만 공유할 수 있음
- 핑 추천 (P1), 리포트 자동생성 (P2)
- 다중 사용자, Jira 연동 (PRD 제외 대상)
- auto-compact 알고리즘 자체 — Claude 측 처리로 가정, FE는 전달/표시만 담당

## Proposal (FE)

1. **브랜치 생성**: 티켓 패널에서 "새 질문" 시작 시 `question-{id}` 브랜치 생성.
   기존 단일 세션(`messagesByTicket`)은 Main Discussion 스트림으로 유지하고,
   브랜치 메시지는 별도 키(`branchesByTicket[ticketId][branchId]`)로 격리.
2. **브랜치 목록**: 패널 상단에 브랜치 탭 (Main + Q1, Q2…). Main 탭 = Discussion,
   Q 탭 = 해당 브랜치 대화.
3. **머지**: Q 탭에서 "Main에 머지" → compact 결과 미리보기 다이얼로그
   (전달 단계) → 승인 (승인 단계) → Main 반영 + 브랜치 삭제 (반영 단계).
   반려 시 브랜치 유지.
4. **Main 표시**: 티켓 상세 또는 패널에 컴팩트 줄글 읽기 뷰 (P0 최소: 텍스트 표시).

## Data sketch (localStorage 우선, 로컬 JSON 확정 시 이관)

```ts
branchesByTicket: Record<ticketId, Branch[]>
Branch = { id, title, messages: UIMessage[], status: 'open' | 'merging' | 'merged' }
mainByTicket: Record<ticketId, string>  // 컴팩트 줄글
```

## Open questions

1. **웹 로컬 JSON 접근 방식** (착수 블로커): File System Access API vs
   로컬 서버(사이드카) vs 파일 다운로드/업로드. 결정 없이는 브랜치 영속 위치 불가.
2. auto-compact 호출 주체: 웹에서 Claude API 직접 vs 로컬 서버 경유
   (API키 로컬 한정 원칙과 연관).
3. Main 줄글 포맷: 자유 텍스트 vs 섹션 구조(요약/결정/미결)?
