"use client";

import { useEffect, useMemo, useRef } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/ai-sdk';
import type { UIMessage } from 'ai';
import { Thread } from '@/components/assistant-ui/elements/thread.aui';
import { useBoardStore } from '@/store/board';
import { useBranchStore } from '@/store/branches';
import { useSessionStore } from '@/store/sessions';

export interface TicketContext {
  ticketId: string;
  sessionKey: string;
  title: string;
  status: string;
  priority: string;
  labels: string[];
  assignees: string[];
  startDate: string | null;
  dueDate: string | null;
  description: string;
}

export function TicketChat({ ticket }: { ticket: TicketContext }) {
  const initialMessages = useSessionStore((s) => s.messagesByTicket[ticket.sessionKey]);
  const setMessages = useSessionStore((s) => s.setMessages);
  const addComment = useBoardStore((s) => s.addComment);
  const linkedAnswer = useRef(false);

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: '/api/chat',
        body: { ticketId: ticket.ticketId, ticketContext: ticket },
      }),
    [ticket],
  );

  const runtime = useChatRuntime({
    transport,
    messages: initialMessages ?? undefined,
    onFinish: ({ messages }) => {
      setMessages(ticket.sessionKey, messages);
      autoTitleBranch(ticket.ticketId, ticket.sessionKey, messages);
      if (linkedAnswer.current) {
        linkedAnswer.current = false;
        const text = lastAssistantText(messages);
        if (text) addComment(ticket.ticketId, text, { ai: true });
      }
    },
  });

  useEffect(() => {
    const question = useSessionStore.getState().consumeQuestion(ticket.sessionKey);
    if (question) {
      linkedAnswer.current = true;
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

function lastAssistantText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const text = messageText(m);
    if (text) return text;
  }
  return '';
}
