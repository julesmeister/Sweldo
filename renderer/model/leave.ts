import fs from "fs";
import path from "path";
import {
  loadLeavesFirestore,
  createLeaveFirestore,
  saveOrUpdateLeaveFirestore,
  deleteLeaveFirestore,
} from "./leave_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

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
      // Skip directory creation in web mode
      if (isWebEnvironment()) {
        return;
      }

      const employeePath = this.basePath;
      await window.electron.ensureDir(employeePath);
    } catch (error) {
      console.error(`Failed to ensure directory exists: ${error}`);
      throw error;
    }
  }

  async createLeave(leave: Leave): Promise<void> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      await createLeaveFirestore(leave, companyName);
      return;
    }

    // Desktop mode - use existing implementation
    await this.saveOrUpdateLeave(leave);
  }

  async saveOrUpdateLeave(leave: Leave): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await saveOrUpdateLeaveFirestore(leave, companyName);
        return;
      }

      // Desktop mode - use existing implementation
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
        const lines = data.split("\n").filter((line) => line.trim().length > 0);
        let leaveExists = false;

        const updatedLines = lines.map((line) => {
          const fields = line.split(",");
          if (fields[0] === leave.id) {
            leaveExists = true;
            return formatLeaveToCSV(leave);
          }
          return line;
        });

        if (!leaveExists) {
          updatedLines.push(formatLeaveToCSV(leave));
        }

        await window.electron.writeFile(
          filePath,
          updatedLines.join("\n") + "\n"
        );
      } catch (error: any) {
        if (error.code === "ENOENT") {
          const csvData = formatLeaveToCSV(leave) + "\n";
          await window.electron.writeFile(filePath, csvData);
        } else {
          console.error("Error saving/updating leave:", error);
          throw error;
        }
      }
    } catch (error) {
      console.error("Error in saveOrUpdateLeave:", error);
      throw error;
    }
  }

  async loadLeaves(
    employeeId: string,
    year: number,
    month: number
  ): Promise<Leave[]> {
    console.log(
      `[leave.ts] LeaveModel.loadLeaves: START - Model EmployeeID: ${this.employeeId}, Args: employeeId='${employeeId}', year=${year}, month=${month}`
    );
    try {
      if (isWebEnvironment()) {
        console.log(
          "[leave.ts] LeaveModel.loadLeaves: Web environment detected. Calling loadLeavesFirestore."
        );
        const companyName = await getCompanyName();
        // The employeeId argument is used here for Firestore
        return loadLeavesFirestore(employeeId, year, month, companyName);
      }

      console.log(
        `[leave.ts] LeaveModel.loadLeaves: Desktop environment. Using this.employeeId (${this.employeeId}) for path construction.`
      );
      await this.ensureDirectoryExists(); // ensureDirectoryExists logs internally

      if (this.useJsonFormat) {
        const jsonPath = this.getJsonFilePath(year, month);
        console.log(
          `[leave.ts] LeaveModel.loadLeaves: Attempting to load from JSON: ${jsonPath}`
        );
        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as LeaveJsonData;
          console.log(
            `[leave.ts] LeaveModel.loadLeaves: Successfully read and parsed JSON file ${jsonPath}. Found ${
              Object.keys(jsonData.leaves).length
            } leave entries.`
          );

          if (jsonData.meta.employeeId !== this.employeeId) {
            console.warn(
              `[leave.ts] LeaveModel.loadLeaves: Mismatch! JSON meta.employeeId (${jsonData.meta.employeeId}) vs model this.employeeId (${this.employeeId}) in file ${jsonPath}. Using data as is.`
            );
          }

          const leaves: Leave[] = Object.keys(jsonData.leaves).map((id) => {
            const leaveData = jsonData.leaves[id];
            // Add individual date parsing checks if necessary, similar to holiday.ts
            return {
              id,
              employeeId: leaveData.employeeId, // This should ideally match jsonData.meta.employeeId and this.employeeId
              startDate: new Date(leaveData.startDate),
              endDate: new Date(leaveData.endDate),
              type: leaveData.type,
              status: leaveData.status,
              reason: leaveData.reason,
            };
          });
          console.log(
            `[leave.ts] LeaveModel.loadLeaves: Returning ${leaves.length} leaves from JSON file ${jsonPath}.`
          );
          return leaves;
        } catch (error: any) {
          console.log(
            `[leave.ts] LeaveModel.loadLeaves: Info - Did not load from JSON file ${jsonPath}. Error code: ${error.code}, Message: ${error.message}`
          );
          if (
            error.code === "ENOENT" ||
            error instanceof SyntaxError ||
            (error instanceof Error && error.message.includes("ENOENT"))
          ) {
            // Fall through to CSV loading
            console.log(
              `[leave.ts] LeaveModel.loadLeaves: JSON file ${jsonPath} not found or unparsable. Falling back to CSV if not preferred or if it exists.`
            );
          } else {
            console.error(
              `[leave.ts] LeaveModel.loadLeaves: Error reading/parsing JSON file ${jsonPath}.`,
              error
            );
            throw error; // Re-throw unexpected errors
          }
        }
      }

      const csvFilePath = this.getFilePathByMonth(year, month);
      console.log(
        `[leave.ts] LeaveModel.loadLeaves: Attempting to load from CSV: ${csvFilePath}`
      );
      try {
        const data = await window.electron.readFile(csvFilePath);
        const lines = data.split("\n");
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
        console.log(
          `[leave.ts] LeaveModel.loadLeaves: Read CSV ${csvFilePath}. Found ${nonEmptyLines.length} non-empty lines.`
        );

        const leaves = nonEmptyLines.map((line) => {
          const fields = line.split(",");
          const startDate = new Date(fields[2]);
          const endDate = new Date(fields[3]);
          let leaveType = fields[4] as
            | "Sick"
            | "Vacation"
            | "Emergency"
            | "Other";
          if (!["Sick", "Vacation", "Emergency", "Other"].includes(leaveType)) {
            leaveType = "Other";
          }
          return {
            id: fields[0],
            employeeId: fields[1], // This is the employeeId from the CSV line
            startDate,
            endDate,
            type: leaveType,
            status: fields[5] as "Pending" | "Approved" | "Rejected",
            reason: fields[6],
          } as Leave;
        });

        // Filter leaves by this.employeeId (model's scope) IF the CSV contains mixed employee data
        // However, the file path itself is already employee-specific, so this filter might be redundant
        // unless the CSV files themselves are not strictly per-employee (which they should be by design).
        const filteredLeaves = leaves.filter(
          (l) => l.employeeId === this.employeeId
        );
        if (leaves.length !== filteredLeaves.length) {
          console.warn(
            `[leave.ts] LeaveModel.loadLeaves: CSV file ${csvFilePath} contained leaves for other employees. Loaded ${filteredLeaves.length} for ${this.employeeId} out of ${leaves.length} total.`
          );
        }
        console.log(
          `[leave.ts] LeaveModel.loadLeaves: Returning ${filteredLeaves.length} leaves from CSV file ${csvFilePath} (for model employee ${this.employeeId}).`
        );
        return filteredLeaves;
      } catch (error: any) {
        if (
          error.code === "ENOENT" ||
          (error instanceof Error && error.message.includes("ENOENT"))
        ) {
          console.log(
            `[leave.ts] LeaveModel.loadLeaves: CSV file ${csvFilePath} not found. Returning empty array.`
          );
          return [];
        }
        console.error(
          `[leave.ts] LeaveModel.loadLeaves: Error reading CSV file ${csvFilePath}.`,
          error
        );
        throw error;
      }
    } catch (error) {
      console.error(
        `[leave.ts] LeaveModel.loadLeaves: OVERALL ERROR for model EmployeeID ${this.employeeId}, args (emp: '${employeeId}', Y:${year}, M:${month}).`,
        error
      );
      return []; // Return empty array on error to prevent sync stalls, but log it.
    }
  }

  async deleteLeave(id: string, leave: Leave): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await deleteLeaveFirestore(id, leave, companyName);
        return;
      }

      // Desktop mode - use existing implementation
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
          }
          return;
        } catch (error: any) {
          if (error.code === "ENOENT") {
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
    } catch (error) {
      console.error("Error deleting leave:", error);
      throw error;
    }
  }

  async loadAllLeavesForSync(): Promise<Leave[]> {
    // Correctly determine the root path for all employee leave folders.
    // this.basePath is specific to the employeeId the model was initialized with (e.g., __SYNC_ALL__).
    // We need to go to the parent directory of this.basePath, which should be 'SweldoDB/leaves'.
    const leavesRootPath = path.dirname(this.basePath);

    console.log(
      `[leave.ts] LeaveModel.loadAllLeavesForSync: START - Scanning for all leaves in ${leavesRootPath}`
    );
    if (isWebEnvironment()) {
      console.warn(
        "[leave.ts] LeaveModel.loadAllLeavesForSync: Should not be called in web environment. Returning empty array."
      );
      return [];
    }

    const allEmployeeLeaves: Leave[] = [];

    try {
      // 1. List all items in the SweldoDB/leaves directory (these should be employeeId folders)
      const employeeIdFolders = await window.electron.readDir(leavesRootPath);
      console.log(
        `[leave.ts] LeaveModel.loadAllLeavesForSync: Found ${employeeIdFolders.length} potential employee folders in ${leavesRootPath}`
      );

      for (const empFolder of employeeIdFolders) {
        if (!empFolder.isDirectory) {
          console.log(
            `[leave.ts] LeaveModel.loadAllLeavesForSync: Skipping item ${empFolder.name} as it is not a directory.`
          );
          continue;
        }
        const currentEmployeeId = empFolder.name;
        const employeeLeavePath = path.join(leavesRootPath, currentEmployeeId);
        console.log(
          `[leave.ts] LeaveModel.loadAllLeavesForSync: Processing employee folder: ${employeeLeavePath}`
        );

        try {
          // 2. List all files in the current employee's leave directory
          const leaveFiles = await window.electron.readDir(employeeLeavePath);
          console.log(
            `[leave.ts] LeaveModel.loadAllLeavesForSync: Found ${leaveFiles.length} files/subdirs in ${employeeLeavePath}`
          );

          // Prioritize JSON files
          const jsonLeaveFiles = leaveFiles.filter(
            (file: { name: string; isFile: boolean }) =>
              file.isFile && file.name.endsWith("_leaves.json")
          );
          const csvLeaveFiles = leaveFiles.filter(
            (file: { name: string; isFile: boolean }) =>
              file.isFile && file.name.endsWith("_leaves.csv")
          );
          console.log(
            `[leave.ts] LeaveModel.loadAllLeavesForSync: Employee ${currentEmployeeId} - Found ${jsonLeaveFiles.length} JSON files, ${csvLeaveFiles.length} CSV files.`
          );

          // Process JSON files for this employee
          for (const jsonFile of jsonLeaveFiles) {
            const filePath = path.join(employeeLeavePath, jsonFile.name);
            console.log(
              `[leave.ts] LeaveModel.loadAllLeavesForSync: Processing JSON file: ${filePath}`
            );
            try {
              const fileContent = await window.electron.readFile(filePath);
              if (!fileContent.trim()) {
                console.log(
                  `[leave.ts] LeaveModel.loadAllLeavesForSync: JSON file ${jsonFile.name} is empty. Skipping.`
                );
                continue;
              }
              const jsonData: LeaveJsonData = JSON.parse(fileContent);
              // Basic validation for the JSON structure if needed (e.g., meta.employeeId)
              if (jsonData.meta.employeeId !== currentEmployeeId) {
                console.warn(
                  `[leave.ts] LeaveModel.loadAllLeavesForSync: Employee ID mismatch in JSON ${jsonFile.name}. Meta: ${jsonData.meta.employeeId}, Folder: ${currentEmployeeId}. Using data as is but this might be an issue.`
                );
              }

              const leavesFromFile: Leave[] = Object.entries(jsonData.leaves)
                .map(([id, leaveData]) => {
                  const startDate = new Date(leaveData.startDate);
                  const endDate = new Date(leaveData.endDate);
                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.warn(
                      `[leave.ts] LeaveModel.loadAllLeavesForSync: Invalid date in JSON file ${jsonFile.name} for leave id ${id}. Skipping this leave entry.`
                    );
                    return null; // Will be filtered out
                  }
                  return {
                    id,
                    employeeId: leaveData.employeeId, // Ensure this matches currentEmployeeId or jsonData.meta.employeeId for consistency
                    startDate,
                    endDate,
                    type: leaveData.type,
                    status: leaveData.status,
                    reason: leaveData.reason,
                  };
                })
                .filter((leave) => leave !== null) as Leave[];
              allEmployeeLeaves.push(...leavesFromFile);
              console.log(
                `[leave.ts] LeaveModel.loadAllLeavesForSync: Added ${leavesFromFile.length} leaves from JSON ${jsonFile.name} for employee ${currentEmployeeId}`
              );
            } catch (error) {
              console.error(
                `[leave.ts] LeaveModel.loadAllLeavesForSync: ERROR processing JSON file ${jsonFile.name} for employee ${currentEmployeeId}.`,
                error
              );
            }
          }

          // Process CSV files (if no JSON equivalent was found or as a fallback)
          for (const csvFile of csvLeaveFiles) {
            const baseName = csvFile.name.replace("_leaves.csv", "");
            // Check if a JSON file for the same year_month already contributed for this employee
            if (
              jsonLeaveFiles.some((jf: { name: string }) =>
                jf.name.startsWith(baseName)
              )
            ) {
              console.log(
                `[leave.ts] LeaveModel.loadAllLeavesForSync: JSON version for ${csvFile.name} (employee ${currentEmployeeId}) already processed. Skipping CSV.`
              );
              continue;
            }
            const filePath = path.join(employeeLeavePath, csvFile.name);
            console.log(
              `[leave.ts] LeaveModel.loadAllLeavesForSync: Processing CSV file: ${filePath}`
            );
            try {
              const fileContent = await window.electron.readFile(filePath);
              if (!fileContent.trim()) {
                console.log(
                  `[leave.ts] LeaveModel.loadAllLeavesForSync: CSV file ${csvFile.name} is empty. Skipping.`
                );
                continue;
              }
              const lines = fileContent
                .split("\n")
                .filter((line) => line.trim().length > 0);
              const leavesFromFile = lines
                .map((line) => {
                  const fields = line.split(",");
                  if (fields.length < 7) {
                    console.warn(
                      `[leave.ts] LeaveModel.loadAllLeavesForSync: Malformed CSV line in ${csvFile.name} (employee ${currentEmployeeId}). Line: "${line}". Skipping.`
                    );
                    return null;
                  }
                  // Ensure employeeId from CSV matches the folder name for consistency
                  if (fields[1] !== currentEmployeeId) {
                    console.warn(
                      `[leave.ts] LeaveModel.loadAllLeavesForSync: Employee ID mismatch in CSV line in ${csvFile.name}. Line EmpID: ${fields[1]}, Folder EmpID: ${currentEmployeeId}. Using line data.`
                    );
                  }
                  const startDate = new Date(fields[2]);
                  const endDate = new Date(fields[3]);
                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.warn(
                      `[leave.ts] LeaveModel.loadAllLeavesForSync: Invalid date in CSV file ${csvFile.name} (employee ${currentEmployeeId}) for leave id ${fields[0]}. Skipping.`
                    );
                    return null;
                  }
                  let leaveType = fields[4] as
                    | "Sick"
                    | "Vacation"
                    | "Emergency"
                    | "Other";
                  if (
                    !["Sick", "Vacation", "Emergency", "Other"].includes(
                      leaveType
                    )
                  )
                    leaveType = "Other";

                  return {
                    id: fields[0],
                    employeeId: fields[1],
                    startDate,
                    endDate,
                    type: leaveType,
                    status: fields[5] as "Pending" | "Approved" | "Rejected",
                    reason: fields[6],
                  } as Leave;
                })
                .filter((leave) => leave !== null) as Leave[];
              allEmployeeLeaves.push(...leavesFromFile);
              console.log(
                `[leave.ts] LeaveModel.loadAllLeavesForSync: Added ${leavesFromFile.length} leaves from CSV ${csvFile.name} for employee ${currentEmployeeId}`
              );
            } catch (error) {
              console.error(
                `[leave.ts] LeaveModel.loadAllLeavesForSync: ERROR processing CSV file ${csvFile.name} for employee ${currentEmployeeId}.`,
                error
              );
            }
          }
        } catch (innerError) {
          console.error(
            `[leave.ts] LeaveModel.loadAllLeavesForSync: ERROR reading files for employee ${currentEmployeeId} in ${employeeLeavePath}.`,
            innerError
          );
        }
      }
    } catch (error) {
      console.error(
        `[leave.ts] LeaveModel.loadAllLeavesForSync: ERROR scanning ${leavesRootPath} directory.`,
        error
      );
      throw error; // If we can't list employee folders, it's a more significant issue
    }
    console.log(
      `[leave.ts] LeaveModel.loadAllLeavesForSync: END - Loaded a total of ${allEmployeeLeaves.length} leaves from all employees and files.`
    );
    return allEmployeeLeaves;
  }
}

/**
 * Migrates leave data from CSV format to JSON format
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
