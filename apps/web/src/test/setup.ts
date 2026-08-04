// jsdom lacks ResizeObserver; react-resizable-panels requires it at mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

// jsdom's WebSocket opens real TCP connections; tests must stay off the
// network. Every constructed stub is recorded so tests can drive it manually.
export class WebSocketStub {
  static instances: WebSocketStub[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    WebSocketStub.instances.push(this);
  }
  send() {}
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

(globalThis as unknown as { WebSocket: typeof WebSocketStub }).WebSocket = WebSocketStub;
