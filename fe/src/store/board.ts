import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import boardData from '../../../data/board.json';
import bug101 from '../../../data/tickets/BUG-101/main.json';
import bug102 from '../../../data/tickets/BUG-102/main.json';
import bug103 from '../../../data/tickets/BUG-103/main.json';
import bug104 from '../../../data/tickets/BUG-104/main.json';
import bug105 from '../../../data/tickets/BUG-105/main.json';
import bug106 from '../../../data/tickets/BUG-106/main.json';
import bug107 from '../../../data/tickets/BUG-107/main.json';
import bug108 from '../../../data/tickets/BUG-108/main.json';
import bug109 from '../../../data/tickets/BUG-109/main.json';
import bug110 from '../../../data/tickets/BUG-110/main.json';
import bug204 from '../../../data/tickets/BUG-204/main.json';

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
  reporter: string | null;
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
  deleteComment: (cardId: string, commentId: string, authorId?: string) => void;
  addLabel: (name: string, colorId: string) => Label | null;
  deleteLabel: (labelId: string) => void;
  resetBoard: () => void;
}

export const LABELS = boardData.labels as Record<string, Label>;

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

export const MEMBERS = boardData.members as Record<string, Member>;

export const PRIORITY_META: Record<Priority, { name: string; text: string; dot: string }> = {
  low: { name: 'Low', text: 'text-muted-foreground', dot: 'bg-zinc-400' },
  medium: { name: 'Medium', text: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  high: { name: 'High', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  urgent: { name: 'Urgent', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
};

type BoardData = typeof boardData;
interface TicketData {
  ticket_id: string;
  title: string;
  description: string;
  labels: string[];
  priority: Priority;
  assignees: string[];
  reporter: string | null;
  start_date: string | null;
  due_date: string | null;
  discussions: Array<{
    id: string;
    author_id: string;
    text: string;
    ai: boolean;
    created_at: string;
  }>;
}

const TICKETS = [bug101, bug102, bug103, bug104, bug105, bug106, bug107, bug108, bug109, bug110, bug204] as TicketData[];

function ticketColumnId(columns: BoardData['columns'], ticketId: string): string {
  return columns.find((column) => column.card_ids.includes(ticketId))?.id ?? 'col-backlog';
}

function toCard(ticket: TicketData, columnId: string): BoardCard {
  return {
    id: ticket.ticket_id,
    columnId,
    title: ticket.title,
    description: ticket.description,
    labels: ticket.labels,
    priority: ticket.priority as Priority,
    assignees: ticket.assignees,
    reporter: ticket.reporter,
    startDate: ticket.start_date,
    dueDate: ticket.due_date,
    comments: ticket.discussions.length,
    attachments: 0,
  };
}

function toComment(discussion: TicketData['discussions'][number]): CardComment {
  return {
    id: discussion.id,
    authorId: discussion.author_id,
    text: discussion.text,
    createdAt: discussion.created_at,
    ai: discussion.ai,
  };
}

function seed(): { columns: BoardColumn[]; cards: Record<string, BoardCard> } {
  const columns = boardData.columns.map((column) => ({
    id: column.id,
    title: column.title,
    accent: column.accent,
    cardIds: [...column.card_ids],
  }));
  const cards = Object.fromEntries(
    TICKETS.map((ticket) => [ticket.ticket_id, toCard(ticket, ticketColumnId(boardData.columns, ticket.ticket_id))]),
  );
  return { columns, cards };
}

function seedComments(): Record<string, CardComment[]> {
  return Object.fromEntries(
    TICKETS.map((ticket) => [ticket.ticket_id, ticket.discussions.map(toComment)]),
  );
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
            priority: 'medium', assignees: [], reporter: null, startDate: null, dueDate: null,
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

      deleteComment: (cardId, commentId, authorId = 'jh') =>
        set((state) => {
          const list = state.commentsByCard[cardId];
          const target = list?.find((c) => c.id === commentId);
          if (!list || !target || target.authorId !== authorId) return state;
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
      version: 16,
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
        if (version < 13) {
          const fresh = seed().cards;
          for (const [id, card] of Object.entries(cards)) {
            if (fresh[id] && id.startsWith('BUG-')) {
              cards[id] = { ...card, assignees: fresh[id].assignees, reporter: fresh[id].reporter };
            }
          }
        }
        if (version < 12) {
          const fresh = seed().cards;
          for (const [id, card] of Object.entries(cards)) {
            if (fresh[id]?.description && id.startsWith('BUG-')) {
              cards[id] = { ...card, description: fresh[id].description };
            }
          }
        }
        if (version < 11) {
          // v10 shipped plain "Summary: ..." mock descriptions; swap in the
          // markdown versions, but only where the user hasn't edited them.
          const fresh = seed().cards;
          for (const [id, card] of Object.entries(cards)) {
            if (fresh[id]?.description && card.description.startsWith('Summary: ')) {
              cards[id] = { ...card, description: fresh[id].description };
            }
          }
        }
        if (version < 10) {
          const fresh = seed().cards;
          for (const [id, card] of Object.entries(cards)) {
            if (fresh[id] && fresh[id].description) {
              cards[id] = { ...card, description: fresh[id].description };
            }
          }
        }
        if (version < 9) {
          for (const [id, card] of Object.entries(cards)) {
            if (card.reporter === undefined) cards[id] = { ...card, reporter: null };
          }
        }
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
        let columns = s.columns;
        if (version < 14 && columns) {
          // Add seed tickets this browser has never seen (e.g. BUG-204), leaving existing cards untouched.
          const fresh = seed();
          const freshComments = seedComments();
          const missing = Object.keys(fresh.cards).filter((id) => !cards[id]);
          if (missing.length > 0) {
            columns = columns.map((column) => {
              const seedColumn = fresh.columns.find((c) => c.id === column.id);
              const added = (seedColumn?.cardIds ?? []).filter((id) => missing.includes(id));
              return added.length ? { ...column, cardIds: [...added, ...column.cardIds] } : column;
            });
            for (const id of missing) {
              const placed = columns.some((column) => column.cardIds.includes(id));
              if (!placed) continue;
              cards[id] = fresh.cards[id];
              comments[id] = freshComments[id] ?? [];
            }
          }
        }
        if (version < 15 && columns && !cards['BUG-204']) {
          // BUG-204 is the live demo ticket; restore it if it was deleted in this browser.
          const fresh = seed();
          const home = fresh.cards['BUG-204']?.columnId;
          if (home && columns.some((column) => column.id === home)) {
            columns = columns.map((column) =>
              column.id === home ? { ...column, cardIds: ['BUG-204', ...column.cardIds.filter((id) => id !== 'BUG-204')] } : column,
            );
            cards['BUG-204'] = fresh.cards['BUG-204'];
            comments['BUG-204'] = seedComments()['BUG-204'] ?? [];
          }
        }
        if (version < 16 && columns) {
          // Recreate the BUG-204 demo ticket from seed, dropping comments (e.g. AI summaries) from earlier demo runs.
          const fresh = seed();
          const home = fresh.cards['BUG-204']?.columnId;
          if (home && columns.some((column) => column.id === home)) {
            columns = columns.map((column) => {
              const others = column.cardIds.filter((id) => id !== 'BUG-204');
              return column.id === home ? { ...column, cardIds: ['BUG-204', ...others] } : { ...column, cardIds: others };
            });
            cards['BUG-204'] = fresh.cards['BUG-204'];
            comments['BUG-204'] = seedComments()['BUG-204'] ?? [];
          }
        }
        return { ...s, columns, cards, commentsByCard: comments } as BoardState;
      },
    },
  ),
);
