import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { anthropic } from '@ai-sdk/anthropic';
import { frontendTools } from '@assistant-ui/ai-sdk';
import { convertToModelMessages, streamText } from 'ai';

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

  const { messages, system, tools } = payload ?? {};
  if (!Array.isArray(messages)) {
    return sendJson(res, 400, { error: 'messages must be an array' });
  }

  try {
    const result = streamText({
      model: anthropic(MODEL),
      system: system || 'You are a helpful assistant.',
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

/**
 * Mounts the API routes onto a Node http request/response pair.
 * Returns true when the request was handled.
 */
export async function handleApi(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (pathname === '/api/chat') {
    await handleChat(req, res);
    return true;
  }
  return false;
}

export { MODEL };