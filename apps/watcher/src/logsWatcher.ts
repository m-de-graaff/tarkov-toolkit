// Tails the game's log files and emits LogEvents (map loads, quest status).
// Log locations and event semantics ported from the-hideout/TarkovMonitor (MIT).
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { LogEventParser, type LogEvent } from '@raidplanner/live';

const REGISTRY_PATHS = [
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\EscapeFromTarkov',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 3932890',
];

export function detectLogsDir(): string | null {
  const explicit = process.env.RAIDPLANNER_LOGS_DIR;
  if (explicit) return existsSync(explicit) ? explicit : null;
  if (process.platform !== 'win32') return null;
  for (const key of REGISTRY_PATHS) {
    const result = spawnSync('reg', ['query', key, '/v', 'InstallLocation'], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    const match = /InstallLocation\s+REG_SZ\s+(.+)/.exec(result.stdout ?? '');
    const installPath = match?.[1]?.trim();
    if (!installPath) continue;
    for (const candidate of [
      path.join(installPath, 'Logs'),
      path.join(installPath, 'build', 'Logs'),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

interface TailedFile {
  path: string;
  offset: number;
  parser: LogEventParser;
}

/**
 * Polls the logs directory: finds the newest session folder, tails its
 * application/notifications logs from their current end (history is not
 * replayed), and invokes onEvent for each parsed event.
 */
export function startLogsWatcher(
  logsDir: string,
  onEvent: (event: LogEvent) => void,
  pollMs = 1000,
): () => void {
  const tails = new Map<string, TailedFile>();
  let currentFolder: string | null = null;

  const poll = async () => {
    try {
      const folders = (await readdir(logsDir, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      const newest = folders.at(-1);
      if (!newest) return;
      const folderPath = path.join(logsDir, newest);
      if (newest !== currentFolder) {
        currentFolder = newest;
        tails.clear();
        console.log(`Watching game logs: ${folderPath}`);
      }

      const files = (await readdir(folderPath)).filter(
        (f) =>
          (f.includes('application.log') || f.includes('notifications.log')) &&
          !f.endsWith('.zip'),
      );
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        let tail = tails.get(filePath);
        if (!tail) {
          // start at the end: only NEW events count
          tail = { path: filePath, offset: statSync(filePath).size, parser: new LogEventParser() };
          tails.set(filePath, tail);
        }
        const size = statSync(filePath).size;
        if (size <= tail.offset) continue;
        const fd = openSync(filePath, 'r');
        try {
          const length = size - tail.offset;
          const buf = Buffer.alloc(length);
          readSync(fd, buf, 0, length, tail.offset);
          tail.offset = size;
          for (const event of tail.parser.push(buf.toString('utf8'))) onEvent(event);
        } finally {
          closeSync(fd);
        }
      }
    } catch {
      /* transient FS errors — next poll retries */
    }
  };

  void poll();
  const interval = setInterval(() => void poll(), pollMs);
  return () => clearInterval(interval);
}
