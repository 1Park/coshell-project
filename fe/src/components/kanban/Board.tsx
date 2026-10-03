import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { PlusIcon, RotateCcwIcon, SearchIcon } from 'lucide-react';
import { useBoardStore } from '@/store/board';
import { useAppStore } from '@/store/app';
import { KanbanColumn } from './Column';
import { CardFace } from './CardItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function KanbanBoard() {
  const columns = useBoardStore((s) => s.columns);
  const cards = useBoardStore((s) => s.cards);
  const moveCard = useBoardStore((s) => s.moveCard);
  const addColumn = useBoardStore((s) => s.addColumn);
  const resetBoard = useBoardStore((s) => s.resetBoard);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const setDetailTicket = useAppStore((s) => s.setDetailTicket);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnDraft, setColumnDraft] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const activeCard = activeId ? cards[activeId] : undefined;

  const visibleIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      map[col.id] = q
        ? col.cardIds.filter((id) => {
            const c = cards[id];
            return c && (c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
          })
        : col.cardIds;
    }
    return map;
  }, [columns, cards, query]);

  const stats = useMemo(() => {
    const all = Object.values(cards);
    const doneCol = columns.find((c) => c.id === 'col-done');
    const done = doneCol ? doneCol.cardIds.length : 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = all.filter((c) => {
      if (!c.dueDate) return false;
      const due = new Date(c.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() < today.getTime() && c.columnId !== 'col-done';
    }).length;
    return { total: all.length, done, overdue };
  }, [columns, cards]);

  const place = (activeCardId: string, overId: string | null) => {
    const card = cards[activeCardId];
    if (!card || !overId) return;
    const overCard = cards[overId];
    const targetColumnId = overCard ? overCard.columnId : overId;
    const targetCol = columns.find((c) => c.id === targetColumnId);
    if (!targetCol) return;
    const overIndex = overCard ? targetCol.cardIds.indexOf(overCard.id) : targetCol.cardIds.length;
    const fromIndex = columns.find((c) => c.id === card.columnId)?.cardIds.indexOf(activeCardId) ?? -1;
    if (card.columnId === targetColumnId && fromIndex === overIndex) return;
    moveCard(activeCardId, targetColumnId, overIndex);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragOver = (e: DragOverEvent) => {
    const activeCardId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const card = cards[activeCardId];
    if (!card || !overId) return;
    const overCard = cards[overId];
    const targetColumnId = overCard ? overCard.columnId : overId;
    if (targetColumnId !== card.columnId) place(activeCardId, overId);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeCardId = String(e.active.id);
    if (e.over) place(activeCardId, String(e.over.id));
    setActiveId(null);
  };

  const submitColumn = () => {
    if (columnDraft.trim()) addColumn(columnDraft);
    setColumnDraft('');
    setAddingColumn(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-sm font-bold tracking-tight">CoRAID Sprint</h1>
          <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
            {stats.done}/{stats.total} done
            {stats.overdue > 0 && <span className="text-rose-600 dark:text-rose-400"> · {stats.overdue} overdue</span>}
          </p>
        </div>
        <span className="flex-1" />
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards"
            className="h-8 w-44 pl-8 text-sm"
          />
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Reset board" title="Reset to demo data" onClick={resetBoard}>
          <RotateCcwIcon />
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="board-canvas flex min-h-0 flex-1 items-start gap-2 overflow-x-auto px-4 pt-2 pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              visibleCardIds={visibleIds[col.id] ?? []}
              searchActive={query.trim().length > 0}
              onOpenCard={setDetailTicket}
            />
          ))}
          {addingColumn ? (
            <div className="bg-card border-border w-72 shrink-0 space-y-2 rounded-[10px] border p-2.5">
              <Input
                autoFocus
                value={columnDraft}
                onChange={(e) => setColumnDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitColumn();
                  if (e.key === 'Escape') { setColumnDraft(''); setAddingColumn(false); }
                }}
                placeholder="Column name"
                className="h-8 text-sm"
              />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={submitColumn} disabled={!columnDraft.trim()}>Add</Button>
                <Button variant="ghost" size="sm" onClick={() => { setColumnDraft(''); setAddingColumn(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="text-muted-foreground hover:text-foreground hover:border-foreground/25 flex w-72 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-dashed py-3 text-[13px] transition"
            >
              <PlusIcon className="size-4" /> Add column
            </button>
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
          {activeCard ? (
            <div className="w-72">
              <CardFace card={activeCard} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}