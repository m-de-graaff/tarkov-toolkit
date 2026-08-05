import { cn } from '@/lib/utils';
import type { ColumnWidths } from '../lib/useColumnWidths';

const KEY_STEP = 16;

/**
 * Header cell with an Excel-style resize grip on its right edge: drag to
 * resize, double-click to fit the column to its content, and - because a drag
 * needs a single-pointer/keyboard alternative (WCAG 2.5.7) - focus the grip
 * and use the arrow keys, or Enter to fit.
 */
export function ResizableTH({
  index,
  columns,
  tableRef,
  right,
  children,
}: {
  index: number;
  columns: ColumnWidths;
  tableRef: React.RefObject<HTMLTableElement | null>;
  right?: boolean;
  children: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        'relative select-none px-3 py-2 text-xs font-medium text-muted-foreground',
        right ? 'text-right' : 'text-left',
      )}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize column: ${typeof children === 'string' ? children : `column ${index + 1}`}`}
        aria-valuenow={Math.round(columns.widths[index] ?? 0)}
        tabIndex={0}
        title="Drag or use arrow keys to resize · double-click or Enter to fit"
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none"
        onPointerDown={(event) => columns.startDrag(index, event)}
        onDoubleClick={() => columns.autoFit(index, tableRef.current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            columns.nudge(index, event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            columns.autoFit(index, tableRef.current);
          }
        }}
      />
    </th>
  );
}
