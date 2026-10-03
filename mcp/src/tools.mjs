import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  StoreError,
  createBranch,
  findBranch,
  findTaskBranches,
  readMain,
  writeBranch,
  writeMain,
} from './store.mjs';

const PROMPTS_DIR = fileURLToPath(new URL('../prompts/', import.meta.url));

export async function loadPrompt(name) {
  const text = await readFile(PROMPTS_DIR + name, 'utf8');
  return text.replace(/<!--[\s\S]*?-->\s*/g, '').trim();
}

function render(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}

const kstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function formatKst(date) {
  const p = Object.fromEntries(kstFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function formatDiscussions(discussions) {
  if (!Array.isArray(discussions) || discussions.length === 0) return '(none)';
  return discussions
    .map((d) => `- ${d.author_id ?? 'unknown'}${d.ai ? ' (AI)' : ''} · ${d.created_at ?? ''}: ${d.text ?? ''}`)
    .join('\n');
}

const text = (body) => ({ content: [{ type: 'text', text: body }] });
const error = (body) => ({ ...text(body), isError: true });

function handled(fn) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof StoreError) return error(err.message);
      throw err;
    }
  };
}

// Finds the branch a status or merge call refers to. Throws StoreError so handled() reports it.
async function resolveOpenBranch(user, branchId, ticketId) {
  let branch;
  if (branchId) {
    branch = await findBranch(branchId);
    if (!branch) throw new StoreError(`Branch ${branchId} does not exist.`);
  } else {
    const open = await findTaskBranches({ author: user, ticketId, status: 'open' });
    if (open.length === 0) throw new StoreError('No open Task branch. Call task_start first.');
    if (open.length > 1) {
      const list = open.map((b) => `${b.branch_id} (${b.ticket_id})`).join(', ');
      throw new StoreError(`Multiple open Task branches. Specify branch_id: ${list}`);
    }
    branch = open[0];
  }
  if (branch.status !== 'open') throw new StoreError(`Branch already merged: ${branch.branch_id}`);
  return branch;
}

const branchLookup = {
  branch_id: z.string().optional().describe('Task branch ID returned by task_start. If omitted, the current user\'s single open branch is used.'),
  ticket_id: z.string().optional().describe('Ticket ID to narrow the open-branch lookup when branch_id is unknown'),
};

export async function registerTools(server, user) {
  const [startDesc, startInstructions, mergeDesc, statusDesc, updateDesc] = await Promise.all([
    loadPrompt('task_start.description.md'),
    loadPrompt('task_start.instructions.md'),
    loadPrompt('task_merge.description.md'),
    loadPrompt('task_status.description.md'),
    loadPrompt('task_update_status.description.md'),
  ]);

  server.registerTool(
    'task_start',
    {
      description: startDesc,
      inputSchema: { ticket_id: z.string().describe('CoRAID ticket ID to work on, for example BUG-104') },
    },
    handled(async ({ ticket_id }) => {
      const main = await readMain(ticket_id);
      const branch = await createBranch({
        ticketId: ticket_id,
        author: user,
        baseContextAt: main.updated_at ?? null,
      });
      return text(render(startInstructions, {
        ticket_id,
        title: main.title ?? '',
        description: main.description || '(none)',
        branch_id: branch.branch_id,
        main_context: main.context || '(empty)',
        discussions: formatDiscussions(main.discussions),
      }));
    }),
  );

  server.registerTool(
    'task_update_status',
    {
      description: updateDesc,
      inputSchema: {
        task_status: z.enum(['in_progress', 'blocked']).describe('blocked when you cannot continue; in_progress when resuming after a block'),
        note: z.string().optional().describe('Why the task is blocked, or what unblocked it. Required for blocked.'),
        ...branchLookup,
      },
    },
    handled(async ({ task_status, note, branch_id, ticket_id }) => {
      if (task_status === 'blocked' && !note?.trim()) return error('A note explaining the block is required.');
      const branch = await resolveOpenBranch(user, branch_id, ticket_id);
      Object.assign(branch, {
        task_status,
        status_note: note?.trim() || null,
        task_status_updated_at: new Date().toISOString(),
      });
      await writeBranch(branch);
      return text(`Task ${branch.branch_id} (${branch.ticket_id}) is now ${task_status}.`);
    }),
  );

  server.registerTool(
    'task_merge',
    {
      description: mergeDesc,
      inputSchema: {
        summary: z.string().min(1).describe('The user-approved completion report to append to the common context'),
        work_log: z.array(z.string()).optional().describe('Short factual entries of the work process'),
        ...branchLookup,
      },
    },
    handled(async ({ summary, work_log, branch_id, ticket_id }) => {
      const branch = await resolveOpenBranch(user, branch_id, ticket_id);

      const now = new Date();
      const entry = `[Task · ${branch.author} · ${formatKst(now)}]\n${summary.trim()}`;
      const main = await readMain(branch.ticket_id);
      main.context = main.context ? `${main.context}\n\n${entry}` : entry;
      main.updated_at = now.toISOString();
      await writeMain(branch.ticket_id, main);

      Object.assign(branch, {
        summary: summary.trim(),
        work_log: work_log ?? [],
        status: 'merged',
        merged_at: now.toISOString(),
        task_status: 'in_review',
        status_note: null,
        task_status_updated_at: now.toISOString(),
      });
      await writeBranch(branch);

      return text(`Merged into the ${branch.ticket_id} common context (${branch.branch_id}). Task status is now in_review.\n\n${entry}`);
    }),
  );

  server.registerTool(
    'task_status',
    {
      description: statusDesc,
      inputSchema: { branch_id: z.string().optional().describe('Task branch ID to look up') },
    },
    handled(async ({ branch_id }) => {
      if (branch_id) {
        const branch = await findBranch(branch_id);
        if (!branch) return error(`Branch ${branch_id} does not exist.`);
        return text(JSON.stringify(branch, null, 2));
      }
      const open = await findTaskBranches({ author: user, status: 'open' });
      if (open.length === 0) return text('No open Task branches.');
      return text(open
        .map((b) => `${b.branch_id} · ${b.ticket_id} · ${b.task_status ?? 'in_progress'} · ${b.created_at}`)
        .join('\n'));
    }),
  );
}
