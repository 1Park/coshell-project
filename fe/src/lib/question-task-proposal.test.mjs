import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuestionSession } from './question-branch.ts';
import { QUESTION_COMPACT_PROMPT, TASK_PROPOSAL_PROMPT } from './question-prompts.ts';

const ticket = { ticketId: 'BUG-101', title: 'Fix login', description: 'Login times out' };
const proposal = {
  title: 'Investigate login timeout', instruction: 'Read MCP context and investigate the timeout.',
  acceptance_criteria: ['Verify the timeout reproduction.'], relevant_context_summary: 'Login timeout reported.',
  risks_or_open_questions: ['Root cause is not verified.'],
};

function ready(options = {}) {
  return createQuestionSession({
    mock: true,
    initialState: {
      mainContext: 'Original main',
      branches: { q1: { id: 'q1', mainContext: 'Snapshot', revision: 1,
        messages: [{ role: 'user', content: 'PRIVATE_TRANSCRIPT' }, { role: 'assistant', content: 'Answer' }] } },
      previews: { q1: { id: 'p1', branchId: 'q1', revision: 1, compact: 'A timeout was reported; root cause is unknown.' } },
    },
    ...options,
  });
}

test('mock task proposal is structured, makes no network request and does not mutate main or compact', async () => {
  const session = ready({ fetch: () => { throw new Error('No network'); } });
  const before = session.getState();
  const task = await session.suggestTask('q1', 'p1', ticket);
  assert.match(task.title, /\[MOCK task\]/);
  assert.ok(task.acceptance_criteria.length);
  assert.deepEqual(session.getState(), before);
  assert.equal(session.approveMerge('q1', 'p1'), `Original main\n\n${before.previews.q1.compact}`);
  assert.ok(!session.getState().mainContext.includes(task.title));
});

test('live proposal uses the separate team-based prompt and ticket + compact, not private transcript', async () => {
  let request;
  const session = ready({
    mock: false, apiKey: 'test-key',
    fetch: async (_url, init) => {
      request = JSON.parse(init.body);
      return Response.json({ content: [{ type: 'text', text: JSON.stringify(proposal) }], stop_reason: 'end_turn' });
    },
  });
  assert.deepEqual(await session.suggestTask('q1', 'p1', ticket), proposal);
  assert.equal(request.system, TASK_PROPOSAL_PROMPT);
  assert.notEqual(request.system, QUESTION_COMPACT_PROMPT);
  assert.deepEqual(JSON.parse(request.messages[0].content), { ticket, compact: session.getState().previews.q1.compact });
  assert.ok(!JSON.stringify(request).includes('PRIVATE_TRANSCRIPT'));
});

test('invalid JSON, missing fields and invalid criteria do not modify session', async () => {
  for (const text of ['not JSON', '{}', JSON.stringify({ ...proposal, acceptance_criteria: [] }),
    JSON.stringify({ ...proposal, risks_or_open_questions: [42] })]) {
    const session = ready({
      mock: false, apiKey: 'test',
      fetch: async () => Response.json({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }),
    });
    const before = session.getState();
    await assert.rejects(session.suggestTask('q1', 'p1', ticket));
    assert.deepEqual(session.getState(), before);
    assert.ok(session.createBranch());
  }
});

test('proposal rejects stale preview and supports cancellation without a merge', async () => {
  const session = ready();
  const before = session.getState();
  await assert.rejects(session.suggestTask('q1', 'wrong-preview', ticket), /stale/);
  await assert.rejects(session.suggestTask('q1', 'p1', ticket, AbortSignal.abort()), { name: 'AbortError' });
  assert.deepEqual(session.getState(), before);
  await session.sendMessage('q1', 'Follow-up');
  await assert.rejects(session.suggestTask('q1', 'p1', ticket), /stale/);
});

test('compact always uses the common prompt independently of the later task proposal', async () => {
  const requests = [];
  const session = ready({
    mock: false, apiKey: 'test',
    fetch: async (_url, init) => {
      const request = JSON.parse(init.body);
      requests.push(request);
      return Response.json({ content: [{ type: 'text', text: request.system === QUESTION_COMPACT_PROMPT
        ? 'Common compact' : JSON.stringify(proposal) }], stop_reason: 'end_turn' });
    },
  });
  const preview = await session.previewMerge('q1');
  await session.suggestTask('q1', preview.id, ticket);
  assert.equal(requests[0].system, QUESTION_COMPACT_PROMPT);
  assert.equal(requests[1].system, TASK_PROPOSAL_PROMPT);
  assert.equal(session.getState().previews.q1.compact, 'Common compact');
  assert.equal(session.getState().mainContext, 'Original main');
});
