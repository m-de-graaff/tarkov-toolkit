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

  // Picking a map is the natural end of the "choose" flow - close the sheet.
  useEffect(() => {
    setSheetOpen(false);
  }, [selectedMapId]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-4">
      {!isDesktop && location.pathname === '/planner' && (
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
      <span className="text-sm font-semibold">Tarkov Toolkit</span>
      <nav aria-label="Tools" className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto">
        <NavTab to="/">Home</NavTab>
        <NavTab to="/planner">Raid Planner</NavTab>
        <NavTab to="/progress">Progress</NavTab>
        <NavTab to="/hideout">Hideout</NavTab>
        <NavTab to="/items">Items</NavTab>
        <NavTab to="/ammo">Ammo</NavTab>
        <NavTab to="/market">Profit</NavTab>
      </nav>
      <GameModeToggle />
    </header>
  );
}

function GameModeToggle() {
  const gameMode = usePlanner((s) => s.gameMode);
  const setGameMode = usePlanner((s) => s.setGameMode);
  return (
    <div
      role="group"
      aria-label="Game mode"
      className="ml-auto flex items-center rounded-md border p-0.5"
      title="PvP and PvE have separate progress - switching swaps your whole profile"
    >
      {(['pvp', 'pve'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={gameMode === mode}
          onClick={() => setGameMode(mode)}
          className={cn(
            'rounded-[5px] px-2.5 py-0.5 text-xs font-medium uppercase transition-colors',
            gameMode === mode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
