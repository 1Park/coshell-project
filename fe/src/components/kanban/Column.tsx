import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { useBoardStore, type BoardColumn } from '@/store/board';
import { SortableCard } from './CardItem';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function KanbanColumn({
  column,
  visibleCardIds,
  searchActive,
  onOpenCard,
}: {
  column: BoardColumn;
  visibleCardIds: string[];
  searchActive: boolean;
  onOpenCard: (cardId: string) => void;
}) {
  const cards = useBoardStore((s) => s.cards);
  const addCard = useBoardStore((s) => s.addCard);
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (draft.trim()) {
      addCard(column.id, draft);
      setDraft('');
    }
    setComposing(false);
  };

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl transition-colors',
        isOver && 'bg-sky-500/[0.07]',
      )}
    >
      <header className="flex items-center gap-1.5 px-1 pt-1 pb-2">
        <span className={cn('size-2 rounded-full', column.accent)} />
        <h2 className="text-muted-foreground text-[11px] font-bold tracking-[0.08em] uppercase">{column.title}</h2>
        <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {visibleCardIds.length}
        </span>
        <span className="flex-1" />
        <Button variant="ghost" size="icon-xs" aria-label="카드 추가" onClick={() => setComposing(true)}>
          <PlusIcon />
        </Button>
      </header>

      <div className="flex min-h-24 flex-col gap-2 overflow-y-auto px-0.5 py-0.5">
        <SortableContext items={visibleCardIds} strategy={verticalListSortingStrategy}>
          {visibleCardIds.map((id) => {
            const card = cards[id];
            if (!card) return null;
            return (
              <SortableCard key={id} card={card} onOpen={() => onOpenCard(id)} dragDisabled={searchActive} />
            );
          })}
        </SortableContext>
        {visibleCardIds.length === 0 && !composing && (
          <p className="text-muted-foreground/60 rounded-[10px] border border-dashed px-3 py-5 text-center text-xs">
            Drop here
          </p>
        )}
        {composing && (
          <div className="bg-card border-border space-y-2 rounded-[10px] border p-2.5">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape') {
                  setDraft('');
                  setComposing(false);
                }
              }}
              placeholder="카드 제목을 입력하세요"
              className="bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60 w-full resize-none"
            />
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={submit} disabled={!draft.trim()}>
                <CheckIcon /> 추가
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="취소" onClick={() => { setDraft(''); setComposing(false); }}>
                <XIcon />
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}