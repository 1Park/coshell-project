import { create } from 'zustand';

interface AppState {
  activeTicketId: string | null;
  activeBranchId: string | null;
  detailTicketId: string | null;
  mergeAnimatingTicketId: string | null;
  sidePanelWidth: number;
  resizingSidePanel: boolean;
  sidePanelResizeEndedAt: number;
  dialogClosedAt: number;
  setActiveTicket: (ticketId: string | null, branchId?: string | null) => void;
  closePanel: () => void;
  setDetailTicket: (ticketId: string | null) => void;
  closeDetail: () => void;
  showMergeAnimation: (ticketId: string) => void;
  clearMergeAnimation: () => void;
  setSidePanelWidth: (width: number) => void;
  setResizingSidePanel: (resizing: boolean) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  activeTicketId: null,
  activeBranchId: null,
  detailTicketId: null,
  mergeAnimatingTicketId: null,
  sidePanelWidth: 380,
  resizingSidePanel: false,
  sidePanelResizeEndedAt: 0,
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
  showMergeAnimation: (ticketId) => set({ mergeAnimatingTicketId: ticketId }),
  clearMergeAnimation: () => set({ mergeAnimatingTicketId: null }),
  setSidePanelWidth: (width) => set({ sidePanelWidth: Math.max(320, Math.min(640, width)) }),
  setResizingSidePanel: (resizing) => set({ resizingSidePanel: resizing, sidePanelResizeEndedAt: resizing ? get().sidePanelResizeEndedAt : Date.now() }),
}));
