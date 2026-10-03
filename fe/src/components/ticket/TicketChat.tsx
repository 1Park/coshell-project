"use client";

import { useEffect, useMemo } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/ai-sdk';
import type { UIMessage } from 'ai';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { useBoardStore } from '@/store/board';
import { useBranchStore } from '@/store/branches';
import { useSessionStore } from '@/store/sessions';
import { branchChatResponse, questionContext } from '@/lib/question-branch-chat';
import { QUESTION_SYSTEM_PROMPT } from '@/lib/team-prompts';

export interface TicketContext {
  ticketId: string;
  sessionKey: string;
  title: string;
  status: string;
  priority: string;
  labels: string[];
  assignees: string[];
  reporter: string | null;
  startDate: string | null;
  dueDate: string | null;
  description: string;
}

export function TicketChat({ ticket, onRunningChange }: {
  ticket: TicketContext;
  onRunningChange: (running: boolean) => void;
}) {
  const initialMessages = useSessionStore((s) => s.messagesByTicket[ticket.sessionKey]);
  const setMessages = useSessionStore((s) => s.setMessages);

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: '/api/chat',
        body: { ticketId: ticket.ticketId, ticketContext: ticket },
        fetch: async (input, init) => {
          const request = new Request(input, init);
          const { messages } = await request.json() as { messages: UIMessage[] };
          const branch = useBranchStore.getState().branchesByTicket[ticket.ticketId]
            ?.find((item) => item.id === ticket.sessionKey);
          if (!branch) throw new Error('Question branch not found');
          const mock = branch.mock ?? true;
          const mainContext = questionContext({
            ticket,
            comments: useBoardStore.getState().commentsByCard[ticket.ticketId] ?? [],
            messages: useSessionStore.getState().messagesByTicket[ticket.ticketId] ?? [],
            mock,
          });
          return branchChatResponse({
            branchId: branch.id,
            mainContext,
            branchContext: branch.mainContext ?? mainContext,
            messages,
            signal: request.signal,
            questionPrompt: QUESTION_SYSTEM_PROMPT,
            mock,
          });
        },
      }),
    [ticket],
  );

  const runtime = useChatRuntime({
    transport,
    messages: initialMessages ?? undefined,
    onFinish: ({ messages }) => {
      setMessages(ticket.sessionKey, messages);
      autoTitleBranch(ticket.ticketId, ticket.sessionKey, messages);
    },
  });

  useEffect(() => {
    const update = () => onRunningChange(runtime.thread.getState().isRunning);
    update();
    const unsubscribe = runtime.thread.subscribe(update);
    return () => {
      unsubscribe();
      onRunningChange(false);
    };
  }, [runtime, onRunningChange]);

  useEffect(() => {
    const question = useSessionStore.getState().consumeQuestion(ticket.sessionKey);
    if (question) {
      runtime.thread.append(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<UIMessage['parts'][number], { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n')
    .trim();
}

function autoTitleBranch(ticketId: string, sessionKey: string, messages: UIMessage[]) {
  const branch = (useBranchStore.getState().branchesByTicket[ticketId] ?? []).find(
    (b) => b.id === sessionKey,
  );
  if (!branch || (branch.title !== 'New question' && !/^Q\d+$/.test(branch.title))) return;
  const firstUser = messages.find((m) => m.role === 'user');
  const text = firstUser ? messageText(firstUser) : '';
  if (text) useBranchStore.getState().renameBranch(ticketId, branch.id, text);
}
