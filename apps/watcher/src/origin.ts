// The WebSocket server binds to 127.0.0.1, but "local-only" does not stop a
// drive-by website: any page open in the user's browser may attempt a
// WebSocket to localhost, and browsers attach an Origin header. Position,
// raid, and quest events are personal data - only the toolkit may read them.
// Non-browser clients (no Origin) stay allowed: a local process could read
// the screenshots folder directly anyway, so blocking it buys nothing.

const DEFAULT_ALLOWED = [
  'https://tarkovtoolkit.vercel.app',
  'https://tarkov-toolkit.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function isAllowedOrigin(origin: string | undefined, extra?: string): boolean {
  if (origin === undefined || origin === '') return true;
  const allowed = [
    ...DEFAULT_ALLOWED,
    ...(extra?.split(',').map((s) => s.trim()).filter(Boolean) ?? []),
  ];
  return allowed.includes(origin);
}
