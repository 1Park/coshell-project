# CoRAID 협업 시나리오

**Status:** Draft

**Reference:** [CoRAID Prompt Design](./coraid-prompts.md)

**Scope:** 제품 흐름과 예시 대화. 구현 완료 여부를 설명하는 문서는 아니다.

## 기본 전제

- 공통 세션에는 사람 간 대화인 `discussion`과 개인 세션에서 공유한 요약이 있다. AI에게 질문하거나 답변을 받는 공간은 개인 세션이다.
- 개인 세션의 대화 원문은 비공개다. 다른 사람은 공통 세션에 공유된 요약만 볼 수 있다.
- 개인 세션 AI는 티켓 설명, 최신 discussion, 공유된 요약, 본인의 개인 세션 대화를 참조한다.
- 개인 세션을 머지하기 전에는 해당 대화의 요약을 공통 세션에 올리지 않는다.
- 머지 시 공통 세션에 요약을 append한다. 기존 공유 내용을 덮어쓰지 않고, 원본 개인 세션은 보존한다.
- 이 시나리오에서 태스크 생성은 개인 세션 요약의 머지를 포함한다.
- 태스크 생성 후 영어 pointer 기반 handoff prompt를 제공한다. Claude Code는 MCP로 실제 맥락을 조회한 뒤 작업한다.
- 완료 보고는 사용자 승인 후에만 공유한다. 보고 제출 후 상태는 `in_review`이며, `done`은 사람이 PR 머지 또는 산출물 승인 후 설정한다.

### 이 시나리오에서 추가로 명시하는 UX

`coraid-prompts.md`는 최신 공통 맥락을 참조하는 구조를 설명하지만, 열린 개인 세션에 새 맥락을 실시간으로 표시하는 방식까지 정의하지는 않는다.

이 시나리오에서는 다른 사람이 머지하면 이미 열린 개인 세션에 **새 공유 요약 안내**가 들어오는 UX를 가정한다. 이는 개인 AI의 답변이나 다른 사람의 대화 원문 복사가 아니라 시스템 안내다. 이후 AI 응답과 태스크 생성은 최신 공유 맥락을 사용한다. 이 동작이 현재 구현되어 있다는 의미는 아니다.

## 등장인물

- 민준: 프론트엔드 조사 및 수정 담당
- 수아: 백엔드 검증 담당
- 지훈: 중간에 합류해 회귀 테스트를 담당
- CoRAID 개인 세션 AI: 질문 답변, 맥락 요약, 태스크 구체화 지원
- Claude Code: handoff prompt와 CoRAID MCP를 이용해 저장소에서 작업하는 개인 AI

## 버그 티켓

**Ticket ID:** `BUG-204`

**제목:** 장바구니 수량 변경 후 새로고침하면 총액이 이전 값으로 표시됨

**증상:** 상품 수량을 변경하면 총액이 즉시 정상 업데이트되지만, 새로고침 후에는 변경 전 총액이 표시된다. 원인은 아직 확인되지 않았다.

**재현 절차:**

1. 단가 10,000원인 상품 A를 장바구니에 1개 담는다.
2. 수량을 3개로 변경한다.
3. 총액이 30,000원으로 표시되는지 확인한다.
4. 페이지를 새로고침한다.
5. 총액이 10,000원으로 돌아가는 것을 확인한다.

**기대 결과:** 새로고침 후에도 최신 수량 기준으로 총액 30,000원이 표시된다.

## 1. 공통 세션에서 역할 분담

공통 세션의 discussion:

**민준:**
> 수량 변경 직후에는 총액이 맞는데 새로고침하면 이전 금액으로 돌아갑니다. 저는 프론트 초기화 쪽을 확인할게요.

**수아:**
> 저는 수량 변경 API와 조회 API가 최신 값을 반환하는지 확인하겠습니다.

이 단계에는 사람 간 discussion만 있다. 공통 세션에서 AI와 대화하지 않는다.

## 2. 민준이 개인 세션을 열고 질문

민준의 개인 세션 `q-minjun-001`:

**민준:**
> 새로고침 후에만 총액이 이전 값으로 돌아가는데, 프론트에서 어디부터 확인하면 좋을까?

**개인 AI:**
> 수량 변경 직후의 상태 업데이트와 새로고침 후 초기화 경로를 비교해보세요. 특히 초기 렌더링에서 총액을 서버 응답으로 계산하는지, 저장된 summary를 사용하는지 확인하면 좋겠습니다.
>
> 백엔드가 최신 데이터를 반환하는지는 아직 확인되지 않았으므로, 현재는 프론트 캐시와 API 응답 freshness 모두 가능성이 있습니다.

**민준:**
> 백엔드 결과를 기다리면서 초기화 로직부터 살펴볼게.

민준은 **머지하지 않는다**. 대화는 개인 세션에만 남고 공통 세션에는 요약이 올라가지 않는다. 개인 세션은 열린 상태로 유지된다.

## 3. 수아가 개인 세션에서 검증 결과 정리

수아의 개인 세션 `q-sua-001`:

**수아:**
> 백엔드에서는 무엇부터 확인하면 좋을까?

**개인 AI:**
> 수량 변경이 DB에 저장되는지, 변경 직후 조회 API가 최신 quantity를 반환하는지, 해당 경로에 서버 응답 캐시가 적용되는지 확인하세요.

수아가 직접 검증한 뒤 같은 개인 세션에 결과를 전달한다.

**수아:**
> 수량을 1에서 3으로 바꾼 뒤 조회 API를 확인했어. DB에도 3으로 저장되고 응답의 quantity도 3이야. 이 경로에는 서버 응답 캐시도 없어. 팀에 공유할 내용 정리해줘.

**개인 AI:**
> 공유할 요약입니다.
>
> 수량 변경 후 DB에 최신 quantity가 저장되고, 장바구니 조회 API도 최신 quantity를 반환하는 것을 확인했습니다. 확인한 경로에는 서버 응답 캐시가 적용되지 않습니다. 현재 확인 범위에서는 프론트 초기 렌더링의 총액 계산 또는 캐시 사용을 우선 조사하는 것이 적절합니다.

수아가 **머지**를 선택한다. 이 요약이 공통 세션에 append된다. 수아의 개인 대화 원문은 공유되지 않는다.

## 4. 민준의 열린 개인 세션에 새 공유 요약 반영

민준의 개인 세션에 시스템 안내가 표시된다.

**공유 맥락 업데이트:**
> 수아님의 개인 세션 요약이 공통 세션에 추가되었습니다.
>
> 수량 변경 후 DB와 조회 API 모두 최신 quantity를 유지하며, 확인한 경로에는 서버 응답 캐시가 적용되지 않습니다. 프론트 초기 렌더링의 총액 계산 또는 캐시 사용을 우선 조사하는 것이 적절합니다.

민준의 개인 세션은 여전히 머지되지 않은 상태다. 새 요약을 받았다고 민준의 개인 대화가 공유되는 것은 아니다.

**민준:**
> 수아가 공유한 결과를 반영하면, 내가 다음으로 확인할 건 뭐야?

**개인 AI:**
> 수아님이 공유한 확인 결과를 반영하면, 조회 API의 quantity가 오래된 값일 가능성은 낮아졌습니다.
>
> 다음으로는 새로고침 후 받은 최신 quantity가 실제 총액 계산에 사용되는지 확인하세요. item 수량은 최신인데 총액만 이전 값이라면, 별도로 저장된 summary나 persisted total을 사용하는 경로가 있는지 살펴보는 것이 좋겠습니다.
>
> 아직 프론트 원인을 확인한 것은 아니므로, 캐시 문제는 가설로 유지하겠습니다.

## 5. 민준이 태스크 생성 시 개인 세션 머지

**민준:**
> 초기 렌더링에서 총액의 source of truth를 확인하고 수정하는 태스크로 만들어줘.

**개인 AI:**
> 최신 공통 맥락과 지금까지의 개인 대화를 바탕으로 태스크를 정리하겠습니다. 실제 캐시 구조와 원인은 Claude Code가 저장소를 확인해 판단하도록 하고, 최신 quantity 기준으로 총액이 표시되는 것을 완료 조건으로 두겠습니다.

민준이 **태스크 생성**을 선택한다.

1. 민준의 개인 세션을 요약해 공통 세션에 append한다. 이번이 민준의 첫 머지다.
2. 원본 개인 세션을 보존하고 상태를 `merged`로 기록한다.
3. 태스크 `task-frontend-001`을 `pending` 상태로 생성한다.
4. 최신 공통 맥락 요약과 민준의 개인 세션 요약을 태스크에 저장한다.
5. 영어 handoff prompt를 생성한다.

공통 세션에 공유되는 민준의 요약:

> 프론트 초기화 경로와 수량 변경 직후 상태 업데이트 경로를 비교하기로 했습니다. 수아의 백엔드 검증 결과를 반영해, 최신 quantity가 총액 계산에 사용되는지와 오래된 summary 사용 여부를 우선 확인하는 수정 태스크를 생성했습니다. 프론트 원인은 아직 미확정입니다.

태스크 초안 예시:

```json
{
  "title": "Fix stale cart total after refresh",
  "instruction": "Read the full ticket context through CoRAID MCP before implementation. Investigate why the cart total becomes stale after refresh despite the cart API returning the latest quantity. Inspect the initial-render total calculation and any cached or persisted summary usage. Fix the confirmed cause without regressing immediate quantity updates. Use the repository's existing pricing rules and test setup.",
  "acceptance_criteria": [
    "After changing quantity and refreshing, the total reflects the latest cart data.",
    "Immediate total updates after quantity changes still work.",
    "Relevant verification is performed and any testing gaps are reported."
  ],
  "relevant_context_summary": "Sua verified that DB persistence and cart API quantity are current, with no server response cache on the checked path. Minjun narrowed the investigation to frontend initial-render total calculation. The frontend cause remains unconfirmed.",
  "risks_or_open_questions": [
    "The actual frontend state and cache mechanisms must be inspected.",
    "Existing pricing rules must be preserved."
  ]
}
```

## 6. Claude Code로 작업 전달

생성된 handoff prompt 예시:

```text
You are working with CoRAID, a multiplayer bug-fixing workspace.

Use the CoRAID MCP tools before implementing. Do not rely only on this pasted prompt.

Task pointers:
- ticket_id: BUG-204
- task_id: task-frontend-001
- personal_session_id: q-minjun-001
- author_id: minjun

Task title:
Fix stale cart total after refresh

Task instruction:
Investigate and fix the stale cart total after refresh. Verify the initial-render total calculation and any cached or persisted summary usage. Preserve existing pricing rules and immediate quantity updates. Run relevant verification.

Required flow:
1. Call get_task_context with the IDs above.
2. Read the ticket description, common context, discussion, your user's personal-session context, and task instruction.
3. Set the task to in_progress when starting work.
4. Implement and verify the fix in this repository.
5. Prepare a reviewable deliverable.
6. Draft a report with URL, change summary, changed files, test results, remaining issues, and author_id.
7. Show the exact report to me and ask for approval.
8. Only after approval, call submit_task_report.
9. Ensure the task is in_review after submission.

Rules:
- Never set done; a human does that after merge or acceptance.
- Common context is append-only.
- Do not read other users' private personal sessions.
- Concurrent work and overlapping files are expected.
- If the task is ambiguous, ask one concise question before editing.
```

민준이 이 프롬프트를 Claude Code에 전달한다. Claude Code는 먼저 `get_task_context`를 호출한다.

```json
{
  "ticket_id": "BUG-204",
  "task_id": "task-frontend-001",
  "personal_session_id": "q-minjun-001"
}
```

조회 결과에는 최신 공통 요약과 recent entries, discussion, 민준의 개인 세션 요약 및 관련 대화 발췌, 태스크 지시가 포함된다. 수아의 비공개 대화 원문은 포함되지 않는다.

Claude Code는 목표를 짧게 설명하고 `update_task_status`로 `in_progress`를 설정한 뒤 조사와 구현을 시작한다. 작업 상태는 태스크 정보로 공유되며, 공통 세션에 별도의 AI 대화가 생기지는 않는다.

## 7. 지훈이 중간 합류해 개인 세션에서 맥락 요청

공통 세션의 discussion:

**지훈:**
> 방금 합류했습니다. 현재 상황을 확인하고 테스트 쪽으로 도울게요.

지훈은 개인 세션 `q-jihoon-001`을 열어 AI에게 묻는다.

**지훈:**
> 이 티켓의 지금까지 상황을 요약해줘. 확인된 사실과 가설, 각자 맡은 일을 구분해서 알려줘.

**개인 AI:**
> 티켓은 수량 변경 직후에는 총액이 맞지만 새로고침 후 이전 금액으로 돌아가는 문제입니다.
>
> 확인된 사실: 수아님이 공유한 요약에 따르면 DB와 조회 API 모두 최신 quantity를 유지하며, 확인한 경로에는 서버 응답 캐시가 없습니다.
>
> 아직 가설인 부분: 프론트 초기 렌더링에서 오래된 summary를 사용하거나 최신 quantity를 총액 계산에 반영하지 않을 가능성이 있습니다. 프론트 원인은 아직 확정되지 않았습니다.
>
> 역할: 수아님은 백엔드 검증을 공유했고, 민준님은 프론트 수정 태스크를 진행 중입니다. 지훈님은 수량 변경 후 새로고침 시 총액을 검증하는 회귀 테스트를 맡을 수 있습니다.
>
> 이 요약은 공통 discussion과 공유된 개인 세션 요약, 태스크 상태를 기준으로 했습니다. 다른 사람의 비공개 개인 대화는 읽지 않았습니다.

## 8. 지훈이 테스트 태스크 생성

**지훈:**
> 기존 테스트 구조를 확인하고 이 버그의 회귀 테스트를 추가하는 태스크로 만들어줘.

**개인 AI:**
> 수량 변경 후 실제 새로고침 시 최신 총액을 유지하는 테스트를 목표로 하겠습니다. 현재 테스트 환경에서 실제 새로고침을 검증하기 어렵다면 페이지 재진입이나 데이터 재로딩을 검증하고, 그 한계를 보고하도록 하겠습니다.

지훈이 태스크 생성을 선택한다. 지훈의 개인 세션 요약이 공통 세션에 머지되고 `task-test-001`이 생성된다. 지훈도 pointer 기반 영어 프롬프트를 개인 Claude Code에 전달한다.

Claude Code는 `get_task_context`로 그 시점의 최신 공유 맥락을 읽고 `in_progress`로 작업을 시작한다. 민준과 파일이 겹칠 수 있다는 이유만으로 작업을 피하지 않는다.

## 9. 민준의 작업 결과를 승인 후 공유

아래 결과는 시나리오용 가상 결과다. 경로, 명령, PR 번호는 실제 저장소에서 확인된 정보가 아니다.

민준의 Claude Code가 초기 렌더링에서 오래된 summary total을 사용하는 경로를 확인하고 수정했다고 가정한다. AI는 보고서를 바로 제출하지 않고 민준에게 정확한 내용을 먼저 보여준다.

```text
URL: https://github.com/example/cart-app/pull/42

Change summary:
- Fixed the initial-render path that prioritized a stale cached cart total.
- Used fresh cart data with the existing pricing calculation.
- Preserved immediate total updates after quantity changes.

Changed files:
- src/cart/CartPage.tsx: updated initial total data flow.
- src/cart/cartSelectors.ts: removed stale summary precedence.

Test results:
- npm test -- cart: passed.

Remaining issues:
- Requires code review and integration with the regression test task.
- Browser-level refresh coverage has not yet been verified.

Author ID: minjun
```

**Claude Code:**
> Do you approve submitting this report to CoRAID?

**민준:**
> 승인할게. 이 내용으로 공유해줘.

승인 후 Claude Code가 `submit_task_report`를 호출한다. 승인된 결과가 공통 세션의 공유 요약으로 append되고, 태스크 상태는 `in_review`가 된다. 개인 작업 대화 원문은 공유되지 않는다.

UI에 **완료/결과 공유** 버튼을 둔다면, 이 단계의 완료는 보고 승인 및 제출을 의미한다. 최종 상태 `done`을 의미하지 않는다.

## 10. 지훈이 최신 결과를 반영하고 테스트 보고

지훈의 열린 CoRAID 개인 세션에는 민준이 승인해 공유한 작업 결과 요약이 안내된다. 지훈은 자신의 Claude Code에도 최신 결과를 반영하도록 요청한다.

**지훈:**
> 민준의 수정 결과가 공유됐어. 최신 태스크 맥락을 다시 조회하고 테스트 작업에 반영해줘.

Claude Code는 `get_task_context`를 다시 호출해 공유된 결과를 확인한다. CoRAID 개인 세션의 안내가 실행 중인 Claude Code에 자동 주입된다고 가정하지 않는다.

지훈의 Claude Code가 회귀 테스트를 추가하고 검증한다. 실제 새로고침 대신 재마운트만 검증했다면 그 차이를 명시한다. 완료 보고 예시:

```text
URL: https://github.com/example/cart-app/pull/43

Change summary:
- Added regression coverage for the total after quantity change and cart page remount.
- Confirmed the test fails on the pre-fix revision and passes with the frontend fix.

Changed files:
- src/cart/CartPage.test.tsx: added regression coverage.

Test results:
- npm test -- CartPage.test.tsx: passed with the fix.
- The new regression test failed on the pre-fix revision as expected.

Remaining issues:
- The test covers page remount with reloaded data, not an actual browser refresh.
- Browser-level refresh verification remains necessary.

Author ID: jihoon
```

이 보고서의 실패/통과 결과는 실제로 검증한 경우에만 기재한다. 지훈이 정확한 보고 내용을 승인한 뒤 제출하고, 테스트 태스크도 `in_review`가 된다.

## 11. 최종 정리와 사람이 완료 처리

민준은 개인 세션에서 최종 상태를 묻는다.

**민준:**
> 지금까지 공유된 결과와 남은 작업을 정리해줘.

**개인 AI:**
> 백엔드 검증에서는 최신 quantity 저장과 조회가 확인됐습니다. 프론트 작업 보고에서는 초기 렌더링이 오래된 summary total을 우선 사용한 원인을 확인하고 수정했다고 공유됐습니다.
>
> 수정 태스크와 회귀 테스트 태스크는 모두 `in_review`입니다. 테스트는 페이지 재마운트 경로를 검증했지만 실제 브라우저 새로고침 검증은 남아 있습니다.
>
> 남은 작업은 코드 리뷰, 실제 브라우저 새로고침 확인, 변경사항 머지입니다. 이후 사람이 태스크 상태를 `done`으로 설정해야 합니다.

이 답변도 민준의 개인 세션에만 남는다. 민준이 요약을 머지하면 공통 세션에 공유할 수 있다.

팀이 리뷰와 실제 새로고침 검증을 마치고 PR을 머지한 뒤, 사람이 태스크를 `done`으로 설정한다.

## 전체 흐름

1. 공통 discussion에서 사람들이 역할을 나눈다.
2. 민준이 개인 AI에게 질문하고, 머지하지 않은 채 세션을 열어둔다.
3. 수아가 개인 세션에서 검증 결과를 정리한 뒤 먼저 머지한다.
4. 수아의 공유 요약이 민준의 열린 개인 세션에 안내된다.
5. 민준이 최신 맥락으로 추가 질문하고, 태스크 생성 시 처음 머지한다.
6. pointer 기반 프롬프트를 받은 Claude Code가 MCP로 맥락을 조회하고 작업한다.
7. 중간 합류한 지훈은 개인 세션에서 맥락 요약을 받고 테스트 태스크를 만든다.
8. 각 사용자가 정확한 완료 보고를 승인하면 공유 요약이 공통 세션에 append된다.
9. 결과 제출 후 태스크는 `in_review`, 리뷰와 머지 후 사람이 `done`으로 설정한다.
