import Papa from "papaparse";
import { toast } from "sonner";

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
  lastPaymentPeriod?: {
    start: Date;
    end: Date;
  };
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

export class EmployeeModel {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  // Load employees from CSV
  public async loadEmployees(): Promise<Employee[]> {
    try {
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
      const fileContent = await retryOperation(async () => {
        return await window.electron.readFile(this.filePath);
      });
      if (!fileContent) {
        console.log("[EmployeeModel] No file content found");
        return null;
      }
      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });
      const employees = results.data as Employee[];
      const employee = employees.find((emp) => emp.id === id) || null;

      console.log("[EmployeeModel] Raw employee data from CSV:", {
        employeeId: employee?.id,
        lastPaymentPeriod: employee?.lastPaymentPeriod,
        startType: employee?.lastPaymentPeriod?.start
          ? typeof employee?.lastPaymentPeriod?.start
          : "undefined",
        endType: employee?.lastPaymentPeriod?.end
          ? typeof employee?.lastPaymentPeriod?.end
          : "undefined",
        startValue: employee?.lastPaymentPeriod?.start,
        endValue: employee?.lastPaymentPeriod?.end,
      });

      // Convert lastPaymentPeriod dates back to Date objects if they exist
      if (employee?.lastPaymentPeriod) {
        try {
          // If lastPaymentPeriod is a string, try to parse it as JSON
          // Handle both escaped and unescaped JSON strings
          const lastPaymentPeriod =
            typeof employee.lastPaymentPeriod === "string"
              ? JSON.parse(employee.lastPaymentPeriod.replace(/\\/g, ""))
              : employee.lastPaymentPeriod;

          console.log(
            "[EmployeeModel] Parsed lastPaymentPeriod:",
            lastPaymentPeriod
          );

          employee.lastPaymentPeriod = {
            start: new Date(lastPaymentPeriod.start),
            end: new Date(lastPaymentPeriod.end),
          };

          console.log("[EmployeeModel] Converted lastPaymentPeriod:", {
            after: employee.lastPaymentPeriod,
            startType: typeof employee.lastPaymentPeriod.start,
            endType: typeof employee.lastPaymentPeriod.end,
            startValue: employee.lastPaymentPeriod.start.toISOString(),
            endValue: employee.lastPaymentPeriod.end.toISOString(),
          });
        } catch (error) {
          console.error(
            "[EmployeeModel] Error parsing lastPaymentPeriod:",
            error
          );
          employee.lastPaymentPeriod = undefined;
        }
      } else {
        console.log("[EmployeeModel] No lastPaymentPeriod found for employee");
      }

      return employee;
    } catch (error) {
      console.error("[EmployeeModel] Error loading employee:", error);
      return null;
    }
  }

  // Save employees to CSV
  public async saveOnlyNewEmployees(employees: Employee[]): Promise<void> {
    try {
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
      console.log("[EmployeeModel] Updating employee details:", {
        employeeId: employee.id,
        lastPaymentPeriod: employee.lastPaymentPeriod,
        startType: employee.lastPaymentPeriod?.start
          ? typeof employee.lastPaymentPeriod.start
          : "undefined",
        endType: employee.lastPaymentPeriod?.end
          ? typeof employee.lastPaymentPeriod.end
          : "undefined",
        startValue: employee.lastPaymentPeriod?.start?.toISOString(),
        endValue: employee.lastPaymentPeriod?.end?.toISOString(),
      });

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

      // Update the employee's details
      currentEmployees[index] = { ...currentEmployees[index], ...employee };

      console.log("[EmployeeModel] Updated employee data before saving:", {
        employeeId: currentEmployees[index].id,
        lastPaymentPeriod: currentEmployees[index].lastPaymentPeriod,
        startType: currentEmployees[index].lastPaymentPeriod?.start
          ? typeof currentEmployees[index].lastPaymentPeriod.start
          : "undefined",
        endType: currentEmployees[index].lastPaymentPeriod?.end
          ? typeof currentEmployees[index].lastPaymentPeriod.end
          : "undefined",
        startValue:
          currentEmployees[index].lastPaymentPeriod?.start?.toISOString(),
        endValue: currentEmployees[index].lastPaymentPeriod?.end?.toISOString(),
      });

      // Convert dates to ISO strings and stringify the lastPaymentPeriod object before saving to CSV
      const employeesToSave = currentEmployees.map((emp) => ({
        ...emp,
        lastPaymentPeriod: emp.lastPaymentPeriod
          ? JSON.stringify({
              start: emp.lastPaymentPeriod.start.toISOString(),
              end: emp.lastPaymentPeriod.end.toISOString(),
            })
          : undefined,
      }));

      console.log("[EmployeeModel] Data being saved to CSV:", {
        employeeId: employeesToSave[index].id,
        lastPaymentPeriod: employeesToSave[index].lastPaymentPeriod,
      });

      // Save the updated employee list back to the CSV
      const csv = Papa.unparse(employeesToSave);
      await retryOperation(async () => {
        await window.electron.writeFile(this.filePath, csv);
      });
      toast.success(`Employee details updated.`);
    } catch (error) {
      const errorMessage = `Failed to update employee details: ${error}`;
      console.error(errorMessage);
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
