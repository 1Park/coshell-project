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
npm run typecheck
```

Tests mock Anthropic requests and do not consume API credits.
