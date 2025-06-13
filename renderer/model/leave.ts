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
      console.error(
        `[LeaveModel] Failed to ensure directory exists for ${this.basePath}:`,
        error
      );
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
          console.error(
            "[LeaveModel] Error saving/updating leave (CSV):",
            error
          );
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
      if (isWebEnvironment()) {
        const companyName = await getCompanyName();
        return loadLeavesFirestore(employeeId, year, month, companyName);
      }

      await this.ensureDirectoryExists(); // ensureDirectoryExists logs internally

      if (this.useJsonFormat) {
        const jsonPath = this.getJsonFilePath(year, month);
        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as LeaveJsonData;
          if (jsonData.meta.employeeId !== this.employeeId) {
            console.warn(
              `[LeaveModel] Mismatch in JSON meta.employeeId (${jsonData.meta.employeeId}) vs model this.employeeId (${this.employeeId}) in file ${jsonPath}. Data used as is.`
            );
          }
          const leaves: Leave[] = Object.keys(jsonData.leaves).map((id) => {
            const leaveData = jsonData.leaves[id];
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
          return leaves;
        } catch (error: any) {
          if (
            error.code === "ENOENT" ||
            error instanceof SyntaxError ||
            (error instanceof Error && error.message.includes("ENOENT"))
          ) {
          } else {
            console.error(
              `[LeaveModel] Error reading/parsing JSON file ${jsonPath}:`,
              error
            );
            throw error;
          }
        }
      }

      const csvFilePath = this.getFilePathByMonth(year, month);
      try {
        const data = await window.electron.readFile(csvFilePath);
        const lines = data.split("\n");
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
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
            `[LeaveModel] CSV file ${csvFilePath} contained leaves for other employees. Loaded ${filteredLeaves.length} for ${this.employeeId} out of ${leaves.length} total.`
          );
        }
        return filteredLeaves;
      } catch (error: any) {
        if (
          error.code === "ENOENT" ||
          (error instanceof Error && error.message.includes("ENOENT"))
        ) {
          return [];
        }
        console.error(
          `[LeaveModel] Error reading CSV file ${csvFilePath}:`,
          error
        );
        throw error;
      }
    } catch (error) {
      console.error(
        `[LeaveModel] Overall error in loadLeaves for model EmployeeID ${this.employeeId}, args (emp: '${employeeId}', Y:${year}, M:${month}):`,
        error
      );
      return []; // Return empty array on error to prevent sync stalls, but log it.
    }
  }

  // Helper method to search for a leave across all months
  private async findLeaveAcrossMonths(id: string): Promise<{ found: boolean; year?: number; month?: number }> {
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];
    
    for (const year of yearsToCheck) {
      for (let month = 1; month <= 12; month++) {
        try {
          const jsonFilePath = this.getJsonFilePath(year, month);
          
          const fileExists = await window.electron.fileExists(jsonFilePath);
          if (!fileExists) continue;
          
          const content = await window.electron.readFile(jsonFilePath);
          if (!content || content.trim() === "") continue;
          
          const data = JSON.parse(content) as LeaveJsonData;
          const leaveFound = data.leaves[id];
          
          if (leaveFound) {
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
      let deleted = false;

      if (this.useJsonFormat) {
        // First try the specified month's JSON file
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
            console.log(`[LeaveModel] Successfully deleted leave from JSON (${year}-${month})`);
            deleted = true;
          }
        } catch (error: any) {
          if (error.code === "ENOENT" || error.message?.includes("ENOENT")) {
            // File doesn't exist for this month, continue to search other months
          } else {
            console.error(`[LeaveModel] Error processing JSON file ${jsonPath} for deletion:`, error);
            throw error;
          }
        }

        // If not found in specified month, search across all months
        if (!deleted) {
          console.log(`[LeaveModel] Leave ${id} not found in specified month (${year}-${month}), searching across all months...`);
          
          const searchResult = await this.findLeaveAcrossMonths(id);
          
          if (searchResult.found && searchResult.year && searchResult.month) {
            console.log(`[LeaveModel] Found leave ${id} in ${searchResult.year}-${searchResult.month}, attempting deletion...`);
            
            const foundJsonPath = this.getJsonFilePath(searchResult.year, searchResult.month);
            try {
              const fileContent = await window.electron.readFile(foundJsonPath);
              const jsonData = JSON.parse(fileContent) as LeaveJsonData;
              
              if (jsonData.leaves[id]) {
                delete jsonData.leaves[id];
                jsonData.meta.lastModified = new Date().toISOString();
                
                await window.electron.writeFile(
                  foundJsonPath,
                  JSON.stringify(jsonData, null, 2)
                );
                console.log(`[LeaveModel] Successfully deleted leave from JSON (${searchResult.year}-${searchResult.month})`);
                deleted = true;
              }
            } catch (error) {
              console.error(`[LeaveModel] Error deleting from found JSON file:`, error);
            }
          }
        }

        // If still not found in JSON, search CSV files across all months
        if (!deleted) {
          console.log(`[LeaveModel] Leave ${id} not found in any JSON files, attempting CSV search across months...`);
          
          const currentYear = new Date().getFullYear();
          const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];
          
          for (const searchYear of yearsToCheck) {
            for (let searchMonth = 1; searchMonth <= 12; searchMonth++) {
              try {
                const csvPath = this.getFilePathByMonth(searchYear, searchMonth);
                const data = await window.electron.readFile(csvPath);
                const lines = data.split("\n").filter((line) => line.trim().length > 0);
                const updatedLines = lines.filter((line) => line.split(",")[0] !== id);

                if (lines.length !== updatedLines.length) {
                  await window.electron.writeFile(csvPath, updatedLines.join("\n") + "\n");
                  console.log(`[LeaveModel] Successfully deleted leave from CSV (${searchYear}-${searchMonth})`);
                  deleted = true;
                  break;
                }
              } catch (csvError: any) {
                if (csvError.code === "ENOENT" || csvError.message?.includes("ENOENT")) {
                  continue; // File doesn't exist for this month, try next
                } else {
                  console.error(`[LeaveModel] Error trying CSV delete (${searchYear}-${searchMonth}):`, csvError);
                  continue;
                }
              }
            }
            if (deleted) break;
          }
        }

        if (!deleted) {
          console.log(`[LeaveModel] Leave ${id} not found in any JSON or CSV files, considering it already deleted`);
        }
        
        return;
      }

      // CSV implementation (original code) - only for when useJsonFormat is false
      const filePath = this.getFilePath(leave);
      
      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split("\n").filter((line) => line.trim().length > 0);
        const updatedLines = lines.filter((line) => line.split(",")[0] !== id);
        
        if (lines.length !== updatedLines.length) {
          await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
          console.log(`[LeaveModel] Successfully deleted leave from CSV`);
        } else {
          console.log(`[LeaveModel] Leave ${id} not found in CSV for deletion`);
        }
      } catch (error: any) {
        if (error.code === "ENOENT" || error.message?.includes("ENOENT")) {
          console.log(`[LeaveModel] CSV file ${filePath} not found for deletion, considering it already deleted`);
          return; // Nothing to delete
        }
        console.error(`[LeaveModel] Error deleting leave from CSV ${filePath}:`, error);
        throw error;
      }
    } catch (error) {
      console.error("[LeaveModel] Error deleting leave:", error);
      throw error;
    }
  }

  async loadAllLeavesForSync(): Promise<Leave[]> {
    // Correctly determine the root path for all employee leave folders.
    // this.basePath is specific to the employeeId the model was initialized with (e.g., __SYNC_ALL__).
    // We need to go to the parent directory of this.basePath, which should be 'SweldoDB/leaves'.
    const leavesRootPath = path.dirname(this.basePath);

    if (isWebEnvironment()) {
      return [];
    }

    const allEmployeeLeaves: Leave[] = [];

    try {
      // 1. List all items in the SweldoDB/leaves directory (these should be employeeId folders)
      const employeeIdFolders = await window.electron.readDir(leavesRootPath);
      for (const empFolder of employeeIdFolders) {
        if (!empFolder.isDirectory) {
          continue;
        }
        const currentEmployeeId = empFolder.name;
        const employeeLeavePath = path.join(leavesRootPath, currentEmployeeId);

        try {
          // 2. List all files in the current employee's leave directory
          const leaveFiles = await window.electron.readDir(employeeLeavePath);

          // Prioritize JSON files
          const jsonLeaveFiles = leaveFiles.filter(
            (file: { name: string; isFile: boolean }) =>
              file.isFile && file.name.endsWith("_leaves.json")
          );
          const csvLeaveFiles = leaveFiles.filter(
            (file: { name: string; isFile: boolean }) =>
              file.isFile && file.name.endsWith("_leaves.csv")
          );

          // Process JSON files for this employee
          for (const jsonFile of jsonLeaveFiles) {
            const filePath = path.join(employeeLeavePath, jsonFile.name);
            try {
              const fileContent = await window.electron.readFile(filePath);
              if (!fileContent.trim()) {
                continue;
              }
              const jsonData: LeaveJsonData = JSON.parse(fileContent);
              if (jsonData.meta.employeeId !== currentEmployeeId) {
                console.warn(
                  `[LeaveModel] Employee ID mismatch in JSON ${jsonFile.name}. Meta: ${jsonData.meta.employeeId}, Folder: ${currentEmployeeId}. Using data from folder ID for records.`
                );
              }

              const leavesFromFile: Leave[] = Object.entries(jsonData.leaves)
                .map(([id, leaveData]) => {
                  const startDate = new Date(leaveData.startDate);
                  const endDate = new Date(leaveData.endDate);
                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.warn(
                      `[LeaveModel] Invalid date in JSON file ${jsonFile.name} for leave id ${id}. Skipping this leave entry.`
                    );
                    return null;
                  }
                  return {
                    id,
                    employeeId: currentEmployeeId,
                    startDate,
                    endDate,
                    type: leaveData.type,
                    status: leaveData.status,
                    reason: leaveData.reason,
                  };
                })
                .filter((leave) => leave !== null) as Leave[];
              allEmployeeLeaves.push(...leavesFromFile);
            } catch (error) {
              console.error(
                `[LeaveModel] Error processing JSON file ${jsonFile.name} for emp ${currentEmployeeId}:`,
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
              continue;
            }
            const filePath = path.join(employeeLeavePath, csvFile.name);
            try {
              const fileContent = await window.electron.readFile(filePath);
              if (!fileContent.trim()) {
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
                      `[LeaveModel] Malformed CSV line in ${csvFile.name} (emp ${currentEmployeeId}). Line: "${line}". Skipping.`
                    );
                    return null;
                  }
                  // Ensure employeeId from CSV matches the folder name for consistency
                  if (fields[1] !== currentEmployeeId) {
                    console.warn(
                      `[LeaveModel] Employee ID mismatch in CSV line ${csvFile.name}. Line EmpID: ${fields[1]}, Folder: ${currentEmployeeId}. Using folder ID.`
                    );
                  }
                  const startDate = new Date(fields[2]);
                  const endDate = new Date(fields[3]);
                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    console.warn(
                      `[LeaveModel] Invalid date in CSV file ${csvFile.name} (emp ${currentEmployeeId}) for id ${fields[0]}. Skipping.`
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
                    employeeId: currentEmployeeId,
                    startDate,
                    endDate,
                    type: leaveType,
                    status: fields[5] as "Pending" | "Approved" | "Rejected",
                    reason: fields[6],
                  } as Leave;
                })
                .filter((leave) => leave !== null) as Leave[];
              allEmployeeLeaves.push(...leavesFromFile);
            } catch (error) {
              console.error(
                `[LeaveModel] Error processing CSV file ${csvFile.name} for emp ${currentEmployeeId}:`,
                error
              );
            }
          }
        } catch (innerError) {
          console.error(
            `[LeaveModel] Error reading files for employee ${currentEmployeeId} in ${employeeLeavePath}:`,
            innerError
          );
        }
      }
    } catch (error) {
      console.error(
        `[LeaveModel] Critical error scanning ${leavesRootPath} directory:`,
        error
      );
      throw error; // If we can't list employee folders, it's a more significant issue
    }
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

    // After successful migration, delete CSV files
    onProgress?.("Starting cleanup of leave CSV files...");
    await deleteCsvFiles(leavesBasePath, "leaves", onProgress);

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
