import path from "path";
import { Short as OldShort, ShortModel as OldShortModel } from "./shorts_old"; // Import old implementation
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";
import {
  loadShortsFirestore,
  createShortFirestore,
  updateShortFirestore,
  deleteShortFirestore,
} from "./shorts_firestore";

// --- Interfaces --- //

// Keep original Short interface
export interface Short extends OldShort {
  type?: "Short" | "Withdrawal"; // Added type field
}

// JSON Structure
interface ShortsJsonStructure {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  shorts: Short[];
}

// --- Implementation --- //

export class ShortModel {
  private dbPath: string;
  private employeeId: string;
  private month: number;
  private year: number;
  private folderPath: string; // Base folder path for the employee
  private jsonFilePath: string; // Path to the JSON file for the current month/year
  private oldModelInstance: OldShortModel; // Instance for fallback

  constructor(
    dbPath: string,
    employeeId: string,
    month?: number,
    year?: number
  ) {
    this.dbPath = dbPath;
    this.employeeId = employeeId;
    this.month = month || new Date().getMonth() + 1;
    this.year = year || new Date().getFullYear();
    const baseShortsPath = path.join(dbPath, "SweldoDB", "shorts");
    this.folderPath = path.join(baseShortsPath, employeeId);
    this.jsonFilePath = path.join(
      this.folderPath,
      `${this.year}_${this.month}_shorts.json`
    );

    // Instantiate the old model pointing to the employee's shorts directory for CSV operations
    this.oldModelInstance = new OldShortModel(
      this.folderPath,
      employeeId,
      this.month,
      this.year
    );
  }

  // Add method to get dbPath
  getDbPath(): string {
    return this.dbPath;
  }

  // --- Private JSON Read/Write Helpers --- //

  private async readJsonFile(): Promise<ShortsJsonStructure | null> {
    try {
      const fileExists = await window.electron.fileExists(this.jsonFilePath);
      if (!fileExists) return null;

      const content = await window.electron.readFile(this.jsonFilePath);
      if (!content || content.trim() === "")
        return {
          meta: {
            employeeId: this.employeeId,
            year: this.year,
            month: this.month,
            lastModified: new Date().toISOString(),
          },
          shorts: [],
        };

      const data = JSON.parse(content) as ShortsJsonStructure;
      // Convert date strings back to Date objects
      data.shorts.forEach((short) => {
        short.date = new Date(short.date);
      });
      return data;
    } catch (error) {
      console.error(`[ShortModel] Error reading ${this.jsonFilePath}:`, error);
      return null;
    }
  }

  private async writeJsonFile(data: ShortsJsonStructure): Promise<void> {
    try {
      await window.electron.ensureDir(this.folderPath);
      // Ensure dates are ISO strings before saving
      const dataToSave = JSON.parse(JSON.stringify(data)); // Deep clone
      dataToSave.meta.lastModified = new Date().toISOString(); // Update timestamp on write
      dataToSave.shorts.forEach((short: any) => {
        short.date =
          short.date instanceof Date ? short.date.toISOString() : short.date;
      });
      await window.electron.writeFile(
        this.jsonFilePath,
        JSON.stringify(dataToSave, null, 2)
      );
    } catch (error) {
      console.error(`[ShortModel] Error writing ${this.jsonFilePath}:`, error);
      throw error;
    }
  }

  // --- Public API Methods (Updated for JSON) --- //

  async createShort(shortInput: Omit<Short, "id">): Promise<void> {
    // Note: The input here doesn't include the ID, we generate it.
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        await createShortFirestore(
          shortInput,
          this.employeeId,
          this.month,
          this.year,
          companyName
        );
        return;
      }

      // Desktop mode - use existing implementation
      const jsonData = (await this.readJsonFile()) ?? {
        meta: {
          employeeId: this.employeeId,
          year: this.year,
          month: this.month,
          lastModified: new Date().toISOString(),
        },
        shorts: [],
      };

      const newShort: Short = {
        ...shortInput,
        id: crypto.randomUUID(),
        employeeId: this.employeeId, // Ensure employeeId is set correctly
        // Ensure status and remainingUnpaid are handled (default if necessary)
        status:
          shortInput.status ||
          (shortInput.remainingUnpaid === 0 ? "Paid" : "Unpaid"),
        remainingUnpaid: shortInput.remainingUnpaid ?? shortInput.amount,
        type: shortInput.type || "Short", // Default type to "Short"
      };

      jsonData.shorts.push(newShort);
      await this.writeJsonFile(jsonData);
    } catch (error) {
      console.error("[ShortModel] Error creating short:", error);
      throw new Error(`Failed to create short: ${(error as any).message}`);
    }
  }

  async updateShort(shortUpdate: Short): Promise<void> {
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        await updateShortFirestore(
          shortUpdate,
          this.month,
          this.year,
          companyName
        );
        return;
      }

      // Desktop mode - use existing implementation
      const jsonData = await this.readJsonFile();
      if (!jsonData) {
        throw new Error(
          `[ShortModel] Shorts data file not found for update (${this.year}-${this.month}).`
        );
      }

      const shortIndex = jsonData.shorts.findIndex(
        (s) => s.id === shortUpdate.id
      );
      if (shortIndex === -1) {
        throw new Error(
          `[ShortModel] Short with id ${shortUpdate.id} not found for update.`
        );
      }

      // Update the short in the array
      jsonData.shorts[shortIndex] = {
        ...jsonData.shorts[shortIndex], // Keep existing fields like employeeId, date if not in update
        ...shortUpdate,
        // Ensure status reflects remaining amount
        status: shortUpdate.remainingUnpaid <= 0 ? "Paid" : "Unpaid",
      };

      await this.writeJsonFile(jsonData);
    } catch (error) {
      console.error("[ShortModel] Error updating short:", error);
      throw error;
    }
  }

  async loadShorts(employeeId: string): Promise<Short[]> {
    // employeeId parameter is technically redundant as it's part of the instance,
    // but kept for API compatibility with old model usage.
    if (employeeId !== this.employeeId) {
      console.warn(
        `[ShortModel] loadShorts called with employeeId (${employeeId}) different from instance (${this.employeeId}). Using instance ID.`
      );
    }
    console.log(
      `[ShortModel DEBUG] loadShorts called for employeeId: ${this.employeeId}, month: ${this.month}, year: ${this.year}`
    );
    try {
      const webEnv = isWebEnvironment();
      console.log(`[ShortModel DEBUG] isWebEnvironment() returned: ${webEnv}`);

      // Web mode - use Firestore
      if (webEnv) {
        console.log("[ShortModel DEBUG] Attempting to load from Firestore.");
        const companyName = await getCompanyName();
        console.log(
          `[ShortModel DEBUG] getCompanyName() returned: ${companyName}`
        );
        if (!companyName) {
          console.error(
            "[ShortModel DEBUG] Company name is missing. Cannot load shorts from Firestore."
          );
          return []; // Or throw an error
        }
        return loadShortsFirestore(
          this.employeeId,
          this.month,
          this.year,
          companyName
        );
      }

      // Desktop mode - use existing implementation
      const jsonData = await this.readJsonFile();
      if (jsonData) {
        // Filter again by employeeId just in case (though should match meta)
        return jsonData.shorts
          .map((s) => ({ ...s, type: s.type || "Short" }))
          .filter((s) => s.employeeId === this.employeeId);
      } else {
        // Fallback to CSV
        console.warn(
          `[ShortModel] ${this.year}_${this.month}_shorts.json not found, falling back to CSV.`
        );
        try {
          // Use the old model instance for CSV reading
          const csvShorts = await this.oldModelInstance.loadShorts(
            this.employeeId
          );
          // Add default type for CSV data
          return csvShorts.map((s) => ({
            ...s,
            type: "Short" as "Short" | "Withdrawal",
          }));
        } catch (csvError) {
          console.error(
            `[ShortModel] Error loading from CSV fallback (${this.year}-${this.month}):`,
            csvError
          );
          return []; // Return empty on fallback error
        }
      }
    } catch (error) {
      console.error("[ShortModel] Error loading shorts:", error);
      throw new Error(`Failed to load shorts: ${(error as any).message}`);
    }
  }

  // Helper method to search for a short across all months
  private async findShortAcrossMonths(id: string): Promise<{ found: boolean; year?: number; month?: number }> {
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];
    
    for (const year of yearsToCheck) {
      for (let month = 1; month <= 12; month++) {
        try {
          const jsonFilePath = path.join(
            this.folderPath,
            `${year}_${month}_shorts.json`
          );
          
          const fileExists = await window.electron.fileExists(jsonFilePath);
          if (!fileExists) continue;
          
          const content = await window.electron.readFile(jsonFilePath);
          if (!content || content.trim() === "") continue;
          
          const data = JSON.parse(content) as ShortsJsonStructure;
          const shortFound = data.shorts.some(s => s.id === id);
          
          if (shortFound) {
            return { found: true, year, month };
          }
        } catch (error) {
          // Continue searching other months if this one fails
          continue;
        }
      }
    }
    
    return { found: false };
  }

  async deleteShort(id: string): Promise<void> {
    try {
      // Web mode - use Firestore
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        await deleteShortFirestore(
          id,
          this.employeeId,
          this.month,
          this.year,
          companyName
        );
        return;
      }

      // Desktop mode - use existing implementation
      // First try the current month's JSON file
      const jsonData = await this.readJsonFile();
      let deleted = false;

      if (jsonData) {
        const initialLength = jsonData.shorts.length;
        jsonData.shorts = jsonData.shorts.filter((s) => s.id !== id);
        if (jsonData.shorts.length < initialLength) {
          await this.writeJsonFile(jsonData);
          deleted = true;
          console.log(`[ShortModel] Deleted short ${id} from JSON (${this.year}-${this.month}).`);
        }
      }

      // If not found in current month's JSON, search across all months
      if (!deleted) {
        console.log(`[ShortModel] Short ${id} not found in current month (${this.year}-${this.month}), searching across all months...`);
        
        const searchResult = await this.findShortAcrossMonths(id);
        
        if (searchResult.found && searchResult.year && searchResult.month) {
          console.log(`[ShortModel] Found short ${id} in ${searchResult.year}-${searchResult.month}, attempting deletion...`);
          
          // Create a temporary model instance for the found month/year
          const tempModel = new ShortModel(this.dbPath, this.employeeId, searchResult.month, searchResult.year);
          const tempJsonData = await tempModel.readJsonFile();
          
          if (tempJsonData) {
            const initialLength = tempJsonData.shorts.length;
            tempJsonData.shorts = tempJsonData.shorts.filter((s) => s.id !== id);
            if (tempJsonData.shorts.length < initialLength) {
              await tempModel.writeJsonFile(tempJsonData);
              deleted = true;
              console.log(`[ShortModel] Deleted short ${id} from JSON (${searchResult.year}-${searchResult.month}).`);
            }
          }
        }
      }

      // Fallback to CSV search across all months if still not found
      if (!deleted) {
        console.warn(
          `[ShortModel] Short ${id} not found in any JSON files, attempting CSV fallback delete across months.`
        );
        
        const currentYear = new Date().getFullYear();
        const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];
        
        for (const year of yearsToCheck) {
          for (let month = 1; month <= 12; month++) {
            try {
              const tempOldModel = new OldShortModel(
                this.folderPath,
                this.employeeId,
                month,
                year
              );
              
              await tempOldModel.deleteShort(id);
              console.log(`[ShortModel] Deleted short ${id} from CSV (${year}-${month}).`);
              deleted = true;
              break;
            } catch (csvError: any) {
              // Check if it's a file not found error
              if (csvError.code === "ENOENT" || csvError.message?.includes("ENOENT") || csvError.message?.includes("no such file")) {
                continue; // File doesn't exist for this month, try next
              } else {
                // Some other error, continue to next month but log it
                console.error(`[ShortModel] Error trying to delete from CSV (${year}-${month}):`, csvError);
                continue;
              }
            }
          }
          if (deleted) break;
        }
        
        if (!deleted) {
          console.log(`[ShortModel] Short ${id} not found in any CSV files either, considering it already deleted`);
          return; // Short not found anywhere, consider it already deleted
        }
      }

      if (!deleted) {
        console.warn(
          `[ShortModel] Short with id ${id} not found for deletion in any JSON or CSV files.`
        );
      }
    } catch (error) {
      console.error("[ShortModel] Error deleting short:", error);
      throw error;
    }
  }

  // --- Migration Function --- //

  static async migrateCsvToJson(
    dbPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
    // Skip migration in web mode since it's only relevant for desktop operation
    if (isWebEnvironment()) {
      onProgress?.("Skipping Shorts migration in web mode.");
      return;
    }

    const baseShortsPath = path.join(dbPath, "SweldoDB", "shorts");
    onProgress?.("Starting Shorts CSV to JSON migration...");

    try {
      const employeeDirs = await window.electron.readDir(baseShortsPath);

      for (const dirEntry of employeeDirs) {
        if (dirEntry.isDirectory) {
          const employeeId = dirEntry.name;
          const employeePath = path.join(baseShortsPath, employeeId);
          onProgress?.(`- Processing employee: ${employeeId}`);

          try {
            const filesInEmployeeDir = await window.electron.readDir(
              employeePath
            );
            const csvFiles = filesInEmployeeDir.filter(
              (f: { name: string; isFile: boolean }) =>
                f.isFile && f.name.endsWith("_shorts.csv")
            );

            if (csvFiles.length === 0) {
              onProgress?.(`  - No shorts CSV files found.`);
              continue;
            }

            for (const fileEntry of csvFiles) {
              const csvFileName = fileEntry.name;
              const csvFilePath = path.join(employeePath, csvFileName);
              const jsonFilePath = csvFilePath.replace(".csv", ".json");

              onProgress?.(`  - Processing ${csvFileName}...`);

              try {
                // Skip if JSON already exists
                if (await window.electron.fileExists(jsonFilePath)) {
                  onProgress?.(`    - JSON file already exists, skipping.`);
                  continue;
                }

                const match = csvFileName.match(/(\d+)_(\d+)_shorts\.csv/);
                if (!match) {
                  onProgress?.(
                    `    - Skipping invalid filename format: ${csvFileName}`
                  );
                  continue;
                }
                const year = parseInt(match[1]);
                const month = parseInt(match[2]);

                // Instantiate old model pointed at the specific CSV file's directory
                const oldModel = new OldShortModel(
                  employeePath,
                  employeeId,
                  month,
                  year
                );
                const shortsFromCsv = await oldModel.loadShorts(employeeId);

                if (shortsFromCsv.length === 0) {
                  onProgress?.(
                    `    - CSV file is empty or failed to parse, skipping.`
                  );
                  continue;
                }

                const jsonData: ShortsJsonStructure = {
                  meta: {
                    employeeId,
                    year,
                    month,
                    lastModified: new Date().toISOString(),
                  },
                  shorts: shortsFromCsv.map((s) => ({
                    ...s,
                    type: "Short" as "Short" | "Withdrawal",
                  })), // Add default type
                };

                // Use the new model's static helpers (or instance method via prototype) to write
                const currentModelInstance = new ShortModel(
                  dbPath,
                  employeeId,
                  month,
                  year
                );
                await currentModelInstance.writeJsonFile(jsonData);
                onProgress?.(
                  `    - Successfully converted ${csvFileName} to JSON.`
                );
              } catch (fileError) {
                const message =
                  fileError instanceof Error
                    ? fileError.message
                    : String(fileError);
                onProgress?.(
                  `    - Error processing ${csvFileName}: ${message}`
                );
                console.error(`Error migrating ${csvFileName}:`, fileError);
              }
            }
          } catch (dirError) {
            const message =
              dirError instanceof Error ? dirError.message : String(dirError);
            onProgress?.(
              `  - Error reading directory ${employeePath}: ${message}`
            );
          }
        }
      }

      // After successful migration, delete CSV files
      onProgress?.("Starting cleanup of shorts CSV files...");
      await deleteCsvFiles(baseShortsPath, "shorts", onProgress);

      onProgress?.("Shorts migration finished.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(`Shorts migration failed: ${message}`);
      console.error("Shorts Migration Error:", error);
      throw new Error(`Shorts migration failed: ${message}`);
    }
  }
}

// Factory function (adjusted to pass base dbPath)
export const createShortModel = (
  dbPath: string, // Expects the main DB path
  employeeId: string,
  month?: number,
  year?: number
): ShortModel => {
  // The constructor now handles joining the paths correctly
  return new ShortModel(dbPath, employeeId, month, year);
};

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
