import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TaskMergeState {
  /** Task branch IDs already turned into ticket comments in this browser. */
  applied: Record<string, true>;
  markApplied: (branchId: string) => void;
}

export const useTaskMergeStore = create<TaskMergeState>()(
  persist(
    (set) => ({
      applied: {},
      markApplied: (branchId) => set((state) => ({ applied: { ...state.applied, [branchId]: true } })),
    }),
    { name: 'coshell-task-merges', version: 1 },
  ),
);
