import { useCallback, useRef, useState } from 'react';

const MIN_WIDTH = 60;

function storageKey(tableKey: string) {
  // v2: widths saved while dragging was visually broken were untrustworthy
  return `raidplanner-cols-v2:${tableKey}`;
}

function load(tableKey: string, defaults: number[]): number[] {
  try {
    const raw = localStorage.getItem(storageKey(tableKey));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as number[];
    return parsed.length === defaults.length ? parsed : defaults;
  } catch {
    return defaults;
  }
}

export interface ColumnWidths {
  widths: number[];
  /** attach to the resize grip's onPointerDown */
  startDrag(index: number, event: React.PointerEvent): void;
  /** Excel-style double-click: fit the column to its widest cell */
  autoFit(index: number, table: HTMLTableElement | null): void;
  reset(): void;
}

/**
 * Stateful per-column pixel widths for a fixed-layout table: drag to resize,
 * double-click to auto-fit, persisted per table key.
 */
export function useColumnWidths(tableKey: string, defaults: number[]): ColumnWidths {
  const [widths, setWidths] = useState(() => load(tableKey, defaults));
  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const persist = useCallback(
    (next: number[]) => {
      try {
        localStorage.setItem(storageKey(tableKey), JSON.stringify(next));
      } catch {
        /* persistence is best-effort */
      }
    },
    [tableKey],
  );

  const startDrag = useCallback(
    (index: number, event: React.PointerEvent) => {
      event.preventDefault();
      dragRef.current = { index, startX: event.clientX, startWidth: widths[index] };
      const onMove = (move: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const width = Math.max(MIN_WIDTH, drag.startWidth + (move.clientX - drag.startX));
        setWidths((current) => {
          const next = [...current];
          next[drag.index] = width;
          return next;
        });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setWidths((current) => {
          persist(current);
          return current;
        });
        dragRef.current = null;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [widths, persist],
  );

  const autoFit = useCallback(
    (index: number, table: HTMLTableElement | null) => {
      if (!table) return;
      let widest = MIN_WIDTH;
      for (const row of table.rows) {
        const cell = row.cells[index];
        if (!cell) continue;
        // measure the cell's content at its natural width
        widest = Math.max(widest, cell.scrollWidth + 8);
      }
      setWidths((current) => {
        const next = [...current];
        next[index] = Math.min(widest, 640);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setWidths(defaults);
    persist(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist]);

  return { widths, startDrag, autoFit, reset };
}
