import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useBoardStore } from './board';
import { useSessionStore } from './sessions';

export interface Branch {
  id: string;
  ticketId: string;
  title: string;
  createdAt: string;
  mainContext?: string;
}

interface BranchState {
  branchesByTicket: Record<string, Branch[]>;
  createBranch: (ticketId: string) => Branch;
  renameBranch: (ticketId: string, branchId: string, title: string) => void;
  deleteBranch: (ticketId: string, branchId: string) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchesByTicket: {},

      createBranch: (ticketId) => {
        const board = useBoardStore.getState();
        const branch: Branch = {
          id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          ticketId,
          title: 'New question',
          createdAt: new Date().toISOString(),
          mainContext: JSON.stringify({
            ticket: board.cards[ticketId],
            comments: board.commentsByCard[ticketId] ?? [],
            messages: useSessionStore.getState().messagesByTicket[ticketId] ?? [],
          }),
        };
        set((state) => ({
          branchesByTicket: {
            ...state.branchesByTicket,
            [ticketId]: [...(state.branchesByTicket[ticketId] ?? []), branch],
          },
        }));
        return branch;
      },

      renameBranch: (ticketId, branchId, title) =>
        set((state) => ({
          branchesByTicket: {
            ...state.branchesByTicket,
            [ticketId]: (state.branchesByTicket[ticketId] ?? []).map((b) =>
              b.id === branchId ? { ...b, title: title.trim().slice(0, 40) || b.title } : b,
            ),
          },
        })),

      deleteBranch: (ticketId, branchId) =>
        set((state) => ({
          branchesByTicket: {
            ...state.branchesByTicket,
            [ticketId]: (state.branchesByTicket[ticketId] ?? []).filter((b) => b.id !== branchId),
          },
        })),
    }),
    { name: 'coshell-branches', version: 2 },
  ),
);
