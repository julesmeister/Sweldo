export interface CashAdvance {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  remainingUnpaid: number;
  reason: string;
  approvalStatus: "Pending" | "Approved" | "Rejected";
  status: "Paid" | "Unpaid";
  paymentSchedule: "One-time" | "Installment";
  installmentDetails?: {
    numberOfPayments: number;
    amountPerPayment: number;
    remainingPayments: number;
  };
}

/**
 * JSON structure for cash advances
 */
interface CashAdvancesJson {
  meta: {
    employeeId: string;
    month: number;
    year: number;
    lastModified: string;
  };
  advances: {
    [id: string]: {
      id: string;
      employeeId: string;
      date: string; // ISO format
      amount: number;
      remainingUnpaid: number;
      reason: string;
      approvalStatus: "Pending" | "Approved" | "Rejected";
      status: "Paid" | "Unpaid";
      paymentSchedule: "One-time" | "Installment";
      installmentDetails?: {
        numberOfPayments: number;
        amountPerPayment: number;
        remainingPayments: number;
      };
    };
  };
}

export class CashAdvanceModel {
  filePath: string;
  employeeId: string;
  month: number;
  year: number;
  private useJsonFormat: boolean = true;

  constructor(
    dbPath: string,
    employeeId: string,
    month?: number,
    year?: number
  ) {
    this.filePath = dbPath;
    this.employeeId = employeeId;
    this.month = month || new Date().getMonth() + 1;
    this.year = year || new Date().getFullYear();
  }

  // Add format toggle
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  private getCsvFilePath(): string {
    return `${this.filePath}/${this.year}_${this.month}_cashAdvances.csv`;
  }

  private getJsonFilePath(): string {
    return `${this.filePath}/${this.year}_${this.month}_cashAdvances.json`;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await window.electron.ensureDir(this.filePath);
    } catch (error) {
      console.error("[CashAdvanceModel] Failed to create directory:", error);
      throw error;
    }
  }

  async createCashAdvance(cashAdvance: CashAdvance): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      // Generate a unique ID for the new cash advance if not provided
      const id = cashAdvance.id || crypto.randomUUID();
      cashAdvance.id = id;

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath();
        let jsonData: CashAdvancesJson;

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          jsonData = JSON.parse(fileContent) as CashAdvancesJson;
        } catch (error) {
          // Create new JSON structure if file doesn't exist
          jsonData = {
            meta: {
              employeeId: this.employeeId,
              month: this.month,
              year: this.year,
              lastModified: new Date().toISOString(),
            },
            advances: {},
          };
        }

        // Add the cash advance to JSON data
        jsonData.advances[id] = {
          id,
          employeeId: cashAdvance.employeeId,
          date: cashAdvance.date.toISOString(),
          amount: cashAdvance.amount,
          remainingUnpaid: cashAdvance.remainingUnpaid || cashAdvance.amount,
          reason: cashAdvance.reason,
          approvalStatus: cashAdvance.approvalStatus || "Pending",
          status: cashAdvance.status || "Unpaid",
          paymentSchedule: cashAdvance.paymentSchedule,
          installmentDetails: cashAdvance.installmentDetails,
        };

        // Update last modified timestamp
        jsonData.meta.lastModified = new Date().toISOString();

        // Save JSON file
        await window.electron.writeFile(
          jsonPath,
          JSON.stringify(jsonData, null, 2)
        );
        console.log(
          `[CashAdvanceModel] Successfully saved cash advance to JSON`
        );
        return;
      }

      // CSV implementation (original code)
      const formattedDate = `${
        cashAdvance.date.getMonth() + 1
      }/${cashAdvance.date.getDate()}/${cashAdvance.date.getFullYear()}`;

      // Save all necessary fields including status and remainingUnpaid
      const csvData =
        [
          id,
          this.employeeId,
          formattedDate,
          cashAdvance.amount,
          cashAdvance.reason,
          cashAdvance.approvalStatus || "Pending",
          cashAdvance.paymentSchedule,
          cashAdvance.status || "Unpaid",
          cashAdvance.remainingUnpaid || cashAdvance.amount,
        ].join(",") + "\n";

      const filePath = this.getCsvFilePath();

      // Define headers for new files
      const headers =
        [
          "id",
          "employeeId",
          "date",
          "amount",
          "reason",
          "approvalStatus",
          "paymentSchedule",
          "status",
          "remainingUnpaid",
        ].join(",") + "\n";

      // Append to file if it exists, create if it doesn't
      let existingData = "";
      try {
        existingData = await window.electron.readFile(filePath);
      } catch (error) {
        existingData = headers;
      }

      const newData = existingData
        ? existingData.trim() + "\n" + csvData
        : headers + csvData;
      await window.electron.writeFile(filePath, newData);
    } catch (error) {
      console.error("[CashAdvanceModel] Failed to create cash advance:", error);
      throw new Error(
        `Failed to create cash advance: ${(error as any).message}`
      );
    }
  }

  async updateCashAdvance(cashAdvance: CashAdvance): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath();
        let jsonData: CashAdvancesJson;

        try {
          const fileContent = await window.electron.readFile(jsonPath);
          jsonData = JSON.parse(fileContent) as CashAdvancesJson;
        } catch (error) {
          // If file doesn't exist or is invalid, we can't update.
          // For robustness, create it if not found
          jsonData = {
            meta: {
              employeeId: this.employeeId,
              month: this.month,
              year: this.year,
              lastModified: new Date().toISOString(),
            },
            advances: {},
          };
        }

        // Check if the advance exists
        if (!jsonData.advances[cashAdvance.id]) {
          console.error(
            "[CashAdvanceModel] Cash advance not found:",
            cashAdvance.id
          );
          throw new Error("Cash advance not found");
        }

        // Update the cash advance in JSON data
        jsonData.advances[cashAdvance.id] = {
          id: cashAdvance.id,
          employeeId: cashAdvance.employeeId,
          date: cashAdvance.date.toISOString(),
          amount: cashAdvance.amount,
          remainingUnpaid: cashAdvance.remainingUnpaid,
          reason: cashAdvance.reason,
          approvalStatus: cashAdvance.approvalStatus,
          status: cashAdvance.status,
          paymentSchedule: cashAdvance.paymentSchedule,
          installmentDetails: cashAdvance.installmentDetails,
        };

        // Update last modified timestamp
        jsonData.meta.lastModified = new Date().toISOString();

        // Save JSON file
        await window.electron.writeFile(
          jsonPath,
          JSON.stringify(jsonData, null, 2)
        );
        console.log(
          `[CashAdvanceModel] Successfully updated cash advance in JSON`
        );
        return;
      }

      // CSV implementation (original code)
      const filePath = this.getCsvFilePath();

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
      } catch (error) {
        console.error("[CashAdvanceModel] Failed to read file:", error);
        throw new Error(
          `Failed to read cash advances file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());
      let found = false;
      let lineIndex = -1;

      // Check if first line is header
      const hasHeader =
        lines[0]?.toLowerCase().includes("id") &&
        lines[0]?.toLowerCase().includes("employeeid") &&
        lines[0]?.toLowerCase().includes("date") &&
        lines[0]?.toLowerCase().includes("amount");
      const dataStartIndex = hasHeader ? 1 : 0;

      // First, find the line with matching ID by parsing each line into a cash advance
      const cashAdvances = lines.slice(dataStartIndex).map((line, index) => {
        const fields = line.split(",");
        const [
          id,
          employeeId,
          date,
          amount,
          reason,
          approvalStatus,
          paymentSchedule,
          status,
          remainingUnpaid,
        ] = fields;

        // If this is the line we want to update
        if (id === cashAdvance.id) {
          found = true;
          lineIndex = index + dataStartIndex; // Adjust for header if present
        }

        return {
          id,
          employeeId,
          date: new Date(date),
          amount: parseFloat(amount),
          remainingUnpaid: parseFloat(remainingUnpaid || amount),
          reason,
          approvalStatus,
          status: status || "Unpaid",
          paymentSchedule,
        };
      });

      if (!found) {
        console.error(
          "[CashAdvanceModel] Cash advance not found:",
          cashAdvance.id
        );
        throw new Error("Cash advance not found");
      }

      // Update the line with all fields
      const formattedDate = `${
        cashAdvance.date.getMonth() + 1
      }/${cashAdvance.date.getDate()}/${cashAdvance.date.getFullYear()}`;
      lines[lineIndex] = [
        cashAdvance.id,
        cashAdvance.employeeId,
        formattedDate,
        cashAdvance.amount,
        cashAdvance.reason,
        cashAdvance.approvalStatus,
        cashAdvance.paymentSchedule,
        cashAdvance.status,
        cashAdvance.remainingUnpaid,
      ].join(",");

      await window.electron.writeFile(filePath, lines.join("\n") + "\n");
    } catch (error) {
      console.error("[CashAdvanceModel] Update failed:", error);
      throw error;
    }
  }

  async loadCashAdvances(employeeId: string): Promise<CashAdvance[]> {
    console.log(
      `[DEBUG] CashAdvanceModel.loadCashAdvances - Starting for employeeId: ${employeeId}, month: ${this.month}, year: ${this.year}`
    );
    try {
      await this.ensureDirectoryExists();

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath();
        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as CashAdvancesJson;

          // Convert JSON data to CashAdvance objects
          const advances: CashAdvance[] = Object.keys(jsonData.advances)
            .map((id) => {
              const advanceData = jsonData.advances[id];

              // Skip if not the requested employee
              if (advanceData.employeeId !== employeeId) {
                return null;
              }

              // Skip if not approved
              if (advanceData.approvalStatus !== "Approved") {
                return null;
              }

              return {
                id,
                employeeId: advanceData.employeeId,
                date: new Date(advanceData.date),
                amount: advanceData.amount,
                remainingUnpaid: advanceData.remainingUnpaid,
                reason: advanceData.reason,
                approvalStatus: advanceData.approvalStatus as
                  | "Pending"
                  | "Approved"
                  | "Rejected",
                status: advanceData.status as "Paid" | "Unpaid",
                paymentSchedule: advanceData.paymentSchedule as
                  | "One-time"
                  | "Installment",
                installmentDetails: advanceData.installmentDetails,
              } as CashAdvance;
            })
            .filter((advance): advance is CashAdvance => advance !== null);

          console.log(
            `[DEBUG] CashAdvanceModel.loadCashAdvances - Loaded ${advances.length} advances from JSON`
          );
          return advances;
        } catch (error: any) {
          if (
            error.code === "ENOENT" ||
            error instanceof SyntaxError ||
            (error instanceof Error && error.message.includes("ENOENT"))
          ) {
            console.log(
              `[DEBUG] CashAdvanceModel.loadCashAdvances - No JSON file found or invalid JSON. Trying CSV.`
            );
            // Fall through to CSV loading if JSON file doesn't exist
          } else {
            console.error(
              `[CashAdvanceModel] Error reading/parsing JSON file ${jsonPath}:`,
              error
            );
            throw error;
          }
        }
      }

      // CSV implementation (original code)
      const filePath = this.getCsvFilePath();
      console.log(
        `[DEBUG] CashAdvanceModel.loadCashAdvances - File path: ${filePath}`
      );

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
        console.log(
          `[DEBUG] CashAdvanceModel.loadCashAdvances - Successfully read file, length: ${data.length}`
        );
      } catch (error) {
        if ((error as any)?.message?.includes("no such file")) {
          console.log(
            `[DEBUG] CashAdvanceModel.loadCashAdvances - File not found, returning empty array`
          );
          return [];
        }
        console.error("[CashAdvanceModel] Error reading file:", error);
        throw new Error(
          `Failed to read cash advances file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());
      console.log(
        `[DEBUG] CashAdvanceModel.loadCashAdvances - Found ${lines.length} lines in the file`
      );

      const advances = lines
        .map((line, index) => {
          const fields = line.split(",");

          // Skip if this is a header row (exact match for header line)
          if (
            line.trim() ===
            "id,employeeId,date,amount,reason,approvalStatus,paymentSchedule,status,remainingUnpaid"
          ) {
            return null;
          }

          try {
            const [
              id,
              employeeId,
              date,
              amount,
              reason,
              approvalStatus,
              paymentSchedule,
              status,
              remainingUnpaid,
            ] = fields;

            // Parse date more reliably by splitting the components
            const [month, day, year] = date.split("/").map(Number);
            const parsedDate = new Date(year, month - 1, day);

            if (isNaN(parsedDate.getTime())) {
              console.log(
                `[DEBUG] CashAdvanceModel.loadCashAdvances - Invalid date in line ${
                  index + 1
                }: ${date}`
              );
              return null;
            }

            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount)) {
              console.log(
                `[DEBUG] CashAdvanceModel.loadCashAdvances - Invalid amount in line ${
                  index + 1
                }: ${amount}`
              );
              return null;
            }

            const parsedRemainingUnpaid = parseFloat(remainingUnpaid || amount);

            // Create the cash advance object
            const advance = {
              id,
              employeeId,
              date: parsedDate,
              amount: parsedAmount,
              remainingUnpaid: parsedRemainingUnpaid,
              reason,
              approvalStatus: approvalStatus as
                | "Pending"
                | "Approved"
                | "Rejected",
              status: (status || "Unpaid") as "Paid" | "Unpaid",
              paymentSchedule: paymentSchedule as "One-time" | "Installment",
              installmentDetails:
                paymentSchedule === "Installment"
                  ? {
                      numberOfPayments: 3,
                      amountPerPayment: Math.ceil(parsedAmount / 3),
                      remainingPayments: Math.ceil(
                        parsedRemainingUnpaid / (parsedAmount / 3)
                      ),
                    }
                  : undefined,
            } as CashAdvance;

            return advance;
          } catch (err) {
            console.error("[CashAdvanceModel] Error processing line:", err);
            return null;
          }
        })
        .filter((advance): advance is CashAdvance => advance !== null)
        .filter((advance) => advance.employeeId === employeeId)
        .filter((advance) => {
          const isApproved = advance.approvalStatus === "Approved";

          return isApproved; // Only filter by approval status, show both paid and unpaid
        });

      console.log(
        `[DEBUG] CashAdvanceModel.loadCashAdvances - Final filtered advances count: ${advances.length}`
      );
      return advances;
    } catch (error) {
      console.error("[CashAdvanceModel] Load error:", error);
      throw new Error(
        `Failed to load cash advances: ${(error as any).message}`
      );
    }
  }

  async deleteCashAdvance(id: string): Promise<void> {
    try {
      await this.ensureDirectoryExists();

      if (this.useJsonFormat) {
        // JSON implementation
        const jsonPath = this.getJsonFilePath();
        try {
          const fileContent = await window.electron.readFile(jsonPath);
          const jsonData = JSON.parse(fileContent) as CashAdvancesJson;

          // Check if the cash advance exists
          if (!jsonData.advances[id]) {
            throw new Error("Cash advance not found");
          }

          // Remove the cash advance
          delete jsonData.advances[id];

          // Update last modified timestamp
          jsonData.meta.lastModified = new Date().toISOString();

          // Save the updated JSON
          await window.electron.writeFile(
            jsonPath,
            JSON.stringify(jsonData, null, 2)
          );
          return;
        } catch (error: any) {
          if (error.code === "ENOENT") {
            throw new Error("Cash advance not found");
          }
          throw error;
        }
      }

      // CSV implementation (original code)
      const filePath = this.getCsvFilePath();

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
      } catch (error) {
        throw new Error(
          `Failed to read cash advances file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());
      const originalCount = lines.length;

      // Find the line with matching ID
      const updatedLines = lines.filter((line) => {
        const fields = line.split(",");
        const [lineId] = fields;
        return lineId !== id;
      });

      const newCount = updatedLines.length;

      if (originalCount === newCount) {
        throw new Error("Cash advance not found");
      }

      await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
    } catch (error) {
      throw error;
    }
  }

  async loadAllCashAdvancesForSync(): Promise<CashAdvance[]> {
    // This method would follow the pattern of loadAllLeavesForSync and loadAllLoansForSync
    // but is outside the scope of this specific update
    return [];
  }
}

// Factory function to create CompensationModel instance
export const createCashAdvanceModel = (
  dbPath: string,
  employeeId: string,
  month?: number,
  year?: number
): CashAdvanceModel => {
  // If dbPath doesn't include SweldoDB, append it
  const normalizedPath = dbPath.includes("SweldoDB")
    ? dbPath
    : `${dbPath}/SweldoDB`;
  const folderPath = `${normalizedPath}/cashAdvances/${employeeId}`;
  return new CashAdvanceModel(folderPath, employeeId, month, year);
};

/**
 * Migrate cash advance data from CSV to JSON format
 */
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    onProgress?.(`Starting Cash Advance CSV to JSON migration...`);

    // Normalize the path
    const normalizedPath = dbPath.includes("SweldoDB")
      ? dbPath
      : `${dbPath}/SweldoDB`;

    // In our case, cash advances are stored by employee ID
    // Base path for cash advances
    const cashAdvancesBasePath = `${normalizedPath}/cashAdvances`;

    // Ensure the directory exists
    await window.electron.ensureDir(cashAdvancesBasePath);

    // Since we can't get the list of directories directly, we'll need to try
    // different employee IDs and check if those folders exist
    let employeeIds: string[] = [];
    let processedCount = 0;
    let convertedCount = 0;

    onProgress?.(`Looking for employee folders in ${cashAdvancesBasePath}...`);

    try {
      // First check for single and double-digit employee IDs (1-99)
      for (let i = 1; i <= 99; i++) {
        const potentialEmployeeId = i.toString();
        const employeeFolder = `${cashAdvancesBasePath}/${potentialEmployeeId}`;

        try {
          // Check if this folder exists
          const exists = await window.electron.fileExists(employeeFolder);
          if (exists) {
            employeeIds.push(potentialEmployeeId);
            onProgress?.(`Found employee folder: ${potentialEmployeeId}`);
          }
        } catch (error) {
          // Folder doesn't exist, continue checking
        }
      }

      // Also check for potential 3-digit employee IDs (100-999)
      for (let i = 100; i <= 999; i++) {
        // Only check every 100th ID to avoid too many checks
        if (i % 100 === 0 || i === 100) {
          const potentialEmployeeId = i.toString();
          const employeeFolder = `${cashAdvancesBasePath}/${potentialEmployeeId}`;

          try {
            const exists = await window.electron.fileExists(employeeFolder);
            if (exists) {
              // If one exists, check the next 99 IDs in this range
              for (let j = i; j < i + 100 && j <= 999; j++) {
                const subId = j.toString();
                const subFolder = `${cashAdvancesBasePath}/${subId}`;
                try {
                  const subExists = await window.electron.fileExists(subFolder);
                  if (subExists) {
                    employeeIds.push(subId);
                    onProgress?.(`Found employee folder: ${subId}`);
                  }
                } catch (error) {
                  // Continue to next ID
                }
              }
            }
          } catch (error) {
            // Continue to next ID
          }
        }
      }

      // Check for specific known 4-digit and higher employee IDs
      const additionalIdsToCheck = ["1010", "10003"];
      for (const id of additionalIdsToCheck) {
        const employeeFolder = `${cashAdvancesBasePath}/${id}`;
        try {
          const exists = await window.electron.fileExists(employeeFolder);
          if (exists) {
            employeeIds.push(id);
            onProgress?.(`Found employee folder: ${id}`);
          }
        } catch (error) {
          // Folder doesn't exist, continue checking
        }
      }
    } catch (error) {
      onProgress?.(`Error checking for employee folders: ${error}`);
    }

    onProgress?.(`Found ${employeeIds.length} employee folders to process`);

    // Process each employee folder
    for (const employeeId of employeeIds) {
      const employeeFolder = `${cashAdvancesBasePath}/${employeeId}`;
      onProgress?.(`Processing employee ID: ${employeeId}`);

      // We'll check for files in the format {year}_{month}_cashAdvances.csv
      // Try common year/month combinations
      const currentYear = new Date().getFullYear();
      const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1];

      for (const year of yearsToCheck) {
        for (let month = 1; month <= 12; month++) {
          const csvFilePath = `${employeeFolder}/${year}_${month}_cashAdvances.csv`;
          const jsonFilePath = csvFilePath.replace(".csv", ".json");

          try {
            // Check if CSV file exists
            const csvExists = await window.electron.fileExists(csvFilePath);
            if (!csvExists) continue;

            processedCount++;
            onProgress?.(`Found CSV file: ${csvFilePath}`);

            // Check if JSON already exists and is newer
            let shouldConvert = true;
            try {
              const jsonExists = await window.electron.fileExists(jsonFilePath);
              if (jsonExists) {
                // If we could check file times, we would do it here
                // For now, we'll convert anyway to ensure the latest data
                onProgress?.(
                  `JSON file already exists but will be updated: ${jsonFilePath}`
                );
              }
            } catch (error) {
              // JSON doesn't exist, which is fine
            }

            if (shouldConvert) {
              // Read CSV content
              const csvContent = await window.electron.readFile(csvFilePath);
              const lines = csvContent
                .split("\n")
                .filter((line) => line.trim());

              // Check for header
              const hasHeader =
                lines[0]?.toLowerCase().includes("id") &&
                lines[0]?.toLowerCase().includes("employeeid") &&
                lines[0]?.toLowerCase().includes("date") &&
                lines[0]?.toLowerCase().includes("amount");
              const dataStartIndex = hasHeader ? 1 : 0;

              // Parse cash advances
              const jsonData: CashAdvancesJson = {
                meta: {
                  employeeId,
                  year,
                  month,
                  lastModified: new Date().toISOString(),
                },
                advances: {},
              };

              let validAdvanceCount = 0;

              for (let i = dataStartIndex; i < lines.length; i++) {
                const line = lines[i];
                const fields = line.split(",");

                // Update minimum field count to ensure id, employeeId, date, and amount are present
                if (fields.length < 4) {
                  onProgress?.(
                    `Skipping line ${
                      i + 1
                    } in ${csvFilePath} - insufficient fields: ${line}`
                  );
                  continue; // Skip if not enough fields
                }

                try {
                  const [
                    id,
                    advanceEmployeeId,
                    dateStr,
                    amountStr,
                    reason = "",
                    approvalStatus = "Pending",
                    paymentSchedule = "One-time",
                    status = "Unpaid",
                    remainingUnpaidStr = amountStr,
                  ] = fields;

                  // Parse date format (M/D/YYYY)
                  const [month, day, year] = dateStr.split("/").map(Number);
                  const date = new Date(year, month - 1, day);

                  if (isNaN(date.getTime())) {
                    onProgress?.(
                      `Skipping line ${
                        i + 1
                      } in ${csvFilePath} due to invalid date: ${dateStr}`
                    );
                    continue;
                  }

                  const amount = parseFloat(amountStr);
                  if (isNaN(amount)) {
                    onProgress?.(
                      `Skipping line ${
                        i + 1
                      } in ${csvFilePath} due to invalid amount: ${amountStr}`
                    );
                    continue;
                  }

                  const remainingUnpaid = parseFloat(
                    remainingUnpaidStr || amountStr
                  );

                  // Store in the JSON structure
                  jsonData.advances[id] = {
                    id,
                    employeeId: advanceEmployeeId,
                    date: date.toISOString(),
                    amount,
                    remainingUnpaid: isNaN(remainingUnpaid)
                      ? amount
                      : remainingUnpaid,
                    reason,
                    approvalStatus: approvalStatus as
                      | "Pending"
                      | "Approved"
                      | "Rejected",
                    status: status as "Paid" | "Unpaid",
                    paymentSchedule: paymentSchedule as
                      | "One-time"
                      | "Installment",
                    installmentDetails:
                      paymentSchedule === "Installment"
                        ? {
                            numberOfPayments: 3,
                            amountPerPayment: Math.ceil(amount / 3),
                            remainingPayments: Math.ceil(
                              (isNaN(remainingUnpaid)
                                ? amount
                                : remainingUnpaid) /
                                (amount / 3)
                            ),
                          }
                        : undefined,
                  };

                  validAdvanceCount++;
                } catch (error) {
                  onProgress?.(
                    `Error processing line ${i + 1} in ${csvFilePath}: ${error}`
                  );
                  continue;
                }
              }

              // Write JSON file if we found valid advances
              if (validAdvanceCount > 0) {
                await window.electron.writeFile(
                  jsonFilePath,
                  JSON.stringify(jsonData, null, 2)
                );
                convertedCount++;
                onProgress?.(
                  `Converted ${csvFilePath} to JSON with ${validAdvanceCount} valid advances`
                );
              } else {
                onProgress?.(
                  `No valid advances found in ${csvFilePath}, skipping JSON creation`
                );
              }
            }
          } catch (error) {
            onProgress?.(`Error processing file ${csvFilePath}: ${error}`);
          }
        }
      }
    }

    onProgress?.(
      `Cash Advance migration completed: Processed ${processedCount} files, converted ${convertedCount} to JSON format`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`Error during Cash Advance migration: ${message}`);
    console.error("Cash Advance migration error:", error);
    throw error;
  }
}
