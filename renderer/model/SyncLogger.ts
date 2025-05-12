import { isWebEnvironment } from "@/renderer/lib/firestoreService";

export interface SyncLogEntry {
  id: string;
  timestamp: string; // ISO string format
  modelName: string;
  operation: "upload" | "download";
  status: "success" | "error" | "running" | "info";
  message: string;
  details?: Record<string, any>; // Optional: for more detailed error info or metadata
}

const MAX_LOG_ENTRIES = 100; // Keep a rolling log of 100 entries
let logFilePath: string | null = null;

// Function to set the dbPath, which determines log file location
// This should be called once from a central place, e.g., settings initialization
export const initializeSyncLogger = (dbPath: string) => {
  if (isWebEnvironment()) {
    console.warn("[SyncLogger] Logger is disabled in web environment.");
    return;
  }
  if (!dbPath) {
    console.error("[SyncLogger] dbPath is required to initialize logger.");
    return;
  }
  logFilePath = `${dbPath}/SweldoDB/logs/sync_activity.json`;
  // console.log(`[SyncLogger] Log file path set to: ${logFilePath}`);
};

const ensureLogDirAndFile = async (): Promise<void> => {
  if (isWebEnvironment() || !logFilePath) return;

  try {
    const logDir = logFilePath.substring(0, logFilePath.lastIndexOf("/"));
    await window.electron.ensureDir(logDir);
    // console.log(`[SyncLogger] Ensured directory: ${logDir}`);

    try {
      await window.electron.readFile(logFilePath);
      // console.log(`[SyncLogger] Log file already exists: ${logFilePath}`);
    } catch (error: any) {
      if (error.code === "ENOENT" || error.message.includes("ENOENT")) {
        // console.log(`[SyncLogger] Log file not found, creating: ${logFilePath}`);
        await window.electron.writeFile(
          logFilePath,
          JSON.stringify([], null, 2)
        );
      } else {
        throw error; // Re-throw other errors
      }
    }
  } catch (error) {
    console.error("[SyncLogger] Error ensuring log directory/file:", error);
    // Don't throw here, allow operations to proceed but they might fail at read/write
  }
};

export const addLog = async (
  entryData: Omit<SyncLogEntry, "id" | "timestamp">
): Promise<void> => {
  if (isWebEnvironment() || !logFilePath) return;

  const newEntry: SyncLogEntry = {
    ...entryData,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  try {
    await ensureLogDirAndFile();
    let fileContent = ""; // Initialize fileContent
    try {
      fileContent = await window.electron.readFile(logFilePath);
    } catch (readFileError: any) {
      // If reading fails (e.g. file doesn't exist yet, which ensureLogDirAndFile should handle, but as a safeguard)
      console.warn(
        "[SyncLogger] Error reading log file initially, will attempt to create/overwrite:",
        readFileError
      );
      // Proceed as if fileContent is empty, ensureLogDirAndFile should have created it or writeFile will.
    }

    let logs: SyncLogEntry[] = [];
    if (fileContent && fileContent.trim() !== "") {
      try {
        logs = JSON.parse(fileContent);
        if (!Array.isArray(logs)) {
          console.warn("[SyncLogger] Log content is not an array, resetting.");
          logs = [];
        }
      } catch (parseError: any) {
        console.error(
          "[SyncLogger] Error parsing existing log file. Backing up corrupted log and starting fresh.",
          parseError
        );
        const corruptedLogPath = logFilePath.replace(
          ".json",
          ".corrupted.json"
        );
        try {
          await window.electron.writeFile(corruptedLogPath, fileContent); // Save the corrupted content
          console.log(
            `[SyncLogger] Corrupted log content saved to: ${corruptedLogPath}`
          );
        } catch (backupError) {
          console.error(
            "[SyncLogger] Failed to save corrupted log content:",
            backupError
          );
        }

        // Log a snippet around the potential error location if parseError has position
        if (typeof parseError.position === "number") {
          const position = parseError.position;
          const snippetStart = Math.max(0, position - 30);
          const snippetEnd = Math.min(fileContent.length, position + 30);
          const snippet = fileContent.substring(snippetStart, snippetEnd);
          console.error(
            `[SyncLogger] Snippet near error (pos ${position}): ...${snippet}...`
          );
        }
        logs = []; // Reset to start fresh
      }
    }

    logs.unshift(newEntry); // Add new entry to the beginning
    if (logs.length > MAX_LOG_ENTRIES) {
      logs = logs.slice(0, MAX_LOG_ENTRIES); // Trim old entries
    }

    await window.electron.writeFile(logFilePath, JSON.stringify(logs, null, 2));
    // console.log(`[SyncLogger] Added log entry for ${newEntry.modelName}`);
  } catch (error) {
    console.error("[SyncLogger] Failed to add log entry:", error);
  }
};

export const getLogs = async (limit: number = 20): Promise<SyncLogEntry[]> => {
  if (isWebEnvironment() || !logFilePath) return [];

  try {
    await ensureLogDirAndFile(); // Ensure file exists before reading
    const fileContent = await window.electron.readFile(logFilePath);
    if (fileContent) {
      let logs: SyncLogEntry[] = JSON.parse(fileContent);
      if (!Array.isArray(logs)) logs = [];
      return logs.slice(0, limit); // Return the most recent 'limit' entries
    }
    return [];
  } catch (error: any) {
    if (error.code === "ENOENT" || error.message.includes("ENOENT")) {
      // console.log('[SyncLogger] Log file not found on getLogs, returning empty.');
      return [];
    }
    console.error("[SyncLogger] Failed to get log entries:", error);
    return [];
  }
};

export const clearAllLogs = async (): Promise<void> => {
  if (isWebEnvironment() || !logFilePath) return;
  try {
    await ensureLogDirAndFile(); // Ensure file exists before attempting to clear
    await window.electron.writeFile(logFilePath, JSON.stringify([], null, 2));
    console.log("[SyncLogger] All sync logs cleared.");
  } catch (error) {
    console.error("[SyncLogger] Failed to clear logs:", error);
  }
};
