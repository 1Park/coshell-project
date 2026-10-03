"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSessionStore } from '@/store/sessions';
import { useBoardStore } from '@/store/board';
import { useBranchStore } from '@/store/branches';
import { createBranchChatSession } from '@/lib/question-branch-chat';
import type { createQuestionSession, MergePreview } from '@/lib/question-branch';
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
  onApprove: (compact: string) => void;
}) {
  const [compact, setCompact] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      .then((preview) => {
        if (!cancelled) {
          setCompact(preview.compact);
          setPrepared({ session, preview, transcript: JSON.stringify(messages) });
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
    if (!prepared || !compact) return;
    try {
      const messages = useSessionStore.getState().messagesByTicket[ticket.sessionKey] ?? [];
      if (JSON.stringify(messages) !== prepared.transcript) {
        throw new Error('Branch changed after compacting. Close and generate a new preview.');
      }
      prepared.session.approveMerge(ticket.sessionKey, prepared.preview.id);
      onApprove(compact);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'merge failed');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Merge into comments — {branchTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            Approving records the compact below as a ticket comment and deletes the branch. Rejecting keeps the branch.
          </p>
          {error ? (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2.5 text-[13px] text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : compact === null ? (
            <p className="text-muted-foreground animate-pulse rounded-lg bg-muted/40 px-3 py-2.5 text-[13px]">
              Compacting branch…
            </p>
          ) : (
            <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-[13px] whitespace-pre-wrap">{compact}</p>
          )}
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Reject
            </Button>
            <Button size="sm" disabled={compact === null || error !== null} onClick={approve}>
              {mode === 'work' ? 'Merge & start work' : 'Approve & merge'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
