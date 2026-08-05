// Game-log event extraction, semantics ported from the-hideout/TarkovMonitor
// (MIT), TarkovMonitor/GameWatcher.cs:
// - map: "TRACE-NetworkGameCreate profileStatus" lines carry "Location: <nameId>"
// - quests: "Got notification | ChatMessageReceived" followed by a JSON block
//   whose message.type is 10 (started) / 11 (failed) / 12 (finished) and whose
//   templateId begins with the task id.

export type LogEvent =
  | { type: 'map'; nameId: string }
  | { type: 'task'; taskId: string; status: 'started' | 'failed' | 'finished' };

const MAP_RE = /TRACE-NetworkGameCreate profileStatus.*?Location: (?<map>[^,\r\n]+)/g;
const NOTIFICATION_MARK = 'Got notification | ChatMessageReceived';
// JSON block: "{" at line start through the matching "}" at line start.
const NOTIFICATION_RE = new RegExp(
  `${NOTIFICATION_MARK}\\s*\\r?\\n(?<json>\\{[\\s\\S]+?^\\})`,
  'gm',
);

const TASK_STATUS: Record<number, 'started' | 'failed' | 'finished'> = {
  10: 'started',
  11: 'failed',
  12: 'finished',
};

/**
 * Log files that carry map-load lines. EFT names them with a rotation
 * suffix ("<stamp> application_000.log"); older builds used "application.log".
 */
export function isApplicationLog(fileName: string): boolean {
  return /application(_\d+)?\.log$/.test(fileName) && !fileName.endsWith('.zip');
}

/**
 * Log files that carry quest notifications: "notifications.log" historically,
 * "push-notifications_000.log" on current builds. output_*.log mirrors both
 * streams and is deliberately excluded to avoid duplicate events.
 */
export function isNotificationsLog(fileName: string): boolean {
  return /notifications(_\d+)?\.log$/.test(fileName) && !fileName.endsWith('.zip');
}

/** True when this file should be tailed for LogEvents. */
export function isGameLogFile(fileName: string): boolean {
  return isApplicationLog(fileName) || isNotificationsLog(fileName);
}

/**
 * EFT session folders ("log_2026.08.05_3-01-16_1.1.0.0.46624") do not
 * zero-pad hours, so a lexicographic sort ranks 3 AM after 19:55. Compare by
 * the parsed timestamp instead; unparseable names sort first.
 */
export function sessionFolderTime(folderName: string): number {
  const m = /^log_(\d{4})\.(\d{2})\.(\d{2})_(\d{1,2})-(\d{2})-(\d{2})/.exec(folderName);
  if (!m) return 0;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

/**
 * The game version a session folder was recorded on
 * ("log_2026.08.04_0-12-19_1.1.0.0.46624" -> "1.1.0.0.46624"). Wipes ship
 * with version bumps, so quest completions are only trustworthy within the
 * current version. Null for legacy names without a version suffix.
 */
export function sessionFolderVersion(folderName: string): string | null {
  const m = /^log_\d{4}\.\d{2}\.\d{2}_\d{1,2}-\d{2}-\d{2}_(.+)$/.exec(folderName);
  return m?.[1] ?? null;
}

/** Every quest completion in existing content, for replaying history. */
export function finishedTaskEvents(content: string): LogEvent[] {
  return new LogEventParser()
    .push(content)
    .filter((e) => e.type === 'task' && e.status === 'finished');
}

/** The last map the session loaded, for catching up when tailing starts mid-raid. */
export function lastMapEvent(content: string): LogEvent | null {
  let last: LogEvent | null = null;
  for (const event of new LogEventParser().push(content)) {
    if (event.type === 'map') last = event;
  }
  return last;
}

/**
 * Stateful chunk parser for tailed log files. Feed appended text as it
 * arrives; complete events are returned once and incomplete tails (a JSON
 * block cut mid-chunk) are buffered for the next push.
 */
export class LogEventParser {
  private buffer = '';

  push(chunk: string): LogEvent[] {
    this.buffer += chunk;
    const events: LogEvent[] = [];
    let consumedTo = 0;

    MAP_RE.lastIndex = 0;
    for (const match of this.buffer.matchAll(MAP_RE)) {
      const nameId = match.groups?.map?.trim();
      if (nameId) events.push({ type: 'map', nameId });
      consumedTo = Math.max(consumedTo, match.index + match[0].length);
    }

    NOTIFICATION_RE.lastIndex = 0;
    for (const match of this.buffer.matchAll(NOTIFICATION_RE)) {
      try {
        const parsed = JSON.parse(match.groups?.json ?? '');
        const status = TASK_STATUS[parsed?.message?.type];
        const templateId: unknown = parsed?.message?.templateId;
        if (status && typeof templateId === 'string' && templateId.length > 0) {
          events.push({ type: 'task', taskId: templateId.split(' ')[0], status });
        }
      } catch {
        /* malformed JSON block - skip */
      }
      consumedTo = Math.max(consumedTo, match.index + match[0].length);
    }

    // Drop consumed text; keep a bounded unconsumed tail (a notification mark
    // whose JSON hasn't fully arrived yet must survive to the next push).
    this.buffer = this.buffer.slice(consumedTo);
    const MAX_TAIL = 256 * 1024;
    if (this.buffer.length > MAX_TAIL) this.buffer = this.buffer.slice(-MAX_TAIL);

    return events;
  }
}
