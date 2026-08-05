import { cn } from '@/lib/utils';
import type { ColumnWidths } from '../lib/useColumnWidths';

/**
 * Header cell with an Excel-style resize grip on its right edge: drag to
 * resize, double-click to fit the column to its content.
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
        role="presentation"
        title="Drag to resize · double-click to fit"
        className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-primary/40"
        onPointerDown={(event) => columns.startDrag(index, event)}
        onDoubleClick={() => columns.autoFit(index, tableRef.current)}
      />
    </th>
  );
}
