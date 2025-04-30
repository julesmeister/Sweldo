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

export class CashAdvanceModel {
  filePath: string;
  employeeId: string;
  month: number;
  year: number;

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

      const formattedDate = `${
        cashAdvance.date.getMonth() + 1
      }/${cashAdvance.date.getDate()}/${cashAdvance.date.getFullYear()}`;
      // Generate a unique ID for the new cash advance
      const id = crypto.randomUUID();

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

      const filePath = `${this.filePath}/${this.year}_${this.month}_cashAdvances.csv`;

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
      const filePath = `${this.filePath}/${this.year}_${this.month}_cashAdvances.csv`;

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
      const hasHeader = lines[0]
        ?.toLowerCase()
        .includes("id,employeeid,date,amount");
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
    try {
      const filePath = `${this.filePath}/${this.year}_${this.month}_cashAdvances.csv`;

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
      } catch (error) {
        if ((error as any)?.message?.includes("no such file")) {
          return [];
        }
        console.error("[CashAdvanceModel] Error reading file:", error);
        throw new Error(
          `Failed to read cash advances file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());

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
              return null;
            }

            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount)) {
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
      const filePath = `${this.filePath}/${this.year}_${this.month}_cashAdvances.csv`;

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
