import Papa from "papaparse";
import { toast } from 'sonner';

export interface Employee {
  id: string;
  name: string;
  position?: string;
  dailyRate?: number;
  sss?: number;
  philHealth?: number;
  pagIbig?: number;
  status: 'active' | 'inactive';
  employmentType?: string;
  lastPaymentPeriod?: {
    start: Date;
    end: Date;
  };
}

// Add a delay utility function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      if (error.message.includes('EBUSY')) {
        console.log(`File busy, retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
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
      const results = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      return results.data as Employee[];
    } catch (error) {
      return []; // Return empty array if there's an error
    }
  }

  // Load active employees from CSV
  public async loadActiveEmployees(): Promise<Employee[]> {
    const allEmployees = await this.loadEmployees();
    return allEmployees.filter(employee => employee.status === 'active');
  }

  // Load a specific employee from CSV by ID
  public async loadEmployeeById(id: string): Promise<Employee | null> {
    try {
      const fileContent = await retryOperation(async () => {
        return await window.electron.readFile(this.filePath);
      });
      if (!fileContent) {
        return null; // Return null if file is empty or doesn't exist
      }
      const results = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
      const employees = results.data as Employee[];
      const employee = employees.find((emp) => emp.id === id) || null; // Return the employee or null if not found
      return employee;
    } catch (error) {
      return null; // Return null if there's an error
    }
  }

  // Save employees to CSV
  public async saveOnlyNewEmployees(employees: Employee[]): Promise<void> {
    try {
      const currentEmployees = await this.loadEmployees();
      const newEmployees = employees.filter(newEmployee => !currentEmployees.some(existingEmployee => existingEmployee.id === newEmployee.id));
      const allEmployees = [...currentEmployees, ...newEmployees];
      const csv = Papa.unparse(allEmployees);
      await retryOperation(async () => {
        await window.electron.saveFile(this.filePath, csv);
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
      const index = currentEmployees.findIndex(existingEmployee => existingEmployee.id === employee.id);
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
        await window.electron.saveFile(this.filePath, csv);
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
      // Load current employees
      const currentEmployees = await this.loadEmployees();
      // Find the index of the employee to update
      const index = currentEmployees.findIndex(existingEmployee => existingEmployee.id === employee.id);
      if (index === -1) {
        const error = `Employee with id ${employee.id} not found.`;
        console.error(error);
        toast.error(error);
        return;
      }
      // Update the employee's details
      currentEmployees[index] = { ...currentEmployees[index], ...employee };
      // Save the updated employee list back to the CSV
      const csv = Papa.unparse(currentEmployees);
      await retryOperation(async () => {
        await window.electron.saveFile(this.filePath, csv);
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
