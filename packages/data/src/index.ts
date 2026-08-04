import type { Snapshot } from './types';
import snapshotJson from '../generated/snapshot.json';

export * from './types';

export const snapshot = snapshotJson as unknown as Snapshot;
