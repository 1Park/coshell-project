import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { anthropic } from '@ai-sdk/anthropic';
import { frontendTools } from '@assistant-ui/ai-sdk';
import { convertToModelMessages, generateText, streamText } from 'ai';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function ticketSystemPrompt(ticket) {
  if (!ticket || typeof ticket !== 'object') return null;
  const lines = [
    `You are helping with the ticket "${ticket.title ?? '(untitled)'}" (id: ${ticket.ticketId ?? 'unknown'}).`,
  ];
  if (ticket.status) lines.push(`Status: ${ticket.status}.`);
  if (ticket.priority) lines.push(`Priority: ${ticket.priority}.`);
  if (Array.isArray(ticket.labels) && ticket.labels.length > 0) {
    lines.push(`Labels: ${ticket.labels.join(', ')}.`);
  }
  if (Array.isArray(ticket.assignees) && ticket.assignees.length > 0) {
    lines.push(`Assignees: ${ticket.assignees.join(', ')}.`);
  }
  if (ticket.dueDate) lines.push(`Due: ${ticket.dueDate}.`);
  if (ticket.reporter) lines.push(`Reporter: ${ticket.reporter}.`);
  if (ticket.startDate) lines.push(`Start: ${ticket.startDate}.`);
  if (ticket.description) lines.push(`Description: ${ticket.description}`);
  lines.push('Answer in the context of this ticket. Keep replies concise and actionable.');
  return lines.join('\n');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

async function sendWebResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) return res.end();
  await pipeline(Readable.fromWeb(response.body), res);
}

async function handleChat(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 500, { error: 'ANTHROPIC_API_KEY is not set' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { messages, system, tools, ticketContext } = payload ?? {};
  if (!Array.isArray(messages)) {
    return sendJson(res, 400, { error: 'messages must be an array' });
  }

  const ticketPrompt = ticketSystemPrompt(ticketContext);
  const baseSystem = system || 'You are a helpful assistant.';
  const finalSystem = ticketPrompt ? `${ticketPrompt}\n\n${baseSystem}` : baseSystem;

  try {
    const result = streamText({
      model: anthropic(MODEL),
      system: finalSystem,
      messages: await convertToModelMessages(messages),
      tools: frontendTools(tools ?? {}),
      onError: ({ error }) => console.error('[api/chat]', error),
    });
    await sendWebResponse(res, result.toUIMessageStreamResponse());
  } catch (error) {
    console.error('[api/chat]', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Failed to start stream' });
    } else {
      res.end();
    }
  }
}

function compactSystemPrompt(ticket) {
  const name = ticket && ticket.title ? `"${ticket.title}"` : 'the ticket';
  return [
    `You are CoRAID's Main recorder. Compress the following Question Branch conversation about ${name} into compact prose another AI can use directly.`,
    'Rules: conclusions and decisions first, then key rationale, then open items.',
    'Korean, plain sentences, max 10 lines. No greeting, no markdown headers.',
  ].join('\n');
}

async function handleCompact(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 500, { error: 'ANTHROPIC_API_KEY is not set' });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { messages, ticketContext } = payload ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return sendJson(res, 400, { error: 'messages must be a non-empty array' });
  }

  try {
    const result = await generateText({
      model: anthropic(MODEL),
      system: compactSystemPrompt(ticketContext),
      messages: await convertToModelMessages(messages),
    });
    sendJson(res, 200, { compact: result.text.trim() });
  } catch (error) {
    console.error('[api/compact]', error);
    sendJson(res, 500, { error: 'Failed to compact branch' });
  }
}

// Same folder the coraid MCP server writes to (mcp/src/store.mjs).
const DATA_DIR = resolve(process.env.DATA_DIR || join(homedir(), '.local/share/coshell/data'));

async function readDirOrEmpty(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** Task branches merged through the coraid MCP server, oldest first. Read-only. */
async function handleTaskMerges(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    const merges = [];
    for (const ticket of await readDirOrEmpty(join(DATA_DIR, 'tickets'))) {
      if (!ticket.isDirectory()) continue;
      const dir = join(DATA_DIR, 'tickets', ticket.name, 'branches');
      for (const file of await readDirOrEmpty(dir)) {
        if (!file.name.startsWith('task-') || !file.name.endsWith('.json')) continue;
        try {
          const branch = JSON.parse(await readFile(join(dir, file.name), 'utf8'));
          if (branch.type !== 'task' || branch.status !== 'merged' || !branch.summary) continue;
          merges.push({
            branchId: branch.branch_id,
            ticketId: branch.ticket_id,
            author: branch.author,
            summary: branch.summary,
            mergedAt: branch.merged_at,
          });
        } catch (error) {
          console.error('[api/task-merges] skipped', file.name, error);
        }
      }
    }
    merges.sort((a, b) => String(a.mergedAt).localeCompare(String(b.mergedAt)));
    sendJson(res, 200, { merges });
  } catch (error) {
    console.error('[api/task-merges]', error);
    sendJson(res, 500, { error: 'Failed to read task merges' });
  }
}

/**
 * Mounts the API routes onto a Node http request/response pair.
 * Returns true when the request was handled.
 */
export async function handleApi(req, res, dependencies = {}) {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/api/claude') {
    await handleClaude(req, res, dependencies);
    return true;
  }
  if (pathname === '/api/chat') {
    await handleChat(req, res);
    return true;
  }
  if (pathname === '/api/compact') {
    await handleCompact(req, res);
    return true;
  }
  if (pathname === '/api/task-merges') {
    await handleTaskMerges(req, res);
    return true;
  }
  return false;
}

export { MODEL };

// Credentials stay on the local server; QB context/state remains frontend-owned.
async function handleClaude(req, res, dependencies) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return sendJson(res, 403, { error: 'Cross-site requests are not allowed' });
  }
  if (req.headers.origin) {
    let originHost;
    try { originHost = new URL(req.headers.origin).host; } catch { return sendJson(res, 403, { error: 'Invalid origin' }); }
    if (originHost !== req.headers.host && originHost !== req.headers['x-forwarded-host']) {
      return sendJson(res, 403, { error: 'Cross-origin requests are not allowed' });
    }
  }
  const apiKey = dependencies.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return sendJson(res, 503, { error: 'ANTHROPIC_API_KEY is not set on the server. Restart after updating ~/.local/share/coshell/env.' });
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    return sendJson(res, error.message === 'Request body too large' ? 413 : 400, { error: error.message });
  }
  if (typeof payload?.system !== 'string' || !Array.isArray(payload.messages) || !payload.messages.length
    || payload.messages.some((message) => !message || !['user', 'assistant'].includes(message.role)
      || typeof message.content !== 'string')) {
    return sendJson(res, 400, { error: 'system and nonempty text messages are required' });
  }
  const controller = new AbortController();
  const abort = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', abort);
  try {
    const response = await (dependencies.fetch ?? fetch)('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 4096, output_config: { effort: 'low' }, system: payload.system, messages: payload.messages }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = typeof data?.error?.message === 'string' ? data.error.message : 'Anthropic request failed';
      return sendJson(res, response.status, {
        error: detail.replaceAll(apiKey, '[redacted]'), requestId: response.headers.get('request-id'),
      });
    }
    sendJson(res, 200, { content: data.content, stop_reason: data.stop_reason });
  } catch {
    if (!res.destroyed) sendJson(res, 502, { error: 'Claude request failed or timed out. Check server connectivity and retry.' });
  } finally {
    res.off('close', abort);
  }
}
