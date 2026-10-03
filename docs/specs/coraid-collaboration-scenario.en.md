# CoRAID Collaboration Scenario

**Status:** Draft

**Reference:** [CoRAID Prompt Design](./coraid-prompts.md)

**Korean version:** [CoRAID Collaboration Scenario](./coraid-collaboration-scenario.md)

**Scope:** Product flow and example conversations. This document does not describe which features have already been implemented.

## Ground Rules

- The common session contains human-to-human `discussion` and summaries shared from personal sessions. Questions to AI and AI responses belong in personal sessions.
- Personal-session transcripts are private. Other people can see only the summaries shared in the common session.
- The personal-session AI uses the ticket description, latest discussion, shared summaries, and the user's own personal-session conversation.
- Before a personal session is merged, its conversation summary is not posted to the common session.
- Merging appends a summary to the common session. Existing shared content is not overwritten, and the original personal session is preserved.
- In this scenario, creating a task includes merging the personal-session summary.
- After task creation, CoRAID provides an English pointer-based handoff prompt. Claude Code retrieves the actual context through MCP before working.
- Completion reports are shared only after user approval. After submission, the task is `in_review`. A human sets `done` after the PR is merged or the deliverable is accepted.

### Additional UX Specified in This Scenario

`coraid-prompts.md` describes using up-to-date common context, but does not define how new context is displayed in real time in an already-open personal session.

This scenario assumes a UX in which another person's merge delivers a **new shared-summary notification** to an already-open personal session. This is a system notification, not a personal AI response or a copy of another person's transcript. Subsequent AI responses and task creation use the latest shared context. This does not imply that the behavior is currently implemented.

## Participants

- Minjun: investigates and fixes the frontend
- Sua: validates the backend
- Jihoon: joins midway and handles regression testing
- CoRAID personal-session AI: answers questions, summarizes context, and helps clarify tasks
- Claude Code: the personal AI that works in the repository using the handoff prompt and CoRAID MCP

## Bug Ticket

**Ticket ID:** `BUG-204`

**Title:** Cart total shows a stale value after a quantity change and refresh

**Symptoms:** Changing an item quantity immediately updates the total correctly, but refreshing the page displays the total from before the change. The cause has not yet been confirmed.

**Steps to reproduce:**

1. Add one unit of product A, priced at KRW 10,000, to the cart.
2. Change the quantity to three.
3. Confirm that the total displays KRW 30,000.
4. Refresh the page.
5. Observe that the total returns to KRW 10,000.

**Expected result:** After refresh, the total still displays KRW 30,000 based on the latest quantity.

## 1. Assign Roles in the Common Session

Discussion in the common session:

**Minjun:**
> The total is correct immediately after changing the quantity, but returns to the previous amount after refresh. I'll check the frontend initialization path.

**Sua:**
> I'll check whether the quantity update API and cart read API return up-to-date values.

At this stage, there is only human-to-human discussion. Nobody talks to AI in the common session.

## 2. Minjun Opens a Personal Session and Asks a Question

Minjun's personal session, `q-minjun-001`:

**Minjun:**
> The total only returns to the old value after refresh. Where should I start investigating on the frontend?

**Personal AI:**
> Compare the state update immediately after the quantity change with the initialization path after refresh. In particular, check whether the initial render calculates the total from the server response or uses a saved summary.
>
> We have not yet confirmed whether the backend returns up-to-date data, so both frontend caching and API response freshness remain possible causes.

**Minjun:**
> I'll look at the initialization logic while waiting for the backend results.

Minjun **does not merge**. The conversation remains only in his personal session, and no summary is posted to the common session. His personal session stays open.

## 3. Sua Organizes Validation Results in Her Personal Session

Sua's personal session, `q-sua-001`:

**Sua:**
> What should I check first on the backend?

**Personal AI:**
> Check whether quantity changes are persisted in the database, whether the read API returns the latest quantity immediately after the change, and whether server response caching applies to that path.

Sua performs the checks herself, then provides the results in the same personal session.

**Sua:**
> I changed the quantity from one to three and checked the read API. The database stores three, and the response quantity is also three. There is no server response cache on this path. Summarize what I should share with the team.

**Personal AI:**
> Here is the summary to share.
>
> After the quantity change, the database stores the latest quantity and the cart read API returns it correctly. Server response caching does not apply to the checked path. Based on these checks, the next priority should be the frontend initial-render total calculation or cache usage.

Sua selects **Merge**. This summary is appended to the common session. Her personal conversation transcript is not shared.

## 4. The New Shared Summary Reaches Minjun's Open Personal Session

A system notification appears in Minjun's personal session.

**Shared context update:**
> Sua's personal-session summary has been added to the common session.
>
> After quantity changes, both the database and read API retain the latest quantity. Server response caching does not apply to the checked path. The next priority should be the frontend initial-render total calculation or cache usage.

Minjun's personal session is still unmerged. Receiving a new summary does not share his private conversation.

**Minjun:**
> Given the results Sua shared, what should I check next?

**Personal AI:**
> Based on Sua's shared validation results, the read API returning a stale quantity is now less likely.
>
> Next, check whether the latest quantity received after refresh is actually used in the total calculation. If item quantities are current but only the total is stale, look for a path that uses a separately stored summary or persisted total.
>
> We have not confirmed the frontend cause yet, so the cache issue remains a hypothesis.

## 5. Minjun Merges His Personal Session When Creating a Task

**Minjun:**
> Create a task to investigate and fix the source of truth for the total during initial render.

**Personal AI:**
> I'll draft the task using the latest common context and our personal conversation so far. Claude Code should inspect the repository to determine the actual cache structure and cause. The acceptance criteria will require the total to reflect the latest quantity.

Minjun selects **Create Task**.

1. CoRAID summarizes Minjun's personal session and appends it to the common session. This is his first merge.
2. The original personal session is preserved and its status is recorded as `merged`.
3. Task `task-frontend-001` is created with status `pending`.
4. The latest common-context summary and Minjun's personal-session summary are stored with the task.
5. An English handoff prompt is generated.

Minjun's summary shared in the common session:

> Minjun will compare the frontend initialization path with the state update immediately after a quantity change. Incorporating Sua's backend validation, he created a fix task that prioritizes checking whether the latest quantity is used in the total calculation and whether a stale summary is being used. The frontend cause remains unconfirmed.

Example task draft:

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

## 6. Hand Off the Work to Claude Code

Example generated handoff prompt:

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

Minjun passes this prompt to Claude Code. Claude Code first calls `get_task_context`.

```json
{
  "ticket_id": "BUG-204",
  "task_id": "task-frontend-001",
  "personal_session_id": "q-minjun-001"
}
```

The response includes the latest common summary and recent entries, discussion, Minjun's personal-session summary and relevant transcript excerpts, and task instructions. It does not include Sua's private transcript.

Claude Code briefly states the goal, sets `in_progress` through `update_task_status`, and begins investigation and implementation. Work status is shared as task information; it does not create a separate AI conversation in the common session.

## 7. Jihoon Joins Midway and Requests Context in a Personal Session

Discussion in the common session:

**Jihoon:**
> I just joined. I'll catch up on the current situation and help with testing.

Jihoon opens personal session `q-jihoon-001` and asks the AI.

**Jihoon:**
> Summarize the situation so far for this ticket. Separate confirmed facts, hypotheses, and each person's responsibilities.

**Personal AI:**
> The issue is that the total is correct immediately after changing quantity, but returns to the previous amount after refresh.
>
> Confirmed facts: According to Sua's shared summary, both the database and read API retain the latest quantity, and there is no server response cache on the checked path.
>
> Remaining hypotheses: The frontend initial render may use a stale summary or fail to incorporate the latest quantity in the total calculation. The frontend cause has not yet been confirmed.
>
> Responsibilities: Sua shared the backend validation. Minjun is working on the frontend fix task. You could handle a regression test that verifies the total after a quantity change and refresh.
>
> This summary is based on common discussion, shared personal-session summaries, and task status. I have not read anyone else's private personal conversation.

## 8. Jihoon Creates a Test Task

**Jihoon:**
> Create a task to inspect the existing test setup and add regression coverage for this bug.

**Personal AI:**
> The goal will be to verify that the latest total is retained after a quantity change and an actual refresh. If the current test environment cannot verify a real refresh, the task should cover page re-entry or data reload and report that limitation.

Jihoon selects task creation. His personal-session summary is merged into the common session, and `task-test-001` is created. He also passes an English pointer-based prompt to his personal Claude Code.

Claude Code reads the latest shared context at that time through `get_task_context` and starts work with status `in_progress`. It does not avoid the task merely because its files might overlap with Minjun's work.

## 9. Share Minjun's Results After Approval

The results below are fictional examples for this scenario. Paths, commands, and PR numbers are not verified details from the actual repository.

Assume Minjun's Claude Code identifies and fixes a path that uses a stale summary total during initial render. The AI does not submit the report immediately; it first shows Minjun the exact content.

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

**Minjun:**
> Approved. Share it with this content.

After approval, Claude Code calls `submit_task_report`. The approved results are appended as a shared summary in the common session, and the task becomes `in_review`. The personal work transcript is not shared.

If the UI provides a **Complete / Share Results** button, completion at this stage means approving and submitting the report. It does not mean the final task status `done`.

## 10. Jihoon Incorporates the Latest Results and Reports on Testing

Jihoon's open CoRAID personal session receives a notification containing the summary of Minjun's approved and shared results. Jihoon also asks his Claude Code to incorporate the latest results.

**Jihoon:**
> Minjun's fix results have been shared. Fetch the latest task context again and incorporate it into the testing work.

Claude Code calls `get_task_context` again to read the shared results. This scenario does not assume that a notification in a CoRAID personal session is automatically injected into a running Claude Code session.

Jihoon's Claude Code adds and verifies regression coverage. If it verifies only a remount rather than a real refresh, it explicitly states the difference. Example completion report:

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

Failure and success results in this report should be stated only if actually verified. Jihoon approves the exact report before submission, and the test task also becomes `in_review`.

## 11. Final Summary and Human Completion

Minjun asks for the final status in his personal session.

**Minjun:**
> Summarize the results shared so far and the remaining work.

**Personal AI:**
> Backend validation confirmed that the latest quantity is stored and returned. The frontend work report states that the initial-render path prioritized a stale summary total, and that this cause was identified and fixed.
>
> Both the fix task and regression test task are `in_review`. The test covers page remount, but verification of an actual browser refresh remains outstanding.
>
> Remaining work includes code review, actual browser refresh verification, and merging the changes. Afterward, a human must set the task status to `done`.

This response also remains only in Minjun's personal session. He can share it in the common session by merging the summary.

After the team completes review and actual refresh verification and merges the PRs, a human sets the tasks to `done`.

## End-to-End Flow

1. People assign roles through common discussion.
2. Minjun asks his personal AI questions and keeps the session open without merging.
3. Sua organizes validation results in her personal session and merges first.
4. Sua's shared summary is delivered as a notification in Minjun's open personal session.
5. Minjun asks follow-up questions using the latest context and merges for the first time when creating a task.
6. Claude Code receives a pointer-based prompt, retrieves context through MCP, and works on the task.
7. Jihoon joins midway, receives a context summary in his personal session, and creates a test task.
8. After each user approves the exact completion report, a shared summary is appended to the common session.
9. Submitted tasks become `in_review`; after review and merge, a human sets them to `done`.
