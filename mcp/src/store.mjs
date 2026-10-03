import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

// Deploys run from a fresh release folder each time, so data must live outside the repo.
export const DATA_DIR = resolve(process.env.DATA_DIR || join(homedir(), '.local/share/coshell/data'));

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class StoreError extends Error {}

function assertId(id, label) {
  if (!ID_PATTERN.test(id)) throw new StoreError(`잘못된 ${label}: ${id}`);
}

const ticketDir = (ticketId) => join(DATA_DIR, 'tickets', ticketId);
const mainPath = (ticketId) => join(ticketDir(ticketId), 'main.json');
const branchesDir = (ticketId) => join(ticketDir(ticketId), 'branches');
const branchPath = (ticketId, branchId) => join(branchesDir(ticketId), `${branchId}.json`);

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

export async function readMain(ticketId) {
  assertId(ticketId, 'ticket_id');
  const main = await readJson(mainPath(ticketId));
  if (!main) throw new StoreError(`티켓 ${ticketId}이(가) 없습니다.`);
  return main;
}

export async function writeMain(ticketId, main) {
  await writeJson(mainPath(ticketId), main);
}

export async function createBranch({ ticketId, author, baseContextAt }) {
  const now = new Date().toISOString();
  const branch = {
    branch_id: `task-${randomBytes(3).toString('hex')}`,
    type: 'task',
    ticket_id: ticketId,
    author,
    status: 'open',
    base_context_at: baseContextAt,
    summary: null,
    work_log: [],
    created_at: now,
    merged_at: null,
  };
  await mkdir(branchesDir(ticketId), { recursive: true });
  await writeJson(branchPath(ticketId, branch.branch_id), branch);
  return branch;
}

export async function writeBranch(branch) {
  await writeJson(branchPath(branch.ticket_id, branch.branch_id), branch);
}

async function listTicketIds() {
  try {
    const entries = await readdir(join(DATA_DIR, 'tickets'), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && ID_PATTERN.test(e.name)).map((e) => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function listBranches(ticketId) {
  let files;
  try {
    files = await readdir(branchesDir(ticketId));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const branches = await Promise.all(
    files.filter((f) => f.endsWith('.json')).map((f) => readJson(join(branchesDir(ticketId), f))),
  );
  return branches.filter(Boolean);
}

export async function findBranch(branchId) {
  assertId(branchId, 'branch_id');
  for (const ticketId of await listTicketIds()) {
    const branch = await readJson(branchPath(ticketId, branchId));
    if (branch) return branch;
  }
  return null;
}

export async function findTaskBranches({ author, ticketId, status }) {
  if (ticketId) assertId(ticketId, 'ticket_id');
  const ticketIds = ticketId ? [ticketId] : await listTicketIds();
  const all = (await Promise.all(ticketIds.map(listBranches))).flat();
  return all
    .filter((b) => b.type === 'task')
    .filter((b) => !author || b.author === author)
    .filter((b) => !status || b.status === status)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
