import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDaysIcon, MessageSquareIcon, PaperclipIcon } from 'lucide-react';
import {
  MEMBERS,
  PRIORITY_META,
  useBoardStore,
  type BoardCard,
} from '@/store/board';
import { cn } from '@/lib/utils';

export const MEMBER_FALLBACK_COLOR = 'bg-zinc-400';

const MEMBER_COLOR_CLASSES = new Set([
  MEMBER_FALLBACK_COLOR,
  'bg-violet-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
]);

export function memberColorClass(color?: string | null): string {
  return color && MEMBER_COLOR_CLASSES.has(color) ? color : MEMBER_FALLBACK_COLOR;
}

export function dueMeta(dueDate: string | null): { label: string; overdue: boolean } | null {  if (!dueDate) return null;
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / day);
  if (diff < 0) return { label: `D+${-diff}`, overdue: true };
  if (diff === 0) return { label: 'D-Day', overdue: false };
  return { label: `D-${diff}`, overdue: false };
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function AvatarStack({ memberIds, size = 'sm' }: { memberIds: string[]; size?: 'sm' | 'md' }) {
  if (memberIds.length === 0) return null;
  const cls = size === 'sm' ? 'size-5 text-[9px]' : 'size-6 text-[10px]';
  return (
    <div className="flex -space-x-1">
      {memberIds.map((id) => {
        const m = MEMBERS[id];
        if (!m) return null;
        return (
          <span
            key={id}
            title={m.name}
            className={cn(
              'flex items-center justify-center rounded-full font-bold text-white ring-2 ring-card',
              memberColorClass(m.color),
              cls,
            )}
          >
            {m.initials}
          </span>
        );
      })}
    </div>
  );
}

export function CardFace({ card, overlay = false }: { card: BoardCard; overlay?: boolean }) {
  const due = dueMeta(card.dueDate);
  const commentCount = useBoardStore((s) => s.commentsByCard[card.id]?.length ?? 0);
  const start = shortDate(card.startDate);

  return (
    <div
      className={cn(
        'bg-card rounded-[10px] shadow-sm shadow-amber-950/5 transition-shadow',
        overlay ? 'rotate-1 shadow-xl' : 'hover:shadow-md hover:shadow-amber-950/10',
      )}
    >
      <div className="space-y-2 p-3">
        <p className="font-mono text-[10px] font-medium tracking-wide text-muted-foreground tabular-nums">
          {card.id}
        </p>
        <p title={card.title} className="truncate text-[13px] leading-snug font-medium">{card.title}</p>
        {card.description && <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">{card.description}</p>}
        <div className="flex items-center gap-2.5 pt-0.5">
          {start && (
            <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] tabular-nums">
              <CalendarDaysIcon className="size-3" />
              {start}
            </span>
          )}
          {due && (
            <span
              className={cn(
                'flex items-center gap-1 font-mono text-[10px] font-medium tabular-nums',
                due.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
              )}
            >
              <CalendarDaysIcon className="size-3" />
              {due.label}
            </span>
          )}
          <span className={cn('flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase', PRIORITY_META[card.priority].text)}>
            <span className={cn('size-1.5 rounded-full', PRIORITY_META[card.priority].dot)} />
            {PRIORITY_META[card.priority].name}
          </span>
          {commentCount > 0 && (
            <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] tabular-nums">
              <MessageSquareIcon className="size-3" />
              {commentCount}
            </span>
          )}
          {card.attachments > 0 && (
            <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px] tabular-nums">
              <PaperclipIcon className="size-3" />
              {card.attachments}
            </span>
          )}
          <span className="ml-auto">
            <AvatarStack memberIds={card.assignees} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function SortableCard({
  card,
  onOpen,
  dragDisabled,
}: {
  card: BoardCard;
  onOpen: () => void;
  dragDisabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', cardId: card.id, columnId: card.columnId },
    disabled: dragDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn('cursor-grab touch-manipulation active:cursor-grabbing', isDragging && 'opacity-30')}
    >
      <CardFace card={card} />
    </div>
  );
}
