import fs from "fs";
import path from "path";

export interface Loan {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  type: "Personal" | "Housing" | "Emergency" | "Other";
  status: "Pending" | "Approved" | "Rejected" | "Completed";
  interestRate: number;
  term: number; // in months
  monthlyPayment: number;
  remainingBalance: number;
  nextPaymentDate: Date;
  reason: string;
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
      employeeId: string;
      date: string;
      amount: number;
      type: "Personal" | "Housing" | "Emergency" | "Other";
      status: "Pending" | "Approved" | "Rejected" | "Completed";
      interestRate: number;
      term: number;
      monthlyPayment: number;
      remainingBalance: number;
      nextPaymentDate: string;
      reason: string;
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
      const employeePath = this.basePath;
      await window.electron.ensureDir(employeePath);
      console.log(`[LoanModel] Ensured directory exists: ${employeePath}`);
    } catch (error) {
      console.error(`[LoanModel] Failed to ensure directory exists: ${error}`);
      throw error;
    }
  }

  async createLoan(loan: Loan): Promise<void> {
    try {
      console.log(`[LoanModel] Attempting to save loan`);
      console.log(`[LoanModel] Loan data to save:`, loan);

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

        // Add the loan to JSON data
        jsonData.loans[loan.id] = {
          employeeId: loan.employeeId,
          date: loan.date.toISOString(),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          interestRate: loan.interestRate,
          term: loan.term,
          monthlyPayment: loan.monthlyPayment,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: loan.nextPaymentDate.toISOString(),
          reason: loan.reason,
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
        return `${l.id},${l.employeeId},${l.date.toISOString()},${l.amount},${
          l.type
        },${l.status},${l.interestRate},${l.term},${l.monthlyPayment},${
          l.remainingBalance
        },${l.nextPaymentDate.toISOString()},${l.reason}`;
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

        // Update the loan in JSON data
        jsonData.loans[loan.id] = {
          employeeId: loan.employeeId,
          date: loan.date.toISOString(),
          amount: loan.amount,
          type: loan.type,
          status: loan.status,
          interestRate: loan.interestRate,
          term: loan.term,
          monthlyPayment: loan.monthlyPayment,
          remainingBalance: loan.remainingBalance,
          nextPaymentDate: loan.nextPaymentDate.toISOString(),
          reason: loan.reason,
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
        return `${l.id},${l.employeeId},${l.date.toISOString()},${l.amount},${
          l.type
        },${l.status},${l.interestRate},${l.term},${l.monthlyPayment},${
          l.remainingBalance
        },${l.nextPaymentDate.toISOString()},${l.reason}`;
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
      console.log(`[LoanModel] Loading loans for ${year}-${month}`);

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
            return {
              id,
              employeeId: loanData.employeeId,
              date: new Date(loanData.date),
              amount: loanData.amount,
              type: loanData.type,
              status: loanData.status,
              interestRate: loanData.interestRate,
              term: loanData.term,
              monthlyPayment: loanData.monthlyPayment,
              remainingBalance: loanData.remainingBalance,
              nextPaymentDate: new Date(loanData.nextPaymentDate),
              reason: loanData.reason,
            };
          });

          console.log(
            `[LoanModel] Successfully loaded ${loans.length} loans from JSON`
          );
          return loans;
        } catch (error: any) {
          if (
            error.code === "ENOENT" ||
            error instanceof SyntaxError ||
            (error instanceof Error && error.message.includes("ENOENT"))
          ) {
            console.log(
              `[LoanModel] No JSON file found or invalid JSON for ${year}-${month}. Trying CSV.`
            );
            // Fall through to CSV loading
          } else {
            throw error;
          }
        }
      }

      // CSV implementation (original code)
      const filePath = this.getFilePathByMonth(year, month);
      console.log(`[LoanModel] Loading loans from:`, filePath);

      try {
        const data = await window.electron.readFile(filePath);
        const lines = data.split("\n").filter((line) => line.trim().length > 0);

        return lines.map((line) => {
          const fields = line.split(",");

          // Parse the dates from ISO format
          const date = new Date(fields[2]);
          const nextPaymentDate = new Date(fields[10]);

          // Validate loan type
          let loanType = fields[4] as Loan["type"];
          if (
            !["Personal", "Housing", "Emergency", "Other"].includes(loanType)
          ) {
            console.warn(
              `[LoanModel] Invalid loan type "${loanType}" found, defaulting to "Other"`
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
            interestRate: parseFloat(fields[6]),
            term: parseInt(fields[7]),
            monthlyPayment: parseFloat(fields[8]),
            remainingBalance: parseFloat(fields[9]),
            nextPaymentDate,
            reason: fields[11],
          };
        });
      } catch (error: any) {
        if (
          error.code === "ENOENT" ||
          (error instanceof Error && error.message.includes("ENOENT"))
        ) {
          console.log(
            `[LoanModel] No loans file found for ${year}-${month}, returning empty array`
          );
          return [];
        }
        throw error;
      }
    } catch (error) {
      console.error("[LoanModel] Error loading loans:", error);
      return [];
    }
  }

  async deleteLoan(id: string, loan: Loan): Promise<void> {
    try {
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
          }
          return;
        } catch (error: any) {
          if (error.code === "ENOENT") {
            console.log(`[LoanModel] No JSON file found for ${year}-${month}`);
            // Fall through to CSV deletion
          } else {
            throw error;
          }
        }
      }

      // CSV implementation (original code)
      const filePath = this.getFilePath(loan);
      console.log(`[LoanModel] Attempting to delete loan from:`, filePath);

      const data = await window.electron.readFile(filePath);
      const lines = data.split("\n").filter((line) => line.trim().length > 0);
      const updatedLines = lines.filter((line) => line.split(",")[0] !== id);
      await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
      console.log(`[LoanModel] Successfully deleted loan`);
    } catch (error) {
      console.error("[LoanModel] Error deleting loan:", error);
      throw error;
    }
  }
}

/**
 * Migrates loan data from CSV format to JSON format
 */
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    onProgress?.("Starting loan CSV to JSON migration...");

    // Get employee folders
    const loansBasePath = path.join(dbPath, "SweldoDB/loans");

    try {
      await window.electron.ensureDir(loansBasePath);
    } catch (error) {
      onProgress?.(`Error ensuring loans directory exists: ${error}`);
      throw error;
    }

    // Get all employee folders
    const employees = await window.electron.readDir(loansBasePath);
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

      const employeePath = path.join(loansBasePath, employeeId);

      // Get all CSV files in the employee folder
      const files = await window.electron.readDir(employeePath);
      const csvFiles = files.filter(
        (file: { isFile: boolean; name: string }) =>
          file.isFile && file.name.endsWith("_loans.csv")
      );

      onProgress?.(
        `  Found ${csvFiles.length} loan CSV files for employee ${employeeId}`
      );

      // Process each CSV file
      for (let j = 0; j < csvFiles.length; j++) {
        const csvFile = csvFiles[j];
        const csvFilePath = path.join(employeePath, csvFile.name);

        try {
          // Extract year and month from filename
          const [year, month] = csvFile.name
            .replace("_loans.csv", "")
            .split("_")
            .map(Number);

          onProgress?.(`    Processing ${year}-${month} loans`);

          // Read the CSV file
          const csvContent = await window.electron.readFile(csvFilePath);
          const lines = csvContent.split("\n").filter((line) => line.trim());

          if (lines.length === 0) {
            onProgress?.(`    - Skipping empty file: ${csvFile.name}`);
            continue;
          }

          // Create JSON structure
          const jsonData: LoanJsonData = {
            meta: {
              employeeId,
              year,
              month,
              lastModified: new Date().toISOString(),
            },
            loans: {},
          };

          // Process each line/loan record
          for (const line of lines) {
            const fields = line.split(",");
            if (fields.length < 12) continue; // Skip invalid lines

            const id = fields[0];
            jsonData.loans[id] = {
              employeeId: fields[1],
              date: fields[2], // ISO string
              amount: parseFloat(fields[3]),
              type: fields[4] as "Personal" | "Housing" | "Emergency" | "Other",
              status: fields[5] as
                | "Pending"
                | "Approved"
                | "Rejected"
                | "Completed",
              interestRate: parseFloat(fields[6]),
              term: parseInt(fields[7]),
              monthlyPayment: parseFloat(fields[8]),
              remainingBalance: parseFloat(fields[9]),
              nextPaymentDate: fields[10], // ISO string
              reason: fields[11],
            };
          }

          // Write JSON file
          const jsonFilePath = path.join(
            employeePath,
            `${year}_${month}_loans.json`
          );

          await window.electron.writeFile(
            jsonFilePath,
            JSON.stringify(jsonData, null, 2)
          );

          onProgress?.(
            `    - Successfully migrated ${
              Object.keys(jsonData.loans).length
            } loan records to JSON`
          );
        } catch (error) {
          onProgress?.(`    - Error processing file ${csvFile.name}: ${error}`);
        }
      }
    }

    onProgress?.("Loan CSV to JSON migration completed successfully!");
  } catch (error) {
    onProgress?.(`Migration failed: ${error}`);
    throw error;
  }
}

export const createLoanModel = (
  dbPath: string,
  employeeId: string
): LoanModel => {
  return new LoanModel(dbPath, employeeId);
};
