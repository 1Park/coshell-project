"use client";

import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { KanbanBoard } from '@/components/kanban/Board';
import { CardDialog } from '@/components/kanban/CardDialog';
import { TicketPanel } from '@/components/ticket/TicketPanel';
import { useAppStore, type Lang } from '@/store/app';

const copy: Record<Lang, { title: string; langLabel: string }> = {
  ko: { title: 'Coshell', langLabel: 'EN' },
  en: { title: 'Coshell', langLabel: '한국어' },
};

export function App() {
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  const activeTicketId = useAppStore((s) => s.activeTicketId);
  const detailTicketId = useAppStore((s) => s.detailTicketId);
  const setDetailTicket = useAppStore((s) => s.setDetailTicket);
  const t = copy[lang];

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <header className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
          <h1 className="text-sm font-semibold tracking-tight">{t.title}</h1>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
          >
            {t.langLabel}
          </Button>
        </header>
        <main className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <KanbanBoard />
          </div>
          {activeTicketId ? <TicketPanel ticketId={activeTicketId} /> : null}
        </main>
      </div>
      <CardDialog cardId={detailTicketId} onClose={() => setDetailTicket(null)} />
    </TooltipProvider>
  );
}
