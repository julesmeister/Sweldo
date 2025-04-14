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
      const employeePath = `${this.filePath}`;
      await window.electron.ensureDir(employeePath);
    } catch (error) {
      throw error;
    }
  }

  async createCashAdvance(cashAdvance: CashAdvance): Promise<void> {
    try {
      const formattedDate = `${this.month}/${cashAdvance.date.getDate()}/${
        this.year
      }`;
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

      // Ensure directory exists before saving
      await this.ensureDirectoryExists();

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
        throw new Error(
          `Failed to read cash advances file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());
      let found = false;
      let lineIndex = -1;

      // Check if first line is header
      const hasHeader = lines[0]?.toLowerCase().includes("date,amount,reason");
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
        const parsedAmount = parseFloat(amount);
        const parsedDate = new Date(date);

        const advance = {
          id,
          employeeId,
          date: parsedDate,
          amount: parsedAmount,
          remainingUnpaid: parseFloat(remainingUnpaid || amount),
          reason,
          approvalStatus: approvalStatus as "Pending" | "Approved" | "Rejected",
          status: (status || "Unpaid") as "Paid" | "Unpaid",
          paymentSchedule: paymentSchedule as "One-time" | "Installment",
        } as CashAdvance;

        // If this is the line we want to update
        if (id === cashAdvance.id) {
          found = true;
          lineIndex = index + dataStartIndex; // Adjust for header if present
        }

        return advance;
      });

      if (!found) {
        throw new Error("Cash advance not found");
      }

      // Update the line with all fields
      const formattedDate = `${this.month}/${cashAdvance.date.getDate()}/${
        this.year
      }`;
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
        // If file doesn't exist, create it with headers
        if ((error as any)?.message?.includes("no such file")) {
          return [];
        }
        throw new Error(
          `Failed to read cash advances file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      const advances = dataLines
        .map((line, index) => {
          const fields = line.split(",");

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

            const parsedDate = new Date(date);
            // Filter by month and year
            if (
              parsedDate.getMonth() + 1 !== this.month ||
              parsedDate.getFullYear() !== this.year
            ) {
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
              // Add installment details if it's an installment payment
              installmentDetails:
                paymentSchedule === "Installment"
                  ? {
                      numberOfPayments: 3, // Default to 3 payments
                      amountPerPayment: Math.ceil(parsedAmount / 3),
                      remainingPayments: Math.ceil(
                        parsedRemainingUnpaid / (parsedAmount / 3)
                      ),
                    }
                  : undefined,
            } as CashAdvance;

            // Double check the status matches the remaining amount
            if (advance.remainingUnpaid > 0 && advance.status === "Paid") {
              advance.status = "Unpaid";
            } else if (
              advance.remainingUnpaid === 0 &&
              advance.status === "Unpaid"
            ) {
              advance.status = "Paid";
            }

            return advance;
          } catch (err) {
            return null;
          }
        })
        .filter((advance): advance is CashAdvance => advance !== null)
        .filter((advance) => advance.employeeId === employeeId);

      return advances;
    } catch (error) {
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
  const folderPath = `${dbPath}/SweldoDB/cashAdvances/${employeeId}`;
  return new CashAdvanceModel(folderPath, employeeId, month, year);
};
