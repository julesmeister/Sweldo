export interface Short {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  remainingUnpaid: number;
  reason: string;
  status: "Paid" | "Unpaid";
}

export class ShortModel {
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

  async createShort(short: Short): Promise<void> {
    try {
      const formattedDate = `${this.month}/${short.date.getDate()}/${
        this.year
      }`;
      // Generate a unique ID for the new short
      const id = crypto.randomUUID();

      // Save all necessary fields including status and remainingUnpaid
      const csvData =
        [
          id,
          this.employeeId,
          formattedDate,
          short.amount,
          short.reason,
          short.status,
          short.remainingUnpaid || short.amount,
        ].join(",") + "\n";

      const filePath = `${this.filePath}/${this.year}_${this.month}_shorts.csv`;

      // Define headers for new files
      const headers =
        [
          "id",
          "employeeId",
          "date",
          "amount",
          "reason",
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
      throw new Error(`Failed to create short: ${(error as any).message}`);
    }
  }

  async updateShort(short: Short): Promise<void> {
    try {
      const filePath = `${this.filePath}/${this.year}_${this.month}_shorts.csv`;

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
      } catch (error) {
        throw new Error(
          `Failed to read shorts file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());
      let found = false;
      let lineIndex = -1;

      // Check if first line is header
      const hasHeader = lines[0]?.toLowerCase().includes("date,amount,reason");
      const dataStartIndex = hasHeader ? 1 : 0;

      // First, find the line with matching ID by parsing each line into a short
      const shorts = lines.slice(dataStartIndex).map((line, index) => {
        const fields = line.split(",");
        const [id, employeeId, date, amount, reason, status, remainingUnpaid] =
          fields;
        const parsedAmount = parseFloat(amount);
        const parsedDate = new Date(date);

        const shortItem = {
          id,
          employeeId,
          date: parsedDate,
          amount: parsedAmount,
          remainingUnpaid: parseFloat(remainingUnpaid || amount),
          reason,
          status: status as "Paid" | "Unpaid",
        } as Short;

        // If this is the line we want to update
        if (id === short.id) {
          found = true;
          lineIndex = index + dataStartIndex; // Adjust for header if present
        }

        return shortItem;
      });

      if (!found) {
        throw new Error("Short not found");
      }

      // Update the line with all fields
      const formattedDate = `${this.month}/${short.date.getDate()}/${
        this.year
      }`;
      lines[lineIndex] = [
        short.id,
        short.employeeId,
        formattedDate,
        short.amount,
        short.reason,
        short.status,
        short.remainingUnpaid,
      ].join(",");

      await window.electron.writeFile(filePath, lines.join("\n") + "\n");
    } catch (error) {
      throw error;
    }
  }

  async loadShorts(employeeId: string): Promise<Short[]> {
    try {
      const filePath = `${this.filePath}/${this.year}_${this.month}_shorts.csv`;

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
      } catch (error) {
        // If file doesn't exist, create it with headers
        if ((error as any)?.message?.includes("no such file")) {
          return [];
        }
        throw new Error(
          `Failed to read shorts file: ${(error as any).message}`
        );
      }

      const lines = data.split("\n").filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      const shorts = dataLines
        .map((line, index) => {
          const fields = line.split(",");

          try {
            const [
              id,
              employeeId,
              date,
              amount,
              reason,
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

            // Create the short object
            const shortItem = {
              id,
              employeeId,
              date: parsedDate,
              amount: parsedAmount,
              remainingUnpaid: parsedRemainingUnpaid,
              reason,
              status: status as "Paid" | "Unpaid",
            } as Short;

            // Double check the status matches the remaining amount
            if (shortItem.remainingUnpaid > 0 && shortItem.status === "Paid") {
              shortItem.status = "Unpaid";
            } else if (
              shortItem.remainingUnpaid === 0 &&
              shortItem.status === "Unpaid"
            ) {
              shortItem.status = "Paid";
            }

            return shortItem;
          } catch (err) {
            return null;
          }
        })
        .filter((short): short is Short => short !== null)
        .filter((short) => short.employeeId === employeeId);

      return shorts;
    } catch (error) {
      throw new Error(`Failed to load shorts: ${(error as any).message}`);
    }
  }

  async deleteShort(id: string): Promise<void> {
    try {
      const filePath = `${this.filePath}/${this.year}_${this.month}_shorts.csv`;

      let data: string;
      try {
        data = await window.electron.readFile(filePath);
      } catch (error) {
        throw new Error(
          `Failed to read shorts file: ${(error as any).message}`
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
        throw new Error("Short not found");
      }

      await window.electron.writeFile(filePath, updatedLines.join("\n") + "\n");
    } catch (error) {
      throw error;
    }
  }
}

// Factory function to create ShortModel instance
export const createShortModel = (
  dbPath: string,
  employeeId: string,
  month?: number,
  year?: number
): ShortModel => {
  const folderPath = `${dbPath}/SweldoDB/shorts/${employeeId}`;
  return new ShortModel(folderPath, employeeId, month, year);
};
