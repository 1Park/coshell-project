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

export interface BoardCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
  labels: string[];
  priority: Priority;
  assignees: string[];
  startDate: string | null;
  dueDate: string | null;
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
  labels: Record<string, Label>;
  moveCard: (cardId: string, toColumnId: string, toIndex: number) => void;
  addCard: (columnId: string, title: string) => void;
  updateCard: (cardId: string, patch: Partial<BoardCard>) => void;
  deleteCard: (cardId: string) => void;
  addColumn: (title: string) => void;
  addComment: (cardId: string, text: string, opts?: { authorId?: string; ai?: boolean }) => void;
  editComment: (cardId: string, commentId: string, text: string) => void;
  deleteComment: (cardId: string, commentId: string) => void;
  addLabel: (name: string, colorId: string) => Label | null;
  deleteLabel: (labelId: string) => void;
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

export const LABEL_COLORS: { id: string; dot: string; text: string }[] = [
  { id: 'gray', dot: 'bg-zinc-400', text: 'text-zinc-500 dark:text-zinc-400' },
  { id: 'red', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { id: 'orange', dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  { id: 'yellow', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { id: 'green', dot: 'bg-emerald-600', text: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'blue', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { id: 'violet', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  { id: 'pink', dot: 'bg-pink-500', text: 'text-pink-600 dark:text-pink-400' },
];

const FALLBACK_LABEL: Label = {
  id: '__unknown',
  name: 'Unknown',
  dot: 'bg-zinc-400',
  text: 'text-muted-foreground',
};

export function resolveLabel(labels: Record<string, Label>, id: string): Label {
  return labels[id] ?? { ...FALLBACK_LABEL, id, name: id };
}

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
    'BUG-101': {
      id: 'BUG-101', columnId: 'col-backlog', title: 'Redesign landing page hero',
      description: 'Tighten hero copy and visuals for the launch. Dark mode included.',
      labels: ['design'], priority: 'high', assignees: ['jh'], startDate: daysFromNow(-2), dueDate: daysFromNow(4),
      comments: 0, attachments: 0,
    },
    'BUG-102': {
      id: 'BUG-102', columnId: 'col-backlog', title: 'Add social login',
      description: 'Wire Google / GitHub OAuth. Need to settle on the session strategy.',
      labels: ['backend', 'frontend'], priority: 'medium', assignees: ['tw'], startDate: daysFromNow(-1), dueDate: daysFromNow(9),
      comments: 0, attachments: 0,
    },
    'BUG-103': {
      id: 'BUG-103', columnId: 'col-backlog', title: 'Document event logging schema',
      description: 'Write up the Mixpanel event naming convention.',
      labels: ['docs'], priority: 'low', assignees: [], startDate: null, dueDate: null,
      comments: 0, attachments: 0,
    },
    'BUG-104': {
      id: 'BUG-104', columnId: 'col-progress', title: 'Polish assistant-ui streaming UX',
      description: 'Review typing indicator, autoscroll, and retry behaviour.',
      labels: ['frontend'], priority: 'high', assignees: ['jh', 'sm'], startDate: daysFromNow(-3), dueDate: daysFromNow(1),
      comments: 2, attachments: 0,
    },
    'BUG-105': {
      id: 'BUG-105', columnId: 'col-progress', title: 'Harden local deploy health check',
      description: 'Serialize rapid pushes and verify the rollback path end to end.',
      labels: ['backend'], priority: 'urgent', assignees: ['tw'], startDate: daysFromNow(-5), dueDate: daysFromNow(-1),
      comments: 0, attachments: 0,
    },
    'BUG-106': {
      id: 'BUG-106', columnId: 'col-progress', title: 'Add empty state illustrations',
      description: 'Three illustrations for when the thread or board is empty.',
      labels: ['design'], priority: 'low', assignees: ['mj'], startDate: daysFromNow(0), dueDate: daysFromNow(6),
      comments: 0, attachments: 0,
    },
    'BUG-107': {
      id: 'BUG-107', columnId: 'col-review', title: 'Audit dark mode tokens',
      description: 'Snapshot review to confirm oklch tokens reach every component.',
      labels: ['frontend', 'design'], priority: 'medium', assignees: ['sm'], startDate: daysFromNow(-4), dueDate: daysFromNow(2),
      comments: 0, attachments: 0,
    },
    'BUG-108': {
      id: 'BUG-108', columnId: 'col-review', title: 'Composer jumps on iOS Safari',
      description: 'The virtual keyboard covers the composer. Needs visualViewport handling.',
      labels: ['bug', 'frontend'], priority: 'urgent', assignees: ['jh'], startDate: daysFromNow(-6), dueDate: daysFromNow(0),
      comments: 1, attachments: 0,
    },
    'BUG-109': {
      id: 'BUG-109', columnId: 'col-done', title: 'Cut onboarding to three steps',
      description: '',
      labels: ['design', 'research'], priority: 'medium', assignees: ['mj', 'sm'], startDate: daysFromNow(-12), dueDate: daysFromNow(-6),
      comments: 0, attachments: 0,
    },
    'BUG-110': {
      id: 'BUG-110', columnId: 'col-done', title: 'Run typecheck as part of build',
      description: '',
      labels: ['backend'], priority: 'low', assignees: ['tw'], startDate: daysFromNow(-5), dueDate: daysFromNow(-3),
      comments: 0, attachments: 0,
    },
  };

  const columns: BoardColumn[] = [
    { id: 'col-backlog', title: 'Backlog', accent: 'bg-zinc-400', cardIds: ['BUG-101', 'BUG-102', 'BUG-103'] },
    { id: 'col-progress', title: 'In Progress', accent: 'bg-sky-500', cardIds: ['BUG-104', 'BUG-105', 'BUG-106'] },
    { id: 'col-review', title: 'In Review', accent: 'bg-amber-500', cardIds: ['BUG-107', 'BUG-108'] },
    { id: 'col-done', title: 'Done', accent: 'bg-emerald-500', cardIds: ['BUG-109', 'BUG-110'] },
  ];

  return { columns, cards };
}

function seedComments(): Record<string, CardComment[]> {
  return {
    'BUG-104': [
      {
        id: 'seed-c1',
        authorId: 'sm',
        text: 'Retry works on desktop, still flaky on subway wifi. Can we replay from the last event id?',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        ai: false,
      },
      {
        id: 'seed-c2',
        authorId: 'jh',
        text: 'Switched streaming to line-buffered events; retry resumes from the last event id. Open: mobile composer viewport jump on iOS — visualViewport handler pending.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        ai: true,
      },
    ],
    'BUG-108': [
      {
        id: 'seed-c3',
        authorId: 'jh',
        text: 'Repro confirmed on iOS Safari: the virtual keyboard resizes the layout viewport and covers the composer. Fix: pin the composer with a visualViewport.resize listener. Verify against TalkBack and VoiceOver before closing.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
        ai: true,
      },
    ],
  };
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      ...seed(),
      commentsByCard: seedComments(),
      labels: { ...LABELS },

      addLabel: (name, colorId) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const color = LABEL_COLORS.find((c) => c.id === colorId) ?? LABEL_COLORS[0];
        const base = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'label';
        let id = base;
        let suffix = 2;
        const existing = { ...LABELS, ...useBoardStore.getState().labels };
        while (existing[id]) id = `${base}-${suffix++}`;
        const label: Label = { id, name: trimmed, dot: color.dot, text: color.text };
        set((state) => ({ labels: { ...state.labels, [id]: label } }));
        return label;
      },

      deleteLabel: (labelId) => {
        set((state) => {
          if (!state.labels[labelId]) return state;
          const labels = { ...state.labels };
          delete labels[labelId];
          const cards = { ...state.cards };
          for (const [id, card] of Object.entries(cards)) {
            if (card.labels.includes(labelId)) {
              cards[id] = { ...card, labels: card.labels.filter((l) => l !== labelId) };
            }
          }
          return { labels, cards };
        });
      },

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
          const maxNum = Object.keys(state.cards).reduce((m, id) => {
            const n = /^BUG-(\d+)$/.exec(id);
            return n ? Math.max(m, Number(n[1])) : m;
          }, 100);
          const id = `BUG-${maxNum + 1}`;
          const card: BoardCard = {
            id, columnId, title: trimmed, description: '', labels: [],
            priority: 'medium', assignees: [], startDate: null, dueDate: null,
            comments: 0, attachments: 0,
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

      addColumn: (title) =>
        set((state) => {
          const trimmed = title.trim();
          if (!trimmed) return state;
          const id = `col-${Date.now().toString(36)}`;
          return { columns: [...state.columns, { id, title: trimmed, accent: 'bg-zinc-400', cardIds: [] }] };
        }),

      editComment: (cardId, commentId, text) =>
        set((state) => {
          const trimmed = text.trim();
          if (!trimmed) return state;
          const list = state.commentsByCard[cardId];
          if (!list) return state;
          return {
            commentsByCard: {
              ...state.commentsByCard,
              [cardId]: list.map((c) => (c.id === commentId && !c.ai ? { ...c, text: trimmed } : c)),
            },
          };
        }),

      deleteComment: (cardId, commentId) =>
        set((state) => {
          const list = state.commentsByCard[cardId];
          const target = list?.find((c) => c.id === commentId);
          if (!list || !target || target.ai) return state;
          const card = state.cards[cardId];
          return {
            commentsByCard: {
              ...state.commentsByCard,
              [cardId]: list.filter((c) => c.id !== commentId),
            },
            cards: { ...state.cards, [cardId]: { ...card, comments: Math.max(0, card.comments - 1) } },
          };
        }),

      resetBoard: () => set(() => ({ ...seed(), commentsByCard: seedComments(), labels: { ...LABELS } })),
    }),
    {
      name: 'coshell-board',
      version: 8,
      migrate: (persistedState, version) => {
        const s = persistedState as Partial<BoardState>;
        if (version < 6 && Object.keys(s.cards ?? {}).some((id) => id.startsWith('card-'))) {
          return { ...seed(), commentsByCard: seedComments(), labels: { ...LABELS } } as BoardState;
        }
        const comments = { ...(s.commentsByCard ?? {}) };
        if (version < 4) {
          const seeds = seedComments();
          for (const [key, value] of Object.entries(seeds)) {
            if (!comments[key] || comments[key].length === 0) comments[key] = value;
          }
        }
        const cards = { ...(s.cards ?? {}) };
        if (version < 8) {
          const fresh = seed().cards;
          for (const [id, card] of Object.entries(cards)) {
            if (card.startDate == null && fresh[id]?.startDate) {
              cards[id] = { ...card, startDate: fresh[id].startDate };
            }
          }
        }
        if (version < 7) {
          for (const [id, card] of Object.entries(cards)) {
            if (card.startDate === undefined) cards[id] = { ...card, startDate: null };
          }
        }
        if (version < 5) {
          for (const [id, card] of Object.entries(cards)) {
            cards[id] = {
              ...card,
              comments: comments[id]?.length ?? 0,
              attachments: 0,
            };
          }
        }
        return { ...s, cards, commentsByCard: comments } as BoardState;
      },
    },
  ),
);