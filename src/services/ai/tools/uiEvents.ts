/**
 * UI Event types for tool execution feedback
 * Allows tools to emit events that UI components can listen to
 */
export interface UIEvent {
  type: UIEventType;
  timestamp: Date;
  payload: unknown;
}

/**
 * Event types that tools can emit
 * These events trigger UI updates and state refreshes
 */
export type UIEventType =
  // File system events
  | "file_created"
  | "file_deleted"
  | "file_renamed"
  | "file_moved"
  // Navigation/view events
  | "view_changed"
  | "block_updated"
  | "page_changed"
  // Tool execution events (for feedback)
  | "tool_execution_started"
  | "tool_execution_completed"
  | "tool_execution_failed";

/**
 * Central event emitter for UI updates
 * Decouples tool execution from UI components
 */
class UIEventEmitter {
  private listeners: Map<UIEventType, Set<(event: UIEvent) => void>> =
    new Map();

  /**
   * Register a listener for an event type
   */
  on(eventType: UIEventType, callback: (event: UIEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)?.add(callback);
  }

  /**
   * Unregister a listener for an event type
   */
  off(eventType: UIEventType, callback: (event: UIEvent) => void): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  emit(event: UIEvent): void {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(event);
        } catch (error) {
          console.error(
            `[UIEventEmitter] Error in listener for event type '${event.type}':`,
            error,
          );
        }
      }
    }
  }

  /**
   * Clear all listeners for a specific event type
   */
  clear(eventType: UIEventType): void {
    this.listeners.delete(eventType);
  }

  /**
   * Clear all listeners
   */
  clearAll(): void {
    this.listeners.clear();
  }
}

/**
 * Global event emitter instance
 * Tools use this to emit events after successful execution
 * UI components listen to this to react to changes
 */
export const uiEventEmitter = new UIEventEmitter();
