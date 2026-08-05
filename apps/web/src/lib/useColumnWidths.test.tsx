// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResizableTH } from '../components/ResizableTH';
import { useColumnWidths } from './useColumnWidths';

function Harness() {
  const cols = useColumnWidths('test-table', [100, 200]);
  return (
    <table data-widths={cols.widths.join(',')}>
      <thead>
        <tr>
          <ResizableTH index={0} columns={cols} tableRef={{ current: null }}>
            A
          </ResizableTH>
          <ResizableTH index={1} columns={cols} tableRef={{ current: null }}>
            B
          </ResizableTH>
        </tr>
      </thead>
    </table>
  );
}

describe('column drag resize', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('dragging the grip changes the column width', () => {
    act(() => root.render(<Harness />));
    const grip = container.querySelectorAll('th span[role="separator"]')[0]!;

    act(() => {
      grip.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, clientX: 100, pointerId: 1 }),
      );
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, pointerId: 1 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, pointerId: 1 }));
    });

    const widths = container.querySelector('table')!.dataset.widths!.split(',').map(Number);
    expect(widths[0]).toBe(160); // 100 + 60px drag
    expect(widths[1]).toBe(200);
  });

  it('the grip is keyboard-operable: arrow keys resize', () => {
    act(() => root.render(<Harness />));
    const grip = container.querySelectorAll<HTMLElement>('th span[role="separator"]')[0]!;
    expect(grip.tabIndex).toBe(0);

    const widths = () =>
      container.querySelector('table')!.dataset.widths!.split(',').map(Number);
    act(() => {
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(widths()[0]).toBe(116); // 100 + 16px step
    act(() => {
      grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(widths()[0]).toBe(100);
  });
});
