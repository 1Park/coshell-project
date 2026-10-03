"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSessionStore } from '@/store/sessions';
import { useBoardStore } from '@/store/board';
import { useBranchStore } from '@/store/branches';
import { createBranchChatSession } from '@/lib/question-branch-chat';
import type { createQuestionSession, MergePreview, TaskProposal } from '@/lib/question-branch';
import type { TicketContext } from './TicketChat';

export function MergeDialog({
  ticket,
  branchTitle,
  mode,
  onClose,
  onApprove,
}: {
  ticket: TicketContext;
  branchTitle: string;
  mode: 'merge' | 'work';
  onClose: () => void;
  onApprove: (compact: string, task?: TaskProposal) => void;
}) {
  const [compact, setCompact] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskProposal | null>(null);
  const [prepared, setPrepared] = useState<{
    session: ReturnType<typeof createQuestionSession>;
    preview: MergePreview;
    transcript: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const messages = useSessionStore.getState().messagesByTicket[ticket.sessionKey] ?? [];
    const branch = useBranchStore.getState().branchesByTicket[ticket.ticketId]
      ?.find((item) => item.id === ticket.sessionKey);
    const mainContext = JSON.stringify({
      ticket,
      comments: useBoardStore.getState().commentsByCard[ticket.ticketId] ?? [],
      messages: useSessionStore.getState().messagesByTicket[ticket.ticketId] ?? [],
    });
    const session = createBranchChatSession({
      branchId: ticket.sessionKey,
      mainContext,
      branchContext: branch?.mainContext ?? mainContext,
      messages,
    });
    session.previewMerge(ticket.sessionKey, controller.signal)
      .then(async (preview) => {
        if (!cancelled) {
          setCompact(preview.compact);
          setPrepared({ session, preview, transcript: JSON.stringify(messages) });
          if (mode === 'work') {
            const proposal = await session.suggestTask(ticket.sessionKey, preview.id, ticket, controller.signal);
            if (!cancelled) setTask(proposal);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'compact failed');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = () => {
    if (!prepared || !compact || (mode === 'work' && !task)) return;
    try {
      const messages = useSessionStore.getState().messagesByTicket[ticket.sessionKey] ?? [];
      if (JSON.stringify(messages) !== prepared.transcript) {
        throw new Error('Branch changed after compacting. Close and generate a new preview.');
      }
      prepared.session.approveMerge(ticket.sessionKey, prepared.preview.id);
      onApprove(compact, task ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'merge failed');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{mode === 'work' ? 'Review compact and Task' : 'Review compact'} — {branchTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Approving records the compact below as a ticket comment and deletes the branch. Rejecting keeps the branch.
            {mode === 'work' && ' The proposed Task stays separate from the main summary and is included in the Claude Code handoff only after approval.'}
          </p>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2.5 text-[13px] text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          <h3 className="text-xs font-semibold">Summary to merge</h3>
          {compact === null ? (
            <p className="text-muted-foreground animate-pulse rounded-lg bg-muted/40 px-3 py-2.5 text-[13px]">
              Compacting branch…
            </p>
          ) : (
            <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-[13px] whitespace-pre-wrap">{compact}</p>
          )}
          {mode === 'work' && (
            <section className="space-y-2 rounded-lg border p-3" aria-label="Proposed Task">
              <h3 className="text-xs font-semibold">Proposed Task (not completed work)</h3>
              {task ? (
                <>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="whitespace-pre-wrap text-xs">{task.instruction}</p>
                  <p className="text-xs font-semibold">Acceptance criteria</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs">
                    {task.acceptance_criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}
                  </ul>
                  <p className="text-xs font-semibold">Relevant context</p>
                  <p className="text-muted-foreground whitespace-pre-wrap text-xs">{task.relevant_context_summary}</p>
                  <p className="text-xs font-semibold">Risks / open questions</p>
                  {task.risks_or_open_questions.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-xs">
                      {task.risks_or_open_questions.map((risk, index) => <li key={index}>{risk}</li>)}
                    </ul>
                  ) : <p className="text-muted-foreground text-xs">None proposed.</p>}
                </>
              ) : <p className="text-muted-foreground text-xs">{error ? 'Task proposal unavailable. Reject to keep the branch.' : 'Suggesting a Task from the compact…'}</p>}
            </section>
          )}
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Reject
            </Button>
            <Button size="sm" disabled={compact === null || error !== null || (mode === 'work' && task === null)} onClick={approve}>
              {mode === 'work' ? 'Approve Task & merge' : 'Approve & merge'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
