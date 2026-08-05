import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectQuestHistory } from './logsWatcher.ts';

const taskNotification = (type: number, taskId: string) =>
  `2026-08-04 01:58:12.306 +02:00|1.1.0.0.46624|Info|push-notifications|Got notification | ChatMessageReceived\n` +
  `{\n  "message": {\n    "type": ${type},\n    "templateId": "${taskId} successMessageText"\n  }\n}\n`;

let logsDir: string;

const session = async (folder: string, notifications: string) => {
  const dir = path.join(logsDir, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${folder.slice(4)} push-notifications_000.log`), notifications);
  // an application log that must NOT be scanned for quest history
  await writeFile(path.join(dir, `${folder.slice(4)} application_000.log`), 'launcher noise\n');
};

beforeEach(async () => {
  logsDir = await mkdtemp(path.join(tmpdir(), 'raidplanner-logs-'));
});

afterEach(async () => {
  await rm(logsDir, { recursive: true, force: true });
});

describe('collectQuestHistory', () => {
  it('replays completions from every session of the current game version', async () => {
    await session('log_2026.08.04_1-18-36_1.1.0.0.46624', taskNotification(12, 'aaa'));
    await session(
      'log_2026.08.05_22-40-47_1.1.0.0.46624',
      taskNotification(12, 'bbb') + taskNotification(10, 'ccc'),
    );
    expect(await collectQuestHistory(logsDir)).toEqual([
      { type: 'task', taskId: 'aaa', status: 'finished' },
      { type: 'task', taskId: 'bbb', status: 'finished' },
    ]);
  });

  it('excludes sessions from older game versions (pre-wipe progress)', async () => {
    await session('log_2026.08.02_15-03-23_1.0.6.5.46221', taskNotification(12, 'pre-wipe'));
    await session('log_2026.08.04_1-18-36_1.1.0.0.46624', taskNotification(12, 'current'));
    expect(await collectQuestHistory(logsDir)).toEqual([
      { type: 'task', taskId: 'current', status: 'finished' },
    ]);
  });

  it('dedupes a quest finished in more than one session', async () => {
    await session('log_2026.08.04_1-18-36_1.1.0.0.46624', taskNotification(12, 'aaa'));
    await session('log_2026.08.05_3-01-16_1.1.0.0.46624', taskNotification(12, 'aaa'));
    expect(await collectQuestHistory(logsDir)).toHaveLength(1);
  });

  it('returns empty for a missing or empty logs dir', async () => {
    expect(await collectQuestHistory(path.join(logsDir, 'nope'))).toEqual([]);
    expect(await collectQuestHistory(logsDir)).toEqual([]);
  });
});
