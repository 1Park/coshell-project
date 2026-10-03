"use client";

import { TooltipProvider } from '@/components/ui/tooltip';
import { KanbanBoard } from '@/components/kanban/Board';
import { CardDialog } from '@/components/kanban/CardDialog';
import { TicketPanel } from '@/components/ticket/TicketPanel';
import { useAppStore } from '@/store/app';

export function App() {
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const detailTicketId = useAppStore((s) => s.detailTicketId);
  const setDetailTicket = useAppStore((s) => s.setDetailTicket);

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <header className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold tracking-tight">CoRAID</h1>
        </header>
        <main className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <KanbanBoard />
          </div>
          {activeTicketId ? <TicketPanel key={activeTicketId} ticketId={activeTicketId} /> : null}
        </main>
      </div>
      <CardDialog cardId={detailTicketId} onClose={() => setDetailTicket(null)} />
    </TooltipProvider>
  );
}
