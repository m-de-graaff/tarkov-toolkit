import { describe, expect, it } from 'vitest';
import {
  finishedTaskEvents,
  isGameLogFile,
  lastMapEvent,
  LogEventParser,
  sessionFolderTime,
  sessionFolderVersion,
} from './logs.ts';

const MAP_LINE =
  '2026-08-05 21:14:03.117 +02:00|0.16.9.2.41337|Info|application|TRACE-NetworkGameCreate profileStatus: Profiled, Location: Sandbox, Sid: xxx, shortId: A1B2C3, RaidMode: Online\n';

const taskNotification = (type: number, taskId: string) =>
  `2026-08-05 21:20:11.500 +02:00|0.16.9.2.41337|Info|push-notifications|Got notification | ChatMessageReceived\n` +
  `{\n  "message": {\n    "type": ${type},\n    "templateId": "${taskId} successMessageText"\n  }\n}\n`;

describe('LogEventParser', () => {
  it('emits a map event from the NetworkGameCreate line', () => {
    const parser = new LogEventParser();
    const events = parser.push(MAP_LINE);
    expect(events).toEqual([{ type: 'map', nameId: 'Sandbox' }]);
  });

  it('emits task events from system chat notifications', () => {
    const parser = new LogEventParser();
    expect(parser.push(taskNotification(12, '657315ddab5a49b71f098853'))).toEqual([
      { type: 'task', taskId: '657315ddab5a49b71f098853', status: 'finished' },
    ]);
    expect(parser.push(taskNotification(10, 'aaa'))).toEqual([
      { type: 'task', taskId: 'aaa', status: 'started' },
    ]);
    expect(parser.push(taskNotification(11, 'bbb'))).toEqual([
      { type: 'task', taskId: 'bbb', status: 'failed' },
    ]);
  });

  it('handles a JSON block split across chunks', () => {
    const parser = new LogEventParser();
    const whole = taskNotification(12, 'ccc');
    const cut = whole.indexOf('"templateId"');
    expect(parser.push(whole.slice(0, cut))).toEqual([]);
    expect(parser.push(whole.slice(cut))).toEqual([
      { type: 'task', taskId: 'ccc', status: 'finished' },
    ]);
  });

  it('ignores player chat and unrelated lines', () => {
    const parser = new LogEventParser();
    expect(parser.push(taskNotification(1, 'ddd'))).toEqual([]);
    expect(parser.push('2026-08-05 21:00:00.000 +02:00|application|GameStarted\n')).toEqual([]);
  });

  it('does not re-emit events on later pushes', () => {
    const parser = new LogEventParser();
    parser.push(MAP_LINE);
    expect(parser.push('more unrelated text\n')).toEqual([]);
  });
});

describe('isGameLogFile', () => {
  it('matches EFT 1.x rotation-suffixed names', () => {
    expect(isGameLogFile('2026.08.05_3-01-16_1.1.0.0.46624 application_000.log')).toBe(true);
    expect(isGameLogFile('2026.08.05_3-01-16_1.1.0.0.46624 push-notifications_000.log')).toBe(
      true,
    );
  });

  it('matches legacy un-suffixed names', () => {
    expect(isGameLogFile('2023.10.12_12-00-00 application.log')).toBe(true);
    expect(isGameLogFile('2023.10.12_12-00-00 notifications.log')).toBe(true);
  });

  it('rejects the other session logs and archives', () => {
    for (const name of [
      '2026.08.05_3-01-16_1.1.0.0.46624 output_000.log',
      '2026.08.05_3-01-16_1.1.0.0.46624 backend_000.log',
      '2026.08.05_3-01-16_1.1.0.0.46624 errors_000.log',
      '2026.08.05_3-01-16_1.1.0.0.46624 spatial-audio_000.log',
      '2026.08.05_3-01-16 application_000.log.zip',
    ]) {
      expect(isGameLogFile(name)).toBe(false);
    }
  });
});

describe('sessionFolderTime', () => {
  it('orders unpadded morning hours before the evening', () => {
    // lexicographically "3-01-16" > "19-55-33"; by time it must be earlier
    const morning = sessionFolderTime('log_2026.08.05_3-01-16_1.1.0.0.46624');
    const evening = sessionFolderTime('log_2026.08.05_19-55-33_1.1.0.0.46624');
    expect(morning).toBeLessThan(evening);
  });

  it('sorts unparseable names first', () => {
    expect(sessionFolderTime('weird')).toBe(0);
  });
});

describe('sessionFolderVersion', () => {
  it('extracts the game version suffix', () => {
    expect(sessionFolderVersion('log_2026.08.04_0-12-19_1.1.0.0.46624')).toBe('1.1.0.0.46624');
    expect(sessionFolderVersion('log_2026.08.02_15-03-23_1.0.6.5.46221')).toBe('1.0.6.5.46221');
  });

  it('returns null for legacy names without a version', () => {
    expect(sessionFolderVersion('log_2023.10.12_12-00-00')).toBeNull();
    expect(sessionFolderVersion('weird')).toBeNull();
  });
});

describe('finishedTaskEvents', () => {
  it('returns only quest completions, in file order', () => {
    const content =
      MAP_LINE +
      taskNotification(12, 'aaa') +
      taskNotification(10, 'bbb') +
      'noise\n' +
      taskNotification(12, 'ccc') +
      taskNotification(11, 'ddd');
    expect(finishedTaskEvents(content)).toEqual([
      { type: 'task', taskId: 'aaa', status: 'finished' },
      { type: 'task', taskId: 'ccc', status: 'finished' },
    ]);
  });

  it('returns nothing for a session without completions', () => {
    expect(finishedTaskEvents(MAP_LINE + 'launcher noise\n')).toEqual([]);
  });
});

describe('lastMapEvent', () => {
  it('returns the most recent map in existing content', () => {
    const content =
      MAP_LINE + 'noise\n' + MAP_LINE.replace('Location: Sandbox', 'Location: Labyrinth');
    expect(lastMapEvent(content)).toEqual({ type: 'map', nameId: 'Labyrinth' });
  });

  it('returns null when the session never loaded a map', () => {
    expect(lastMapEvent('just launcher noise\n')).toBeNull();
  });
});
