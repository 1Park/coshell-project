import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Label {
  id: string;
  name: string;
  dot: string;
  text: string;
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface BoardCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
  labels: string[];
  priority: Priority;
  assignees: string[];
  dueDate: string | null;
  subtasks: Subtask[];
  comments: number;
  attachments: number;
}

export interface BoardColumn {
  id: string;
  title: string;
  accent: string;
  cardIds: string[];
}

export interface CardComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  ai: boolean;
}

interface BoardState {
  columns: BoardColumn[];
  cards: Record<string, BoardCard>;
  commentsByCard: Record<string, CardComment[]>;
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void;
  addCard: (columnId: string, title: string) => void;
  updateCard: (cardId: string, patch: Partial<BoardCard>) => void;
  deleteCard: (cardId: string) => void;
  toggleSubtask: (cardId: string, subtaskId: string) => void;
  addColumn: (title: string) => void;
  addComment: (cardId: string, text: string, opts?: { authorId?: string; ai?: boolean }) => void;
  resetBoard: () => void;
}

export const LABELS: Record<string, Label> = {
  design: { id: 'design', name: 'Design', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  frontend: { id: 'frontend', name: 'Frontend', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  backend: { id: 'backend', name: 'Backend', dot: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
  bug: { id: 'bug', name: 'Bug', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  docs: { id: 'docs', name: 'Docs', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  research: { id: 'research', name: 'Research', dot: 'bg-indigo-500', text: 'text-indigo-500 dark:text-indigo-400' },
};

export const MEMBERS: Record<string, Member> = {
  jh: { id: 'jh', name: 'Jinhyun Kim', initials: 'JK', color: 'bg-violet-600' },
  sm: { id: 'sm', name: 'Sumin Jeon', initials: 'SJ', color: 'bg-sky-600' },
  mj: { id: 'mj', name: 'Minji Park', initials: 'MP', color: 'bg-emerald-600' },
  tw: { id: 'tw', name: 'Taewon Han', initials: 'TH', color: 'bg-amber-600' },
};

export const PRIORITY_META: Record<Priority, { name: string; text: string; dot: string }> = {
  low: { name: 'Low', text: 'text-muted-foreground', dot: 'bg-zinc-400' },
  medium: { name: 'Medium', text: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  high: { name: 'High', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  urgent: { name: 'Urgent', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
};

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

function seed(): { columns: BoardColumn[]; cards: Record<string, BoardCard> } {
  const cards: Record<string, BoardCard> = {
    'card-landing': {
      id: 'card-landing', columnId: 'col-backlog', title: 'Redesign landing page hero',
      description: 'Tighten hero copy and visuals for the launch. Dark mode included.',
      labels: ['design'], priority: 'high', assignees: ['jh'], dueDate: daysFromNow(4),
      subtasks: [{ id: 's1', title: 'Lock copy', done: true }, { id: 's2', title: 'Two design variants', done: false }, { id: 's3', title: 'Mobile breakpoint', done: false }],
      comments: 5, attachments: 3,
    },
    'card-auth': {
      id: 'card-auth', columnId: 'col-backlog', title: 'Add social login',
      description: 'Wire Google / GitHub OAuth. Need to settle on the session strategy.',
      labels: ['backend', 'frontend'], priority: 'medium', assignees: ['tw'], dueDate: daysFromNow(9),
      subtasks: [{ id: 's1', title: 'Register OAuth app', done: false }, { id: 's2', title: 'Callback route', done: false }],
      comments: 2, attachments: 0,
    },
    'card-analytics': {
      id: 'card-analytics', columnId: 'col-backlog', title: 'Document event logging schema',
      description: 'Write up the Mixpanel event naming convention.',
      labels: ['docs'], priority: 'low', assignees: [], dueDate: null,
      subtasks: [], comments: 0, attachments: 1,
    },
    'card-chat': {
      id: 'card-chat', columnId: 'col-progress', title: 'Polish assistant-ui streaming UX',
      description: 'Review typing indicator, autoscroll, and retry behaviour.',
      labels: ['frontend'], priority: 'high', assignees: ['jh', 'sm'], dueDate: daysFromNow(1),
      subtasks: [{ id: 's1', title: 'Pin autoscroll', done: true }, { id: 's2', title: 'Retry on error', done: true }, { id: 's3', title: 'Mobile composer', done: false }],
      comments: 8, attachments: 2,
    },
    'card-deploy': {
      id: 'card-deploy', columnId: 'col-progress', title: 'Harden local deploy health check',
      description: 'Serialize rapid pushes and verify the rollback path end to end.',
      labels: ['backend'], priority: 'urgent', assignees: ['tw'], dueDate: daysFromNow(-1),
      subtasks: [{ id: 's1', title: 'Concurrent deploy test', done: false }],
      comments: 3, attachments: 0,
    },
    'card-empty': {
      id: 'card-empty', columnId: 'col-progress', title: 'Add empty state illustrations',
      description: 'Three illustrations for when the thread or board is empty.',
      labels: ['design'], priority: 'low', assignees: ['mj'], dueDate: daysFromNow(6),
      subtasks: [], comments: 1, attachments: 4,
    },
    'card-dark': {
      id: 'card-dark', columnId: 'col-review', title: 'Audit dark mode tokens',
      description: 'Snapshot review to confirm oklch tokens reach every component.',
      labels: ['frontend', 'design'], priority: 'medium', assignees: ['sm'], dueDate: daysFromNow(2),
      subtasks: [{ id: 's1', title: 'Capture snapshots', done: true }, { id: 's2', title: 'Contrast check', done: false }],
      comments: 4, attachments: 6,
    },
    'card-crash': {
      id: 'card-crash', columnId: 'col-review', title: 'Composer jumps on iOS Safari',
      description: 'The virtual keyboard covers the composer. Needs visualViewport handling.',
      labels: ['bug', 'frontend'], priority: 'urgent', assignees: ['jh'], dueDate: daysFromNow(0),
      subtasks: [{ id: 's1', title: 'Capture repro', done: true }, { id: 's2', title: 'Ship fix PR', done: true }],
      comments: 12, attachments: 1,
    },
    'card-onboard': {
      id: 'card-onboard', columnId: 'col-done', title: 'Cut onboarding to three steps',
      description: '',
      labels: ['design', 'research'], priority: 'medium', assignees: ['mj', 'sm'], dueDate: daysFromNow(-6),
      subtasks: [{ id: 's1', title: 'User interviews', done: true }, { id: 's2', title: 'Prototype', done: true }, { id: 's3', title: 'Ship it', done: true }],
      comments: 6, attachments: 2,
    },
    'card-ci': {
      id: 'card-ci', columnId: 'col-done', title: 'Run typecheck as part of build',
      description: '',
      labels: ['backend'], priority: 'low', assignees: ['tw'], dueDate: daysFromNow(-3),
      subtasks: [{ id: 's1', title: 'Update script', done: true }],
      comments: 0, attachments: 0,
    },
  };

  const columns: BoardColumn[] = [
    { id: 'col-backlog', title: 'Backlog', accent: 'bg-zinc-400', cardIds: ['card-landing', 'card-auth', 'card-analytics'] },
    { id: 'col-progress', title: 'In Progress', accent: 'bg-sky-500', cardIds: ['card-chat', 'card-deploy', 'card-empty'] },
    { id: 'col-review', title: 'In Review', accent: 'bg-amber-500', cardIds: ['card-dark', 'card-crash'] },
    { id: 'col-done', title: 'Done', accent: 'bg-emerald-500', cardIds: ['card-onboard', 'card-ci'] },
  ];

  return { columns, cards };
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      ...seed(),
      commentsByCard: {},

      addComment: (cardId, text, opts) =>
        set((state) => {
          const trimmed = text.trim();
          if (!trimmed || !state.cards[cardId]) return state;
          const comment: CardComment = {
            id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            authorId: opts?.authorId ?? 'jh',
            text: trimmed,
            createdAt: new Date().toISOString(),
            ai: opts?.ai ?? false,
          };
          const card = state.cards[cardId];
          return {
            commentsByCard: {
              ...state.commentsByCard,
              [cardId]: [...(state.commentsByCard[cardId] ?? []), comment],
            },
            cards: { ...state.cards, [cardId]: { ...card, comments: card.comments + 1 } },
          };
        }),

      moveCard: (cardId, toColumnId, toIndex) =>
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
          const fromColumnId = card.columnId;
          const columns = state.columns.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
          const from = columns.find((c) => c.id === fromColumnId);
          const to = columns.find((c) => c.id === toColumnId);
          if (!from || !to) return state;
          from.cardIds = from.cardIds.filter((id) => id !== cardId);
          const clamped = Math.max(0, Math.min(toIndex, to.cardIds.length));
          to.cardIds.splice(clamped, 0, cardId);
          return {
            columns,
            cards: { ...state.cards, [cardId]: { ...card, columnId: toColumnId } },
          };
        }),

      addCard: (columnId, title) =>
        set((state) => {
          const trimmed = title.trim();
          if (!trimmed) return state;
          const id = `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
          const card: BoardCard = {
            id, columnId, title: trimmed, description: '', labels: [],
            priority: 'medium', assignees: [], dueDate: null,
            subtasks: [], comments: 0, attachments: 0,
          };
          return {
            cards: { ...state.cards, [id]: card },
            columns: state.columns.map((c) =>
              c.id === columnId ? { ...c, cardIds: [...c.cardIds, id] } : c,
            ),
          };
        }),

      updateCard: (cardId, patch) =>
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
          return { cards: { ...state.cards, [cardId]: { ...card, ...patch } } };
        }),

      deleteCard: (cardId) =>
        set((state) => {
          if (!state.cards[cardId]) return state;
          const cards = { ...state.cards };
          delete cards[cardId];
          const commentsByCard = { ...state.commentsByCard };
          delete commentsByCard[cardId];
          return {
            cards,
            commentsByCard,
            columns: state.columns.map((c) => ({ ...c, cardIds: c.cardIds.filter((id) => id !== cardId) })),
          };
        }),

      toggleSubtask: (cardId, subtaskId) =>
        set((state) => {
          const card = state.cards[cardId];
          if (!card) return state;
          return {
            cards: {
              ...state.cards,
              [cardId]: {
                ...card,
                subtasks: card.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
              },
            },
          };
        }),

      addColumn: (title) =>
        set((state) => {
          const trimmed = title.trim();
          if (!trimmed) return state;
          const id = `col-${Date.now().toString(36)}`;
          return { columns: [...state.columns, { id, title: trimmed, accent: 'bg-zinc-400', cardIds: [] }] };
        }),

      resetBoard: () => set(() => ({ ...seed(), commentsByCard: {} })),
    }),
    { 
      name: 'coshell-board',
      version: 3,
      migrate: (persistedState) => ({
        ...(persistedState as Record<string, unknown>),
        commentsByCard: (persistedState as Partial<BoardState>).commentsByCard ?? {},
      }) as BoardState,
    },
  ),
);