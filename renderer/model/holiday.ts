import fs from "fs";
import path from "path";

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
      await window.electron.ensureDir(this.basePath);
    } catch (error) {
      console.error(`Error creating holiday directory:`, error);
    }
  }

  async createHoliday(holiday: Holiday): Promise<void> {
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
        console.log(
          `[HolidayModel] Ensuring directory exists at: ${path.dirname(
            filePath
          )}`
        );
        await window.electron.ensureDir(path.dirname(filePath));
        data = await window.electron.readFile(filePath);
        console.log(`[HolidayModel] Existing file found, updating content`);
      } catch (readError: any) {
        // If file doesn't exist, create it
        if (readError.message.includes("ENOENT")) {
          console.log(`[HolidayModel] File doesn't exist, creating new file`);
          const csvData = formatHolidayToCSV(holiday) + "\n";
          await window.electron.writeFile(filePath, csvData);
          console.log(
            `[HolidayModel] Successfully created new file and saved holiday`
          );
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
          console.log(`[HolidayModel] Updating existing holiday entry`);
          return formatHolidayToCSV(holiday);
        }
        return line;
      });

      if (!holidayExists) {
        console.log(`[HolidayModel] Adding new holiday entry`);
        updatedLines.push(formatHolidayToCSV(holiday));
      }

      await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
      console.log(`[HolidayModel] Successfully saved/updated holiday`);
    } catch (error) {
      console.error("[HolidayModel] Error in saveOrUpdateHoliday:", error);
      throw error;
    }
  }

  async loadHolidays(): Promise<Holiday[]> {
    // First try JSON format if that's preferred
    if (this.useJsonFormat) {
      const jsonExists = await this.jsonFileExists();
      if (jsonExists) {
        return this.loadHolidaysFromJson();
      }
    }

    // Fall back to CSV if JSON doesn't exist or is not preferred
    return this.loadHolidaysFromCsv();
  }

  private async loadHolidaysFromCsv(): Promise<Holiday[]> {
    try {
      const filePath = this.getCsvFilePath();

      try {
        // Ensure directory exists before trying to read file
        await window.electron.ensureDir(path.dirname(filePath));

        // Check if file exists
        const exists = await window.electron.fileExists(filePath);
        if (!exists) {
          // Create empty file if it doesn't exist
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
      console.error("[HolidayModel] Error loading holidays:", error);
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
      console.error("[HolidayModel] Error loading holidays from JSON:", error);
      throw error;
    }
  }

  async deleteHoliday(id: string): Promise<void> {
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
