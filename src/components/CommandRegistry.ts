/**
 * CommandRegistry
 * 
 * Provides a central point for registering and managing commands for the Command Palette.
 * Components can dynamically register commands that are context-aware.
 */

export { 
  useCommandStore, 
  useRegisterCommand, 
  useRegisterCommands 
} from "../stores/commandStore";

export type { Command } from "../stores/commandStore";
