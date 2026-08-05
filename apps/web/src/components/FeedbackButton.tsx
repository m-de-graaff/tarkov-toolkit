// Feedback entry point in the top nav: a small sheet posting to our own
// /api/feedback (Postgres-backed - no third-party service involved). Only
// rendered on the hosted deployment, which is the one with a database.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AUTH_ENABLED } from '../lib/authClient';
import { metric, reportFeedback } from '../lib/monitoring';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function FeedbackButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  // the hosted deployment is the one with an API + database behind it
  if (!AUTH_ENABLED) return null;

  const submit = async () => {
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          ...(email.trim() ? { email: email.trim() } : {}),
          page: location.pathname,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      // mirror into Sentry User Feedback so it sits next to errors/replays
      reportFeedback(message, email.trim() || undefined);
      metric.count('feedback.submitted');
      setStatus('sent');
      setMessage('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStatus('idle');
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Send feedback"
          title="Send feedback"
        >
          <MessageSquarePlus aria-hidden="true" className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[90vw] max-w-96 flex-col gap-3 p-4">
        <SheetHeader className="p-0">
          <SheetTitle className="text-sm">Send feedback</SheetTitle>
        </SheetHeader>
        {status === 'sent' ? (
          <p className="rounded-md border border-ok/40 bg-ok/10 p-3 text-sm">
            Thanks - your feedback landed. It's read regularly.
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              What's broken, missing, or annoying?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={4000}
                className="rounded-md border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Steps to reproduce help a lot for bugs."
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Email (optional, for follow-up)
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                placeholder="you@example.com"
                className="h-8"
              />
            </label>
            {status === 'error' && (
              <p className="text-xs text-destructive">
                Sending failed - try again in a moment.
              </p>
            )}
            <Button
              type="button"
              size="sm"
              disabled={message.trim().length < 3 || status === 'sending'}
              onClick={() => void submit()}
            >
              {status === 'sending' ? 'Sending…' : 'Send'}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
