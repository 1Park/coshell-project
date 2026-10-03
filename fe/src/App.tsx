"use client";

import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/ai-sdk';
import { ThreadList } from '@/components/assistant-ui/elements/thread-list.aui';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { KanbanBoard } from '@/components/kanban/Board';
import { MessageSquareIcon, PanelLeftIcon, SquareKanbanIcon } from 'lucide-react';
import { useAppStore, type Lang } from '@/store/app';
import { cn } from '@/lib/utils';

const copy: Record<Lang, { title: string; toggleSidebar: string; langLabel: string; board: string; chat: string }> = {
  ko: { title: 'Coshell', toggleSidebar: '사이드바 토글', langLabel: 'EN', board: '보드', chat: '챗' },
  en: { title: 'Coshell', toggleSidebar: 'Toggle sidebar', langLabel: '한국어', board: 'Board', chat: 'Chat' },
};

function Chat({ sidebarOpen }: { sidebarOpen: boolean }) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: '/api/chat' }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full">
        {sidebarOpen && (
          <div className="border-border w-64 shrink-0 overflow-y-auto border-r p-2">
            <ThreadList />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Thread />
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

export function App() {
  const { lang, setLang, sidebarOpen, toggleSidebar, view, setView } = useAppStore();
  const t = copy[lang];

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <header className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
          {view === 'chat' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label={t.toggleSidebar}
            >
              <PanelLeftIcon />
            </Button>
          )}
          <h1 className="text-sm font-semibold tracking-tight">{t.title}</h1>
          <nav className="bg-muted ml-2 flex items-center gap-0.5 rounded-lg p-0.5">
            {(
              [
                { id: 'board', label: t.board, icon: SquareKanbanIcon },
                { id: 'chat', label: t.chat, icon: MessageSquareIcon },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition',
                  view === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
          >
            {t.langLabel}
          </Button>
        </header>
        <main className="min-h-0 flex-1">
          {view === 'board' ? <KanbanBoard /> : <Chat sidebarOpen={sidebarOpen} />}
        </main>
      </div>
    </TooltipProvider>
  );
}