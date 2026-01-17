import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { useEffect } from "react";

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void | Promise<void>;
  keywords?: string[];
  category?: string;
  order?: number;
}

interface CommandState {
  commands: Record<string, Command>;
  registerCommand: (command: Command) => () => void;
  unregisterCommand: (id: string) => void;
}

export const useCommandStore = createWithEqualityFn<CommandState>()(
  immer((set) => ({
    commands: {},

    registerCommand: (command: Command) => {
      set((state) => {
        state.commands[command.id] = command;
      });

      // Return unregister function
      return () => {
        set((state) => {
          delete state.commands[command.id];
        });
      };
    },

    unregisterCommand: (id: string) => {
      set((state) => {
        delete state.commands[id];
      });
    },
  })),
);

// Helper hook for registering a single command in components
export function useRegisterCommand(command: Command | null | undefined) {
  const registerCommand = useCommandStore((state) => state.registerCommand);

  useEffect(() => {
    if (!command) return;
    const unregister = registerCommand(command);
    return unregister;
  }, [command, registerCommand]);
}

// Helper hook for registering multiple commands in components
export function useRegisterCommands(commands: Command[]) {
  const registerCommand = useCommandStore((state) => state.registerCommand);

  useEffect(() => {
    if (commands.length === 0) return;
    const unregisters = commands.map((cmd) => registerCommand(cmd));
    return () => {
      for (const unreg of unregisters) {
        unreg();
      }
    };
  }, [commands, registerCommand]);
}
