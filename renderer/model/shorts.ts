import path from "path";
import { Short as OldShort, ShortModel as OldShortModel } from "./shorts_old"; // Import old implementation

// --- Interfaces --- //

// Keep original Short interface
export interface Short extends OldShort {}

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
  private jsonFilePath: string;
  private employeeId: string;
  private month: number;
  private year: number;
  private folderPath: string; // Base folder path for the employee
  private oldModelInstance: OldShortModel; // Instance for fallback

  constructor(
    dbPath: string,
    employeeId: string,
    month?: number,
    year?: number
  ) {
    // Note: The dbPath passed to this constructor should be the *base* DB path,
    // not the employee-specific shorts path like in the old model.
    const baseShortsPath = path.join(dbPath, "SweldoDB", "shorts");
    this.folderPath = path.join(baseShortsPath, employeeId);
    this.employeeId = employeeId;
    this.month = month || new Date().getMonth() + 1;
    this.year = year || new Date().getFullYear();
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
    try {
      const jsonData = await this.readJsonFile();
      if (jsonData) {
        // Filter again by employeeId just in case (though should match meta)
        return jsonData.shorts.filter((s) => s.employeeId === this.employeeId);
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
          return csvShorts;
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

  async deleteShort(id: string): Promise<void> {
    try {
      const jsonData = await this.readJsonFile();
      let deleted = false;

      if (jsonData) {
        const initialLength = jsonData.shorts.length;
        jsonData.shorts = jsonData.shorts.filter((s) => s.id !== id);
        if (jsonData.shorts.length < initialLength) {
          await this.writeJsonFile(jsonData);
          deleted = true;
          console.log(`[ShortModel] Deleted short ${id} from JSON.`);
        }
      }

      // Fallback to CSV ONLY if not found/deleted in JSON
      if (!deleted) {
        console.warn(
          `[ShortModel] Short ${id} not found in JSON (${this.year}-${this.month}), attempting CSV fallback delete.`
        );
        try {
          await this.oldModelInstance.deleteShort(id);
          console.log(`[ShortModel] Deleted short ${id} from CSV (fallback).`);
          deleted = true; // Mark as deleted even if via fallback
        } catch (csvError) {
          console.error(
            `[ShortModel] Error during fallback CSV delete for ${id}:`,
            csvError
          );
          // If JSON existed but didn't contain ID, and CSV delete failed, maybe throw?
          if (jsonData) {
            throw new Error(
              `Short ${id} not found in JSON and CSV delete failed: ${
                (csvError as Error).message
              }`
            );
          }
          // If JSON didn't exist and CSV delete failed, throw original error?
          throw new Error(`Short ${id} not found in JSON or CSV.`);
        }
      }

      if (!deleted) {
        // This should only happen if JSON exists, but ID not found, AND CSV fallback failed
        console.warn(
          `[ShortModel] Short with id ${id} not found for deletion in either JSON or CSV.`
        );
        // Optionally throw new Error(`Short with id ${id} not found for deletion.`);
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
                  shorts: shortsFromCsv,
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
