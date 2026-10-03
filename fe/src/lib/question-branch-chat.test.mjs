import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readUIMessageStream } from 'ai';
import { branchChatResponse, createBranchChatSession, QUESTION_BRANCH_MOCK, questionContext } from './question-branch-chat.ts';
import { createQuestionSession } from './question-branch.ts';

const message = (id, role, text) => ({ id, role, parts: [{ type: 'text', text }] });

test('HTTP origins without crypto.randomUUID support chat and approved merge', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  try {
    const session = createQuestionSession({ mock: true });
    const branch = session.createBranch();
    const other = session.createBranch();
    assert.notEqual(branch.id, other.id);
    await session.sendMessage(branch.id, 'Question');
    const preview = await session.previewMerge(branch.id);
    assert.ok(preview.id);
    assert.match(session.approveMerge(branch.id, preview.id), /MOCK compact/);
    const response = await branchChatResponse({
      branchId: 'q-http', mainContext: 'Main', branchContext: 'Snapshot',
      messages: [message('u1', 'user', 'Question')],
      mock: true,
    });
    const text = await response.text();
    assert.match(text, /MOCK answer/);
    assert.ok(!text.includes('"type":"error"'));
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor);
  }
});

test('explicit Mock UI transport produces a valid assistant stream without API access', async () => {
  assert.equal(QUESTION_BRANCH_MOCK, false);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('No network allowed'); };
  try {
    const response = await branchChatResponse({
      branchId: 'q-1', mainContext: 'Main', branchContext: 'Snapshot',
      messages: [message('u1', 'user', 'Question')],
      mock: true,
    });
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const chunks = (await response.text()).split('\n\n')
      .filter((line) => line.startsWith('data: ') && !line.includes('[DONE]'))
      .map((line) => JSON.parse(line.slice(6)));
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    let result;
    for await (const item of readUIMessageStream({ stream, terminateOnError: true })) result = item;
    assert.equal(result.role, 'assistant');
    assert.equal(result.parts[0].text,
      '[MOCK answer] [question] 질문을 받았음. 현재 mocking모드라 답변은 제공하지않음');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('saved UI history is restored and compacted only on approval', async () => {
  const session = createBranchChatSession({
    branchId: 'q-existing', mainContext: 'Latest main', branchContext: 'Starting snapshot',
    messages: [message('u1', 'user', 'Earlier question'), message('a1', 'assistant', 'Earlier answer')],
    mock: true,
  });
  assert.equal(session.getState().branches['q-existing'].mainContext, 'Starting snapshot');
  assert.equal(session.getState().branches['q-existing'].messages.length, 2);
  const preview = await session.previewMerge('q-existing');
  assert.equal(session.getState().mainContext, 'Latest main');
  assert.equal(session.getState().branches['q-existing'].messages.length, 2);
  assert.equal(session.approveMerge('q-existing', preview.id), `Latest main\n\n${preview.compact}`);
  assert.equal(session.getState().branches['q-existing'], undefined);
});

test('follow-up transport, empty questions and cancellation', async () => {
  const options = {
    mock: true,
    branchId: 'q-1', mainContext: 'Main', branchContext: 'Snapshot',
    messages: [message('u1', 'user', 'First'), message('a1', 'assistant', 'Answer'), message('u2', 'user', 'Follow-up')],
  };
  const response = await branchChatResponse(options);
  assert.match(await response.text(), /MOCK answer/);
  await assert.rejects(branchChatResponse({ ...options, messages: [message('u1', 'user', ' ')] }), /empty/);
  await assert.rejects(branchChatResponse({ ...options, signal: AbortSignal.abort() }), { name: 'AbortError' });
  await assert.rejects(branchChatResponse({ ...options, messages: [] }), /text questions/);
});

test('live UI wrapper sends no credentials and excludes marked mock context', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, ...init };
    return Response.json({ content: [{ type: 'text', text: 'Live reply' }], stop_reason: 'end_turn' });
  };
  try {
    const session = createBranchChatSession({ branchId: 'q-live', mainContext: 'Main', branchContext: 'Main', messages: [] });
    assert.equal((await session.sendMessage('q-live', 'Question')).content, 'Live reply');
    assert.equal(request.url, '/api/claude');
    assert.equal(request.headers['x-api-key'], undefined);
    const context = JSON.parse(questionContext({
      ticket: {}, mock: false,
      comments: [{ text: '[MOCK compact] fake' }, { text: 'Verified context' }],
      messages: [message('u1', 'user', 'Question'), message('a1', 'assistant', '[MOCK answer] fake')],
    }));
    assert.deepEqual(context.comments, [{ text: 'Verified context' }]);
    assert.deepEqual(context.messages, []);
  } finally { globalThis.fetch = originalFetch; }
});
