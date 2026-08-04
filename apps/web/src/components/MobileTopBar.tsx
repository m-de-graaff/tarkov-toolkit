import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePlanner } from '../store';
import { Sidebar } from './Sidebar';

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const selectedMapId = usePlanner((s) => s.selectedMapId);

  // Picking a map is the natural end of the "choose" flow — close the sheet.
  useEffect(() => {
    setOpen(false);
  }, [selectedMapId]);

  return (
    <header className="flex items-center gap-3 border-b bg-card px-3 py-2">
      <Sheet open={open} onOpenChange={setOpen}>
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
      <span className="truncate text-sm font-bold uppercase tracking-widest text-primary">
        Raid Planner
      </span>
    </header>
  );
}
