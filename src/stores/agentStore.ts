import { create } from "zustand";
import type { AgentState, AgentStep } from "../services/ai/agent/types";

interface AgentStore extends AgentState {
  addStep: (step: AgentStep) => void;
  updateStep: (stepId: string, updates: Partial<AgentStep>) => void;
  setStatus: (status: AgentState["status"]) => void;
  setError: (error: string) => void;
  reset: () => void;
  incrementIteration: () => void;
}

const initialState: AgentState = {
  executionId: "",
  goal: "",
  status: "idle",
  steps: [],
  iterations: 0,
  maxIterations: 10,
};

export const useAgentStore = create<AgentStore>((set) => ({
  ...initialState,

  addStep: (step) =>
    set((state) => ({
      steps: [...state.steps, step],
    })),

  updateStep: (stepId, updates) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s,
      ),
    })),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: "failed" }),

  reset: () => set(initialState),

  incrementIteration: () =>
    set((state) => ({ iterations: state.iterations + 1 })),
}));
