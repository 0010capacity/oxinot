import { create } from 'zustand';

export interface PendingToolCall {
  id: string;
  toolName: string;
  params: any;
  description: string;
  requiresApproval: boolean;
  timestamp: number;
}

interface ToolApprovalStore {
  pendingCalls: PendingToolCall[];
  approvedCalls: Set<string>;
  deniedCalls: Set<string>;

  // Add tool call for approval
  addPendingCall: (call: Omit<PendingToolCall, 'id' | 'timestamp'>) => string;

  // Approve tool call
  approve: (id: string) => void;

  // Deny tool call
  deny: (id: string) => void;

  // Check if tool call is approved
  isApproved: (id: string) => boolean;

  // Check if tool call is denied
  isDenied: (id: string) => boolean;

  // Clear approval state
  clear: () => void;
}

export const useToolApprovalStore = create<ToolApprovalStore>((set, get) => ({
  pendingCalls: [],
  approvedCalls: new Set(),
  deniedCalls: new Set(),

  addPendingCall: (call) => {
    const id = `${Date.now()}-${Math.random()}`;
    const pendingCall: PendingToolCall = {
      ...call,
      id,
      timestamp: Date.now(),
    };

    set(state => ({
      pendingCalls: [...state.pendingCalls, pendingCall],
    }));

    return id;
  },

  approve: (id) => {
    set(state => {
      const newApproved = new Set(state.approvedCalls);
      newApproved.add(id);

      return {
        approvedCalls: newApproved,
        pendingCalls: state.pendingCalls.filter(c => c.id !== id),
      };
    });
  },

  deny: (id) => {
    set(state => {
      const newDenied = new Set(state.deniedCalls);
      newDenied.add(id);

      return {
        deniedCalls: newDenied,
        pendingCalls: state.pendingCalls.filter(c => c.id !== id),
      };
    });
  },

  isApproved: (id) => get().approvedCalls.has(id),
  isDenied: (id) => get().deniedCalls.has(id),

  clear: () => set({
    pendingCalls: [],
    approvedCalls: new Set(),
    deniedCalls: new Set(),
  }),
}));
