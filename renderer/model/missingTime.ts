import {
  MissingTimeLog as OldMissingTimeLog,
  MissingTimeModel as OldMissingTimeModel,
} from "./missingTime_old";
import Papa from "papaparse";

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
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading or parsing JSON file ${filePath}:`, error);
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
    const jsonData = await this.readJsonFile(month, year);

    let logs: MissingTimeLog[] = [];
    if (jsonData) {
      logs = jsonData.logs;
    }

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

  // ----- Migration Function -----
  static async migrateCsvToJson(
    dbPath: string,
    onProgress?: (message: string) => void
  ): Promise<void> {
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
}
