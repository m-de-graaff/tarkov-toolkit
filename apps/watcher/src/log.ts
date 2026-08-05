// When running as a windowless single executable there is no console, so
// output mirrors to companion.log next to the exe. Dev runs keep plain stdout.
import { appendFileSync } from 'node:fs';
import path from 'node:path';

export function isSeaBuild(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('node:sea') as { isSea(): boolean }).isSea();
  } catch {
    return false;
  }
}

export function setupLogging(): string | null {
  if (!isSeaBuild()) return null;
  const logFile = path.join(path.dirname(process.execPath), 'companion.log');
  const write = (level: string, parts: unknown[]) => {
    try {
      const line = `${new Date().toISOString()} ${level} ${parts.map(String).join(' ')}\n`;
      appendFileSync(logFile, line);
    } catch {
      /* logging must never crash the app */
    }
  };
  console.log = (...parts: unknown[]) => write('info', parts);
  console.error = (...parts: unknown[]) => write('error', parts);
  return logFile;
}
