import { createContext } from "react";

/**
 * FR-PRI-03 (Task 10.4): opens the "Clear this session's data" confirmation.
 * Provided by ExperimentSessionShell around the results of a live session
 * that has ended. Absent elsewhere (for example a stored session in the
 * development Observatory, which has its own deletion), so no clear action is
 * shown there.
 */
export const ClearSessionContext = createContext<(() => void) | null>(null);
