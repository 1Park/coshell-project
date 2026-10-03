"use client";

import { useMemo, useState } from 'react';
import { MessageSquareIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app';
import { PRIORITY_META, useBoardStore } from '@/store/board';
import { useSessionStore } from '@/store/sessions';
import { TicketChat, type TicketContext } from './TicketChat';
import { cn } from '@/lib/utils';

export function TicketPanel({ ticketId }: { ticketId: string }) {
  const card = useBoardStore((s) => s.cards[ticketId]);
  const columns = useBoardStore((s) => s.columns);
  const close = useAppStore((s) => s.closePanel);
  const openDetail = useAppStore((s) => s.setDetailTicket);
  const clearSession = useSessionStore((s) => s.clearSession);
  const hasSession = useSessionStore((s) => Boolean(s.messagesByTicket[ticketId]?.length));
  const [epoch, setEpoch] = useState(0);

  const ticket: TicketContext | null = useMemo(() => {
    if (!card) return null;
    return {
      ticketId: card.id,
      title: card.title,
      status: columns.find((c) => c.id === card.columnId)?.title ?? card.columnId,
      priority: card.priority,
      labels: card.labels,
      assignees: card.assignees,
      dueDate: card.dueDate,
      description: card.description,
      subtasks: card.subtasks,
    };
  }, [card, columns]);

  if (!card || !ticket) return null;

  return (
    <aside className="border-border bg-card flex w-[380px] shrink-0 flex-col border-l">
      <div className="border-border shrink-0 border-b px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
              <MessageSquareIcon className="size-3" />
              AI 세션 · {ticket.status}
              <span className={cn('ml-1 inline-block size-1.5 rounded-full', PRIORITY_META[card.priority].dot)} />
              {PRIORITY_META[card.priority].name}
            </p>
            <h2 className="mt-0.5 truncate text-sm font-semibold">{card.title}</h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="상세 편집" title="상세 편집" onClick={() => openDetail(card.id)}>
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="새 세션"
            title={hasSession ? '대화 기록 지우고 새 세션' : '새 세션'}
            onClick={() => {
              clearSession(card.id);
              setEpoch((e) => e + 1);
            }}
          >
            <PlusIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="패널 닫기" onClick={close}>
            <XIcon />
          </Button>
        </div>
        {card.description ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{card.description}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <TicketChat key={`${card.id}-${epoch}`} ticket={ticket} />
      </div>
    </aside>
  );
}
