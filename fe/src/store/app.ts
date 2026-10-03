import { create } from 'zustand';

export type Lang = 'ko' | 'en';

interface AppState {
  lang: Lang;
  activeTicketId: string | null;
  detailTicketId: string | null;
  setLang: (lang: Lang) => void;
  setActiveTicket: (ticketId: string | null) => void;
  closePanel: () => void;
  setDetailTicket: (ticketId: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  lang: 'ko',
  activeTicketId: null,
  detailTicketId: null,
  setLang: (lang) => set({ lang }),
  setActiveTicket: (ticketId) => set({ activeTicketId: ticketId }),
  closePanel: () => set({ activeTicketId: null }),
  setDetailTicket: (ticketId) => set({ detailTicketId: ticketId }),
}));