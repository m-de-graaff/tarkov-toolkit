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
        /* malformed JSON block — skip */
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
