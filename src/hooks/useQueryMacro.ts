import { useState, useCallback, useEffect } from "react";
import { tauriAPI, type QueryResultBlock } from "../tauri-api";
import { parseQueryMacro, QueryParseError } from "../utils/queryParser";

export interface UseQueryMacroState {
  results: QueryResultBlock[];
  isLoading: boolean;
  error: string | null;
}

export interface UseQueryMacroReturn extends UseQueryMacroState {
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for executing and managing query macro results
 */
export function useQueryMacro(
  macroString: string,
  workspacePath: string,
): UseQueryMacroReturn {
  const [state, setState] = useState<UseQueryMacroState>({
    results: [],
    isLoading: false,
    error: null,
  });

  const executeQuery = useCallback(async () => {
    if (!macroString.trim()) {
      setState({
        results: [],
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Validate query syntax
      parseQueryMacro(macroString);

      // Execute query via Tauri
      const result = await tauriAPI.executeQueryMacro(
        workspacePath,
        macroString,
      );

      if (result.error) {
        setState({
          results: [],
          isLoading: false,
          error: result.error,
        });
      } else {
        setState({
          results: result.blocks,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      const message =
        err instanceof QueryParseError
          ? `Parse error: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error";

      setState({
        results: [],
        isLoading: false,
        error: message,
      });
    }
  }, [macroString, workspacePath]);

  const refetch = useCallback(() => executeQuery(), [executeQuery]);

  const reset = useCallback(() => {
    setState({
      results: [],
      isLoading: false,
      error: null,
    });
  }, []);

  // Execute query when macro or workspace changes
  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return {
    ...state,
    refetch,
    reset,
  };
}
