import { create } from "zustand";

export interface AppError {
  id: string;
  message: string;
  type: "error" | "warning" | "info";
  timestamp: number;
  details?: string;
  action?: {
    label: string;
    handler: () => void;
  };
}

interface ErrorState {
  errors: AppError[];
  addError: (
    message: string,
    options?: {
      type?: "error" | "warning" | "info";
      details?: string;
      action?: { label: string; handler: () => void };
    },
  ) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  errors: [],

  addError: (message, options = {}) => {
    const id = `${Date.now()}-${Math.random()}`;
    const error: AppError = {
      id,
      message,
      type: options.type || "error",
      timestamp: Date.now(),
      details: options.details,
      action: options.action,
    };

    set((state) => ({
      errors: [...state.errors, error],
    }));

    setTimeout(() => {
      set((state) => ({
        errors: state.errors.filter((e) => e.id !== id),
      }));
    }, 5000);
  },

  removeError: (id) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
    }));
  },

  clearErrors: () => {
    set({ errors: [] });
  },
}));
