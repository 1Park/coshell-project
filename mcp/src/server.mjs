import { createServer } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getUser } from './auth.mjs';
import { DATA_DIR } from './store.mjs';
import { loadPrompt, registerTools } from './tools.mjs';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// Stateless: a fresh server per request, so prompt file edits apply without a restart.
async function handleMcp(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
  }
  const server = new McpServer(
    { name: 'coraid', version: '0.1.0' },
    { instructions: await loadPrompt('server.instructions.md') },
  );
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await registerTools(server, getUser(req));
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/healthz') return sendJson(res, 200, { status: 'ok', commit: process.env.RELEASE_SHA });
    if (pathname !== '/mcp') return sendJson(res, 404, { error: 'Not found' });
    if (req.method !== 'POST') {
      return sendJson(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
    }
    await handleMcp(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
  }
}).listen(PORT, HOST, () => {
  console.log(`coraid MCP listening on http://${HOST}:${PORT}/mcp (data: ${DATA_DIR})`);
});
