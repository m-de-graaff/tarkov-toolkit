import type { GameMode, GamePosition } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import type { LiveFix, LogEvent } from '@raidplanner/live';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TrackerState } from './lib/availability';
import { progressStorage } from './lib/storage';

export type SpawnChoice =
  | { kind: 'zone'; zoneName: string; position: GamePosition }
  | { kind: 'custom'; position: GamePosition };

const freshTracker = (): TrackerState => ({
  level: 15,
  faction: 'Any',
  completedTaskIds: [],
  hideoutLevels: {},
});

interface PlannerState {
  selectedMapId: string | null;
  selectedTaskIds: string[];
  spawn: SpawnChoice | null;
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
  resetProgress(): void;
  setSearch(s: string): void;
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      selectedMapId: null,
      selectedTaskIds: [],
      spawn: null,
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
      selectMap: (id) => set({ selectedMapId: id, selectedTaskIds: [], spawn: null }),
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
      resetProgress: () =>
        set({ tracker: { level: 1, faction: 'Any', completedTaskIds: [], hideoutLevels: {} } }),
      setSearch: (search) => set({ search }),
    }),
    {
      name: 'raidplanner-v1',
      version: 1,
      storage: createJSONStorage(() => progressStorage),
      migrate: (persisted, version) => {
        if (version === 0 && persisted && typeof persisted === 'object') {
          const old = persisted as { tracker?: TrackerState };
          return {
            ...old,
            gameMode: 'pvp' as const,
            profiles: {},
            tracker: old.tracker ?? freshTracker(),
          };
        }
        return persisted;
      },
      partialize: ({ search: _search, liveFix: _liveFix, lastAutoEvent: _e, ...rest }) => rest,
    },
  ),
);
