import Papa from "papaparse";
import { toast } from "sonner";
import path from "path";
import {
  loadEmployeesFirestore,
  loadActiveEmployeesFirestore,
  loadEmployeeByIdFirestore,
  saveOnlyNewEmployeesFirestore,
  updateEmployeeStatusFirestore,
  updateEmployeeDetailsFirestore,
} from "./employee_firestore";
import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";

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

// JSON structure for employees
interface EmployeesJson {
  meta: {
    lastModified: string;
  };
  employees: {
    [id: string]: {
      id: string;
      name: string;
      position?: string;
      dailyRate?: number;
      sss?: number;
      philHealth?: number;
      pagIbig?: number;
      status: "active" | "inactive";
      employmentType?: string;
      lastPaymentPeriod: LastPaymentPeriod | null;
    };
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

// Add type guard
const isLastPaymentPeriod = (value: any): value is LastPaymentPeriod => {
  return (
    value && typeof value === "object" && "start" in value && "end" in value
  );
};

export class EmployeeModel {
  private csvFilePath: string;
  private jsonFilePath: string;
  private useJsonFormat: boolean = true;

  constructor(filePath: string) {
    // Keep original path for CSV
    this.csvFilePath = filePath;

    // Set JSON path to use .json extension
    this.jsonFilePath = filePath.replace(".csv", ".json");

    // Initialize files
    this.ensureEmployeeFiles();
  }

  /**
   * Set whether to use JSON format (true) or CSV format (false)
   */
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  private async ensureEmployeeFiles(): Promise<void> {
    try {
      // Skip file operations in web mode
      if (isWebEnvironment()) {
        return;
      }

      // Check if JSON file exists, create it if needed
      if (this.useJsonFormat) {
        const jsonExists = await window.electron.fileExists(this.jsonFilePath);
        if (!jsonExists) {
          // Initialize with empty data structure
          const emptyJsonData: EmployeesJson = {
            meta: {
              lastModified: new Date().toISOString(),
            },
            employees: {},
          };
          await window.electron.writeFile(
            this.jsonFilePath,
            JSON.stringify(emptyJsonData, null, 2)
          );
        }
      }
    } catch (error) {
      console.error("[EmployeeModel] Error ensuring employee files:", error);
      throw error;
    }
  }

  /**
   * Check if JSON file exists
   */
  private async jsonFileExists(): Promise<boolean> {
    return await window.electron.fileExists(this.jsonFilePath);
  }

  /**
   * Check if CSV file exists
   */
  private async csvFileExists(): Promise<boolean> {
    return await window.electron.fileExists(this.csvFilePath);
  }

  /**
   * Load employees from JSON
   */
  private async loadEmployeesFromJson(): Promise<Employee[]> {
    try {
      const jsonExists = await this.jsonFileExists();
      if (!jsonExists) {
        console.log(
          "[EmployeeModel] JSON file doesn't exist yet, falling back to CSV"
        );
        return this.loadEmployeesFromCsv();
      }

      const fileContent = await retryOperation(async () => {
        return await window.electron.readFile(this.jsonFilePath);
      });

      if (!fileContent || fileContent.trim() === "") {
        console.log("[EmployeeModel] JSON file is empty, falling back to CSV");
        return this.loadEmployeesFromCsv();
      }

      const jsonData = JSON.parse(fileContent) as EmployeesJson;

      return Object.values(jsonData.employees).map((emp) => ({
        ...emp,
        lastPaymentPeriod: emp.lastPaymentPeriod,
        startType: isLastPaymentPeriod(emp.lastPaymentPeriod)
          ? typeof emp.lastPaymentPeriod.start
          : "undefined",
        endType: isLastPaymentPeriod(emp.lastPaymentPeriod)
          ? typeof emp.lastPaymentPeriod.end
          : "undefined",
      }));
    } catch (error) {
      console.error("[EmployeeModel] Error loading from JSON:", error);
      return this.loadEmployeesFromCsv(); // Fallback to CSV
    }
  }

  /**
   * Load employees from CSV
   */
  private async loadEmployeesFromCsv(): Promise<Employee[]> {
    try {
      const csvExists = await this.csvFileExists();
      if (!csvExists) {
        await this.ensureEmployeeFiles();
      }

      const fileContent = await retryOperation(async () => {
        return await window.electron.readFile(this.csvFilePath);
      });

      if (!fileContent) {
        return []; // Return empty array if file is empty or doesn't exist
      }

      const results = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
      });

      return (results.data as Employee[]).map((emp) => {
        // Parse lastPaymentPeriod if it's a string
        let lastPaymentPeriod = emp.lastPaymentPeriod;
        if (typeof lastPaymentPeriod === "string" && lastPaymentPeriod) {
          try {
            lastPaymentPeriod = JSON.parse(
              lastPaymentPeriod.replace(/\\/g, "")
            );
          } catch (e) {
            console.warn(
              `Failed to parse lastPaymentPeriod for employee ${emp.id}`
            );
          }
        }

        return {
          ...emp,
          lastPaymentPeriod,
          startType: isLastPaymentPeriod(lastPaymentPeriod)
            ? typeof (lastPaymentPeriod as LastPaymentPeriod).start
            : "undefined",
          endType: isLastPaymentPeriod(lastPaymentPeriod)
            ? typeof (lastPaymentPeriod as LastPaymentPeriod).end
            : "undefined",
        };
      });
    } catch (error) {
      console.error("[EmployeeModel] Error loading from CSV:", error);
      return []; // Return empty array if there's an error
    }
  }

  /**
   * Save employees to JSON
   */
  private async saveEmployeesToJson(employees: Employee[]): Promise<void> {
    try {
      // Ensure directory exists
      await window.electron.ensureDir(path.dirname(this.jsonFilePath));

      // Prepare data structure
      const jsonData: EmployeesJson = {
        meta: {
          lastModified: new Date().toISOString(),
        },
        employees: {},
      };

      // Convert employees array to object with IDs as keys
      employees.forEach((emp) => {
        // Handle lastPaymentPeriod (ensure it's an object or null)
        let lastPaymentPeriod: LastPaymentPeriod | null = null;

        if (emp.lastPaymentPeriod) {
          if (typeof emp.lastPaymentPeriod === "string") {
            try {
              lastPaymentPeriod = JSON.parse(
                emp.lastPaymentPeriod.replace(/\\/g, "")
              );
            } catch (e) {
              console.warn(
                `Failed to parse lastPaymentPeriod for employee ${emp.id}, setting to null`
              );
            }
          } else if (isLastPaymentPeriod(emp.lastPaymentPeriod)) {
            lastPaymentPeriod = emp.lastPaymentPeriod;
          }
        }

        jsonData.employees[emp.id] = {
          id: emp.id,
          name: emp.name,
          position: emp.position,
          dailyRate: emp.dailyRate,
          sss: emp.sss,
          philHealth: emp.philHealth,
          pagIbig: emp.pagIbig,
          status: emp.status,
          employmentType: emp.employmentType,
          lastPaymentPeriod: lastPaymentPeriod,
        };
      });

      // Write to file
      await retryOperation(async () => {
        await window.electron.writeFile(
          this.jsonFilePath,
          JSON.stringify(jsonData, null, 2)
        );
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save employees to CSV
   */
  private async saveEmployeesToCsv(employees: Employee[]): Promise<void> {
    try {
      // Convert lastPaymentPeriod to string for CSV storage
      const employeesToSave = employees.map((emp) => {
        // Convert lastPaymentPeriod to string before saving to CSV
        return {
          ...emp,
          lastPaymentPeriod: emp.lastPaymentPeriod
            ? typeof emp.lastPaymentPeriod === "string"
              ? emp.lastPaymentPeriod // Keep the existing JSON string
              : JSON.stringify(emp.lastPaymentPeriod)
            : null,
        };
      });

      // Convert to CSV
      const csv = Papa.unparse(employeesToSave);

      // Write to file
      await retryOperation(async () => {
        await window.electron.writeFile(this.csvFilePath, csv);
      });
    } catch (error) {
      throw error;
    }
  }

  // Public API methods (same as original)

  /**
   * Load all employees
   */
  public async loadEmployees(): Promise<Employee[]> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      return loadEmployeesFirestore(companyName);
    }

    // Desktop mode - use existing implementation
    if (this.useJsonFormat) {
      return this.loadEmployeesFromJson();
    } else {
      return this.loadEmployeesFromCsv();
    }
  }

  /**
   * Load only active employees
   */
  public async loadActiveEmployees(): Promise<Employee[]> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore with query
      const companyName = await getCompanyName();
      return loadActiveEmployeesFirestore(companyName);
    }

    // Desktop mode - filter locally
    const allEmployees = await this.loadEmployees();
    return allEmployees.filter((employee) => employee.status === "active");
  }

  /**
   * Load employee by ID
   */
  public async loadEmployeeById(id: string): Promise<Employee | null> {
    if (isWebEnvironment()) {
      // Web mode - use Firestore with direct document lookup
      const companyName = await getCompanyName();
      return loadEmployeeByIdFirestore(id, companyName);
    }

    // Desktop mode - load all and filter
    const allEmployees = await this.loadEmployees();
    return allEmployees.find((emp) => emp.id === id) || null;
  }

  /**
   * Add new employees (only if they don't exist)
   */
  public async saveOnlyNewEmployees(employees: Employee[]): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await saveOnlyNewEmployeesFirestore(employees, companyName);
        return;
      }

      // Desktop mode - use existing implementation
      // Load current employees
      const currentEmployees = await this.loadEmployees();

      // Filter only new employees
      const newEmployees = employees.filter(
        (newEmployee) =>
          !currentEmployees.some(
            (existingEmployee) => existingEmployee.id === newEmployee.id
          )
      );

      // Combine with existing employees
      const allEmployees = [...currentEmployees, ...newEmployees];

      // Save to appropriate format(s)
      if (this.useJsonFormat) {
        await this.saveEmployeesToJson(allEmployees);
      }

      // Always save to CSV for backward compatibility
      await this.saveEmployeesToCsv(allEmployees);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update employee status
   */
  public async updateEmployeeStatus(employee: Employee): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await updateEmployeeStatusFirestore(employee, companyName);
        toast.success(`Employee status updated to ${employee.status}.`);
        return;
      }

      // Desktop mode - use existing implementation
      // Load current employees
      const currentEmployees = await this.loadEmployees();

      // Find the employee to update
      const index = currentEmployees.findIndex(
        (existingEmployee) => existingEmployee.id === employee.id
      );

      if (index === -1) {
        const error = `Employee with id ${employee.id} not found.`;
        console.error(error);
        toast.error(error);
        return;
      }

      // Update status
      currentEmployees[index].status = employee.status;

      // Save to appropriate format(s)
      if (this.useJsonFormat) {
        await this.saveEmployeesToJson(currentEmployees);
      }

      // Always save to CSV for backward compatibility
      await this.saveEmployeesToCsv(currentEmployees);

      toast.success(`Employee status updated to ${employee.status}.`);
    } catch (error) {
      const errorMessage = `Failed to update employee status: ${error}`;
      console.error(errorMessage);
      toast.error(errorMessage);
      throw error;
    }
  }

  /**
   * Update employee details
   */
  public async updateEmployeeDetails(employee: Employee): Promise<void> {
    try {
      if (isWebEnvironment()) {
        // Web mode - use Firestore
        const companyName = await getCompanyName();
        await updateEmployeeDetailsFirestore(employee, companyName);
        toast.success(`Employee details updated.`);
        return;
      }

      // Desktop mode - use existing implementation
      // Load current employees
      const currentEmployees = await this.loadEmployees();

      // Find the employee to update
      const index = currentEmployees.findIndex(
        (existingEmployee) => existingEmployee.id === employee.id
      );

      if (index === -1) {
        const error = `Employee with id ${employee.id} not found.`;
        toast.error(error);
        return;
      }

      // Update with new details
      currentEmployees[index] = {
        ...currentEmployees[index],
        ...employee,
      };

      // Save to appropriate format(s)
      if (this.useJsonFormat) {
        await this.saveEmployeesToJson(currentEmployees);
      }

      // Always save to CSV for backward compatibility
      await this.saveEmployeesToCsv(currentEmployees);

      toast.success(`Employee details updated.`);
    } catch (error) {
      const errorMessage = `Failed to update employee details: ${error}`;
      toast.error(errorMessage);
      throw error;
    }
  }
}

/**
 * Factory function to create EmployeeModel instance
 */
export const createEmployeeModel = (dbPath: string): EmployeeModel => {
  const filePath = `${dbPath}/SweldoDB/employees.csv`;
  return new EmployeeModel(filePath);
};

/**
 * Migrate employee data from CSV to JSON format
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

  const csvFilePath = `${dbPath}/SweldoDB/employees.csv`;
  const jsonFilePath = `${dbPath}/SweldoDB/employees.json`;

  try {
    onProgress?.(`Starting employee CSV to JSON migration...`);

    // First ensure the directory exists
    await window.electron.ensureDir(path.dirname(csvFilePath));

    // Check if CSV file exists
    const csvExists = await window.electron.fileExists(csvFilePath);
    if (!csvExists) {
      onProgress?.(
        `No CSV file found at ${csvFilePath}, creating empty JSON file`
      );

      // Create empty JSON structure
      const emptyJsonData: EmployeesJson = {
        meta: {
          lastModified: new Date().toISOString(),
        },
        employees: {},
      };

      await window.electron.writeFile(
        jsonFilePath,
        JSON.stringify(emptyJsonData, null, 2)
      );

      onProgress?.(`Migration completed: Created empty JSON file`);
      return;
    }

    // Read CSV file
    onProgress?.(`Reading employee CSV data from ${csvFilePath}`);
    const csvContent = await window.electron.readFile(csvFilePath);

    if (!csvContent || csvContent.trim() === "") {
      onProgress?.(`CSV file is empty, creating empty JSON file`);

      // Create empty JSON structure
      const emptyJsonData: EmployeesJson = {
        meta: {
          lastModified: new Date().toISOString(),
        },
        employees: {},
      };

      await window.electron.writeFile(
        jsonFilePath,
        JSON.stringify(emptyJsonData, null, 2)
      );

      onProgress?.(`Migration completed: Created empty JSON file`);
      return;
    }

    // Parse CSV
    onProgress?.(`Parsing CSV data...`);
    const results = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (!results.data || results.data.length === 0) {
      onProgress?.(`No employee data found in CSV file`);

      // Create empty JSON structure
      const emptyJsonData: EmployeesJson = {
        meta: {
          lastModified: new Date().toISOString(),
        },
        employees: {},
      };

      await window.electron.writeFile(
        jsonFilePath,
        JSON.stringify(emptyJsonData, null, 2)
      );

      onProgress?.(`Migration completed: Created empty JSON file`);
      return;
    }

    // Convert to JSON structure
    onProgress?.(
      `Converting ${results.data.length} employees to JSON format...`
    );

    const jsonData: EmployeesJson = {
      meta: {
        lastModified: new Date().toISOString(),
      },
      employees: {},
    };

    results.data.forEach((emp: any) => {
      if (!emp.id) {
        onProgress?.(`Skipping employee without ID`);
        return;
      }

      // Parse lastPaymentPeriod if it's a string
      let lastPaymentPeriod: LastPaymentPeriod | null = null;
      if (emp.lastPaymentPeriod) {
        try {
          if (typeof emp.lastPaymentPeriod === "string") {
            lastPaymentPeriod = JSON.parse(
              emp.lastPaymentPeriod.replace(/\\/g, "")
            );
          } else {
            lastPaymentPeriod = emp.lastPaymentPeriod;
          }
        } catch (e) {
          onProgress?.(
            `Failed to parse lastPaymentPeriod for employee ${emp.id}, setting to null`
          );
        }
      }

      jsonData.employees[emp.id] = {
        id: emp.id,
        name: emp.name,
        position: emp.position,
        dailyRate: emp.dailyRate ? parseFloat(emp.dailyRate) : undefined,
        sss: emp.sss ? parseFloat(emp.sss) : undefined,
        philHealth: emp.philHealth ? parseFloat(emp.philHealth) : undefined,
        pagIbig: emp.pagIbig ? parseFloat(emp.pagIbig) : undefined,
        status: emp.status || "inactive",
        employmentType: emp.employmentType,
        lastPaymentPeriod: lastPaymentPeriod,
      };
    });

    // Write to JSON file
    onProgress?.(`Writing JSON data to ${jsonFilePath}`);
    await window.electron.writeFile(
      jsonFilePath,
      JSON.stringify(jsonData, null, 2)
    );

    onProgress?.(
      `Migration completed: ${
        Object.keys(jsonData.employees).length
      } employees migrated successfully`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onProgress?.(`Error during migration: ${message}`);
    console.error("Employee migration error:", error);
    throw error;
  }
}
