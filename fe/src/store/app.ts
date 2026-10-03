import { create } from 'zustand';

interface AppState {
  activeTicketId: string | null;
  activeBranchId: string | null;
  detailTicketId: string | null;
  dialogClosedAt: number;
  setActiveTicket: (ticketId: string | null, branchId?: string | null) => void;
  closePanel: () => void;
  setDetailTicket: (ticketId: string | null) => void;
  closeDetail: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  activeTicketId: null,
  activeBranchId: null,
  detailTicketId: null,
  dialogClosedAt: 0,
  setActiveTicket: (ticketId, branchId = null) => set({ activeTicketId: ticketId, activeBranchId: branchId }),
  closePanel: () => set({ activeTicketId: null, activeBranchId: null }),
  setDetailTicket: (ticketId) => {
    // Closing unmounts the dialog on pointerdown; the rest of the same click
    // would otherwise land underneath and reopen it.
    if (ticketId && Date.now() - get().dialogClosedAt < 400) return;
    set({ detailTicketId: ticketId });
  },
  closeDetail: () => set({ detailTicketId: null, dialogClosedAt: Date.now() }),
}));