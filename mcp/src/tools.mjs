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

async function loadPrompt(name) {
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

export async function registerTools(server, user) {
  const [startDesc, startInstructions, mergeDesc, statusDesc] = await Promise.all([
    loadPrompt('task_start.description.md'),
    loadPrompt('task_start.instructions.md'),
    loadPrompt('task_merge.description.md'),
    loadPrompt('task_status.description.md'),
  ]);

  server.registerTool(
    'task_start',
    {
      description: startDesc,
      inputSchema: { ticket_id: z.string().describe('작업할 티켓 ID (예: BUG-123)') },
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
        branch_id: branch.branch_id,
        main_context: main.context || '(아직 메인 컨텍스트가 비어 있습니다.)',
      }));
    }),
  );

  server.registerTool(
    'task_merge',
    {
      description: mergeDesc,
      inputSchema: {
        summary: z.string().min(1).describe('메인 컨텍스트에 이어 붙일 작업 요약'),
        work_log: z.array(z.string()).optional().describe('작업 과정 기록 (변경 파일, 테스트 결과 등)'),
        branch_id: z.string().optional().describe('머지할 Task 브랜치 ID. 생략하면 현재 사용자의 열린 브랜치를 찾습니다.'),
        ticket_id: z.string().optional().describe('branch_id를 모를 때 열린 브랜치를 찾을 티켓 ID'),
      },
    },
    handled(async ({ summary, work_log, branch_id, ticket_id }) => {
      let branch;
      if (branch_id) {
        branch = await findBranch(branch_id);
        if (!branch) return error(`브랜치 ${branch_id}이(가) 없습니다.`);
      } else {
        const open = await findTaskBranches({ author: user, ticketId: ticket_id, status: 'open' });
        if (open.length === 0) return error('열린 Task 브랜치가 없습니다. task_start로 먼저 시작하세요.');
        if (open.length > 1) {
          const list = open.map((b) => `${b.branch_id} (${b.ticket_id})`).join(', ');
          return error(`열린 Task 브랜치가 여러 개입니다. branch_id를 지정하세요: ${list}`);
        }
        branch = open[0];
      }
      if (branch.status !== 'open') return error(`이미 머지된 브랜치입니다: ${branch.branch_id}`);

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
      });
      await writeBranch(branch);

      return text(`${branch.ticket_id} 메인 컨텍스트에 머지했습니다 (${branch.branch_id}).\n\n${entry}`);
    }),
  );

  server.registerTool(
    'task_status',
    {
      description: statusDesc,
      inputSchema: { branch_id: z.string().optional().describe('조회할 Task 브랜치 ID') },
    },
    handled(async ({ branch_id }) => {
      if (branch_id) {
        const branch = await findBranch(branch_id);
        if (!branch) return error(`브랜치 ${branch_id}이(가) 없습니다.`);
        return text(JSON.stringify(branch, null, 2));
      }
      const open = await findTaskBranches({ author: user, status: 'open' });
      if (open.length === 0) return text('열린 Task 브랜치가 없습니다.');
      return text(open.map((b) => `${b.branch_id} · ${b.ticket_id} · ${b.created_at}`).join('\n'));
    }),
  );
}
