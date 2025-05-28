import { MissingTimeModel } from "./missingTime";

/**
 * Utility functions for managing missing time log files
 */

/**
 * Repairs a corrupted missing time log file by creating a backup and
 * replacing it with a fresh empty structure.
 *
 * @param dbPath Path to the database directory
 * @param month Month number (1-12)
 * @param year Year (e.g., 2025)
 * @returns Promise that resolves to true if repair was successful
 */
export async function repairMissingTimeLogFile(
  dbPath: string,
  month: number,
  year: number
): Promise<boolean> {
  return MissingTimeModel.repairMissingTimeLogFile(dbPath, month, year);
}

/**
 * Utility function to specifically repair the 2025_5_missing_times.json file
 * that was reported as corrupted.
 *
 * @param dbPath Path to the database directory (typically the app's user data path)
 * @returns Promise that resolves to true if repair was successful
 */
export async function repair2025MayMissingTimeLogs(
  dbPath: string
): Promise<boolean> {
  console.log("Attempting to repair 2025_5_missing_times.json file...");
  const result = await repairMissingTimeLogFile(dbPath, 5, 2025);

  if (result) {
    console.log("Successfully repaired 2025_5_missing_times.json");
  } else {
    console.error("Failed to repair 2025_5_missing_times.json");
  }

  return result;
}
