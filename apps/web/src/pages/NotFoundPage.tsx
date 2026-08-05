// Catch-all route: typo'd or outdated URLs land here inside the shell (nav
// stays usable) instead of on a blank page.
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'react-router-dom';

export function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-muted-foreground text-sm">
          <code className="rounded bg-muted px-1.5 py-0.5">{pathname}</code> doesn&apos;t exist.
          It may have moved, or the link is out of date.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/planner">Open the planner</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
