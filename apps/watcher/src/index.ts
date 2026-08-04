// Standalone screenshot watcher — live position in ANY browser, no folder
// picker needed. Watches the EFT Screenshots folder and broadcasts parsed
// positions to the web app over a local-only WebSocket.
//
//   pnpm watcher            (from the repo root)
//
// The web app auto-detects it at ws://127.0.0.1:17520.
import { watch, type FSWatcher } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseScreenshotName, pickNewestFix, type LiveFix } from '@raidplanner/live';

const PORT = Number(process.env.RAIDPLANNER_WATCHER_PORT ?? 17520);
const screenshotsDir =
  process.argv[2] ??
  process.env.RAIDPLANNER_SCREENSHOTS_DIR ??
  path.join(homedir(), 'Documents', 'Escape from Tarkov', 'Screenshots');

const seen = new Set<string>();
let latestFix: LiveFix | null = null;
const clients = new Set<WebSocket>();

function broadcast(fix: LiveFix) {
  latestFix = fix;
  const message = JSON.stringify({ type: 'fix', fix });
  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
  const { x, y, z } = fix.position;
  console.log(`Position sent: ${x}, ${y}, ${z} (${fix.raw})`);
}

async function scan(initial = false) {
  let names: string[];
  try {
    names = (await readdir(screenshotsDir)).filter((n) => n.endsWith('.png'));
  } catch {
    return; // folder briefly unavailable (e.g. being recreated) — next scan retries
  }
  const newest = pickNewestFix(names, seen);
  if (newest) {
    const fix = parseScreenshotName(newest);
    if (fix) {
      if (initial) console.log('Found your latest screenshot:');
      broadcast(fix);
    }
  }
}

const server = new WebSocketServer({ host: '127.0.0.1', port: PORT });
server.on('connection', (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: 'hello', app: 'raidplanner-watcher' }));
  if (latestFix) socket.send(JSON.stringify({ type: 'fix', fix: latestFix }));
  socket.on('close', () => clients.delete(socket));
  console.log('Web app connected.');
});

console.log(`Tarkov Toolkit companion watcher`);
console.log(`Watching: ${screenshotsDir}`);
console.log(`Waiting for the web app on ws://127.0.0.1:${PORT} — keep this window open.`);

await scan(true);

// fs.watch gives instant events; the 2s poll catches anything it misses
// (network drives, editor-style atomic writes).
let watcher: FSWatcher | null = null;
try {
  watcher = watch(screenshotsDir, () => void scan());
} catch {
  console.log('Folder not found yet — will keep checking every 2s.');
}
const interval = setInterval(() => void scan(), 2000);

process.on('SIGINT', () => {
  watcher?.close();
  clearInterval(interval);
  server.close();
  process.exit(0);
});
