import Papa from "papaparse";
import { toast } from "sonner";
import path from "path";

interface LastPaymentPeriod {
  startDate: string;
  endDate: string;
  start: string;
  end: string;
}

export interface Employee {
  id: string;
  name: string;
  position?: string;
  dailyRate?: number;
  sss?: number;
  philHealth?: number;
  pagIbig?: number;
  status: "active" | "inactive";
  employmentType?: string;
  lastPaymentPeriod: string | LastPaymentPeriod | null;
  startType?: string;
  endType?: string;
}

// Add a delay utility function
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Add a retry utility function
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error as Error;
      if (error.message.includes("EBUSY")) {
        console.log(
          `File busy, retrying in ${delayMs}ms... (attempt ${
            attempt + 1
          }/${maxRetries})`
        );
        await delay(delayMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

// Add type guard
const isLastPaymentPeriod = (value: any): value is LastPaymentPeriod => {
  return (
    value && typeof value === "object" && "start" in value && "end" in value
  );
};

export class EmployeeModel {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.ensureEmployeeFile();
  }

  private async ensureEmployeeFile(): Promise<void> {
    try {
      const exists = await window.electron.fileExists(this.filePath);
      if (!exists) {
        // Create directory if it doesn't exist
        await window.electron.ensureDir(path.dirname(this.filePath));
        // Create file with headers
        const headers =
          "id,name,position,dailyRate,sss,philHealth,pagIbig,status,employmentType,lastPaymentPeriod,startType,endType\n";
        await window.electron.writeFile(this.filePath, headers);
      }
    } catch (error) {
      console.error("[EmployeeModel] Error ensuring employee file:", error);
      throw error;
    }
  }

  // Load employees from CSV
  public async loadEmployees(): Promise<Employee[]> {
    try {
      await this.ensureEmployeeFile();
      const fileContent = await retryOperation(async () => {
        return await window.electron.readFile(this.filePath);
      });
      if (!fileContent) {
        return []; // Return empty array if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });
      return results.data as Employee[];
    } catch (error) {
      return []; // Return empty array if there's an error
    }
  }

  // Load active employees from CSV
  public async loadActiveEmployees(): Promise<Employee[]> {
    const allEmployees = await this.loadEmployees();
    return allEmployees.filter((employee) => employee.status === "active");
  }

  // Load a specific employee from CSV by ID
  public async loadEmployeeById(id: string): Promise<Employee | null> {
    try {
      await this.ensureEmployeeFile();
      const fileContent = await retryOperation(async () => {
        return await window.electron.readFile(this.filePath);
      });
      if (!fileContent) {
        return null;
      }
      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });
      const employees = results.data as Employee[];
      const employee = employees.find((emp) => emp.id === id) || null;

      if (employee) {
        const lastPaymentPeriod = employee.lastPaymentPeriod
          ? typeof employee.lastPaymentPeriod === "string"
            ? JSON.parse(employee.lastPaymentPeriod.replace(/\\/g, ""))
            : employee.lastPaymentPeriod
          : null;

        return {
          ...employee,
          lastPaymentPeriod,
          startType: isLastPaymentPeriod(lastPaymentPeriod)
            ? typeof lastPaymentPeriod.start
            : "undefined",
          endType: isLastPaymentPeriod(lastPaymentPeriod)
            ? typeof lastPaymentPeriod.end
            : "undefined",
        };
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  // Save employees to CSV
  public async saveOnlyNewEmployees(employees: Employee[]): Promise<void> {
    try {
      await this.ensureEmployeeFile();
      const currentEmployees = await this.loadEmployees();
      const newEmployees = employees.filter(
        (newEmployee) =>
          !currentEmployees.some(
            (existingEmployee) => existingEmployee.id === newEmployee.id
          )
      );
      const allEmployees = [...currentEmployees, ...newEmployees];
      const csv = Papa.unparse(allEmployees);
      await retryOperation(async () => {
        await window.electron.writeFile(this.filePath, csv);
      });
    } catch (error) {
      throw error;
    }
  }

  // Update employee status
  public async updateEmployeeStatus(employee: Employee): Promise<void> {
    try {
      await this.ensureEmployeeFile();
      // Load current employees
      const currentEmployees = await this.loadEmployees();
      // Find the index of the employee to update
      const index = currentEmployees.findIndex(
        (existingEmployee) => existingEmployee.id === employee.id
      );
      if (index === -1) {
        const error = `Employee with id ${employee.id} not found.`;
        console.error(error);
        toast.error(error);
        return;
      }
      // Update the employee's status
      currentEmployees[index].status = employee.status;
      // Save the updated employee list back to the CSV
      const csv = Papa.unparse(currentEmployees);
      await retryOperation(async () => {
        await window.electron.writeFile(this.filePath, csv);
      });
      toast.success(`Employee status updated to ${employee.status}.`);
    } catch (error) {
      const errorMessage = `Failed to update employee status: ${error}`;
      console.error(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  }

  // Update employee details
  public async updateEmployeeDetails(employee: Employee): Promise<void> {
    try {
      await this.ensureEmployeeFile();

      // Load current employees
      const currentEmployees = await this.loadEmployees();
      // Find the index of the employee to update
      const index = currentEmployees.findIndex(
        (existingEmployee) => existingEmployee.id === employee.id
      );
      if (index === -1) {
        const error = `Employee with id ${employee.id} not found.`;
        toast.error(error);
        return;
      }

      // Update the employee's details
      currentEmployees[index] = { ...currentEmployees[index], ...employee };

      // Convert dates to ISO strings and stringify the lastPaymentPeriod object before saving to CSV
      const employeesToSave = currentEmployees.map((emp) => ({
        ...emp,
        lastPaymentPeriod: isLastPaymentPeriod(emp.lastPaymentPeriod)
          ? JSON.stringify({
              start: emp.lastPaymentPeriod.start,
              end: emp.lastPaymentPeriod.end,
            })
          : undefined,
      }));

      // Save the updated employee list back to the CSV
      const csv = Papa.unparse(employeesToSave);
      await retryOperation(async () => {
        await window.electron.writeFile(this.filePath, csv);
      });
      toast.success(`Employee details updated.`);
    } catch (error) {
      const errorMessage = `Failed to update employee details: ${error}`;
      toast.error(errorMessage);
      throw error;
    }
  }
}
// Factory function to create EmployeeModel instance
export const createEmployeeModel = (dbPath: string): EmployeeModel => {
  const filePath = `${dbPath}/SweldoDB/employees.csv`; // Adjust the path as needed
  return new EmployeeModel(filePath);
};
