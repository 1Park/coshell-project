"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranchIcon, MessageSquareIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app';
import { MEMBERS, PRIORITY_META, useBoardStore } from '@/store/board';
import { useBranchStore, type Branch } from '@/store/branches';
import { useSessionStore } from '@/store/sessions';
import { TicketChat, type TicketContext } from './TicketChat';
import { MergeDialog } from './MergeDialog';
import { TaskStartDialog } from './TaskStartDialog';
import { buildTaskStartPrompt } from '@/lib/task-start-prompt';
import { QUESTION_BRANCH_MOCK } from '@/lib/question-branch-chat';
import type { TaskProposal } from '@/lib/question-branch';
import { cn } from '@/lib/utils';

const EMPTY_BRANCHES: Branch[] = [];

export function TicketPanel({ ticketId }: { ticketId: string }) {
  const card = useBoardStore((s) => s.cards[ticketId]);
  const columns = useBoardStore((s) => s.columns);
  const close = useAppStore((s) => s.closePanel);
  const openDetail = useAppStore((s) => s.setDetailTicket);
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const setActiveTicket = useAppStore((s) => s.setActiveTicket);
  const addComment = useBoardStore((s) => s.addComment);
  const moveCard = useBoardStore((s) => s.moveCard);
  const branches = useBranchStore((s) => s.branchesByTicket[ticketId] ?? EMPTY_BRANCHES);
  const deleteBranch = useBranchStore((s) => s.deleteBranch);
  const clearSession = useSessionStore((s) => s.clearSession);

  const [merging, setMerging] = useState<{ branchId: string; startWork: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [taskPrompt, setTaskPrompt] = useState<string | null>(null);
  const [showTaskPrompt, setShowTaskPrompt] = useState(false);
  const didInit = useRef(false);

  const selectedId = branches.some((b) => b.id === activeBranchId)
    ? activeBranchId
    : (branches[branches.length - 1]?.id ?? null);
  const selected = branches.find((b) => b.id === selectedId) ?? null;
  const hasMessages = useSessionStore((s) => Boolean(selectedId && s.messagesByTicket[selectedId]?.length));

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (useBranchStore.getState().branchesByTicket[ticketId]?.length) return;
    const branch = useBranchStore.getState().createBranch(ticketId);
    setActiveTicket(ticketId, branch.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = useMemo(() => {
    if (!card) return null;
    const { id, title, priority, labels, assignees, reporter, startDate, dueDate, description } = card;
    return {
      ticketId: id,
      title,
      status: columns.find((c) => c.id === card.columnId)?.title ?? card.columnId,
      priority,
      labels,
      assignees,
      reporter: reporter ? (MEMBERS[reporter]?.name ?? reporter) : null,
      startDate,
      dueDate,
      description,
    };
  }, [card, columns]);

  if (!card || !base) return null;

  const startBranch = () => {
    const branch = useBranchStore.getState().createBranch(card.id);
    setActiveTicket(card.id, branch.id);
  };

  const approveMerge = (branch: Branch, compact: string, startWork: boolean, task?: TaskProposal) => {
    if (startWork && !task) throw new Error('Approve a Task proposal before starting a Task');
    const trimmed = compact.trim();
    addComment(card.id, trimmed, { ai: true });
    if (startWork && task) {
      const progress = columns.find((c) => c.id === 'col-progress');
      if (progress && card.columnId !== progress.id) {
        moveCard(card.id, progress.id, progress.cardIds.length);
      }
    }
    clearSession(branch.id);
    deleteBranch(card.id, branch.id);
    setMerging(null);
    const rest = useBranchStore.getState().branchesByTicket[card.id] ?? [];
    setActiveTicket(card.id, rest[rest.length - 1]?.id ?? null);
    if (startWork && task) {
      const board = useBoardStore.getState();
      const updated = board.cards[card.id];
      const ticket = {
        ...base,
        status: board.columns.find((column) => column.id === updated.columnId)?.title ?? updated.columnId,
      };
      setTaskPrompt(buildTaskStartPrompt({
        ticket,
        mainContext: JSON.stringify({
          comments: board.commentsByCard[card.id] ?? [],
          messages: useSessionStore.getState().messagesByTicket[card.id] ?? [],
        }),
        mock: QUESTION_BRANCH_MOCK,
        task,
      }));
      setShowTaskPrompt(true);
    }
  };

  const mergingBranch = merging ? branches.find((b) => b.id === merging.branchId) ?? null : null;

  return (
    <aside className="border-border bg-card flex w-[380px] shrink-0 flex-col border-l">
      <div className="border-border shrink-0 border-b px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
              <MessageSquareIcon className="size-3" />
              Question Branch · {QUESTION_BRANCH_MOCK ? 'Mock · ' : ''}{base.status}
              <span className={cn('ml-1 inline-block size-1.5 rounded-full', PRIORITY_META[card.priority].dot)} />
              {PRIORITY_META[card.priority].name}
            </p>
            <h2 className="mt-0.5 truncate text-sm font-semibold">{card.title}</h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Edit details" title="Edit details" onClick={() => openDetail(card.id)}>
            <PencilIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="New branch" title="Start a new question branch" disabled={running} onClick={startBranch}>
            <PlusIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={close}>
            <XIcon />
          </Button>
        </div>
        {card.description ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{card.description}</p>
        ) : null}
      </div>

      <div className="border-border flex shrink-0 items-center gap-1.5 border-b px-3 py-1.5">
        <GitBranchIcon className="text-muted-foreground size-3.5 shrink-0" />
        {selected ? (
          <select
            value={selected.id}
            onChange={(e) => setActiveTicket(card.id, e.target.value)}
            aria-label="Select branch"
            disabled={running}
            className="bg-muted min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-xs font-medium outline-none"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground text-xs">No branches</span>
        )}
        <span className="flex-1" />
        {selected && (
          <>
            <Button size="sm" disabled={!hasMessages || running} onClick={() => setMerging({ branchId: selected.id, startWork: false })}>
              Merge
            </Button>
            <Button size="sm" variant="secondary" disabled={!hasMessages || running} onClick={() => setMerging({ branchId: selected.id, startWork: true })}>
              Merge & start Task
            </Button>
          </>
        )}
      </div>

      {taskPrompt && (
        <Button size="sm" variant="secondary" className="mx-3 my-2 shrink-0" onClick={() => setShowTaskPrompt(true)}>
          Show Task start prompt
        </Button>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {selected ? (
          <div className="min-h-0 flex-1" inert={merging !== null}>
            <TicketChat key={selected.id} ticket={{ ...base, sessionKey: selected.id } satisfies TicketContext} onRunningChange={setRunning} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-muted-foreground text-[13px]">
              Starting an AI chat automatically opens a question branch.
            </p>
            <Button size="sm" onClick={startBranch}>
              <PlusIcon /> Start a new question
            </Button>
          </div>
        )}
      </div>

      {mergingBranch && merging && (
        <MergeDialog
          ticket={{ ...base, sessionKey: mergingBranch.id }}
          branchTitle={mergingBranch.title}
          mode={merging.startWork ? 'work' : 'merge'}
          onClose={() => setMerging(null)}
          onApprove={(compact, task) => approveMerge(mergingBranch, compact, merging.startWork, task)}
        />
      )}
      {showTaskPrompt && taskPrompt && (
        <TaskStartDialog prompt={taskPrompt} mock={QUESTION_BRANCH_MOCK} onClose={() => setShowTaskPrompt(false)} />
      )}
    </aside>
  );
}
