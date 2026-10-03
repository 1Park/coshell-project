import { useEffect } from 'react';
import { useBoardStore } from '@/store/board';
import { useTaskMergeStore } from '@/store/taskMerges';

const POLL_MS = 3000;

interface TaskMerge {
  branchId: string;
  ticketId: string;
  author: string;
  summary: string;
  mergedAt: string;
}

/**
 * Task reports are merged by the coraid MCP server into files on the Mac mini.
 * Mirror each one into the ticket as an AI comment, the same way an approved QB merge is recorded.
 */
export function useTaskMergeSync() {
  useEffect(() => {
    let stopped = false;
    let running = false;

    const sync = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/task-merges', { cache: 'no-store' });
        if (!response.ok) return;
        const { merges } = (await response.json()) as { merges: TaskMerge[] };
        for (const merge of merges) {
          if (stopped || useTaskMergeStore.getState().applied[merge.branchId]) continue;
          useTaskMergeStore.getState().markApplied(merge.branchId);
          useBoardStore.getState().addComment(merge.ticketId, merge.summary, { authorId: merge.author, ai: true });
        }
      } catch {
        // Server unreachable (e.g. static preview); try again on the next tick.
      } finally {
        running = false;
      }
    };

    void sync();
    const timer = window.setInterval(() => void sync(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);
}
