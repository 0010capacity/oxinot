import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type AIJobStatus =
  | "queued"
  | "streaming"
  | "applying"
  | "done"
  | "error"
  | "cancelled";

export type AIJobMode = "create" | "edit" | "rewrite";

export interface AIJobOperation {
  id: string;
  blockId: string;
  type: "create" | "update" | "delete";
  status: AIJobStatus;
  error?: string;
}

export interface AIJob {
  id: string;
  prompt: string;
  mode: AIJobMode;
  status: AIJobStatus;
  targetBlockIds: string[];
  operations: AIJobOperation[];
  dedupeKey: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  threadId?: string;
}

interface AIJobsState {
  jobs: Record<string, AIJob>;
  targetLocks: Record<string, string>;
}

interface AIJobsActions {
  createJob: (params: {
    prompt: string;
    mode: AIJobMode;
    targetBlockIds: string[];
  }) => AIJob | null;

  updateJobStatus: (jobId: string, status: AIJobStatus) => void;
  setJobThreadId: (jobId: string, threadId: string) => void;
  setJobError: (jobId: string, error: string) => void;
  completeJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;

  addOperation: (
    jobId: string,
    operation: Omit<AIJobOperation, "id">,
  ) => string;
  updateOperationStatus: (
    jobId: string,
    operationId: string,
    status: AIJobStatus,
    error?: string,
  ) => void;

  getJob: (jobId: string) => AIJob | undefined;
  getJobByThread: (threadId: string) => AIJob | undefined;
  getActiveJobs: () => AIJob[];
  getJobsByBlock: (blockId: string) => AIJob[];
  getActiveJobForBlock: (blockId: string) => AIJob | undefined;
  isBlockLocked: (blockId: string) => boolean;
  isBlockStreaming: (blockId: string) => boolean;
  cleanupCompletedJobs: (maxAgeMs?: number) => void;

  hasActiveJobWithKey: (dedupeKey: string) => boolean;
  generateDedupeKey: (
    prompt: string,
    targetBlockIds: string[],
    mode: AIJobMode,
  ) => string;
}

type AIJobsStore = AIJobsState & AIJobsActions;

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function releaseLocks(state: AIJobsState, job: AIJob, jobId: string): void {
  for (const blockId of job.targetBlockIds) {
    if (state.targetLocks[blockId] === jobId) {
      delete state.targetLocks[blockId];
    }
  }
}

export const useAIJobsStore = create<AIJobsStore>()(
  immer((set, get) => ({
    jobs: {},
    targetLocks: {},

    createJob: (params) => {
      const { prompt, mode, targetBlockIds } = params;
      const dedupeKey = get().generateDedupeKey(prompt, targetBlockIds, mode);

      const jobId = `job_${uuidv4()}`;
      let createdJob: AIJob | null = null;

      // Checks + creation in single set() to prevent TOCTOU race
      set((state) => {
        const hasDuplicate = Object.values(state.jobs).some(
          (j) =>
            j.dedupeKey === dedupeKey &&
            j.status !== "done" &&
            j.status !== "error" &&
            j.status !== "cancelled",
        );
        if (hasDuplicate) {
          console.log("[AIJobsStore] Duplicate job detected, skipping");
          return;
        }

        const lockedTargets = targetBlockIds.filter((id) =>
          Boolean(state.targetLocks[id]),
        );
        if (lockedTargets.length > 0) {
          console.log("[AIJobsStore] Targets already locked:", lockedTargets);
          return;
        }

        const job: AIJob = {
          id: jobId,
          prompt,
          mode,
          status: "queued",
          targetBlockIds,
          operations: [],
          dedupeKey,
          createdAt: Date.now(),
        };

        state.jobs[jobId] = job;
        for (const blockId of targetBlockIds) {
          state.targetLocks[blockId] = jobId;
        }
        createdJob = job;
      });

      if (createdJob) {
        console.log("[AIJobsStore] Created job:", jobId, {
          mode,
          targets: targetBlockIds.length,
        });
      }

      return createdJob;
    },

    updateJobStatus: (jobId, status) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          job.status = status;
        }
      });
    },

    setJobThreadId: (jobId, threadId) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          job.threadId = threadId;
        }
      });
    },

    setJobError: (jobId, error) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          job.status = "error";
          job.error = error;
          job.completedAt = Date.now();
          releaseLocks(state, job, jobId);
        }
      });
    },

    completeJob: (jobId) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          job.status = "done";
          job.completedAt = Date.now();
          releaseLocks(state, job, jobId);
        }
      });
    },

    cancelJob: (jobId) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          job.status = "cancelled";
          job.completedAt = Date.now();
          releaseLocks(state, job, jobId);
        }
      });
    },

    removeJob: (jobId) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          releaseLocks(state, job, jobId);
          delete state.jobs[jobId];
        }
      });
    },

    addOperation: (jobId, operation) => {
      const opId = `op_${uuidv4()}`;
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          job.operations.push({ ...operation, id: opId });
        }
      });
      return opId;
    },

    updateOperationStatus: (jobId, operationId, status, error) => {
      set((state) => {
        const job = state.jobs[jobId];
        if (job) {
          const op = job.operations.find((o) => o.id === operationId);
          if (op) {
            op.status = status;
            if (error) op.error = error;
          }
        }
      });
    },

    getJob: (jobId) => get().jobs[jobId],

    getJobByThread: (threadId) =>
      Object.values(get().jobs).find((j) => j.threadId === threadId),

    getActiveJobs: () =>
      Object.values(get().jobs).filter(
        (j) =>
          j.status !== "done" &&
          j.status !== "error" &&
          j.status !== "cancelled",
      ),

    getJobsByBlock: (blockId) =>
      Object.values(get().jobs).filter((j) =>
        j.targetBlockIds.includes(blockId),
      ),

    getActiveJobForBlock: (blockId) => {
      const jobId = get().targetLocks[blockId];
      if (!jobId) return undefined;
      return get().jobs[jobId];
    },

    isBlockLocked: (blockId) => Boolean(get().targetLocks[blockId]),

    isBlockStreaming: (blockId) => {
      const job = get().getActiveJobForBlock(blockId);
      return job?.status === "streaming";
    },

    cleanupCompletedJobs: (maxAgeMs = 5 * 60 * 1000) => {
      set((state) => {
        const now = Date.now();
        for (const [jobId, job] of Object.entries(state.jobs)) {
          const isTerminal =
            job.status === "done" ||
            job.status === "error" ||
            job.status === "cancelled";
          if (
            isTerminal &&
            job.completedAt &&
            now - job.completedAt > maxAgeMs
          ) {
            delete state.jobs[jobId];
          }
        }
      });
    },

    hasActiveJobWithKey: (dedupeKey) =>
      Object.values(get().jobs).some(
        (j) =>
          j.dedupeKey === dedupeKey &&
          j.status !== "done" &&
          j.status !== "error" &&
          j.status !== "cancelled",
      ),

    generateDedupeKey: (prompt, targetBlockIds, mode) => {
      const sortedTargets = [...targetBlockIds].sort().join(",");
      const key = `${mode}:${sortedTargets}:${prompt}`;
      return simpleHash(key);
    },
  })),
);

export const useJob = (jobId: string) => useAIJobsStore((s) => s.jobs[jobId]);

export const useActiveJobs = () => useAIJobsStore((s) => s.getActiveJobs());

export const useBlockJobStatus = (blockId: string) => {
  const job = useAIJobsStore((s) => s.getActiveJobForBlock(blockId));
  return job?.status;
};

export const useIsBlockLocked = (blockId: string) =>
  useAIJobsStore((s) => s.isBlockLocked(blockId));

export const useIsBlockStreaming = (blockId: string) =>
  useAIJobsStore((s) => s.isBlockStreaming(blockId));
