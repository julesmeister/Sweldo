import fs from "fs";
import path from "path";

export interface Leave {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: "Sick" | "Vacation" | "Emergency" | "Other";
  status: "Pending" | "Approved" | "Rejected";
  reason: string;
}

// New JSON structure interfaces
interface LeaveJsonData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  leaves: {
    [id: string]: {
      employeeId: string;
      startDate: string;
      endDate: string;
      type: "Sick" | "Vacation" | "Emergency" | "Other";
      status: "Pending" | "Approved" | "Rejected";
      reason: string;
    };
  };
}

export class LeaveModel {
  private basePath: string;
  private employeeId: string;
  private useJsonFormat: boolean = true;

  constructor(dbPath: string, employeeId: string) {
    this.basePath = path.join(dbPath, "SweldoDB/leaves", employeeId);
    this.employeeId = employeeId;
  }

  // Add format toggle
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  private getFilePath(leave: Leave): string {
    return `${this.basePath}/${leave.startDate.getFullYear()}_${
      leave.startDate.getMonth() + 1
    }_leaves.csv`;
  }

  private getFilePathByMonth(year: number, month: number): string {
    return `${this.basePath}/${year}_${month}_leaves.csv`;
  }

  private getJsonFilePath(year: number, month: number): string {
    return `${this.basePath}/${year}_${month}_leaves.json`;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const employeePath = this.basePath;
      await window.electron.ensureDir(employeePath);
      console.log(`Ensured directory exists: ${employeePath}`);
    } catch (error) {
      console.error(`Failed to ensure directory exists: ${error}`);
      throw error;
    }
  }

  async createLeave(leave: Leave): Promise<void> {
    await this.saveOrUpdateLeave(leave);
  }

  async saveOrUpdateLeave(leave: Leave): Promise<void> {
    try {
      console.log(`[LeaveModel] Attempting to save/update leave`);
      console.log(`[LeaveModel] Leave data to save:`, leave);

      // Ensure directory exists before reading/writing
      await this.ensureDirectoryExists();

      const year = leave.startDate.getFullYear();
      const month = leave.startDate.getMonth() + 1;

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath(year, month);
        let jsonData: LeaveJsonData;

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          jsonData = JSON.parse(fileContent) as LeaveJsonData;
        } catch (error) {
          // Create new JSON structure if file doesn't exist
          jsonData = {
            meta: {
              employeeId: this.employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            leaves: {},
          };
        }

        // Update the leave in JSON data
        jsonData.leaves[leave.id] = {
          employeeId: leave.employeeId,
          startDate: leave.startDate.toISOString(),
          endDate: leave.endDate.toISOString(),
          type: leave.type,
          status: leave.status,
          reason: leave.reason,
        };

        // Update last modified timestamp
        jsonData.meta.lastModified = new Date().toISOString();

        // Save JSON file
        await window.electron.writeFile(
          jsonPath,
          JSON.stringify(jsonData, null, 2)
        );
        console.log(`[LeaveModel] Successfully saved/updated leave to JSON`);
        return;
      }

      // CSV implementation (original code)
      const filePath = this.getFilePath(leave);
      const formatLeaveToCSV = (l: Leave) => {
        return `${l.id},${
          l.employeeId
        },${l.startDate.toISOString()},${l.endDate.toISOString()},${l.type},${
          l.status
        },${l.reason}`;
      };

      try {
        const data = await window.electron.readFile(filePath);
        console.log(`[LeaveModel] Existing file found, updating content`);
        const lines = data.split("\n").filter((line) => line.trim().length > 0);
        let leaveExists = false;

        const updatedLines = lines.map((line) => {
          const fields = line.split(",");
          if (fields[0] === leave.id) {
            leaveExists = true;
            console.log(`[LeaveModel] Updating existing leave entry`);
            return formatLeaveToCSV(leave);
          }
          return line;
        });

        if (!leaveExists) {
          console.log(`[LeaveModel] Adding new leave entry`);
          updatedLines.push(formatLeaveToCSV(leave));
        }

        await window.electron.writeFile(
          filePath,
          updatedLines.join("\n") + "\n"
        );
        console.log(`[LeaveModel] Successfully saved/updated leave`);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          console.log(`[LeaveModel] Creating new file for leave entry`);
          const csvData = formatLeaveToCSV(leave) + "\n";
          await window.electron.writeFile(filePath, csvData);
          console.log(
            `[LeaveModel] Successfully created new file and saved leave`
          );
        } else {
          console.error("[LeaveModel] Error saving/updating leave:", error);
          throw error;
        }
      }
    } catch (error) {
      console.error("[LeaveModel] Error in saveOrUpdateLeave:", error);
      throw error;
    }
  }

  async loadLeaves(
    employeeId: string,
    year: number,
    month: number
  ): Promise<Leave[]> {
    try {
      console.log(`[LeaveModel] Loading leaves for ${year}-${month}`);

      // Ensure directory exists
      await this.ensureDirectoryExists();

      if (this.useJsonFormat) {
        // Try to load from JSON first
        const jsonPath = this.getJsonFilePath(year, month);

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as LeaveJsonData;

          // Convert JSON data to Leave objects
          const leaves: Leave[] = Object.keys(jsonData.leaves).map((id) => {
            const leaveData = jsonData.leaves[id];
            return {
              id,
              employeeId: leaveData.employeeId,
              startDate: new Date(leaveData.startDate),
              endDate: new Date(leaveData.endDate),
              type: leaveData.type,
              status: leaveData.status,
              reason: leaveData.reason,
            };
          });

          console.log(
            `[LeaveModel] Successfully loaded ${leaves.length} leaves from JSON`
          );
          return leaves;
        } catch (error: any) {
          if (error.code === "ENOENT" || error instanceof SyntaxError) {
            console.log(
              `[LeaveModel] No JSON file found or invalid JSON. Trying CSV.`
            );
            // Fall through to CSV loading
          } else {
            throw error;
          }
        }
      }

      // Load from CSV (original implementation)
      const filePath = this.getFilePathByMonth(year, month);
      console.log(`[LeaveModel] Loading leaves from CSV:`, filePath);

      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split("\n");

        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

        const leaves = nonEmptyLines.map((line) => {
          const fields = line.split(",");

          // Parse the dates from ISO format
          const startDate = new Date(fields[2]);
          const endDate = new Date(fields[3]);

          // Validate leave type
          let leaveType = fields[4] as
            | "Sick"
            | "Vacation"
            | "Emergency"
            | "Other";
          if (!["Sick", "Vacation", "Emergency", "Other"].includes(leaveType)) {
            console.warn(
              `[LeaveModel] Invalid leave type "${leaveType}" found, defaulting to "Other"`
            );
            leaveType = "Other";
          }

          return {
            id: fields[0],
            employeeId: fields[1],
            startDate,
            endDate,
            type: leaveType,
            status: fields[5],
            reason: fields[6],
          } as Leave;
        });

        // Filter leaves by employeeId
        const filteredLeaves = leaves;

        return filteredLeaves;
      } catch (error: any) {
        if (
          error.code === "ENOENT" ||
          (error instanceof Error && error.message.includes("ENOENT"))
        ) {
          console.log(
            `[LeaveModel] No leaves file found for ${year}-${month}, returning empty array`
          );
          return [];
        }
        throw error;
      }
    } catch (error) {
      console.error("[LeaveModel] Error loading leaves:", error);
      throw error;
    }
  }

  async deleteLeave(id: string, leave: Leave): Promise<void> {
    try {
      const year = leave.startDate.getFullYear();
      const month = leave.startDate.getMonth() + 1;

      if (this.useJsonFormat) {
        // Delete from JSON
        const jsonPath = this.getJsonFilePath(year, month);

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as LeaveJsonData;

          // Remove the leave with the given ID
          if (jsonData.leaves[id]) {
            delete jsonData.leaves[id];
            jsonData.meta.lastModified = new Date().toISOString();

            // Write back the updated data
            await window.electron.writeFile(
              jsonPath,
              JSON.stringify(jsonData, null, 2)
            );
            console.log(`[LeaveModel] Successfully deleted leave from JSON`);
          }
          return;
        } catch (error: any) {
          if (error.code === "ENOENT") {
            console.log(`[LeaveModel] No JSON file found for ${year}-${month}`);
            // Fall through to CSV deletion
          } else {
            throw error;
          }
        }
      }

      // Delete from CSV (original implementation)
      const filePath = this.getFilePath(leave);
      const data = await window.electron.readFile(filePath);
      const lines = data.split("\n");
      const updatedLines = lines.filter((line) => line.split(",")[0] !== id);
      await window.electron.writeFile(filePath, updatedLines.join("\n"));
      console.log(`[LeaveModel] Successfully deleted leave from CSV`);
    } catch (error) {
      console.error("[LeaveModel] Error deleting leave:", error);
      throw error;
    }
  }
}

/**
 * Migrates leave data from CSV format to JSON format
 */
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    onProgress?.("Starting leave CSV to JSON migration...");

    // Get employee folders
    const leavesBasePath = path.join(dbPath, "SweldoDB/leaves");

    try {
      await window.electron.ensureDir(leavesBasePath);
    } catch (error) {
      onProgress?.(`Error ensuring leaves directory exists: ${error}`);
      throw error;
    }

    // Get all employee folders
    const employees = await window.electron.readDir(leavesBasePath);
    const employeeFolders = employees.filter(
      (item: { isDirectory: boolean; name: string }) => item.isDirectory
    );

    onProgress?.(`Found ${employeeFolders.length} employee folders to process`);

    // Process each employee folder
    for (let i = 0; i < employeeFolders.length; i++) {
      const employeeFolder = employeeFolders[i];
      const employeeId = employeeFolder.name;
      onProgress?.(
        `Processing employee ${employeeId} (${i + 1}/${employeeFolders.length})`
      );

      const employeePath = path.join(leavesBasePath, employeeId);

      // Get all CSV files in the employee folder
      const files = await window.electron.readDir(employeePath);
      const csvFiles = files.filter(
        (file: { isFile: boolean; name: string }) =>
          file.isFile && file.name.endsWith("_leaves.csv")
      );

      onProgress?.(
        `  Found ${csvFiles.length} leave CSV files for employee ${employeeId}`
      );

      // Process each CSV file
      for (let j = 0; j < csvFiles.length; j++) {
        const csvFile = csvFiles[j];
        const csvFilePath = path.join(employeePath, csvFile.name);

        try {
          // Extract year and month from filename
          const [year, month] = csvFile.name
            .replace("_leaves.csv", "")
            .split("_")
            .map(Number);

          onProgress?.(`    Processing ${year}-${month} leaves`);

          // Read the CSV file
          const csvContent = await window.electron.readFile(csvFilePath);
          const lines = csvContent.split("\n").filter((line) => line.trim());

          if (lines.length === 0) {
            onProgress?.(`    - Skipping empty file: ${csvFile.name}`);
            continue;
          }

          // Create JSON structure
          const jsonData: LeaveJsonData = {
            meta: {
              employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            leaves: {},
          };

          // Process each line/leave record
          for (const line of lines) {
            const fields = line.split(",");
            if (fields.length < 7) continue; // Skip invalid lines

            const id = fields[0];
            jsonData.leaves[id] = {
              employeeId: fields[1],
              startDate: fields[2], // ISO string
              endDate: fields[3], // ISO string
              type: fields[4] as "Sick" | "Vacation" | "Emergency" | "Other",
              status: fields[5] as "Pending" | "Approved" | "Rejected",
              reason: fields[6],
            };
          }

          // Write JSON file
          const jsonFilePath = path.join(
            employeePath,
            `${year}_${month}_leaves.json`
          );

          await window.electron.writeFile(
            jsonFilePath,
            JSON.stringify(jsonData, null, 2)
          );

          onProgress?.(
            `    - Successfully migrated ${
              Object.keys(jsonData.leaves).length
            } leave records to JSON`
          );
        } catch (error) {
          onProgress?.(`    - Error processing file ${csvFile.name}: ${error}`);
        }
      }
    }

    onProgress?.("Leave CSV to JSON migration completed successfully!");
  } catch (error) {
    onProgress?.(`Migration failed: ${error}`);
    throw error;
  }
}

export const createLeaveModel = (
  dbPath: string,
  employeeId: string
): LeaveModel => {
  return new LeaveModel(dbPath, employeeId);
};
