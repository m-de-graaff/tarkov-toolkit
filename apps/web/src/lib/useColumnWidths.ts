import { useCallback, useRef, useState } from 'react';

const MIN_WIDTH = 60;
const MAX_WIDTH = 640;

function storageKey(tableKey: string) {
  // v2: widths saved while dragging was visually broken were untrustworthy
  return `raidplanner-cols-v2:${tableKey}`;
}

interface Saved {
  w: number[];
  /** true once the user dragged or explicitly fitted - stops automatic fits */
  manual: boolean;
}

function load(tableKey: string, defaults: number[]): Saved {
  try {
    const raw = localStorage.getItem(storageKey(tableKey));
    if (!raw) return { w: defaults, manual: false };
    const parsed = JSON.parse(raw) as number[] | Saved;
    // older versions stored a bare array, and only wrote it on user action
    if (Array.isArray(parsed)) {
      return parsed.length === defaults.length ? { w: parsed, manual: true } : { w: defaults, manual: false };
    }
    return parsed.w?.length === defaults.length ? parsed : { w: defaults, manual: false };
  } catch {
    return { w: defaults, manual: false };
  }
}

const clamp = (w: number) => Math.min(Math.max(Math.ceil(w), MIN_WIDTH), MAX_WIDTH);

/**
 * The natural per-column widths of a fixed-layout table: briefly switch it to
 * auto layout with unconstrained columns, let the browser solve the layout,
 * and read the resulting column boxes. Unlike scrollWidth probing this sees
 * the full content of truncated cells.
 */
function measureNatural(table: HTMLTableElement): number[] | null {
  const headerCells = table.tHead?.rows[0]?.cells;
  if (!headerCells || headerCells.length === 0) return null;
  const cols = Array.from(table.querySelectorAll('col'));
  const prev = {
    layout: table.style.tableLayout,
    width: table.style.width,
    colWidths: cols.map((c) => c.style.width),
  };
  table.style.tableLayout = 'auto';
  table.style.width = 'auto';
  for (const c of cols) c.style.width = '';
  const widths = Array.from(headerCells, (cell) => clamp(cell.getBoundingClientRect().width + 2));
  table.style.tableLayout = prev.layout;
  table.style.width = prev.width;
  cols.forEach((c, i) => {
    c.style.width = prev.colWidths[i];
  });
  return widths;
}

export interface ColumnWidths {
  widths: number[];
  /** whether the user has taken manual control (drag or explicit fit) */
  manual: boolean;
  /** attach to the resize grip's onPointerDown */
  startDrag(index: number, event: React.PointerEvent): void;
  /** Excel-style double-click: fit the column to its widest cell */
  autoFit(index: number, table: HTMLTableElement | null): void;
  /** keyboard resize: adjust a column by a pixel delta (persisted) */
  nudge(index: number, deltaPx: number): void;
  /** fit every column to its content; used automatically until the user resizes */
  fitAll(table: HTMLTableElement | null): void;
  reset(): void;
}

/**
 * Stateful per-column pixel widths for a fixed-layout table: automatically
 * fitted to content until the user drags (then their widths persist per table
 * key); double-click a grip to fit one column, reset to return to automatic.
 */
export function useColumnWidths(tableKey: string, defaults: number[]): ColumnWidths {
  const [saved, setSaved] = useState(() => load(tableKey, defaults));
  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  // callers pass array literals; a ref keeps reset() stable without a
  // new-identity dep churning the callback every render
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const persist = useCallback(
    (next: Saved) => {
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
      dragRef.current = { index, startX: event.clientX, startWidth: saved.w[index] };
      const onMove = (move: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const width = Math.max(MIN_WIDTH, drag.startWidth + (move.clientX - drag.startX));
        setSaved((current) => {
          const w = [...current.w];
          w[drag.index] = width;
          return { w, manual: true };
        });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setSaved((current) => {
          persist(current);
          return current;
        });
        dragRef.current = null;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [saved.w, persist],
  );

  const autoFit = useCallback(
    (index: number, table: HTMLTableElement | null) => {
      if (!table) return;
      const natural = measureNatural(table);
      if (!natural) return;
      setSaved((current) => {
        const w = [...current.w];
        w[index] = natural[index] ?? w[index];
        const next = { w, manual: true };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const nudge = useCallback(
    (index: number, deltaPx: number) => {
      setSaved((current) => {
        const w = [...current.w];
        w[index] = Math.max(MIN_WIDTH, (w[index] ?? MIN_WIDTH) + deltaPx);
        const next = { w, manual: true };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const fitAll = useCallback((table: HTMLTableElement | null) => {
    if (!table) return;
    const natural = measureNatural(table);
    if (!natural) return;
    // automatic fits are not persisted - content is remeasured per visit
    setSaved((current) => {
      if (
        current.w.length === natural.length &&
        current.w.every((w, i) => w === natural[i])
      ) {
        return current;
      }
      return { w: natural, manual: current.manual };
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(tableKey));
    } catch {
      /* best-effort */
    }
    setSaved({ w: defaultsRef.current, manual: false });
  }, [tableKey]);

  return { widths: saved.w, manual: saved.manual, startDrag, autoFit, nudge, fitAll, reset };
}
