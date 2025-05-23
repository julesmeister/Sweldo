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

export class HolidayModel {
  private basePath: string;
  private year: number;
  private month: number;

  constructor(dbPath: string, year: number, month: number) {
    this.basePath = path.join(dbPath, "SweldoDB/holidays");
    this.year = year;
    this.month = month;

    // Ensure directory exists
    this.initializeModel();
  }

  private getFilePath(): string {
    return `${this.basePath}/${this.year}_${this.month}_holidays.csv`;
  }

  private async initializeModel() {
    try {
      await window.electron.ensureDir(this.basePath);
    } catch (error) {
      console.error(`Error creating holiday directory:`, error);
    }
  }

  async createHoliday(holiday: Holiday): Promise<void> {
    const filePath = this.getFilePath();
    const csvData = `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}\n`;
    await window.electron.writeFile(filePath, csvData);
  }

  async saveOrUpdateHoliday(holiday: Holiday): Promise<void> {
    try {
      const filePath = this.getFilePath();

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
    try {
      const filePath = this.getFilePath();

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

  async deleteHoliday(id: string): Promise<void> {
    try {
      const filePath = this.getFilePath();
      const data = await window.electron.readFile(filePath);
      const lines = data.split("\n");
      const updatedLines = lines.filter((line) => line.split(",")[0] !== id);
      await window.electron.writeFile(filePath, updatedLines.join("\n"));
    } catch (error) {
      console.error("Error deleting holiday:", error);
      throw error;
    }
  }

  async saveHolidays(holidays: Holiday[]): Promise<void> {
    const filePath = this.getFilePath();
    const csvData = holidays
      .map(
        (holiday) =>
          `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}`
      )
      .join("\n");
    await window.electron.writeFile(filePath, csvData);
  }
}

export const createHolidayModel = (
  dbPath: string,
  year: number,
  month: number
): HolidayModel => {
  return new HolidayModel(dbPath, year, month);
};
