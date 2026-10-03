import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTaskStartPrompt } from './task-start-prompt.ts';

const task = {
  title: 'Investigate login failure', instruction: 'Reproduce and fix the issue using MCP context.',
  acceptance_criteria: ['Verify login succeeds.'], relevant_context_summary: 'Login times out.',
  risks_or_open_questions: ['Root cause not yet verified.'],
};

test('mock Task handoff includes ticket, approved context and the correct MCP workflow', () => {
  const prompt = buildTaskStartPrompt({
    ticket: { ticketId: 'BUG-101', title: 'Fix login', description: 'Login times out', status: 'In Progress' },
    mainContext: '[MOCK compact] approved summary', mock: true, task,
  });
  assert.match(prompt, /MOCK MODE/);
  assert.match(prompt, /\[MOCK compact\] approved summary/);
  assert.ok(prompt.includes('task_start with {"ticket_id":"BUG-101"}'));
  assert.match(prompt, /Wait for my explicit approval before calling task_merge/);
  assert.match(prompt, /branch_id returned by task_start/);
  assert.match(prompt, /not yet be synchronized to MCP storage/);
  assert.match(prompt, /Login times out/);
  assert.match(prompt, /Approved Task proposal \(planned work, not completed findings\)/);
  assert.ok(prompt.includes(task.instruction));
  assert.ok(prompt.includes(task.acceptance_criteria[0]));
});

test('live handoff does not claim mock context or automatic task execution', () => {
  const prompt = buildTaskStartPrompt({
    ticket: { ticketId: 'BUG-102', title: 'Fix crash', description: '', status: 'In Progress' },
    mainContext: 'Approved findings', mock: false, task,
  });
  assert.ok(!prompt.includes('MOCK MODE'));
  assert.match(prompt, /Approved findings/);
  assert.match(prompt, /Do not claim a Task was started/);
});
