import {
  MissingTimeLog as OldMissingTimeLog,
  MissingTimeModel as OldMissingTimeModel,
} from "./missingTime_old";
import Papa from "papaparse";
import {
  getMissingTimeLogsFirestore,
  saveMissingTimeLogFirestore,
  deleteMissingTimeLogFirestore,
  getAllMissingTimeLogsForEmployeeFirestore,
} from "./missingTime_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

// Re-export the interface for external use
export interface MissingTimeLog extends OldMissingTimeLog {}

interface MissingTimeJsonStructure {
  meta: {
    month: number;
    year: number;
    lastModified: string;
  };
  logs: MissingTimeLog[];
}

export class MissingTimeModel {
  private dbPath: string;
  private logsFolderPath: string;
  private oldModel: OldMissingTimeModel; // For fallback

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.logsFolderPath = `${this.dbPath}/SweldoDB/missing_time_logs`;
    this.oldModel = new OldMissingTimeModel(dbPath); // Instantiate old model for fallback
  }

  private getJsonFilePath(month: number, year: number): string {
    return `${this.logsFolderPath}/${year}_${month}_missing_times.json`;
  }

  private async readJsonFile(
    month: number,
    year: number
  ): Promise<MissingTimeJsonStructure | null> {
    const filePath = this.getJsonFilePath(month, year);
    if (!(await window.electron.fileExists(filePath))) {
      return null;
    }
    try {
      const content = await window.electron.readFile(filePath);
      try {
        return JSON.parse(content);
      } catch (parseError) {
        console.error(`Error parsing JSON file ${filePath}:`, parseError);

        // Attempt to fix common JSON syntax errors
        try {
          // Create a default structure with empty logs
          const defaultStructure: MissingTimeJsonStructure = {
            meta: {
              month,
              year,
              lastModified: new Date().toISOString(),
            },
            logs: [],
          };

          // Make a backup of the corrupted file
          const backupPath = `${filePath}.backup.${Date.now()}`;
          await window.electron.writeFile(backupPath, content);

          // Write the repaired JSON file
          await this.writeJsonFile(month, year, defaultStructure);
          console.log(`Repaired JSON file ${filePath} with empty structure`);

          return defaultStructure;
        } catch (recoveryError) {
          console.error(
            `Failed to recover corrupted JSON file ${filePath}:`,
            recoveryError
          );
          return null;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null; // Handle error or corrupted file
    }
  }

  private async writeJsonFile(
    month: number,
    year: number,
    data: MissingTimeJsonStructure
  ): Promise<void> {
    const filePath = this.getJsonFilePath(month, year);
    await window.electron.ensureDir(this.logsFolderPath);
    try {
      await window.electron.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing JSON file ${filePath}:`, error);
      throw error;
    }
  }

  // ----- Public API Methods (Matching Old Model) -----

  async saveMissingTimeLog(
    log: MissingTimeLog, // Expect full log object with id and createdAt
    month: number,
    year: number
  ): Promise<void> {
    // Web mode - use Firestore
    if (isWebEnvironment()) {
      const companyName = await getCompanyName();
      await saveMissingTimeLogFirestore(log, month, year, companyName);
      return;
    }

    // Desktop mode - use existing implementation
    const jsonData = await this.readJsonFile(month, year);

    // Initialize with an empty structure if the file doesn't exist or is corrupted
    const logs: MissingTimeLog[] = jsonData ? jsonData.logs : [];

    // Simple check for duplicates based on employee, day, and type before adding
    const exists = logs.some(
      (existingLog) =>
        existingLog.day === log.day && // Use the provided log directly
        existingLog.employeeId === log.employeeId &&
        existingLog.missingType === log.missingType
    );

    if (exists) {
      console.log("Missing time log already exists (JSON), skipping:", log);
      return;
    }

    logs.push(log);

    const updatedJsonData: MissingTimeJsonStructure = {
      meta: {
        month,
        year,
        lastModified: new Date().toISOString(),
      },
      logs: logs,
    };

    await this.writeJsonFile(month, year, updatedJsonData);
  }

  async getMissingTimeLogs(
    month: number,
    year: number
  ): Promise<MissingTimeLog[]> {
    // Web mode - use Firestore
    if (isWebEnvironment()) {
      const companyName = await getCompanyName();
      return getMissingTimeLogsFirestore(month, year, companyName);
    }

    // Desktop mode - use existing implementation
    const jsonData = await this.readJsonFile(month, year);
    if (jsonData) {
      return jsonData.logs;
    } else {
      // Fallback to CSV if JSON doesn't exist
      console.warn(
        `JSON file for ${year}-${month} not found, falling back to CSV.`
      );
      try {
        // IMPORTANT: We need to cast the result from the old model
        const csvLogs = (await this.oldModel.getMissingTimeLogs(
          month,
          year
        )) as MissingTimeLog[];
        return csvLogs;
      } catch (error) {
        console.error(`Error falling back to CSV for ${year}-${month}:`, error);
        return []; // Return empty on fallback error
      }
    }
  }

  async deleteMissingTimeLog(
    id: string,
    month: number,
    year: number
  ): Promise<void> {
    // Web mode - use Firestore
    if (isWebEnvironment()) {
      const companyName = await getCompanyName();
      await deleteMissingTimeLogFirestore(id, month, year, companyName);
      return;
    }

    // Desktop mode - use existing implementation
    const jsonData = await this.readJsonFile(month, year);
    if (!jsonData) {
      console.warn(
        `Cannot delete log ${id}: JSON file for ${year}-${month} not found.`
      );
      // Optionally, add fallback to delete from CSV? For now, we only delete from JSON.
      // If needed: await this.oldModel.deleteMissingTimeLog(id, month, year);
      return;
    }

    const initialLength = jsonData.logs.length;
    jsonData.logs = jsonData.logs.filter((log) => log.id !== id);

    if (jsonData.logs.length < initialLength) {
      jsonData.meta.lastModified = new Date().toISOString();
      await this.writeJsonFile(month, year, jsonData);
    } else {
      console.warn(
        `Log with id ${id} not found in JSON file for ${year}-${month}.`
      );
    }
  }

  // New method to get all missing time logs for an employee across all periods
  async getAllMissingTimeLogsForEmployee(
    employeeId: string
  ): Promise<MissingTimeLog[]> {
    // Web mode - use Firestore
    if (isWebEnvironment()) {
      const companyName = await getCompanyName();
      return getAllMissingTimeLogsForEmployeeFirestore(employeeId, companyName);
    }

    // Desktop mode implementation would need to be added here
    // This would require scanning all JSON files for the given employee
    // For now, we'll return an empty array
    console.warn(
      "getAllMissingTimeLogsForEmployee not implemented for desktop mode"
    );
    return [];
  }

  // ----- New Method for Full Sync Data Loading -----
  async loadAllMissingTimeLogsForSync(): Promise<MissingTimeLog[]> {
    console.log(
      `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: START - Scanning ${this.logsFolderPath}`
    );
    if (isWebEnvironment()) {
      console.warn(
        "[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: Should not be called in web environment. Returning empty array."
      );
      return [];
    }

    const allLogs: MissingTimeLog[] = [];
    try {
      await window.electron.ensureDir(this.logsFolderPath); // Ensure base directory exists
      const files = await window.electron.readDir(this.logsFolderPath);
      console.log(
        `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: Found ${files.length} potential files/dirs in ${this.logsFolderPath}`
      );

      const jsonFiles = files.filter(
        (file: { name: string; isFile: boolean }) =>
          file.isFile && file.name.endsWith("_missing_times.json")
      );
      console.log(
        `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: Found ${jsonFiles.length} JSON files to process.`
      );

      for (const jsonFile of jsonFiles) {
        const filePath = `${this.logsFolderPath}/${jsonFile.name}`;
        console.log(
          `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: Processing JSON file: ${filePath}`
        );
        try {
          const fileContent = await window.electron.readFile(filePath);
          if (!fileContent.trim()) {
            console.log(
              `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: JSON file ${jsonFile.name} is empty. Skipping.`
            );
            continue;
          }

          let jsonData: MissingTimeJsonStructure;
          try {
            jsonData = JSON.parse(fileContent);
          } catch (parseError) {
            console.error(
              `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: ERROR parsing JSON file ${jsonFile.name}:`,
              parseError
            );

            // Try to extract file metadata from filename
            const fileNameParts = jsonFile.name.split("_");
            if (fileNameParts.length >= 2) {
              const year = parseInt(fileNameParts[0], 10);
              const month = parseInt(fileNameParts[1], 10);

              if (!isNaN(year) && !isNaN(month)) {
                // Create backup and repair the file
                const backupPath = `${filePath}.backup.${Date.now()}`;
                await window.electron.writeFile(backupPath, fileContent);
              }
            }
            continue;
          }

          if (jsonData && jsonData.logs && Array.isArray(jsonData.logs)) {
            // Add validation for individual logs if necessary (e.g., date parsing)
            const validLogs = jsonData.logs.filter((log) => {
              // Corrected validation: ensure essential fields exist, including date components
              if (
                !log.id ||
                !log.employeeId ||
                typeof log.day === "undefined" ||
                typeof log.month === "undefined" ||
                typeof log.year === "undefined"
              ) {
                console.warn(
                  `[missingTime.ts] Invalid log entry in ${jsonFile.name}, missing essential fields (id, employeeId, day, month, or year):`,
                  log
                );
                return false;
              }
              // Further validation could be to ensure day, month, year can form a valid date
              // For now, just checking existence.
              return true;
            });
            allLogs.push(...validLogs);
            console.log(
              `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: Added ${validLogs.length} logs from ${jsonFile.name}.`
            );
          } else {
            console.warn(
              `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: JSON file ${jsonFile.name} does not have a valid logs array. Skipping.`
            );
          }
        } catch (error) {
          console.error(
            `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: ERROR processing JSON file ${jsonFile.name}:`,
            error
          );
        }
      }
      // Note: CSV fallback for sync loading is not implemented here, assuming JSON is the primary format after migration.
    } catch (error) {
      console.error(
        `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: ERROR scanning directory ${this.logsFolderPath}:`,
        error
      );
      // Depending on desired behavior, might rethrow or return what's been gathered so far.
      // For now, if directory scan fails, it's a more significant issue.
      throw error;
    }
    console.log(
      `[missingTime.ts] MissingTimeModel.loadAllMissingTimeLogsForSync: END - Loaded a total of ${allLogs.length} missing time logs.`
    );
    return allLogs;
  }

  // ----- Migration Function -----
  static async migrateCsvToJson(
    dbPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    // Skip migration in web mode since it's only relevant for desktop operation
    if (isWebEnvironment()) {
      onProgress?.("Skipping Missing Time Logs migration in web mode.");
      return;
    }

    const logsFolderPath = `${dbPath}/SweldoDB/missing_time_logs`;
    const oldModel = new OldMissingTimeModel(dbPath); // Use old model to read CSV

    try {
      onProgress?.("Starting Missing Time Logs CSV to JSON migration...");
      await window.electron.ensureDir(logsFolderPath);
      const files = await window.electron.readDir(logsFolderPath);
      const csvFiles = files.filter(
        (f: { name: string; isDirectory: boolean }) =>
          f.name.endsWith("_missing_times.csv") && !f.isDirectory
      );

      if (csvFiles.length === 0) {
        onProgress?.("No CSV files found to migrate.");
        return;
      }

      onProgress?.(`Found ${csvFiles.length} CSV file(s) to process.`);

      for (const file of csvFiles) {
        const fileName = file.name;
        const filePath = `${logsFolderPath}/${fileName}`;
        const jsonFilePath = filePath.replace(".csv", ".json");

        // Basic check if JSON already exists - skip if it does? Or overwrite? Let's skip for now.
        if (await window.electron.fileExists(jsonFilePath)) {
          onProgress?.(`JSON file already exists for ${fileName}, skipping.`);
          continue;
        }

        onProgress?.(`Processing ${fileName}...`);
        try {
          // Extract year and month from filename (e.g., "2023_5_missing_times.csv")
          const parts = fileName.split("_");
          if (parts.length < 2) {
            onProgress?.(`Skipping invalid filename format: ${fileName}`);
            continue;
          }
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);

          if (isNaN(year) || isNaN(month)) {
            onProgress?.(
              `Skipping invalid year/month in filename: ${fileName}`
            );
            continue;
          }

          // Read logs using the OLD model's get method (which reads CSV)
          const logs = (await oldModel.getMissingTimeLogs(
            month,
            year
          )) as MissingTimeLog[]; // Cast needed

          const jsonData: MissingTimeJsonStructure = {
            meta: {
              month,
              year,
              lastModified: new Date().toISOString(),
            },
            logs: logs,
          };

          // Write the new JSON file
          await window.electron.ensureDir(logsFolderPath); // Ensure dir again just in case
          await window.electron.writeFile(
            jsonFilePath,
            JSON.stringify(jsonData, null, 2)
          );
          onProgress?.(`Successfully converted ${fileName} to JSON.`);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          onProgress?.(`Error processing ${fileName}: ${message}`);
          console.error(`Error migrating ${fileName}:`, error);
          // Decide if one error should stop the whole process or just skip the file
          // For now, we continue with the next file.
        }
      }
      // Delete CSV files after successful migration
      await deleteCsvFiles(logsFolderPath, "missing_times", onProgress);

      onProgress?.("Missing Time Logs migration process finished.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(`Migration failed: ${message}`);
      console.error("Error during Missing Time Logs migration:", error);
      throw new Error(`Missing Time Logs migration failed: ${message}`);
    }
  }

  // ----- Factory Function -----
  static createMissingTimeModel(dbPath: string): MissingTimeModel {
    return new MissingTimeModel(dbPath);
  }

  // Utility method to repair a corrupted missing time log file
  static async repairMissingTimeLogFile(
    dbPath: string,
    month: number,
    year: number
  ): Promise<boolean> {
    const logsFolderPath = `${dbPath}/SweldoDB/missing_time_logs`;
    const filePath = `${logsFolderPath}/${year}_${month}_missing_times.json`;

    try {
      // Check if file exists
      if (!(await window.electron.fileExists(filePath))) {
        console.error(`File does not exist: ${filePath}`);
        return false;
      }

      // Create backup
      const backupPath = `${filePath}.backup.${Date.now()}`;
      const content = await window.electron.readFile(filePath);
      await window.electron.writeFile(backupPath, content);
      console.log(`Created backup of file at ${backupPath}`);

      // Create a fresh structure
      const repairedData = {
        meta: {
          month,
          year,
          lastModified: new Date().toISOString(),
        },
        logs: [],
      };

      // Write the repaired file
      await window.electron.writeFile(
        filePath,
        JSON.stringify(repairedData, null, 2)
      );
      console.log(`Successfully repaired ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Failed to repair ${filePath}:`, error);
      return false;
    }
  }
}

/**
 * Delete CSV files after successful migration
 */
const deleteCsvFiles = async (basePath: string, filePattern: string, progressCallback?: (message: string) => void) => {
  try {
    progressCallback?.("Starting cleanup of CSV files...");
    
    const findAndDeleteInDirectory = async (dirPath: string): Promise<number> => {
      try {
        const items = await window.electron.readDir(dirPath);
        let deletedCount = 0;
        
        for (const item of items) {
          const itemPath = `${dirPath}/${item.name}`;
          
          if (item.isFile && item.name.endsWith('.csv') && item.name.includes(filePattern)) {
            try {
              await window.electron.deleteFile(itemPath);
              progressCallback?.(`Deleted: ${item.name}`);
              deletedCount++;
            } catch (error) {
              progressCallback?.(`Failed to delete: ${item.name} - ${error}`);
            }
          } else if (!item.isFile) {
            // Recursively search subdirectories
            const subDeleted = await findAndDeleteInDirectory(itemPath);
            deletedCount += subDeleted;
          }
        }
        
        return deletedCount;
      } catch (error) {
        progressCallback?.(`Error reading directory ${dirPath}: ${error}`);
        return 0;
      }
    };
    
    const totalDeleted = await findAndDeleteInDirectory(basePath);
    
    if (totalDeleted > 0) {
      progressCallback?.(`Cleanup completed: ${totalDeleted} CSV files deleted successfully`);
    } else {
      progressCallback?.("No CSV files found to delete");
    }
  } catch (error) {
    progressCallback?.(`CSV cleanup error: ${error}`);
  }
};
