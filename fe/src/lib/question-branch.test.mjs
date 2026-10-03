import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuestionSession, QUESTION_BRANCH_MODEL } from './question-branch.ts';

function setup(outputs = ['Answer', 'Compact summary']) {
  const calls = [];
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const options = {
    apiKey: 'test-key', mainContext: 'Bug ticket context',
    persistence: { storage, key: 'ticket-1' },
    fetch: async (url, init) => {
      calls.push({ url, ...init, body: JSON.parse(init.body) });
      return Response.json({ content: [{ type: 'text', text: outputs.shift() }], stop_reason: 'end_turn' });
    },
  };
  return { session: createQuestionSession(options), options, calls, data };
}

test('conversation uses Sonnet 5.5 directly and merge requires explicit approval', async () => {
  const { session, options, calls, data } = setup();
  const branch = session.createBranch();
  await session.sendMessage(branch.id, 'Why is this failing?');
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].body.model, QUESTION_BRANCH_MODEL);
  assert.equal(calls[0].headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.match(calls[0].body.system, /Bug ticket context/);
  assert.equal(session.getState().branches[branch.id].messages.length, 2);
  const preview = await session.previewMerge(branch.id);
  assert.equal(session.getState().mainContext, 'Bug ticket context');
  assert.ok(session.getState().branches[branch.id]);
  assert.equal(session.approveMerge(branch.id, preview.id), 'Bug ticket context\n\nCompact summary');
  assert.equal(session.getState().branches[branch.id], undefined);
  assert.throws(() => session.approveMerge(branch.id, preview.id), /not found/);
  assert.deepEqual(createQuestionSession(options).getState(), session.getState());
  assert.ok(!data.get('ticket-1').includes('test-key'));
});

test('follow-up sends history and invalidates a previously generated preview', async () => {
  const { session, calls } = setup(['First answer', 'Summary', 'Follow-up answer']);
  const branch = session.createBranch();
  await session.sendMessage(branch.id, 'First question');
  const preview = await session.previewMerge(branch.id);
  await session.sendMessage(branch.id, 'Follow-up');
  assert.equal(calls[2].body.messages.length, 3);
  assert.throws(() => session.approveMerge(branch.id, preview.id), /stale/);
  assert.equal(session.getState().mainContext, 'Bug ticket context');
});

test('merges append to latest main while question context remains a snapshot', async () => {
  const { session, calls } = setup();
  const branch = session.createBranch();
  session.setMainContext('New main context');
  await session.sendMessage(branch.id, 'Question');
  assert.match(calls[0].body.system, /Bug ticket context/);
  const preview = await session.previewMerge(branch.id);
  assert.equal(session.approveMerge(branch.id, preview.id), 'New main context\n\nCompact summary');
});

test('API errors, cancellation and truncated output do not commit a turn', async () => {
  for (const fetch of [
    async () => new Response('', { status: 401 }),
    async () => { throw new DOMException('Aborted', 'AbortError'); },
    async () => Response.json({ content: [{ type: 'text', text: 'Partial' }], stop_reason: 'max_tokens' }),
  ]) {
    const { options } = setup();
    const session = createQuestionSession({ ...options, fetch });
    const branch = session.createBranch();
    const before = session.getState();
    await assert.rejects(session.sendMessage(branch.id, 'Question'));
    assert.deepEqual(session.getState(), before);
    assert.ok(session.createBranch());
  }
});

test('blocks concurrent mutation and empty input', async () => {
  let resolve;
  const session = createQuestionSession({
    apiKey: 'test', fetch: () => new Promise((done) => { resolve = done; }),
  });
  const branch = session.createBranch();
  await assert.rejects(session.sendMessage(branch.id, '  '), /empty/);
  await assert.rejects(session.previewMerge(branch.id), /empty/);
  const pending = session.sendMessage(branch.id, 'Question');
  assert.throws(() => session.createBranch(), /in progress/);
  await assert.rejects(session.previewMerge(branch.id), /in progress/);
  resolve(Response.json({ content: [{ type: 'text', text: 'Answer' }], stop_reason: 'end_turn' }));
  await pending;
});

test('persistence failure leaves both main and branch unchanged during approval', async () => {
  const { session, options } = setup();
  const branch = session.createBranch();
  await session.sendMessage(branch.id, 'Question');
  const preview = await session.previewMerge(branch.id);
  const before = session.getState();
  options.persistence.storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => session.approveMerge(branch.id, preview.id), /Storage full/);
  assert.deepEqual(session.getState(), before);
});

test('returned state cannot mutate internal history or approved summary', async () => {
  const { session } = setup();
  const branch = session.createBranch();
  branch.mainContext = 'Tampered';
  await session.sendMessage(branch.id, 'Question');
  const preview = await session.previewMerge(branch.id);
  const previewId = preview.id;
  preview.compact = 'Tampered';
  session.getState().mainContext = 'Tampered';
  assert.equal(session.approveMerge(branch.id, previewId), 'Bug ticket context\n\nCompact summary');
});
