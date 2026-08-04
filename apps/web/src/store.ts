import type { GamePosition } from '@raidplanner/data';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackerState } from './lib/availability';

export type SpawnChoice =
  | { kind: 'zone'; zoneName: string; position: GamePosition }
  | { kind: 'custom'; position: GamePosition };

interface PlannerState {
  selectedMapId: string | null;
  selectedTaskIds: string[];
  spawn: SpawnChoice | null;
  tracker: TrackerState;
  onlyAvailable: boolean;
  search: string;
  selectMap(id: string): void;
  toggleTask(id: string): void;
  clearTasks(): void;
  setSpawn(s: SpawnChoice | null): void;
  setLevel(n: number): void;
  setFaction(f: TrackerState['faction']): void;
  toggleCompleted(taskId: string): void;
  setOnlyAvailable(b: boolean): void;
  setSearch(s: string): void;
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      selectedMapId: null,
      selectedTaskIds: [],
      spawn: null,
      tracker: { level: 15, faction: 'Any', completedTaskIds: [] },
      onlyAvailable: true,
      search: '',
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
      setOnlyAvailable: (onlyAvailable) => set({ onlyAvailable }),
      setSearch: (search) => set({ search }),
    }),
    {
      name: 'raidplanner-v1',
      partialize: ({ search: _search, ...rest }) => rest,
    },
  ),
);
