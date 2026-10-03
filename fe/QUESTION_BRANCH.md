# Question Branch Core

UI-independent frontend module: `src/lib/question-branch.ts`.
No backend, MCP, React components or extra dependencies are needed.
Requests go directly from the browser to Anthropic Messages API using
`claude-sonnet-5-5` for both conversation and compaction.

## Integration

```ts
import { createQuestionSession } from '@/lib/question-branch';

// Keep one instance per ticket in the frontend, not one per render.
const session = createQuestionSession({
  apiKey, // Supply an existing key at runtime; never commit it.
  mainContext: ticketContext,
  persistence: { storage: localStorage, key: `synccontext:question:${ticketId}` },
});

const branch = session.createBranch();
const answer = await session.sendMessage(branch.id, 'Why does this error occur?');
// Display answer.content and getState().branches[branch.id].messages.

const preview = await session.previewMerge(branch.id);
// Display preview.compact. Nothing has been merged yet.
// Only on explicit user approval:
const updatedMainContext = session.approveMerge(branch.id, preview.id);
// Use updatedMainContext as the main session's context in your frontend store.
// The branch and preview have now been removed from session state.
```

## Mock Mode

The existing Question Branch UI is now connected to the browser module via
`src/lib/question-branch-chat.ts`. `QUESTION_BRANCH_MOCK = true` is the local-demo
flag for both chat and compact. The transport returns a local AI SDK response;
neither `/api/chat` nor `/api/compact` receives QB requests. No API key is required.

The existing session store remains the persisted UI transcript. Branches capture
ticket details, comments and main history when created. Existing saved branches
without a snapshot use the current context. Approval writes only the compact to
the ticket's main comments, then removes the branch and its private transcript.
Unapproved questions and answers are not automatically published as comments.
New branches include approved comments in their starting context.

The core's `initialState` option lets the UI adapter restore its existing saved
transcript without replaying model calls. Core persistence, when supplied, takes
precedence over `initialState`.

Use `mock: true` to test the same conversation, preview and approval workflow
without a key, internet access or API charges:

```ts
const session = createQuestionSession({
  mock: true,
  mainContext: ticketContext,
  persistence: { storage: localStorage, key: `synccontext:question:mock:${ticketId}` },
});
```

All model calls are bypassed, even if a key is supplied. Replies and compact
previews are deterministic and labeled `[MOCK answer]` / `[MOCK compact]`.
Both headers are followed by the fixed message
`[question] 질문을 받았음. 현재 mocking모드라 답변은 제공하지않음`.
These are test fixtures, not genuine AI answers or semantic summaries. Cancellation
is supported, but mock mode does not simulate latency or provider failures.

For live testing, create a new instance with `mock: false` (the default) and
`apiKey`. Use separate persistence keys for mock and live sessions so simulated
content does not enter live conversations. Do not build a real key into the app.

`getState()` returns a copy containing main context, branches and pending previews.
Optional persistence saves the whole session as JSON, never the API key. Without
persistence, state lives only in memory. Restoring a saved session takes precedence
over the initial `mainContext`. Browser storage is not a filesystem JSON file and
is not shared with MCP; that integration is outside this frontend-only module.

Use `setMainContext(text)` when the frontend's main session changes elsewhere.
Existing branches retain their starting context; approval appends the compact
summary to the latest main context rather than overwriting it. The caller owns
syncing the returned context with its main-session store.

Both async methods accept an optional `AbortSignal` as their last argument.
They return a complete response, not streaming chunks. Failed, aborted or truncated
responses are not recorded as completed turns. Catch errors and retain the user's
input in the UI for retry. A new successful turn invalidates any old merge preview.
Canceling preview needs no call: simply do not approve it. A new preview replaces
the previous one. Empty branches cannot be merged, and approval cannot run twice.
Mutations are blocked while a model request is in flight.

Only one active instance/tab should own a ticket's storage key; cross-tab and
multi-user coordination are not supported. localStorage writes can fail (for
example, quota exceeded); a failed write does not change the in-memory session.

## Compact And Task Proposal

Both merge actions use the same `QUESTION_COMPACT_PROMPT` in
`src/lib/question-prompts.ts`. It records findings and uncertainty without adding
new proposed tasks. The Task action then calls `suggestTask(branchId, previewId,
ticket, signal?)` using a separate `TASK_PROPOSAL_PROMPT`, extracted directly from the team's
`docs/specs/coraid-prompts.md` Internal AI Task Draft Format.

Task proposals contain `title`, `instruction`, `acceptance_criteria`,
`relevant_context_summary` and `risks_or_open_questions`. They are generated from
the ticket and compact, not the full private transcript. Generating a proposal
does not change the main context or the saved compact. Invalid model JSON prevents
approval; rejection preserves the branch. Mock mode returns a fixed `[MOCK task]`
JSON fixture without API calls, while answer/compact mock text stays unchanged.

The review dialog separates the summary to merge from the proposed Task. Approval
publishes only the compact into main comments and includes the approved Task fields
in the Claude Code handoff. Proposed work is never recorded as completed findings.
MCP calls remain `task_start` / `task_merge`; the proposed MCP tool names in the
team's design document are not implemented yet.

The web UI imports `docs/specs/coraid-prompts.md` as raw text through
`src/lib/team-prompts.ts`. QB conversation uses the exact `CoRAID Internal AI
Prompt` block; Task suggestion uses the exact `Internal AI Task Draft Format`
block, not a rewritten copy. Changes to these MD blocks take effect after rebuild
and deployment. Compact remains a separate prompt because the team document has
no QB merge-compaction prompt. Standalone live core callers must supply
`taskProposalPrompt`; the UI supplies it from the MD automatically.

## Security

Direct browser access explicitly uses Anthropic's
`anthropic-dangerous-direct-browser-access` header. This is for trusted local demos
only: the key is visible to the browser and its network tools. Do not bundle a
shared key in Vite environment variables or deploy this with a shared production
key. A server-only `ANTHROPIC_API_KEY` is not automatically available in a browser;
the frontend caller must supply the key. This module does not read `.env` or change
the existing `/api/chat` route.

## Verification

On Node 22.6+:

```sh
node --experimental-strip-types --test fe/src/lib/question-branch.test.mjs
node --experimental-strip-types --test fe/src/lib/question-branch-chat.test.mjs
node --experimental-strip-types --test fe/src/lib/question-task-proposal.test.mjs
npm run typecheck
```

Tests mock Anthropic requests and do not consume API credits.
