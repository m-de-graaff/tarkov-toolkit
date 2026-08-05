import type { GameMode, GamePosition } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import type { LiveFix, LogEvent } from '@raidplanner/live';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackerState } from './lib/availability';

export type SpawnChoice =
  | { kind: 'zone'; zoneName: string; position: GamePosition }
  | { kind: 'custom'; position: GamePosition };

const freshTracker = (): TrackerState => ({
  level: 15,
  faction: 'Any',
  completedTaskIds: [],
  hideoutLevels: {},
  itemsHave: {},
});

interface PlannerState {
  selectedMapId: string | null;
  selectedTaskIds: string[];
  spawn: SpawnChoice | null;
  /** chosen extract for routing; null = auto (farthest always-open exfil) */
  targetExtractId: string | null;
  setTargetExtract(id: string | null): void;
  /** PvP and PvE are separate in-game profiles; progress is tracked per mode */
  gameMode: GameMode;
  /** the active mode's progress */
  tracker: TrackerState;
  /** the inactive mode's stashed progress */
  profiles: Partial<Record<GameMode, TrackerState>>;
  search: string;
  liveFix: LiveFix | null;
  /** last companion automation event, for the toolbar status line */
  lastAutoEvent: string | null;
  setLiveFix(f: LiveFix | null): void;
  applyLogEvent(event: LogEvent): void;
  setGameMode(mode: GameMode): void;
  selectMap(id: string): void;
  toggleTask(id: string): void;
  clearTasks(): void;
  setSpawn(s: SpawnChoice | null): void;
  setLevel(n: number): void;
  setFaction(f: TrackerState['faction']): void;
  toggleCompleted(taskId: string): void;
  setHideoutLevel(stationId: string, level: number): void;
  setItemHave(itemId: string, count: number): void;
  /** decrement haves by the given requirements (building a hideout level) */
  consumeItems(requirements: { itemId: string; count: number }[]): void;
  resetProgress(): void;
  setSearch(s: string): void;
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      selectedMapId: null,
      selectedTaskIds: [],
      spawn: null,
      targetExtractId: null,
      setTargetExtract: (targetExtractId) => set({ targetExtractId }),
      gameMode: 'pvp',
      tracker: freshTracker(),
      profiles: {},
      search: '',
      liveFix: null,
      lastAutoEvent: null,
      setLiveFix: (liveFix) => set({ liveFix }),
      applyLogEvent: (event) =>
        set((s) => {
          if (event.type === 'map') {
            const map = snapshot.maps.find(
              (m) => m.nameId === event.nameId || m.altNameIds?.includes(event.nameId),
            );
            if (!map) return s;
            const changed = map.id !== s.selectedMapId;
            return {
              lastAutoEvent: `Raid detected: ${map.name}`,
              ...(changed
                ? { selectedMapId: map.id, selectedTaskIds: [], spawn: null }
                : {}),
            };
          }
          if (event.status !== 'finished') return s;
          const task = snapshot.tasks.find((t) => t.id === event.taskId);
          if (!task || s.tracker.completedTaskIds.includes(task.id)) return s;
          return {
            lastAutoEvent: `Quest completed: ${task.name}`,
            tracker: {
              ...s.tracker,
              completedTaskIds: [...s.tracker.completedTaskIds, task.id],
            },
          };
        }),
      setGameMode: (mode) =>
        set((s) => {
          if (mode === s.gameMode) return s;
          return {
            gameMode: mode,
            tracker: s.profiles[mode] ?? freshTracker(),
            profiles: { ...s.profiles, [s.gameMode]: s.tracker },
            // quest selection follows progress; a different profile means a
            // different set of open quests
            selectedTaskIds: [],
          };
        }),
      selectMap: (id) =>
        set({ selectedMapId: id, selectedTaskIds: [], spawn: null, targetExtractId: null }),
      toggleTask: (id) =>
        set((s) => ({
          selectedTaskIds: s.selectedTaskIds.includes(id)
            ? s.selectedTaskIds.filter((t) => t !== id)
            : [...s.selectedTaskIds, id],
        })),
      clearTasks: () => set({ selectedTaskIds: [] }),
      setSpawn: (spawn) => set({ spawn }),
      setLevel: (level) => set((s) => ({ tracker: { ...s.tracker, level } })),
      setFaction: (faction) => set((s) => ({ tracker: { ...s.tracker, faction } })),
      toggleCompleted: (taskId) =>
        set((s) => ({
          tracker: {
            ...s.tracker,
            completedTaskIds: s.tracker.completedTaskIds.includes(taskId)
              ? s.tracker.completedTaskIds.filter((t) => t !== taskId)
              : [...s.tracker.completedTaskIds, taskId],
          },
        })),
      setHideoutLevel: (stationId, level) =>
        set((s) => ({
          tracker: {
            ...s.tracker,
            hideoutLevels: { ...(s.tracker.hideoutLevels ?? {}), [stationId]: level },
          },
        })),
      setItemHave: (itemId, count) =>
        set((s) => ({
          tracker: {
            ...s.tracker,
            itemsHave: { ...(s.tracker.itemsHave ?? {}), [itemId]: Math.max(0, count) },
          },
        })),
      consumeItems: (requirements) =>
        set((s) => {
          const itemsHave = { ...(s.tracker.itemsHave ?? {}) };
          for (const req of requirements) {
            itemsHave[req.itemId] = Math.max(0, (itemsHave[req.itemId] ?? 0) - req.count);
          }
          return { tracker: { ...s.tracker, itemsHave } };
        }),
      resetProgress: () =>
        set({
          tracker: {
            level: 1,
            faction: 'Any',
            completedTaskIds: [],
            hideoutLevels: {},
            itemsHave: {},
          },
        }),
      setSearch: (search) => set({ search }),
    }),
    {
      name: 'raidplanner-v1',
      version: 3,
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        let state = persisted as {
          tracker?: TrackerState;
          profiles?: Partial<Record<GameMode, TrackerState>>;
          gameMode?: GameMode;
        };
        if (version < 1) {
          state = {
            ...state,
            gameMode: 'pvp',
            profiles: {},
            tracker: state.tracker ?? freshTracker(),
          };
        }
        if (version < 3) {
          // v2 added hideoutLevels, v3 added itemsHave — normalize both
          const normalize = (tracker: TrackerState | undefined): TrackerState => ({
            ...(tracker ?? freshTracker()),
            hideoutLevels: tracker?.hideoutLevels ?? {},
            itemsHave: tracker?.itemsHave ?? {},
          });
          state = {
            ...state,
            tracker: normalize(state.tracker),
            profiles: Object.fromEntries(
              Object.entries(state.profiles ?? {}).map(([mode, tracker]) => [
                mode,
                normalize(tracker),
              ]),
            ),
          };
        }
        return state;
      },
      partialize: ({ search: _search, liveFix: _liveFix, lastAutoEvent: _e, ...rest }) => rest,
    },
  ),
);
