import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronDownIcon, PencilIcon, PlusIcon, SendIcon, SparklesIcon, Trash2Icon, XIcon } from 'lucide-react';
import {
  LABEL_COLORS,
  MEMBERS,
  PRIORITY_META,
  resolveLabel,
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
import { Markdown } from '@/components/ui/markdown';
import { AvatarStack, memberColorClass } from './CardItem';
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

function Field({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">{caption}</span>
      {children}
    </div>
  );
}

function PeopleField({
  value,
  onChange,
  multiple,
  placeholder,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open ]);

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      setPos({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 280)),
        width: Math.min(Math.max(r.width, 240), window.innerWidth - 16),
      });
    }
    setOpen(true);
  };

  const toggle = (id: string) => {
    if (multiple) onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
    else onChange(value[0] === id ? [] : [id]);
  };
  return (
    <div>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        aria-expanded={open}
        className="bg-muted/60 hover:bg-muted flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-xs transition"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {value.length > 0 ? (
            <>
              <AvatarStack memberIds={value} size="md" />
              <span className="min-w-0 flex-1 truncate text-xs">
                {value.map((id) => MEMBERS[id]?.name ?? id).join(', ')}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon className={cn('size-3.5 shrink-0 text-muted-foreground transition', open && 'rotate-180')} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="border-border fixed z-[61] max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {Object.values(MEMBERS).map((m) => {
              const on = value.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition"
                >
                  <span className={cn('flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white', memberColorClass(m.color))}>
                    {m.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  {on && <CheckIcon className="size-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

export function CardDialog({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const card = useBoardStore((s) => (cardId ? s.cards[cardId] : undefined));
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMode, setCommentMode] = useState<'comment' | 'ai'>('ai');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [addingLabel, setAddingLabel] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelPos, setLabelPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const labelBtnRef = useRef<HTMLButtonElement>(null);
  // Keep the last opened card so the close animation never renders an empty shell.
  const lastCardRef = useRef(card);
  useEffect(() => {
    if (card) lastCardRef.current = card;
  }, [card]);
  const shown = card ?? lastCardRef.current;

  // Reset per-ticket UI state whenever the ticket changes or the dialog closes.
  // Never re-key the popup itself: a key change mid-close remounts an orphan
  // popup that is already "closed" and can't be dismissed.
  // Dropdown portals live outside the dialog tree, so close them here too.
  useEffect(() => {
    setLabelsOpen(false);
    setAddingLabel(false);
    setEditingTitle(false);
    setEditingDesc(false);
    setEditingId(null);
    setCommentMode('ai');
  }, [cardId]);
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const comments = useBoardStore((s) => (shown ? (s.commentsByCard[shown.id] ?? EMPTY_COMMENTS) : EMPTY_COMMENTS));
  const addComment = useBoardStore((s) => s.addComment);
  const editComment = useBoardStore((s) => s.editComment);
  const deleteComment = useBoardStore((s) => s.deleteComment);
  const labelDefs = useBoardStore((s) => s.labels);
  const addLabel = useBoardStore((s) => s.addLabel);
  const deleteLabel = useBoardStore((s) => s.deleteLabel);
  const setActiveTicket = useAppStore((s) => s.setActiveTicket);
  const createBranch = useBranchStore((s) => s.createBranch);
  const queueQuestion = useSessionStore((s) => s.queueQuestion);

  useEffect(() => {
    if (!labelsOpen) return;
    const close = () => setLabelsOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [labelsOpen]);

  const toggleLabels = () => {
    if (labelsOpen) {
      setLabelsOpen(false);
      return;
    }
    const r = labelBtnRef.current?.getBoundingClientRect();
    if (r) {
      setLabelPos({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.left, window.innerWidth - 280)),
        width: Math.min(Math.max(r.width, 260), window.innerWidth - 16),
      });
    }
    setLabelsOpen(true);
  };
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

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  const saveTitle = () => {
    if (card && titleDraft.trim()) updateCard(card.id, { title: titleDraft.trim() });
    setEditingTitle(false);
  };

  return (
    <Dialog open={cardId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent initialFocus={false} className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {!shown ? null : (
          <>
            <DialogHeader>
              <DialogTitle>
                <span className="px-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                  {shown.id}
                </span>
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    className="px-2 text-xl font-semibold"
                  />
                ) : (
                  <button
                    title="Edit title"
                    onClick={() => {
                      setTitleDraft(shown.title);
                      setEditingTitle(true);
                    }}
                    className="hover:bg-muted/60 block w-full rounded-md px-2 py-1 text-left text-xl font-semibold transition"
                  >
                    {shown.title || <span className="text-muted-foreground">Untitled</span>}
                  </button>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 px-1 pb-1">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field caption="ASSIGNEES">
                  <PeopleField
                    key={`assignees-${shown.id}`}
                    multiple
                    value={shown.assignees}
                    placeholder="Unassigned"
                    onChange={(ids) => updateCard(shown.id, { assignees: ids })}
                  />
                </Field>
                <Field caption="REPORTER">
                  <PeopleField
                    key={`reporter-${shown.id}`}
                    value={shown.reporter ? [shown.reporter] : []}
                    placeholder="Unassigned"
                    onChange={(ids) => updateCard(shown.id, { reporter: ids[0] ?? null })}
                  />
                </Field>
                <Field caption="START">
                  <input
                    type="date"
                    value={toDateInput(shown.startDate)}
                    onChange={(e) =>
                      updateCard(shown.id, {
                        startDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null,
                      })
                    }
                    className="bg-muted h-8 w-full rounded-md px-2 text-xs text-foreground outline-none"
                  />
                </Field>
                <Field caption="DUE">
                  <input
                    type="date"
                    value={toDateInput(shown.dueDate)}
                    onChange={(e) =>
                      updateCard(shown.id, {
                        dueDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null,
                      })
                    }
                    className="bg-muted h-8 w-full rounded-md px-2 text-xs text-foreground outline-none"
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">PRIORITY</p>
                <div className="flex gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => updateCard(shown.id, { priority: p })}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                        shown.priority === p
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
                <button
                  ref={labelBtnRef}
                  onClick={toggleLabels}
                  aria-expanded={labelsOpen}
                  className="mb-2 flex items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground"
                >
                  LABELS · {shown.labels.length}
                  <ChevronDownIcon className={cn('size-3.5 transition', labelsOpen && 'rotate-180')} />
                </button>
                {shown.labels.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {shown.labels.map((id) => {
                      const l = resolveLabel(labelDefs, id);
                      return (
                        <span
                          key={id}
                          className={cn('bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold tracking-[0.06em] uppercase', l.text)}
                        >
                          <span className={cn('size-2 rounded-full', l.dot)} />
                          {l.name}
                          <button
                            title={`Remove ${l.name}`}
                            aria-label={`Remove ${l.name} from ticket`}
                            onClick={() => updateCard(shown.id, { labels: shown.labels.filter((x) => x !== id) })}
                            className="rounded p-px hover:text-rose-500"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {labelsOpen && labelPos && createPortal(
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setLabelsOpen(false)} />
                    <div
                      className="border-border fixed z-[61] max-h-72 space-y-1 overflow-y-auto rounded-lg border bg-popover p-1 shadow-xl"
                      style={{ top: labelPos.top, left: labelPos.left, width: labelPos.width }}
                    >
                    {Object.values(labelDefs).map((l) => {
                      const on = shown.labels.includes(l.id);
                      return (
                        <div
                          key={l.id}
                          className="hover:bg-muted/60 group/label flex items-center gap-1 rounded-md py-1 pr-1 pl-2 transition"
                        >
                          <button
                            onClick={() =>
                              updateCard(shown.id, {
                                labels: on ? shown.labels.filter((x) => x !== l.id) : [...shown.labels, l.id],
                              })
                            }
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          >
                            <span className={cn('size-2 shrink-0 rounded-full', l.dot)} />
                            <span className={cn('min-w-0 flex-1 truncate text-[13px]', !on && 'text-muted-foreground')}>{l.name}</span>
                            {on && <CheckIcon className="size-3.5 shrink-0" />}
                          </button>
                          <button
                            title={`Delete label ${l.name}`}
                            aria-label={`Delete label ${l.name}`}
                            onClick={() => deleteLabel(l.id)}
                            className="invisible shrink-0 rounded p-0.5 group-hover/label:visible hover:text-rose-500"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                    {addingLabel ? (
                      <div className="space-y-2 p-1">
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
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1.5 text-xs transition"
                      >
                        <PlusIcon className="size-3.5" /> New label
                      </button>
                    )}
                    </div>
                  </>,
                  document.body,
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">DESCRIPTION</p>
                  {!editingDesc && (
                    <button
                      title="Edit description"
                      aria-label="Edit description"
                      onClick={() => {
                        setDescDraft(shown.description);
                        setEditingDesc(true);
                      }}
                      className="text-muted-foreground rounded p-0.5 transition hover:bg-muted hover:text-foreground"
                    >
                      <PencilIcon className="size-3" />
                    </button>
                  )}
                </div>
                {editingDesc ? (
                  <>
                    <Textarea
                      autoFocus
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      rows={4}
                      className="text-sm"
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <Button size="sm" onClick={() => { updateCard(shown.id, { description: descDraft }); setEditingDesc(false); }}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingDesc(false)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : shown.description ? (
                  <Markdown text={shown.description} />
                ) : (
                  <button
                    onClick={() => {
                      setDescDraft('');
                      setEditingDesc(true);
                    }}
                    className="text-muted-foreground/60 text-sm transition hover:text-foreground"
                  >
                    Add a description…
                  </button>
                )}
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
                                  if (shown && editDraft.trim()) editComment(shown.id, c.id, editDraft);
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
                                  if (shown && editDraft.trim()) editComment(shown.id, c.id, editDraft);
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
                            {mine && shown && (
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
                                  onClick={() => deleteComment(shown.id, c.id)}
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
                        { id: 'ai', icon: SparklesIcon, label: 'Ask AI mode' },
                        { id: 'comment', icon: SendIcon, label: 'Comment mode' },
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
                  onClick={() => { deleteCard(shown.id); onClose(); }}
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
