// Account button for the hosted deployment: sign in to sync progress across
// devices. Renders nothing unless the build sets VITE_AUTH_ENABLED, so local
// dev and self-hosted builds stay account-free.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CircleUser } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AUTH_ENABLED, authClient } from '../lib/authClient';
import type { SyncStatus } from '../lib/useProgressSync';
import { useProgressSync } from '../lib/useProgressSync';

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: '',
  syncing: 'Syncing...',
  synced: 'Progress synced',
  error: 'Sync failed - retrying automatically',
};

function AuthForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const call =
      mode === 'signIn'
        ? authClient.signIn.email({ email, password })
        : authClient.signUp.email({ email, password, name: email.split('@')[0] });
    const { error: err } = await call;
    setBusy(false);
    if (err) {
      setError(err.message ?? 'Something went wrong');
      return;
    }
    onDone();
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {mode === 'signIn'
          ? 'Sign in to sync your progress across devices.'
          : 'Create an account to sync your progress across devices.'}
      </p>
      <Input
        type="email"
        required
        aria-label="Email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-8"
      />
      <Input
        type="password"
        required
        minLength={8}
        aria-label="Password"
        placeholder="Password (8+ characters)"
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-8"
      />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy} className="h-8">
          {busy ? 'Working...' : mode === 'signIn' ? 'Sign in' : 'Create account'}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => {
            setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
            setError(null);
          }}
        >
          {mode === 'signIn' ? 'New here? Create account' : 'Have an account? Sign in'}
        </button>
      </div>
    </form>
  );
}

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SyncStatus>('off');
  const session = authClient.useSession();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useProgressSync(setStatus);

  // dialog behaviour: focus moves in on open, Escape closes, Tab cycles
  // inside, and focus returns to the trigger on close
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () =>
      [...panel.querySelectorAll<HTMLElement>('button, input, a[href]')].filter(
        (el) => !el.hasAttribute('disabled'),
      );
    focusables()[0]?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      // the trigger is the wrapper's first button (ui Button forwards no ref)
      wrapRef.current?.querySelector('button')?.focus();
    };
  }, [open]);

  if (!AUTH_ENABLED) return null;
  const user = session.data?.user;

  return (
    <div ref={wrapRef} className="relative">
      <Button
        type="button"
        variant={user ? 'ghost' : 'outline'}
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn('h-8 gap-1.5', user && 'text-muted-foreground')}
        title={user ? `Signed in as ${user.email}` : 'Sign in to sync progress'}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleUser aria-hidden="true" className="size-4" />
        {user ? 'Account' : 'Sign in'}
      </Button>
      {open && (
        <>
          {/* pointer-only click-away target; Escape is the keyboard path, so
              this must not occupy a tab stop between trigger and dialog */}
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={user ? 'Account' : 'Sign in'}
            className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-md border bg-card p-3 shadow-md"
          >
          {user ? (
            <div className="flex flex-col gap-2">
              <p className="truncate text-sm font-medium" title={user.email}>
                {user.email}
              </p>
              {status !== 'off' && (
                <p
                  className={cn(
                    'text-xs',
                    status === 'error' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {STATUS_LABEL[status]}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 self-start"
                onClick={() => {
                  void authClient.signOut();
                  setOpen(false);
                }}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <AuthForm onDone={() => setOpen(false)} />
          )}
          </div>
        </>
      )}
    </div>
  );
}
