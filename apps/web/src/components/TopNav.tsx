import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useMediaQuery } from '../lib/useMediaQuery';
import { usePlanner } from '../store';
import { Sidebar } from './Sidebar';

function NavTab({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'rounded-md px-2.5 py-1 text-sm transition-colors hover:text-foreground',
          isActive ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function TopNav() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const selectedMapId = usePlanner((s) => s.selectedMapId);

  // Picking a map is the natural end of the "choose" flow — close the sheet.
  useEffect(() => {
    setSheetOpen(false);
  }, [selectedMapId]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
      {!isDesktop && location.pathname === '/' && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <Menu aria-hidden="true" className="size-4" />
              Maps & Quests
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-90 overflow-y-auto p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Maps and quests</SheetTitle>
            </SheetHeader>
            <Sidebar />
          </SheetContent>
        </Sheet>
      )}
      <span className="text-sm font-semibold">Raid Planner</span>
      <nav aria-label="Pages" className="ml-2 flex items-center gap-1">
        <NavTab to="/">Planner</NavTab>
        <NavTab to="/progress">Progress</NavTab>
      </nav>
    </header>
  );
}
