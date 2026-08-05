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
import { AccountMenu } from './AccountMenu';
import { Sidebar } from './Sidebar';

function NavTab({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-colors hover:text-foreground',
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
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-0 border-b bg-card px-4 py-1.5 md:h-12 md:flex-nowrap md:py-0">
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
      <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
        <img src="/logo.svg" alt="" className="size-5 rounded-[5px]" />
        <span className="max-[440px]:hidden">Tarkov Toolkit</span>
      </span>
      {/* below md the tabs drop to their own full-width scrollable row; the
          edge fade tells mobile users the strip scrolls */}
      <nav
        aria-label="Tools"
        className="order-last -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-1 overflow-x-auto px-4 pt-1 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] md:order-none md:mx-0 md:ml-2 md:w-auto md:px-0 md:pt-0 md:[mask-image:none]"
      >
        <NavTab to="/">Home</NavTab>
        <NavTab to="/planner">Raid Planner</NavTab>
        <NavTab to="/progress">Progress</NavTab>
        <NavTab to="/hideout">Hideout</NavTab>
        <NavTab to="/items">Items</NavTab>
        <NavTab to="/ammo">Ammo</NavTab>
        <NavTab to="/market">Profit</NavTab>
        <NavTab to="/xp">XP</NavTab>
      </nav>
      <GameModeToggle />
      <AccountMenu />
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
            // py-1 keeps the target at/above the 24px minimum on touch screens
            'rounded-[5px] px-2.5 py-1 text-xs font-medium uppercase transition-colors',
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
