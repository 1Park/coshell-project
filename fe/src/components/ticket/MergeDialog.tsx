"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSessionStore } from '@/store/sessions';
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

  useEffect(() => {
    let cancelled = false;
    const messages = useSessionStore.getState().messagesByTicket[ticket.sessionKey] ?? [];
    fetch('/api/compact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketContext: ticket, messages }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `compact failed (${res.status})`);
        return data.compact as string;
      })
      .then((text) => {
        if (!cancelled) setCompact(text);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'compact failed');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <Button size="sm" disabled={compact === null} onClick={() => compact && onApprove(compact)}>
              {mode === 'work' ? 'Merge & start work' : 'Approve & merge'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
