import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UIMessage } from 'ai';

interface SessionsState {
  messagesByTicket: Record<string, UIMessage[]>;
  pendingByTicket: Record<string, string>;
  setMessages: (ticketId: string, messages: UIMessage[]) => void;
  clearSession: (ticketId: string) => void;
  queueQuestion: (ticketId: string, text: string) => void;
  consumeQuestion: (ticketId: string) => string | null;
}

export const useSessionStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      messagesByTicket: {},
      pendingByTicket: {},

      setMessages: (ticketId, messages) =>
        set((state) => ({
          messagesByTicket: { ...state.messagesByTicket, [ticketId]: messages },
        })),

      clearSession: (ticketId) =>
        set((state) => {
          const next = { ...state.messagesByTicket };
          delete next[ticketId];
          return { messagesByTicket: next };
        }),

      queueQuestion: (ticketId, text) =>
        set((state) => ({
          pendingByTicket: { ...state.pendingByTicket, [ticketId]: text },
        })),

      consumeQuestion: (ticketId) => {
        const text = get().pendingByTicket[ticketId];
        if (!text) return null;
        set((state) => {
          const next = { ...state.pendingByTicket };
          delete next[ticketId];
          return { pendingByTicket: next };
        });
        return text;
      },
    }),
    {
      name: 'coshell-sessions',
      version: 2,
      migrate: (persistedState) => ({
        ...(persistedState as Record<string, unknown>),
        pendingByTicket: (persistedState as Partial<SessionsState>).pendingByTicket ?? {},
      }) as SessionsState,
      partialize: (state) => ({ messagesByTicket: state.messagesByTicket }) as SessionsState,
    },
  ),
);
