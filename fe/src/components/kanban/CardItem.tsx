import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDaysIcon, MessageSquareIcon, PaperclipIcon } from 'lucide-react';
import {
  MEMBERS,
  PRIORITY_META,
  resolveLabel,
  useBoardStore,
  type BoardCard,
} from '@/store/board';
import { cn } from '@/lib/utils';

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
              m.color,
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
  const labelDefs = useBoardStore((s) => s.labels);
  const start = shortDate(card.startDate);

  return (
    <div
      className={cn(
        'bg-card border-border rounded-[10px] border transition-colors',
        overlay ? 'rotate-1 shadow-xl' : 'hover:border-foreground/25',
      )}
    >
      <div className="space-y-2 p-3">
        {card.labels.length > 0 && (
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            {card.labels.map((id) => {
              const l = resolveLabel(labelDefs, id);
              return (
                <span key={id} className={cn('flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase', l.text)}>
                  <span className={cn('size-1.5 rounded-full', l.dot)} />
                  {l.name}
                </span>
              );
            })}
          </div>
        )}
        <p className="text-[13px] leading-snug font-medium">{card.title}</p>
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