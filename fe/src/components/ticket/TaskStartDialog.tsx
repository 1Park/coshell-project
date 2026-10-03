"use client";

import { useRef, useState } from 'react';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function TaskStartDialog({ prompt, mock, onClose }: {
  prompt: string;
  mock: boolean;
  onClose: () => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const copy = async () => {
    setError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        // Clipboard API is unavailable on HTTP demo origins.
        input.current?.focus();
        input.current?.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
      }
      setCopied(true);
    } catch {
      input.current?.focus();
      input.current?.select();
      setError(true);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start Task in Claude Code</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-xs">
          Paste this prompt into Claude Code in your local repository. MCP must be connected and the ticket registered.
          This screen does not launch Claude Code or start an MCP Task automatically.
        </p>
        {mock && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Mock mode: the approved QB compact is simulated. No model call is made to generate this prompt.
          </p>
        )}
        <Textarea ref={input} aria-label="Task start prompt" value={prompt} readOnly rows={16} className="max-h-[50dvh] resize-none font-mono text-xs" />
        {error && <p role="alert" className="text-xs text-destructive">Copy unavailable. The prompt is selected; copy it manually.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}{copied ? 'Copied' : 'Copy prompt'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
