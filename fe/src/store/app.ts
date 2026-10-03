import { create } from 'zustand';

interface AppState {
  activeTicketId: string | null;
  activeBranchId: string | null;
  detailTicketId: string | null;
  setActiveTicket: (ticketId: string | null, branchId?: string | null) => void;
  closePanel: () => void;
  setDetailTicket: (ticketId: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  activeTicketId: null,
  activeBranchId: null,
  detailTicketId: null,
  setActiveTicket: (ticketId, branchId = null) => set({ activeTicketId: ticketId, activeBranchId: branchId }),
  closePanel: () => set({ activeTicketId: null, activeBranchId: null }),
  setDetailTicket: (ticketId) => set({ detailTicketId: ticketId }),
}));