// Standalone screenshot watcher - live position in ANY browser, no folder
// picker needed. Watches the EFT Screenshots folder and broadcasts parsed
// positions to the web app over a local-only WebSocket.
//
//   pnpm watcher            (from the repo root)
//
// The web app auto-detects it at ws://127.0.0.1:17520.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseScreenshotName, pickNewestFix, type LiveFix, type LogEvent } from '@raidplanner/live';
import { isSeaBuild, setupLogging } from './log.ts';
import { detectLogsDir, startLogsWatcher } from './logsWatcher.ts';
import { startTray, type Tray } from './tray.ts';
import { checkForUpdate, cleanupOldBinary, downloadAndInstall } from './updater.ts';

declare const __COMPANION_VERSION__: string | undefined;
const VERSION =
  typeof __COMPANION_VERSION__ === 'string' ? __COMPANION_VERSION__ : 'dev';

const PORT = Number(process.env.RAIDPLANNER_WATCHER_PORT ?? 17520);
const CONFIG_FILE = path.join(homedir(), '.raidplanner-watcher.json');

function windowsDocumentsFolder(): string | null {
  // GetFolderPath respects Documents redirection (OneDrive, custom locations).
  if (process.platform !== 'win32') return null;
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', "[Environment]::GetFolderPath('MyDocuments')"],
    { encoding: 'utf8', timeout: 10_000 },
  );
  const out = result.stdout?.trim();
  return out ? out : null;
}

function savedDir(): string | null {
  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    return typeof config.screenshotsDir === 'string' ? config.screenshotsDir : null;
  } catch {
    return null;
  }
}

async function detectScreenshotsDir(): Promise<string> {
  const explicit = process.argv[2] ?? process.env.RAIDPLANNER_SCREENSHOTS_DIR;
  if (explicit) return explicit;

  const suffix = path.join('Escape from Tarkov', 'Screenshots');
  const candidates = [
    savedDir(),
    ...[windowsDocumentsFolder(), path.join(homedir(), 'Documents'), path.join(homedir(), 'OneDrive', 'Documents')]
      .filter((docs): docs is string => docs !== null)
      .map((docs) => path.join(docs, suffix)),
  ].filter((dir): dir is string => dir !== null);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`Found your screenshots at: ${candidate}`);
      return candidate;
    }
  }

  console.log("Couldn't find the Escape from Tarkov screenshots folder automatically.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (
    await rl.question('Paste the full path to your Screenshots folder and press Enter: ')
  ).trim().replace(/^"|"$/g, '');
  rl.close();
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify({ screenshotsDir: answer }, null, 2));
    console.log(`Saved - next time this is found automatically (${CONFIG_FILE}).`);
  } catch {
    /* not persisted; still usable this run */
  }
  return answer;
}

let screenshotsDir = '';

const seen = new Set<string>();
let latestFix: LiveFix | null = null;
const clients = new Set<WebSocket>();

function send(payload: object) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}

function broadcast(fix: LiveFix) {
  latestFix = fix;
  send({ type: 'fix', fix });
  const { x, y, z } = fix.position;
  console.log(`Position sent: ${x}, ${y}, ${z} (${fix.raw})`);
}

function broadcastLogEvent(event: LogEvent) {
  send(event);
  if (event.type === 'map') console.log(`Raid detected on map: ${event.nameId}`);
  if (event.type === 'task') console.log(`Quest ${event.status}: ${event.taskId}`);
}

async function scan(initial = false) {
  let names: string[];
  try {
    names = (await readdir(screenshotsDir)).filter((n) => n.endsWith('.png'));
  } catch {
    return; // folder briefly unavailable (e.g. being recreated) - next scan retries
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

// no top-level await: the single-executable build bundles to CommonJS
async function main() {
  setupLogging();
  cleanupOldBinary();
  screenshotsDir = await detectScreenshotsDir();

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
  console.log(`Waiting for the web app on ws://127.0.0.1:${PORT} - keep this window open.`);

  await scan(true);

  // fs.watch gives instant events; the 2s poll catches anything it misses
  // (network drives, editor-style atomic writes).
  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(screenshotsDir, () => void scan());
  } catch {
    console.log('Folder not found yet - will keep checking every 2s.');
  }
  const interval = setInterval(() => void scan(), 2000);

  // Game-log automation: auto map detection + quest completion events.
  const logsDir = detectLogsDir();
  let stopLogs: (() => void) | null = null;
  if (logsDir) {
    stopLogs = startLogsWatcher(logsDir, broadcastLogEvent);
  } else {
    console.log(
      'Game logs folder not found - auto map/quest detection off. ' +
        'Set RAIDPLANNER_LOGS_DIR to enable it.',
    );
  }

  const shutdown = () => {
    tray?.dispose();
    watcher?.close();
    stopLogs?.();
    clearInterval(interval);
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);

  // Tray icon + updater for the packaged app (dev runs stay console-only,
  // opt in with RAIDPLANNER_TRAY=1).
  let tray: Tray | null = null;
  if (process.platform === 'win32' && (isSeaBuild() || process.env.RAIDPLANNER_TRAY === '1')) {
    tray = startTray(VERSION, (action) => {
      if (action === 'quit') shutdown();
      if (action === 'update') {
        void checkForUpdate(VERSION)
          .then(async (update) => {
            if (!update) {
              tray?.balloon(`You are on the latest version (${VERSION}).`);
              return;
            }
            tray?.balloon(`Updating to ${update.tag}...`);
            await downloadAndInstall(update);
          })
          .catch((err) => {
            console.error('update failed:', err);
            tray?.balloon('Update check failed. Are you online?');
          });
      }
    });

    // startup auto-update: download, swap, relaunch. Opt out with
    // RAIDPLANNER_NO_AUTO_UPDATE=1 (the tray menu still updates on demand).
    if (process.env.RAIDPLANNER_NO_AUTO_UPDATE !== '1') {
      void checkForUpdate(VERSION)
        .then(async (update) => {
          if (!update) return;
          console.log(`Update available: ${update.tag}, installing`);
          tray?.balloon(`Updating to ${update.tag}...`);
          await downloadAndInstall(update);
        })
        .catch((err) => console.error('auto-update failed:', err));
    }
  }
}

void main().catch((err) => {
  console.error(err);
  // double-clicked exe: keep the window open long enough to read the error
  setTimeout(() => process.exit(1), 15_000);
});
