import { useState } from 'react';
import { CalendarDaysIcon, PencilIcon, PlusIcon, SendIcon, SparklesIcon, Trash2Icon, XIcon } from 'lucide-react';
import {
  LABEL_COLORS,
  MEMBERS,
  PRIORITY_META,
  useBoardStore,
  type CardComment,
  type Priority,
} from '@/store/board';
import { useAppStore } from '@/store/app';
import { useBranchStore } from '@/store/branches';
import { useSessionStore } from '@/store/sessions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AvatarStack } from './CardItem';
import { cn } from '@/lib/utils';

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

// Current user — their comments render on the right, iMessage-style.
const ME = 'jh';

const EMPTY_COMMENTS: CardComment[] = [];

function formatTime(iso: string): string {  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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
  const comments = useBoardStore((s) => (cardId ? (s.commentsByCard[cardId] ?? EMPTY_COMMENTS) : EMPTY_COMMENTS));
  const addComment = useBoardStore((s) => s.addComment);
  const editComment = useBoardStore((s) => s.editComment);
  const deleteComment = useBoardStore((s) => s.deleteComment);
  const labelDefs = useBoardStore((s) => s.labels);
  const addLabel = useBoardStore((s) => s.addLabel);
  const deleteLabel = useBoardStore((s) => s.deleteLabel);
  const setActiveTicket = useAppStore((s) => s.setActiveTicket);
  const createBranch = useBranchStore((s) => s.createBranch);
  const queueQuestion = useSessionStore((s) => s.queueQuestion);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMode, setCommentMode] = useState<'comment' | 'ai'>('comment');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [addingLabel, setAddingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [labelColor, setLabelColor] = useState('violet');

  const submitLabel = () => {
    if (!card || !labelDraft.trim()) return;
    const label = addLabel(labelDraft, labelColor);
    if (label && !card.labels.includes(label.id)) {
      updateCard(card.id, { labels: [...card.labels, label.id] });
    }
    setLabelDraft('');
    setAddingLabel(false);
  };

  const submitComment = () => {
    if (commentMode === 'ai') {
      askAi();
      return;
    }
    if (!card || !commentDraft.trim()) return;
    addComment(card.id, commentDraft.trim());
    setCommentDraft('');
  };

  const askAi = () => {
    if (!card || !commentDraft.trim()) return;
    const question = commentDraft.trim();
    const branch = createBranch(card.id);
    queueQuestion(branch.id, question);
    setCommentDraft('');
    setActiveTicket(card.id, branch.id);
    onClose();
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
                  <span className="font-medium">Start</span>
                  <input
                    type="date"
                    value={toDateInput(card.startDate)}
                    onChange={(e) =>
                      updateCard(card.id, {
                        startDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null,
                      })
                    }
                    className="bg-muted rounded-md px-2 py-1 text-xs text-foreground outline-none"
                  />
                </label>
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span className="font-medium">Due</span>
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
                  {Object.values(labelDefs).map((l) => {
                    const on = card.labels.includes(l.id);
                    return (
                      <span
                        key={l.id}
                        className={cn(
                          'group/label flex items-center gap-0.5 rounded-lg py-1.5 pr-1 pl-2.5 text-[11px] font-bold tracking-[0.06em] uppercase transition',
                          on ? cn('bg-muted', l.text) : 'text-muted-foreground hover:bg-muted/60',
                        )}
                      >
                        <button
                          onClick={() =>
                            updateCard(card.id, {
                              labels: on ? card.labels.filter((x) => x !== l.id) : [...card.labels, l.id],
                            })
                          }
                          className="flex items-center gap-1.5"
                        >
                          <span className={cn('size-2 rounded-full', l.dot)} />
                          {l.name}
                        </button>
                        <button
                          title={`Delete label ${l.name}`}
                          aria-label={`Delete label ${l.name}`}
                          onClick={() => deleteLabel(l.id)}
                          className="invisible rounded p-0.5 group-hover/label:visible hover:text-rose-500"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                {addingLabel ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-1.5">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c.id}
                          title={c.id}
                          aria-label={`Color ${c.id}`}
                          onClick={() => setLabelColor(c.id)}
                          className={cn(
                            'size-5 rounded-full transition',
                            c.dot,
                            labelColor === c.id ? 'ring-foreground ring-2 ring-offset-2 ring-offset-card' : 'opacity-50 hover:opacity-100',
                          )}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        value={labelDraft}
                        onChange={(e) => setLabelDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitLabel();
                          if (e.key === 'Escape') { setLabelDraft(''); setAddingLabel(false); }
                        }}
                        placeholder="New label name"
                        className="h-8 text-sm"
                      />
                      <Button size="sm" onClick={submitLabel} disabled={!labelDraft.trim()}>Add</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setLabelDraft(''); setAddingLabel(false); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingLabel(true)}
                    className="text-muted-foreground hover:text-foreground mt-1.5 flex items-center gap-1 text-xs transition"
                  >
                    <PlusIcon className="size-3.5" /> New label
                  </button>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">DESCRIPTION</p>
                <Textarea
                  value={card.description}
                  onChange={(e) => updateCard(card.id, { description: e.target.value })}
                  placeholder="Add a description"
                  rows={3}
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
                  COMMENTS · {comments.length}
                </p>
                {comments.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg bg-muted/40 px-3 py-2.5 text-[13px]">
                    No comments yet. Write below or ask AI.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {comments.map((c) => {
                      if (c.ai) {
                        const merged = c.text.match(/^\[(.+?) merged\]\n?([\s\S]*)$/);
                        return (
                          <div key={c.id} className="bg-muted/60 rounded-xl px-3 py-2.5">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                              <SparklesIcon className="size-3 text-violet-500" />
                              AI SUMMARY
                              {merged && (
                                <span className="rounded-full bg-violet-500/15 px-1.5 py-px text-[10px] text-violet-600 dark:text-violet-400">
                                  {merged[1]}
                                </span>
                              )}
                              <span className="ml-auto font-normal">{formatTime(c.createdAt)}</span>
                            </p>
                            <p className="mt-1 text-[13px] whitespace-pre-wrap">{merged ? merged[2] : c.text}</p>
                          </div>
                        );
                      }
                      const member = MEMBERS[c.authorId];
                      const mine = c.authorId === ME;
                      if (editingId === c.id) {
                        return (
                          <div key={c.id} className="flex flex-col items-end gap-1.5">
                            <Textarea
                              autoFocus
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  if (card && editDraft.trim()) editComment(card.id, c.id, editDraft);
                                  setEditingId(null);
                                }
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              rows={2}
                              className="text-sm"
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                disabled={!editDraft.trim()}
                                onClick={() => {
                                  if (card && editDraft.trim()) editComment(card.id, c.id, editDraft);
                                  setEditingId(null);
                                }}
                              >
                                Save
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={c.id} className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
                          <p className="mb-0.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                            {!mine && <span className="font-semibold">{member?.name ?? 'Unknown'}</span>}
                            {!mine && ' · '}
                            {formatTime(c.createdAt)}
                            {mine && card && (
                              <span className="ml-1 hidden gap-0.5 group-hover:flex">
                                <button
                                  title="Edit comment"
                                  aria-label="Edit comment"
                                  onClick={() => {
                                    setEditingId(c.id);
                                    setEditDraft(c.text);
                                  }}
                                  className="rounded p-0.5 hover:bg-muted"
                                >
                                  <PencilIcon className="size-3" />
                                </button>
                                <button
                                  title="Delete comment"
                                  aria-label="Delete comment"
                                  onClick={() => deleteComment(card.id, c.id)}
                                  className="rounded p-0.5 hover:bg-muted hover:text-rose-500"
                                >
                                  <Trash2Icon className="size-3" />
                                </button>
                              </span>
                            )}
                          </p>
                          <p
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap',
                              mine
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted rounded-bl-md',
                            )}
                          >
                            {c.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <Input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                    placeholder={commentMode === 'ai' ? 'Ask AI (Enter to send)' : 'Write a comment (Enter to post)'}
                    className="h-8 text-sm"
                  />
                  <div
                    role="group"
                    aria-label="Input mode"
                    className="bg-muted flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
                  >
                    {(
                      [
                        { id: 'comment', icon: SendIcon, label: 'Comment mode' },
                        { id: 'ai', icon: SparklesIcon, label: 'Ask AI mode' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={m.label}
                        aria-label={m.label}
                        aria-pressed={commentMode === m.id}
                        onClick={() => {
                          if (commentMode === m.id) submitComment();
                          else setCommentMode(m.id);
                        }}
                        className={cn(
                          'flex size-7 items-center justify-center rounded-md transition',
                          commentMode === m.id
                            ? m.id === 'ai'
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <m.icon className="size-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-600 dark:text-rose-400"
                  onClick={() => { deleteCard(card.id); onClose(); }}
                >
                  <Trash2Icon /> Delete
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
