// Account button for the hosted deployment: sign in to sync progress across
// devices. Renders nothing unless the build sets VITE_AUTH_ENABLED, so local
// dev and self-hosted builds stay account-free.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CircleUser } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useState } from 'react';
import { AUTH_ENABLED, authClient } from '../lib/authClient';
import type { SyncStatus } from '../lib/useProgressSync';
import { useProgressSync } from '../lib/useProgressSync';

const STATUS_LABEL: Record<SyncStatus, string> = {
  off: '',
  syncing: 'Syncing...',
  synced: 'Progress synced',
  error: 'Sync failed - retrying on next change',
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
        placeholder="Password (8+ characters)"
        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-8"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
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
  useProgressSync(setStatus);

  if (!AUTH_ENABLED) return null;
  const user = session.data?.user;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant={user ? 'ghost' : 'outline'}
          size="sm"
          className={cn('h-8 gap-1.5', user && 'text-muted-foreground')}
          title={user ? `Signed in as ${user.email}` : 'Sign in to sync progress'}
        >
          <CircleUser aria-hidden="true" className="size-4" />
          {user ? 'Account' : 'Sign in'}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-md border bg-card p-3 shadow-md outline-none"
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
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
