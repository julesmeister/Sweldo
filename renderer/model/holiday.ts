import fs from "fs";
import path from "path";
import {
  loadHolidaysFirestore,
  createHolidayFirestore,
  saveOrUpdateHolidayFirestore,
  deleteHolidayFirestore,
  saveHolidaysFirestore,
} from "./holiday_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

export interface Holiday {
  id: string;
  startDate: Date;
  endDate: Date;
  name: string;
  type: "Regular" | "Special";
  multiplier: number;
}

// New JSON structure interfaces
interface HolidayJsonData {
  meta: {
    year: number;
    month: number;
    lastModified: string;
  };
  holidays: {
    [id: string]: {
      startDate: string;
      endDate: string;
      name: string;
      type: "Regular" | "Special";
      multiplier: number;
    };
  };
}

export class HolidayModel {
  private basePath: string;
  private year: number;
  private month: number;
  private useJsonFormat: boolean = true; // Default to JSON format

  constructor(dbPath: string, year: number, month: number) {
    this.basePath = path.join(dbPath, "SweldoDB/holidays");
    this.year = year;
    this.month = month;

    // Ensure directory exists
    this.initializeModel();
  }

  /**
   * Set whether to use JSON format (true) or CSV format (false)
   * Useful during the transition period
   */
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  private getCsvFilePath(): string {
    return `${this.basePath}/${this.year}_${this.month}_holidays.csv`;
  }

  private getJsonFilePath(): string {
    return `${this.basePath}/${this.year}_${this.month}_holidays.json`;
  }

  /**
   * Check if a JSON version of the file exists
   */
  private async jsonFileExists(): Promise<boolean> {
    const jsonFilePath = this.getJsonFilePath();
    return await window.electron.fileExists(jsonFilePath);
  }

  /**
   * Check if a CSV version of the file exists
   */
  private async csvFileExists(): Promise<boolean> {
    const csvFilePath = this.getCsvFilePath();
    return await window.electron.fileExists(csvFilePath);
  }

  private async initializeModel() {
    try {
      // Skip initialization in web mode
      if (isWebEnvironment()) {
        return;
      }

      await window.electron.ensureDir(this.basePath);
    } catch (error) {
      console.error(`Error creating holiday directory:`, error);
    }
  }

  async createHoliday(holiday: Holiday): Promise<void> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      await createHolidayFirestore(holiday, this.year, this.month, companyName);
      return;
    }

    // Desktop mode - use existing implementation
    if (this.useJsonFormat) {
      await this.createHolidayJson(holiday);
    } else {
      await this.createHolidayCsv(holiday);
    }
  }

  private async createHolidayCsv(holiday: Holiday): Promise<void> {
    const filePath = this.getCsvFilePath();
    const csvData = `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}\n`;
    await window.electron.writeFile(filePath, csvData);
  }

  private async createHolidayJson(holiday: Holiday): Promise<void> {
    const filePath = this.getJsonFilePath();

    // Create or load existing JSON data
    let jsonData: HolidayJsonData = {
      meta: {
        year: this.year,
        month: this.month,
        lastModified: new Date().toISOString(),
      },
      holidays: {},
    };

    // Check if file exists
    const exists = await window.electron.fileExists(filePath);
    if (exists) {
      try {
        const content = await window.electron.readFile(filePath);
        jsonData = JSON.parse(content);
      } catch (error) {
        console.error("Error reading JSON holiday file:", error);
      }
    }

    // Add or update holiday
    jsonData.meta.lastModified = new Date().toISOString();
    jsonData.holidays[holiday.id] = {
      startDate: holiday.startDate.toISOString(),
      endDate: holiday.endDate.toISOString(),
      name: holiday.name,
      type: holiday.type,
      multiplier: holiday.multiplier,
    };

    // Write back to file
    await window.electron.writeFile(
      filePath,
      JSON.stringify(jsonData, null, 2)
    );
  }

  async saveOrUpdateHoliday(holiday: Holiday): Promise<void> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      await saveOrUpdateHolidayFirestore(
        holiday,
        this.year,
        this.month,
        companyName
      );
      return;
    }

    // Desktop mode - use existing implementation
    if (this.useJsonFormat) {
      await this.createHolidayJson(holiday); // Same implementation works for both create and update
    } else {
      await this.saveOrUpdateHolidayCsv(holiday);
    }
  }

  private async saveOrUpdateHolidayCsv(holiday: Holiday): Promise<void> {
    try {
      const filePath = this.getCsvFilePath();

      const formatHolidayToCSV = (h: Holiday) => {
        return `${
          h.id
        },${h.startDate.toISOString()},${h.endDate.toISOString()},${h.name},${
          h.type
        },${h.multiplier}`;
      };

      let data;
      try {
        await window.electron.ensureDir(path.dirname(filePath));
        data = await window.electron.readFile(filePath);
      } catch (readError: any) {
        // If file doesn't exist, create it
        if (readError.message.includes("ENOENT")) {
          const csvData = formatHolidayToCSV(holiday) + "\n";
          await window.electron.writeFile(filePath, csvData);
          return; // Exit after creating new file
        }
        // If it's a different error, rethrow it
        throw readError;
      }

      // If we get here, we successfully read the existing file
      const lines = data.split("\n").filter((line) => line.trim().length > 0);
      let holidayExists = false;

      const updatedLines = lines.map((line) => {
        const fields = line.split(",");
        if (fields[0] === holiday.id) {
          holidayExists = true;
          return formatHolidayToCSV(holiday);
        }
        return line;
      });

      if (!holidayExists) {
        updatedLines.push(formatHolidayToCSV(holiday));
      }

      await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
    } catch (error) {
      console.error("[HolidayModel] Error in saveOrUpdateHoliday:", error);
      throw error;
    }
  }

  async loadHolidays(): Promise<Holiday[]> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      try {
        const firestoreHolidays = await loadHolidaysFirestore(
          this.year,
          this.month,
          companyName
        );
        return firestoreHolidays;
      } catch (error) {
        console.error(
          "[holiday.ts] HolidayModel.loadHolidays: ERROR loading from Firestore.",
          error
        );
        throw error;
      }
    }

    // First try JSON format if that's preferred
    if (this.useJsonFormat) {
      const jsonExists = await this.jsonFileExists();
      if (jsonExists) {
        try {
          const jsonHolidays = await this.loadHolidaysFromJson();
          return jsonHolidays;
        } catch (error) {
          console.error(
            "[holiday.ts] HolidayModel.loadHolidays: ERROR loading from JSON. Falling back to CSV if it exists.",
            error
          );
          // Fall through to CSV if JSON loading fails, but only if CSV exists or JSON wasn't preferred initially
          const csvExists = await this.csvFileExists();
          if (csvExists) {
            try {
              const csvHolidays = await this.loadHolidaysFromCsv();
              return csvHolidays;
            } catch (csvError) {
              console.error(
                "[holiday.ts] HolidayModel.loadHolidays: ERROR loading fallback CSV.",
                csvError
              );
              throw csvError; // Or handle as appropriate, maybe return empty array
            }
          } else {
            throw error; // Re-throw original JSON error if no CSV fallback
          }
        }
      }
    }

    try {
      const csvHolidays = await this.loadHolidaysFromCsv();
      return csvHolidays;
    } catch (error) {
      console.error(
        "[holiday.ts] HolidayModel.loadHolidays: ERROR loading from CSV.",
        error
      );
      // If JSON was preferred and didn't exist, and CSV also fails, we might have an issue.
      if (this.useJsonFormat) {
      }
      throw error;
    }
  }

  private async loadHolidaysFromCsv(): Promise<Holiday[]> {
    try {
      const filePath = this.getCsvFilePath();

      try {
        // Ensure directory exists before trying to read file
        await window.electron.ensureDir(path.dirname(filePath));
        const exists = await window.electron.fileExists(filePath);
        if (!exists) {
          await window.electron.writeFile(filePath, "");
          return [];
        }
        const data = await window.electron.readFile(filePath);
        const lines = data.split("\n");

        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

        const holidays = nonEmptyLines.map((line) => {
          const fields = line.split(",");

          // Parse the dates from ISO format
          const startDate = new Date(fields[1]);
          const endDate = new Date(fields[2]);

          return {
            id: fields[0],
            startDate,
            endDate,
            name: fields[3],
            type: fields[4] as "Regular" | "Special",
            multiplier: parseFloat(fields[5]),
          } as Holiday;
        });
        return holidays;
      } catch (error: any) {
        console.error(
          "[holiday.ts] HolidayModel.loadHolidaysFromCsv: ERROR during file operations or parsing.",
          error
        );
        if (
          error.code === "ENOENT" ||
          (error instanceof Error && error.message.includes("ENOENT"))
        ) {
          // Create empty file if it doesn't exist
          await window.electron.writeFile(filePath, "");
          return [];
        }
        throw error;
      }
    } catch (error) {
      console.error(
        "[holiday.ts] HolidayModel.loadHolidaysFromCsv: FATAL ERROR.",
        error
      );
      throw error;
    }
  }

  private async loadHolidaysFromJson(): Promise<Holiday[]> {
    try {
      const filePath = this.getJsonFilePath();

      // Ensure directory exists
      await window.electron.ensureDir(path.dirname(filePath));

      // Check if file exists
      const exists = await window.electron.fileExists(filePath);
      if (!exists) {
        // Create empty JSON structure if file doesn't exist
        const emptyData: HolidayJsonData = {
          meta: {
            year: this.year,
            month: this.month,
            lastModified: new Date().toISOString(),
          },
          holidays: {},
        };
        await window.electron.writeFile(
          filePath,
          JSON.stringify(emptyData, null, 2)
        );
        return [];
      }

      // Read and parse JSON
      const data = await window.electron.readFile(filePath);
      const jsonData: HolidayJsonData = JSON.parse(data);

      // Convert to Holiday array
      const holidays: Holiday[] = Object.entries(jsonData.holidays).map(
        ([id, holiday]) => ({
          id,
          startDate: new Date(holiday.startDate),
          endDate: new Date(holiday.endDate),
          name: holiday.name,
          type: holiday.type,
          multiplier: holiday.multiplier,
        })
      );
      return holidays;
    } catch (error) {
      console.error(
        "[holiday.ts] HolidayModel.loadHolidaysFromJson: ERROR.",
        error
      );
      throw error;
    }
  }

  async deleteHoliday(id: string): Promise<void> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      await deleteHolidayFirestore(id, this.year, this.month, companyName);
      return;
    }

    // Desktop mode - use existing implementation
    if (this.useJsonFormat) {
      await this.deleteHolidayJson(id);
    } else {
      await this.deleteHolidayCsv(id);
    }
  }

  private async deleteHolidayCsv(id: string): Promise<void> {
    try {
      const filePath = this.getCsvFilePath();
      const data = await window.electron.readFile(filePath);
      const lines = data.split("\n");
      const updatedLines = lines.filter((line) => line.split(",")[0] !== id);
      await window.electron.writeFile(filePath, updatedLines.join("\n"));
    } catch (error) {
      console.error("Error deleting holiday from CSV:", error);
      throw error;
    }
  }

  private async deleteHolidayJson(id: string): Promise<void> {
    try {
      const filePath = this.getJsonFilePath();

      // Check if file exists
      const exists = await window.electron.fileExists(filePath);
      if (!exists) return; // Nothing to delete

      // Load and parse JSON
      const data = await window.electron.readFile(filePath);
      const jsonData: HolidayJsonData = JSON.parse(data);

      // Remove the holiday
      if (jsonData.holidays[id]) {
        delete jsonData.holidays[id];
        jsonData.meta.lastModified = new Date().toISOString();

        // Write updated data back to file
        await window.electron.writeFile(
          filePath,
          JSON.stringify(jsonData, null, 2)
        );
      }
    } catch (error) {
      console.error("Error deleting holiday from JSON:", error);
      throw error;
    }
  }

  async saveHolidays(holidays: Holiday[]): Promise<void> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      await saveHolidaysFirestore(holidays, this.year, this.month, companyName);
      return;
    }

    // Desktop mode - use existing implementation
    if (this.useJsonFormat) {
      await this.saveHolidaysJson(holidays);
    } else {
      await this.saveHolidaysCsv(holidays);
    }
  }

  private async saveHolidaysCsv(holidays: Holiday[]): Promise<void> {
    const filePath = this.getCsvFilePath();
    const csvData = holidays
      .map(
        (holiday) =>
          `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}`
      )
      .join("\n");
    await window.electron.writeFile(filePath, csvData);
  }

  private async saveHolidaysJson(holidays: Holiday[]): Promise<void> {
    const filePath = this.getJsonFilePath();

    // Create JSON structure
    const jsonData: HolidayJsonData = {
      meta: {
        year: this.year,
        month: this.month,
        lastModified: new Date().toISOString(),
      },
      holidays: {},
    };

    // Populate holidays
    holidays.forEach((holiday) => {
      jsonData.holidays[holiday.id] = {
        startDate: holiday.startDate.toISOString(),
        endDate: holiday.endDate.toISOString(),
        name: holiday.name,
        type: holiday.type,
        multiplier: holiday.multiplier,
      };
    });

    // Write to file
    await window.electron.writeFile(
      filePath,
      JSON.stringify(jsonData, null, 2)
    );
  }

  async loadAllHolidaysForSync(): Promise<Holiday[]> {
    if (isWebEnvironment()) {
      console.warn(
        "[holiday.ts] HolidayModel.loadAllHolidaysForSync: Should not be called in web environment. Returning empty array."
      );
      return []; // This method is for local data reading for sync TO Firestore
    }

    const allHolidays: Holiday[] = [];
    try {
      const files = await window.electron.readDir(this.basePath);

      const holidayJsonFiles = files.filter(
        (file: { name: string; isFile: boolean }) =>
          file.isFile && file.name.endsWith("_holidays.json")
      );
      const holidayCsvFiles = files.filter(
        (file: { name: string; isFile: boolean }) =>
          file.isFile && file.name.endsWith("_holidays.csv")
      );

      // Process JSON files first
      for (const jsonFile of holidayJsonFiles) {
        const filePath = path.join(this.basePath, jsonFile.name);
        try {
          const fileContent = await window.electron.readFile(filePath);
          if (!fileContent.trim()) {
            continue;
          }
          const jsonData: HolidayJsonData = JSON.parse(fileContent);
          const holidaysFromFile: Holiday[] = Object.entries(jsonData.holidays)
            .map(([id, holidayData]) => {
              const startDate = new Date(holidayData.startDate);
              const endDate = new Date(holidayData.endDate);

              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.warn(
                  `[holiday.ts] loadAllHolidaysForSync: Invalid startDate or endDate detected for id ${id} in ${jsonFile.name}. Raw startDate: '${holidayData.startDate}', Raw endDate: '${holidayData.endDate}'. Skipping this holiday entry.`
                );
                return null; // Mark as null to filter out later
              }
              return {
                id,
                startDate,
                endDate,
                name: holidayData.name,
                type: holidayData.type,
                multiplier: holidayData.multiplier,
              };
            })
            .filter((holiday) => holiday !== null) as Holiday[]; // Filter out the null (invalid) entries

          allHolidays.push(...holidaysFromFile);
        } catch (error) {
          console.error(
            `[holiday.ts] HolidayModel.loadAllHolidaysForSync: ERROR processing JSON file ${jsonFile.name}.`,
            error
          );
        }
      }

      // Process CSV files, potentially skipping if a JSON version for the same Y/M was already processed
      // For simplicity now, we'll just load all CSVs. The sync logic in holiday_firestore groups them by Y/M anyway.
      for (const csvFile of holidayCsvFiles) {
        const filePath = path.join(this.basePath, csvFile.name);
     
        try {
          const fileContent = await window.electron.readFile(filePath);
          if (!fileContent.trim()) {
            continue;
          }
          const lines = fileContent
            .split("\n")
            .filter((line) => line.trim().length > 0);
          const holidaysFromFile = lines.map((line) => {
            const fields = line.split(",");
            return {
              id: fields[0],
              startDate: new Date(fields[1]),
              endDate: new Date(fields[2]),
              name: fields[3],
              type: fields[4] as "Regular" | "Special",
              multiplier: parseFloat(fields[5]),
            } as Holiday;
          });
          allHolidays.push(...holidaysFromFile);
        } catch (error) {
          console.error(
            `[holiday.ts] HolidayModel.loadAllHolidaysForSync: ERROR processing CSV file ${csvFile.name}.`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "[holiday.ts] HolidayModel.loadAllHolidaysForSync: ERROR reading directory or processing files.",
        error
      );
      // Decide if we should throw or return what we have. For sync, maybe return what we have so partial sync can occur?
      // For now, rethrow, as this implies a bigger issue if we can't even list files.
      throw error;
    }
    return allHolidays;
  }
}

export const createHolidayModel = (
  dbPath: string,
  year: number,
  month: number
): HolidayModel => {
  return new HolidayModel(dbPath, year, month);
};

/**
 * Migrates holiday data from CSV format to JSON format
 * @param dbPath The base path to the SweldoDB directory
 * @param onProgress Optional callback to report progress
 */
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // Skip migration in web mode
  if (isWebEnvironment()) {
    onProgress?.("Migration not needed in web mode.");
    return;
  }

  const holidaysBasePath = `${dbPath}/SweldoDB/holidays`;

  try {
    onProgress?.(
      `Starting holiday CSV to JSON migration in: ${holidaysBasePath}`
    );

    // Ensure directory exists
    await window.electron.ensureDir(holidaysBasePath);

    // Get all CSV files in the directory
    const files = await window.electron.readDir(holidaysBasePath);
    const csvFiles = files.filter(
      (file: { isFile: boolean; name: string }) =>
        file.isFile && file.name.endsWith("_holidays.csv")
    );

    onProgress?.(`Found ${csvFiles.length} holiday CSV files to migrate`);

    // Process each CSV file
    for (let i = 0; i < csvFiles.length; i++) {
      const csvFile: { name: string; isFile: boolean } = csvFiles[i];
      try {
        onProgress?.(
          `Processing file ${i + 1}/${csvFiles.length}: ${csvFile.name}`
        );

        // Parse year and month from filename
        const match = csvFile.name.match(/(\d+)_(\d+)_holidays\.csv/);
        if (!match) {
          onProgress?.(`  - Skipping ${csvFile.name}: Invalid filename format`);
          continue;
        }

        const year = parseInt(match[1]);
        const month = parseInt(match[2]);

        // Read CSV file
        const csvPath = `${holidaysBasePath}/${csvFile.name}`;
        const csvContent = await window.electron.readFile(csvPath);
        if (!csvContent.trim()) {
          onProgress?.(`  - Skipping ${csvFile.name}: File is empty`);
          continue;
        }

        // Parse CSV data
        const lines = csvContent.split("\n").filter((line) => line.trim());

        // Create JSON structure
        const jsonData: HolidayJsonData = {
          meta: {
            year,
            month,
            lastModified: new Date().toISOString(),
          },
          holidays: {},
        };

        // Process each holiday
        for (const line of lines) {
          const fields = line.split(",");
          if (fields.length < 6) continue;

          const id = fields[0];
          jsonData.holidays[id] = {
            startDate: fields[1],
            endDate: fields[2],
            name: fields[3],
            type: fields[4] as "Regular" | "Special",
            multiplier: parseFloat(fields[5]),
          };
        }

        // Write JSON file
        const jsonPath = csvPath.replace(".csv", ".json");
        await window.electron.writeFile(
          jsonPath,
          JSON.stringify(jsonData, null, 2)
        );

        onProgress?.(`  - Successfully migrated to: ${jsonPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onProgress?.(`  - Error processing ${csvFile.name}: ${message}`);
      }
    }

    onProgress?.(`Holiday CSV to JSON migration completed successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`Migration failed: ${message}`);
    throw error;
  }
}
