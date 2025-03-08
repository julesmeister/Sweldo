import fs from 'fs';
import path from 'path';

export interface Holiday {
  id: string;
  startDate: Date;
  endDate: Date;
  name: string;
  type: 'Regular' | 'Special';
  multiplier: number;
}

export class HolidayModel {
  filePath: string;
  year: number;
  month: number;
  constructor(dbPath: string, year: number, month: number) {
    this.year = year;
    this.month = month;
    // Ensure we start with an absolute path
    const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
    this.filePath = path.join(absoluteDbPath, `SweldoDB/holidays/${year.toString()}_${month.toString()}_holidays.csv`);
    console.log("Full file path:", this.filePath);
    // Ensure directory exists
    const directoryPath = path.dirname(this.filePath);
    console.log("Directory path:", directoryPath);
    // Create directories recursively
    const parts = directoryPath.split(path.sep);
    let currentPath = absoluteDbPath; // Start from absoluteDbPath instead of dbPath
    for (const part of parts) {
      if (part) {
        currentPath = path.join(currentPath, part);
        try {
          window.electron.ensureDir(currentPath);
          console.log("Created directory:", currentPath);
        } catch (error) {
          console.error(`Error creating directory ${currentPath}:`, error);
        }
      }
    }
  }

  async createHoliday(holiday: Holiday): Promise<void> {
    const csvData = `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}\n`;
    await window.electron.saveFile(this.filePath, csvData);
  }

  async saveOrUpdateHoliday(holiday: Holiday): Promise<void> {
    try {
      // Ensure directory exists before saving
      const directoryPath = path.dirname(this.filePath);
      await window.electron.ensureDir(directoryPath);

      // Check if file exists
      const exists = await window.electron.fileExists(this.filePath);
      
      if (exists) {
        // File exists, update it
        const data = await window.electron.readFile(this.filePath);
        const lines = data.split('\n');
        let holidayExists = false;
        const updatedLines = lines.map(line => {
          const fields = line.split(',');
          if (fields[0] === holiday.id) {
            holidayExists = true;
            return `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}`;
          }
          return line;
        });
        if (!holidayExists) {
          updatedLines.push(`${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}`);
        }
        await window.electron.saveFile(this.filePath, updatedLines.join('\n'));
      } else {
        // File doesn't exist, create it
        const csvData = `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}\n`;
        await window.electron.saveFile(this.filePath, csvData);
      }
    } catch (error) {
      console.error('Error updating holiday:', error);
      throw error;
    }
  }

  async loadHolidays(): Promise<Holiday[]> {
    try {
      // Ensure directory exists before loading
      const directoryPath = path.dirname(this.filePath);
      await window.electron.ensureDir(directoryPath);

      // Check if file exists
      const exists = await window.electron.fileExists(this.filePath);
      
      if (exists) {
        const data = await window.electron.readFile(this.filePath);
        const lines = data.split('\n');
        return lines.map(line => {
          const fields = line.split(',');
          return {
            id: fields[0],
            startDate: new Date(fields[1]),
            endDate: new Date(fields[2]),
            name: fields[3],
            type: fields[4],
            multiplier: parseFloat(fields[5]),
          } as Holiday;
        });
      } else {
        console.log('[HolidayModel] No holidays file found, returning empty array');
        return [];
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.log('[HolidayModel] No holidays file found, returning empty array');
        return [];
      }
      console.error('Error loading holidays:', error);
      throw error;
    }
  }

  async deleteHoliday(id: string): Promise<void> {
    try {
      const holidays = await this.loadHolidays();
      const updatedHolidays = holidays.filter(holiday => holiday.id !== id);
      await this.saveHolidays(updatedHolidays);
    } catch (error) {
      console.error('Error deleting holiday:', error);
      throw error;
    }
  }

  async saveHolidays(holidays: Holiday[]): Promise<void> {
    const csvData = holidays.map(holiday => `${holiday.id},${holiday.startDate},${holiday.endDate},${holiday.name},${holiday.type},${holiday.multiplier}`).join('\n');
    await window.electron.saveFile(this.filePath, csvData);
  }
}

export const createHolidayModel = (dbPath: string, year: number, month: number): HolidayModel => {
  return new HolidayModel(dbPath, year, month);
};
