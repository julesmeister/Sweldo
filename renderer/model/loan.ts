import fs from "fs";
import path from "path";
import {
  loadLoansFirestore,
  createLoanFirestore,
  updateLoanFirestore,
  deleteLoanFirestore,
} from "./loan_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

export interface Deduction {
  amountDeducted: number;
  dateDeducted: Date;
  payrollId?: string;
  notes?: string;
}

export interface StoredDeduction {
  amountDeducted: number;
  dateDeducted: string; // ISO string
  payrollId?: string;
  notes?: string;
}

export interface Loan {
  id: string;
  employeeId: string;
  date: Date; // Date loan was issued
  amount: number; // Principal amount
  type: "Personal" | "PagIbig" | "SSS" | "Other";
  status: "Pending" | "Approved" | "Rejected" | "Completed";
  // interestRate?: number; // Removed
  // term?: number; // Removed
  // monthlyPayment?: number; // Removed
  remainingBalance: number; // Current outstanding balance
  // nextPaymentDate?: Date; // Removed
  // reason?: string; // Removed
  deductions?: Record<string, Deduction>; // Key is deductionId (e.g., UUID)
}

// New JSON structure interfaces
interface LoanJsonData {
  meta: {
    employeeId: string;
    year: number;
    month: number;
    lastModified: string;
  };
  loans: {
    [id: string]: {
      // Represents a stored loan
      employeeId: string;
      date: string; // ISO string
      amount: number;
      type: "Personal" | "PagIbig" | "SSS" | "Other";
      status: "Pending" | "Approved" | "Rejected" | "Completed";
      // interestRate?: number; // Removed
      // term?: number; // Removed
      // monthlyPayment?: number; // Removed
      remainingBalance: number;
      // nextPaymentDate?: string; // Removed
      // reason?: string; // Removed
      deductions?: Record<string, StoredDeduction>;
    };
  };
}

export class LoanModel {
  private basePath: string;
  private employeeId: string;
  private useJsonFormat: boolean = true;

  constructor(dbPath: string, employeeId: string) {
    this.basePath = path.join(dbPath, "SweldoDB/loans", employeeId);
    this.employeeId = employeeId;
  }

  // Add format toggle
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  private getFilePath(loan: Loan): string {
    return `${this.basePath}/${loan.date.getFullYear()}_${
      loan.date.getMonth() + 1
    }_loans.csv`;
  }

  private getFilePathByMonth(year: number, month: number): string {
    return `${this.basePath}/${year}_${month}_loans.csv`;
  }

  private getJsonFilePath(year: number, month: number): string {
    return `${this.basePath}/${year}_${month}_loans.json`;
  }

  // Ensure the directory exists before writing files
  private async ensureDirectoryExists(): Promise<void> {
    try {
      // Skip directory creation in web mode
      if (isWebEnvironment()) {
        return;
      }

      const employeePath = this.basePath;
      await window.electron.ensureDir(employeePath);
      // console.log(`[LoanModel] Ensured directory exists: ${employeePath}`); // REMOVED
    } catch (error) {
      console.error(
        `[LoanModel] Failed to ensure directory ${this.basePath} exists:`,
        error
      );
      throw error;
    }
  }

  async createLoan(loan: Loan): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await createLoanFirestore(loan, companyName);
        console.log(`[LoanModel] Successfully saved loan to Firestore`);
        return;
      }

      // Desktop mode - use existing implementation
      console.log(`[LoanModel] Attempting to save loan`);
      // console.log(`[LoanModel] Loan data to save:`, loan); // Keep this for debugging if needed

      // Ensure directory exists
      await this.ensureDirectoryExists();

      const year = loan.date.getFullYear();
      const month = loan.date.getMonth() + 1;

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath(year, month);
        let jsonData: LoanJsonData;

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          jsonData = JSON.parse(fileContent) as LoanJsonData;
        } catch (error) {
          // Create new JSON structure if file doesn't exist
          jsonData = {
            meta: {
              employeeId: this.employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            loans: {},
          };
        }

        const storedDeductions: Record<string, StoredDeduction> = {};
        if (loan.deductions) {
          for (const key in loan.deductions) {
            const deduction = loan.deductions[key];
            storedDeductions[key] = {
              ...deduction,
              dateDeducted: deduction.dateDeducted.toISOString(),
            };
          }
        }

        // Add the loan to JSON data
        jsonData.loans[loan.id] = {
          employeeId: loan.employeeId,
          date: loan.date.toISOString(),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          remainingBalance: loan.remainingBalance,
          deductions: storedDeductions,
        };

        // Update last modified timestamp
        jsonData.meta.lastModified = new Date().toISOString();

        // Save JSON file
        await window.electron.writeFile(
          jsonPath,
          JSON.stringify(jsonData, null, 2)
        );
        console.log(`[LoanModel] Successfully saved loan to JSON`);
        return;
      }

      // CSV implementation (original code)
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to save loan to:`, filePath);

      const formatLoanToCSV = (l: Loan) => {
        // CSV format: id,employeeId,date,amount,type,status,remainingBalance
        return `${l.id},${l.employeeId},${l.date.toISOString()},${l.amount},${
          l.type
        },${l.status},${l.remainingBalance}`;
      };

      try {
        const data = await window.electron.readFile(filePath);
        console.log(`[LoanModel] Existing file found, updating content`);
        const lines = data.split("\n").filter((line) => line.trim().length > 0);
        lines.push(formatLoanToCSV(loan));
        await window.electron.writeFile(filePath, lines.join("\n") + "\n");
        console.log(`[LoanModel] Successfully saved loan`);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          console.log(`[LoanModel] Creating new file for loan entry`);
          const csvData = formatLoanToCSV(loan) + "\n";
          await window.electron.writeFile(filePath, csvData);
          console.log(
            `[LoanModel] Successfully created new file and saved loan`
          );
        } else {
          console.error("[LoanModel] Error saving loan:", error);
          throw error;
        }
      }
    } catch (error) {
      console.error("[LoanModel] Error in createLoan:", error);
      throw error;
    }
  }

  async updateLoan(loan: Loan): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await updateLoanFirestore(loan, companyName);
        console.log(`[LoanModel] Successfully updated loan in Firestore`);
        return;
      }

      // Desktop mode - use existing implementation
      console.log(`[LoanModel] Attempting to update loan`);

      // Ensure directory exists
      await this.ensureDirectoryExists();

      const year = loan.date.getFullYear();
      const month = loan.date.getMonth() + 1;

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath(year, month);
        let jsonData: LoanJsonData;

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          jsonData = JSON.parse(fileContent) as LoanJsonData;
        } catch (error) {
          // If file doesn't exist or is invalid, we can't update.
          // For robustness, one might create it, but typically update implies existence.
          console.error(
            `[LoanModel] Error reading JSON file for update: ${jsonPath}`,
            error
          );
          // Fallback: attempt to create if not found (matches createLoan behavior)
          jsonData = {
            meta: {
              employeeId: this.employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            loans: {},
          };
        }

        const storedDeductions: Record<string, StoredDeduction> = {};
        if (loan.deductions) {
          for (const key in loan.deductions) {
            const deduction = loan.deductions[key];
            storedDeductions[key] = {
              ...deduction,
              dateDeducted: deduction.dateDeducted.toISOString(),
            };
          }
        }

        // Update the loan in JSON data
        jsonData.loans[loan.id] = {
          employeeId: loan.employeeId,
          date: loan.date.toISOString(),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          remainingBalance: loan.remainingBalance,
          deductions: storedDeductions,
        };

        // Update last modified timestamp
        jsonData.meta.lastModified = new Date().toISOString();

        // Save JSON file
        await window.electron.writeFile(
          jsonPath,
          JSON.stringify(jsonData, null, 2)
        );
        console.log(`[LoanModel] Successfully updated loan in JSON`);
        return;
      }

      // CSV implementation (original code)
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to update loan in:`, filePath);

      const formatLoanToCSV = (l: Loan) => {
        // CSV format: id,employeeId,date,amount,type,status,remainingBalance
        return `${l.id},${l.employeeId},${l.date.toISOString()},${l.amount},${
          l.type
        },${l.status},${l.remainingBalance}`;
      };

      const data = await window.electron.readFile(filePath);
      const lines = data.split("\n").filter((line) => line.trim().length > 0);
      const updatedLines = lines.map((line) => {
        const fields = line.split(",");
        if (fields[0] === loan.id) {
          return formatLoanToCSV(loan);
        }
        return line;
      });
      await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
      console.log(`[LoanModel] Successfully updated loan`);
    } catch (error) {
      console.error("[LoanModel] Error updating loan:", error);
      throw error;
    }
  }

  async loadLoans(year: number, month: number): Promise<Loan[]> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        const loans = await loadLoansFirestore(
          this.employeeId,
          year,
          month,
          companyName
        );
        console.log(
          `[LoanModel] Successfully loaded ${loans.length} loans from Firestore`
        );
        return loans;
      }

      // Desktop mode - use existing implementation
      // console.log(`[LoanModel] Loading loans for ${year}-${month}`);

      // Ensure directory exists
      await this.ensureDirectoryExists();

      if (this.useJsonFormat) {
        // Try to load from JSON first
        const jsonPath = this.getJsonFilePath(year, month);

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as LoanJsonData;

          // Convert JSON data to Loan objects
          const loans: Loan[] = Object.keys(jsonData.loans).map((id) => {
            const loanData = jsonData.loans[id];

            const loadedDeductions: Record<string, Deduction> = {};
            if (loanData.deductions) {
              for (const key in loanData.deductions) {
                const storedDeduction = loanData.deductions[key];
                loadedDeductions[key] = {
                  ...storedDeduction,
                  dateDeducted: new Date(storedDeduction.dateDeducted),
                };
              }
            }

            return {
              id,
              employeeId: loanData.employeeId,
              date: new Date(loanData.date),
              amount: loanData.amount,
              type: loanData.type,
              status: loanData.status,
              remainingBalance: loanData.remainingBalance,
              deductions: loadedDeductions,
            };
          });

          // console.log(`[LoanModel] Successfully loaded ${loans.length} loans from JSON`);
          return loans;
        } catch (error: any) {
          if (
            error.code === "ENOENT" ||
            error instanceof SyntaxError ||
            (error instanceof Error && error.message.includes("ENOENT"))
          ) {
            // console.log(`[LoanModel] No JSON file found or invalid JSON for ${year}-${month}. Trying CSV.`);
            // Fall through to CSV loading
          } else {
            console.error(
              `[LoanModel] Error reading/parsing JSON file ${jsonPath}:`,
              error
            );
            // If JSON is primary and fails to parse (other than not found), maybe we shouldn't fall back to CSV?
            // For now, maintain original fallback logic.
            // throw error;
          }
        }
      }

      // CSV implementation (original code)
      const filePath = this.getFilePathByMonth(year, month);
      // console.log(`[LoanModel] Loading loans from CSV:`, filePath);

      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split("\n").filter((line) => line.trim().length > 0);

        return lines.map((line) => {
          const fields = line.split(",");
          // Expected CSV format: id,employeeId,date,amount,type,status,remainingBalance
          // Minimum 7 fields expected.

          // Parse the dates from ISO format
          const date = new Date(fields[2]);
          // nextPaymentDate removed

          // Validate loan type
          let loanType = fields[4] as Loan["type"];
          if (
            !["Personal", "Housing", "Emergency", "Other"].includes(loanType)
          ) {
            console.warn(
              `[LoanModel] Invalid loan type "${loanType}" in CSV, defaulting to "Other"`
            );
            loanType = "Other";
          }

          return {
            id: fields[0],
            employeeId: fields[1],
            date,
            amount: parseFloat(fields[3]),
            type: loanType,
            status: fields[5] as Loan["status"],
            // interestRate, term, monthlyPayment removed
            remainingBalance: parseFloat(fields[6]),
            // nextPaymentDate removed
            // reason removed
            deductions: {}, // CSV does not store deductions
          };
        });
      } catch (error: any) {
        if (
          error.code === "ENOENT" ||
          (error instanceof Error && error.message.includes("ENOENT"))
        ) {
          // console.log(`[LoanModel] No CSV loans file found for ${year}-${month}, returning empty array`);
          return [];
        }
        console.error(`[LoanModel] Error reading CSV file ${filePath}:`, error);
        throw error; // Rethrow if it's not a "file not found" error
      }
    } catch (error) {
      console.error("[LoanModel] Error loading loans:", error);
      return [];
    }
  }

  async deleteLoan(id: string, loan: Loan): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await deleteLoanFirestore(id, loan, companyName);
        console.log(`[LoanModel] Successfully deleted loan from Firestore`);
        return;
      }

      // Desktop mode - use existing implementation
      const year = loan.date.getFullYear();
      const month = loan.date.getMonth() + 1;

      if (this.useJsonFormat) {
        // Delete from JSON
        const jsonPath = this.getJsonFilePath(year, month);

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as LoanJsonData;

          // Remove the loan with the given ID
          if (jsonData.loans[id]) {
            delete jsonData.loans[id];
            jsonData.meta.lastModified = new Date().toISOString();

            // Write back the updated data
            await window.electron.writeFile(
              jsonPath,
              JSON.stringify(jsonData, null, 2)
            );
            console.log(`[LoanModel] Successfully deleted loan from JSON`);
          } else {
            console.log(
              `[LoanModel] Loan ID ${id} not found in JSON ${jsonPath} for deletion.`
            );
          }
          return; // Return after attempting JSON deletion
        } catch (error: any) {
          if (error.code === "ENOENT") {
            console.log(
              `[LoanModel] No JSON file found for ${year}-${month} for deletion. Loan ID ${id} cannot be deleted if not in JSON.`
            );
            // If JSON is the primary format, and the file doesn't exist, there's nothing to delete.
            // No fallback to CSV for deletion if JSON is preferred and file is missing.
            return;
          } else {
            console.error(
              `[LoanModel] Error processing JSON file ${jsonPath} for deletion:`,
              error
            );
            throw error;
          }
        }
      }

      // CSV implementation (original code)
      // This part will only be reached if useJsonFormat is false.
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to delete loan from CSV:`, filePath);

      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split("\n").filter((line) => line.trim().length > 0);
        const updatedLines = lines.filter((line) => line.split(",")[0] !== id);

        if (lines.length === updatedLines.length) {
          console.log(
            `[LoanModel] Loan ID ${id} not found in CSV ${filePath} for deletion.`
          );
        } else {
          await window.electron.writeFile(
            filePath,
            updatedLines.join("\n") + "\n"
          );
          console.log(`[LoanModel] Successfully deleted loan from CSV`);
        }
      } catch (error: any) {
        if (error.code === "ENOENT") {
          console.log(
            `[LoanModel] CSV file ${filePath} not found for deletion.`
          );
          return; // Nothing to delete
        }
        console.error(
          `[LoanModel] Error deleting loan from CSV ${filePath}:`,
          error
        );
        throw error;
      }
    } catch (error) {
      console.error("[LoanModel] Error deleting loan:", error);
      throw error;
    }
  }

  async loadAllLoansForSync(): Promise<Loan[]> {
    const loansRootPath = path.dirname(this.basePath);
    if (isWebEnvironment()) {
      console.warn(
        "[loan.ts] LoanModel.loadAllLoansForSync: Should not be called in web environment. Returning empty array."
      );
      return [];
    }

    const allEmployeeLoans: Loan[] = [];

    try {
      const employeeIdFolders = await window.electron.readDir(loansRootPath);

      for (const empFolder of employeeIdFolders) {
        if (!empFolder.isDirectory) {
          continue;
        }
        const currentEmployeeId = empFolder.name;
        const employeeLoanPath = path.join(loansRootPath, currentEmployeeId);

        try {
          const loanFiles = await window.electron.readDir(employeeLoanPath);

          const jsonLoanFiles = loanFiles.filter(
            (file: { name: string; isFile: boolean }) =>
              file.isFile && file.name.endsWith("_loans.json")
          );
          const csvLoanFiles = loanFiles.filter(
            (file: { name: string; isFile: boolean }) =>
              file.isFile && file.name.endsWith("_loans.csv")
          );

          for (const jsonFile of jsonLoanFiles) {
            const filePath = path.join(employeeLoanPath, jsonFile.name);
            try {
              const fileContent = await window.electron.readFile(filePath);
              if (!fileContent.trim()) {
                continue;
              }
              const jsonData: LoanJsonData = JSON.parse(fileContent);
              if (jsonData.meta.employeeId !== currentEmployeeId) {
                console.warn(
                  `[LoanModel] Employee ID mismatch in JSON ${jsonFile.name}. Meta: ${jsonData.meta.employeeId}, Folder: ${currentEmployeeId}. Prioritizing folder ID.`
                );
              }

              const loansFromFile: Loan[] = Object.entries(jsonData.loans)
                .map(([id, loanData]) => {
                  const date = new Date(loanData.date);
                  // nextPaymentDate removed from loanData parsing
                  if (isNaN(date.getTime())) {
                    console.warn(
                      `[loan.ts] LoanModel.loadAllLoansForSync: Invalid date in JSON file ${jsonFile.name} for loan id ${id}. Skipping entry.`
                    );
                    return null;
                  }

                  const loadedDeductions: Record<string, Deduction> = {};
                  if (loanData.deductions) {
                    for (const key in loanData.deductions) {
                      const storedDeduction = loanData.deductions[key];
                      loadedDeductions[key] = {
                        ...storedDeduction,
                        dateDeducted: new Date(storedDeduction.dateDeducted),
                      };
                    }
                  }

                  return {
                    id,
                    employeeId: currentEmployeeId,
                    date,
                    amount: loanData.amount,
                    type: loanData.type,
                    status: loanData.status,
                    remainingBalance: loanData.remainingBalance,
                    deductions: loadedDeductions,
                  };
                })
                .filter((loan) => loan !== null) as Loan[];
              allEmployeeLoans.push(...loansFromFile);
            } catch (error) {
              console.error(
                `[loan.ts] LoanModel.loadAllLoansForSync: ERROR processing JSON file ${jsonFile.name} for emp ${currentEmployeeId}:`,
                error
              );
            }
          }

          for (const csvFile of csvLoanFiles) {
            const baseName = csvFile.name.replace("_loans.csv", "");
            if (
              jsonLoanFiles.some((jf: { name: string }) =>
                jf.name.startsWith(baseName)
              )
            ) {
              // console.log(`[loan.ts] LoanModel.loadAllLoansForSync: JSON version for ${csvFile.name} (emp ${currentEmployeeId}) processed. Skipping CSV.`);
              continue;
            }
            const filePath = path.join(employeeLoanPath, csvFile.name);
            try {
              const fileContent = await window.electron.readFile(filePath);
              if (!fileContent.trim()) {
                continue;
              }
              const lines = fileContent
                .split("\n")
                .filter((line) => line.trim().length > 0);
              const loansFromFile = lines
                .map((line) => {
                  const fields = line.split(",");
                  // New CSV format: id,employeeId,date,amount,type,status,remainingBalance (7 fields)
                  if (fields.length < 7) {
                    // Updated field length check
                    console.warn(
                      `[loan.ts] LoanModel.loadAllLoansForSync: Malformed CSV line in ${csvFile.name} (emp ${currentEmployeeId}). Expected 7 fields, got ${fields.length}. Line: "${line}". Skipping.`
                    );
                    return null;
                  }
                  if (fields[1] !== currentEmployeeId) {
                    console.warn(
                      `[LoanModel] Employee ID mismatch in CSV ${csvFile.name}. Line EmpID: ${fields[1]}, Folder: ${currentEmployeeId}. Prioritizing folder ID.`
                    );
                  }
                  const date = new Date(fields[2]);
                  // nextPaymentDate parsing removed
                  if (isNaN(date.getTime())) {
                    console.warn(
                      `[loan.ts] LoanModel.loadAllLoansForSync: Invalid date in CSV ${csvFile.name} (emp ${currentEmployeeId}) for loan id ${fields[0]}. Skipping.`
                    );
                    return null;
                  }
                  let loanType = fields[4] as Loan["type"];
                  if (
                    !["Personal", "Housing", "Emergency", "Other"].includes(
                      loanType
                    )
                  )
                    loanType = "Other";
                  return {
                    id: fields[0],
                    employeeId: currentEmployeeId,
                    date,
                    amount: parseFloat(fields[3]),
                    type: loanType,
                    status: fields[5] as Loan["status"],
                    remainingBalance: parseFloat(fields[6]), // Adjusted index
                    deductions: {}, // CSV does not store deductions
                  } as Loan;
                })
                .filter((loan) => loan !== null) as Loan[];
              allEmployeeLoans.push(...loansFromFile);
            } catch (error) {
              console.error(
                `[loan.ts] LoanModel.loadAllLoansForSync: ERROR processing CSV file ${csvFile.name} for emp ${currentEmployeeId}:`,
                error
              );
            }
          }
        } catch (innerError) {
          console.error(
            `[loan.ts] LoanModel.loadAllLoansForSync: ERROR reading files for employee ${currentEmployeeId} in ${employeeLoanPath}:`,
            innerError
          );
        }
      }
    } catch (error) {
      console.error(
        `[loan.ts] LoanModel.loadAllLoansForSync: ERROR scanning ${loansRootPath} directory:`,
        error
      );
      throw error;
    }
    return allEmployeeLoans;
  }
}

/**
 * Migrates loan data from CSV format to JSON format
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
    onProgress?.("Starting loan CSV to JSON migration...");
    const loansBasePath = path.join(dbPath, "SweldoDB/loans");

    try {
      await window.electron.ensureDir(loansBasePath);
    } catch (error: any) {
      onProgress?.(
        `Error ensuring loans directory exists: ${error.message || error}`
      );
      throw error;
    }

    const employees = await window.electron.readDir(loansBasePath);
    const employeeFolders = employees.filter(
      (item: { isDirectory: boolean; name: string }) => item.isDirectory
    );

    onProgress?.(`Found ${employeeFolders.length} employee folders to process`);

    for (let i = 0; i < employeeFolders.length; i++) {
      const employeeFolder = employeeFolders[i];
      const employeeId = employeeFolder.name;
      onProgress?.(
        `Processing employee ${employeeId} (${i + 1}/${employeeFolders.length})`
      );

      const employeePath = path.join(loansBasePath, employeeId);
      const files = await window.electron.readDir(employeePath);
      const csvFiles = files.filter(
        (file: { isFile: boolean; name: string }) =>
          file.isFile && file.name.endsWith("_loans.csv")
      );

      onProgress?.(
        `  Found ${csvFiles.length} loan CSV files for employee ${employeeId}`
      );

      for (let j = 0; j < csvFiles.length; j++) {
        const csvFile = csvFiles[j];
        const csvFilePath = path.join(employeePath, csvFile.name);

        // Check if a JSON file already exists for this CSV
        const jsonFileName = csvFile.name.replace("_loans.csv", "_loans.json");
        const jsonFilePathTarget = path.join(employeePath, jsonFileName);
        try {
          await window.electron.readFile(jsonFilePathTarget); // This will throw if file doesn't exist
          onProgress?.(
            `    JSON file ${jsonFileName} already exists. Skipping migration for ${csvFile.name}.`
          );
          continue; // Skip if JSON already exists
        } catch (e: any) {
          if (e.code !== "ENOENT") {
            // If error is not 'file not found', log it and skip
            onProgress?.(
              `    Error checking for existing JSON file ${jsonFileName}: ${
                e.message || e
              }. Skipping migration for ${csvFile.name}.`
            );
            continue;
          }
          // ENOENT means JSON file does not exist, proceed with migration
        }

        try {
          const [year, month] = csvFile.name
            .replace("_loans.csv", "")
            .split("_")
            .map(Number);
          onProgress?.(
            `    Migrating ${year}-${month} loans from ${csvFile.name}`
          );

          const csvContent = await window.electron.readFile(csvFilePath);
          const lines = csvContent.split("\n").filter((line) => line.trim());

          if (lines.length === 0) {
            onProgress?.(`    - Skipping empty CSV file: ${csvFile.name}`);
            continue;
          }

          const jsonData: LoanJsonData = {
            meta: {
              employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            loans: {},
          };

          for (const line of lines) {
            const fields = line.split(",");
            // Old CSV: id,employeeId,date,amount,type,status,interestRate,term,monthlyPayment,remainingBalance,nextPaymentDate,reason
            // New CSV expected by migration (from potentially old files): We only care about the first few fields for the new structure
            // We'll map to new structure if fields are available, otherwise they'll be undefined / default.
            // A robust migration might check fields.length more granularly or handle various old formats.
            // For minimal change: Assume old CSVs might have up to 12 fields.
            // We need at least 7 for the *new* core fields if we were parsing a new CSV.
            // Since this is migrating *old* CSVs, we check old lengths.
            if (fields.length < 7) {
              // If an old CSV has less than basic info, skip.
              onProgress?.(
                `    - Skipping malformed line in ${csvFile.name} (less than 7 fields): "${line}"`
              );
              continue;
            }

            const id = fields[0];
            jsonData.loans[id] = {
              employeeId: fields[1],
              date: fields[2], // Keep as ISO string from CSV
              amount: parseFloat(fields[3]),
              type: fields[4] as "Personal" | "PagIbig" | "SSS" | "Other",
              status: fields[5] as
                | "Pending"
                | "Approved"
                | "Rejected"
                | "Completed",
              // Fields removed: interestRate (fields[6]), term (fields[7]), monthlyPayment (fields[8])
              // nextPaymentDate (fields[10]), reason (fields[11])
              remainingBalance: fields[9]
                ? parseFloat(fields[9])
                : parseFloat(fields[3]), // If old remainingBalance exists, use it. Otherwise default to amount.
              deductions: {}, // Initialize empty deductions for migrated loans
            };
          }

          if (Object.keys(jsonData.loans).length > 0) {
            await window.electron.writeFile(
              jsonFilePathTarget, // Use the target path
              JSON.stringify(jsonData, null, 2)
            );
            onProgress?.(
              `    - Successfully migrated ${
                Object.keys(jsonData.loans).length
              } loan records to ${jsonFileName}`
            );
          } else {
            onProgress?.(
              `    - No valid loan records found in ${csvFile.name} to migrate.`
            );
          }
        } catch (error: any) {
          onProgress?.(
            `    - Error processing file ${csvFile.name}: ${
              error.message || error
            }`
          );
        }
      }
    }

    onProgress?.("Loan CSV to JSON migration completed!");
  } catch (error: any) {
    onProgress?.(`Migration failed: ${error.message || error}`);
    throw error;
  }
}

export const createLoanModel = (
  dbPath: string,
  employeeId: string
): LoanModel => {
  return new LoanModel(dbPath, employeeId);
};
