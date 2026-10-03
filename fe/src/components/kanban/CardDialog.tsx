import { useState } from 'react';
import { CalendarDaysIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import {
  LABELS,
  MEMBERS,
  PRIORITY_META,
  useBoardStore,
  type Priority,
} from '@/store/board';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AvatarStack } from './CardItem';
import { cn } from '@/lib/utils';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CardDialog({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const card = useBoardStore((s) => (cardId ? s.cards[cardId] : undefined));
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const toggleSubtask = useBoardStore((s) => s.toggleSubtask);
  const [subtaskDraft, setSubtaskDraft] = useState('');

  const addSubtask = () => {
    if (!card || !subtaskDraft.trim()) return;
    updateCard(card.id, {
      subtasks: [
        ...card.subtasks,
        { id: `sub-${Date.now().toString(36)}`, title: subtaskDraft.trim(), done: false },
      ],
    });
    setSubtaskDraft('');
  };

  return (
    <Dialog open={cardId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {!card ? null : (
          <>
            <DialogHeader>
              <DialogTitle>
                <Input
                  value={card.title}
                  onChange={(e) => updateCard(card.id, { title: e.target.value })}
                  className="border-transparent px-2 text-base font-semibold shadow-none focus-visible:border-input"
                />
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 px-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <div className="flex items-center gap-2">
                  <AvatarStack memberIds={card.assignees} size="md" />
                  <div className="flex -space-x-1">
                    {Object.values(MEMBERS).map((m) => {
                      const on = card.assignees.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          title={m.name}
                          onClick={() =>
                            updateCard(card.id, {
                              assignees: on ? card.assignees.filter((a) => a !== m.id) : [...card.assignees, m.id],
                            })
                          }
                          className={cn(
                            'size-7 rounded-full text-xs font-bold text-white ring-2 transition',
                            m.color,
                            on ? 'ring-foreground scale-110' : 'opacity-30 ring-transparent hover:opacity-70',
                          )}
                        >
                          {m.initials}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarDaysIcon className="size-3.5" />
                  <input
                    type="date"
                    value={toDateInput(card.dueDate)}
                    onChange={(e) =>
                      updateCard(card.id, {
                        dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null,
                      })
                    }
                    className="bg-muted rounded-md px-2 py-1 text-xs text-foreground outline-none"
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">PRIORITY</p>
                <div className="flex gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => updateCard(card.id, { priority: p })}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                        card.priority === p
                          ? 'border-foreground/30 bg-muted'
                          : 'border-transparent text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      <span className={cn('size-1.5 rounded-full', PRIORITY_META[p].dot)} />
                      {PRIORITY_META[p].name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">LABELS</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(LABELS).map((l) => {
                    const on = card.labels.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        onClick={() =>
                          updateCard(card.id, {
                            labels: on ? card.labels.filter((x) => x !== l.id) : [...card.labels, l.id],
                          })
                        }
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold tracking-[0.06em] uppercase transition',
                          on ? cn('bg-muted', l.text) : 'text-muted-foreground hover:bg-muted/60',
                        )}
                      >
                        <span className={cn('size-2 rounded-full', l.dot)} />
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">DESCRIPTION</p>
                <Textarea
                  value={card.description}
                  onChange={(e) => updateCard(card.id, { description: e.target.value })}
                  placeholder="설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                  SUBTASKS · {card.subtasks.filter((s) => s.done).length}/{card.subtasks.length}
                </p>
                <div className="space-y-1">
                  {card.subtasks.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleSubtask(card.id, s.id)}
                      className="hover:bg-muted/60 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition"
                    >
                      <span
                        className={cn(
                          'flex size-4.5 items-center justify-center rounded-md border text-[11px] transition',
                          s.done ? 'border-transparent bg-emerald-500 text-white' : 'border-input text-transparent',
                        )}
                      >
                        ✓
                      </span>
                      <span className={cn(s.done && 'text-muted-foreground line-through')}>{s.title}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Input
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addSubtask(); }}
                    placeholder="새 하위 작업"
                    className="h-8 text-sm"
                  />
                  <Button variant="ghost" size="icon-sm" aria-label="하위 작업 추가" onClick={addSubtask}>
                    <PlusIcon />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-600 dark:text-rose-400"
                  onClick={() => { deleteCard(card.id); onClose(); }}
                >
                  <Trash2Icon /> 삭제
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}