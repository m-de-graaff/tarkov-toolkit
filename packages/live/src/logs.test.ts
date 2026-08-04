import { describe, expect, it } from 'vitest';
import { LogEventParser } from './logs.ts';

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
