import { create } from 'zustand';

export type Lang = 'ko' | 'en';
export type View = 'board' | 'chat';

interface AppState {
  lang: Lang;
  view: View;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setLang: (lang: Lang) => void;
  setView: (view: View) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  lang: 'ko',
  view: 'board',
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLang: (lang) => set({ lang }),
  setView: (view) => set({ view }),
}));