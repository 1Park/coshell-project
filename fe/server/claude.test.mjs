import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { handleApi } from './api.mjs';
import { createQuestionSession } from '../src/lib/question-branch.ts';

const payload = { system: 'System prompt', messages: [{ role: 'user', content: 'Question' }] };
async function serve(t, dependencies) {
  const server = createServer((req, res) => {
    handleApi(req, res, dependencies).catch(() => { res.writeHead(500); res.end(); });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/claude`;
}

test('server-held key powers live chat, compact and Task without returning the key', async (t) => {
  const calls = [];
  const task = { title: 'Investigate', instruction: 'Read MCP context', acceptance_criteria: ['Verify'], relevant_context_summary: 'Summary', risks_or_open_questions: [] };
  const outputs = ['Answer', 'Compact', JSON.stringify(task)];
  const url = await serve(t, { apiKey: 'server-secret', fetch: async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return Response.json({ content: [{ type: 'text', text: outputs.shift() }], stop_reason: 'end_turn' });
  } });
  const session = createQuestionSession({ endpoint: url, mock: false, taskProposalPrompt: 'Task prompt' });
  const branch = session.createBranch();
  await session.sendMessage(branch.id, 'Question');
  const preview = await session.previewMerge(branch.id);
  assert.deepEqual(await session.suggestTask(branch.id, preview.id, { ticketId: 'BUG-204', title: 'Bug', description: '' }), task);
  assert.equal(session.approveMerge(branch.id, preview.id), 'Compact');
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.headers['x-api-key'] === 'server-secret' && call.body.model === 'claude-sonnet-5-5'));
  assert.ok(calls.every((call) => call.body.output_config.effort === 'low'));
  assert.ok(!JSON.stringify(session.getState()).includes('server-secret'));
});

test('missing key, invalid payload, wrong methods and foreign origins fail before Anthropic', async (t) => {
  const url = await serve(t, { apiKey: '', fetch: () => { throw new Error('No upstream request'); } });
  const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /ANTHROPIC_API_KEY/);
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await fetch(url, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  const valid = await serve(t, { apiKey: 'secret', fetch: () => { throw new Error('No upstream request'); } });
  assert.equal((await fetch(valid, { method: 'POST', body: '{}' })).status, 400);
});

test('provider failures are actionable and redact credentials', async (t) => {
  const url = await serve(t, { apiKey: 'secret-key', fetch: async () => Response.json({ error: { message: 'Invalid secret-key' } }, { status: 401, headers: { 'request-id': 'req-1' } }) });
  const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Invalid [redacted]', requestId: 'req-1' });
});
