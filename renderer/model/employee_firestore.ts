/**
 * Firestore implementation for employee-related operations
 *
 * This module provides Firestore implementations for all employee-related
 * operations that mirror the local filesystem operations in employee.ts.
 *
 * IMPLEMENTATION PATTERN:
 * 1. Import interfaces from the main model file (employee.ts) rather than redefining them
 * 2. Use utility functions from firestoreService.ts for common Firestore operations
 * 3. Maintain the same function signatures as local storage but with "Firestore" suffix
 * 4. Follow the Firestore path structure from the documentation:
 *    companies/{companyName}/employees/{employeeId}
 */

import { Employee, EmployeeModel } from "./employee";
import {
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  queryCollection,
  getCompanyName,
} from "../lib/firestoreService";
import { db } from "../lib/db";

/**
 * Type for the Firestore employee document structure
 * Based on the EmployeesJson interface from employee.ts but adapted for Firestore
 */
interface FirestoreEmployee {
  id: string;
  name: string;
  position?: string;
  dailyRate?: number;
  sss?: number;
  philHealth?: number;
  pagIbig?: number;
  status: "active" | "inactive";
  employmentType?: string;
  lastPaymentPeriod: {
    startDate: string;
    endDate: string;
    start: string;
    end: string;
  } | null;
}

/**
 * Load all employees from Firestore
 */
export async function loadEmployeesFirestore(
  companyName: string
): Promise<Employee[]> {
  try {
    // Fetch all employee documents from the employees collection
    const employees = await fetchCollection<FirestoreEmployee>(
      "employees",
      companyName
    );

    return employees.map((emp) => ({
      ...emp,
      // Add these fields for compatibility with the existing model
      startType: emp.lastPaymentPeriod
        ? typeof emp.lastPaymentPeriod.start
        : "undefined",
      endType: emp.lastPaymentPeriod
        ? typeof emp.lastPaymentPeriod.end
        : "undefined",
    }));
  } catch (error) {
    console.error(`Error loading Firestore employees:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Load only active employees from Firestore
 */
export async function loadActiveEmployeesFirestore(
  companyName: string
): Promise<Employee[]> {
  try {
    // Attempt to load from cache
    const cachedRecords = await db.employees
      .where("companyName")
      .equals(companyName)
      .toArray();

    if (cachedRecords.length > 0) {
      return cachedRecords.map((rec) => rec.data);
    }

    // Cache miss; query active employees from Firestore
    const activeEmployees = await queryCollection<FirestoreEmployee>(
      "employees",
      [["status", "==", "active"]],
      companyName
    );

    const employeesList = activeEmployees.map((emp) => ({
      ...emp,
      startType: emp.lastPaymentPeriod
        ? typeof emp.lastPaymentPeriod.start
        : "undefined",
      endType: emp.lastPaymentPeriod
        ? typeof emp.lastPaymentPeriod.end
        : "undefined",
    }));

    // Store fetched employees in cache
    const timestamp = Date.now();
    const records = employeesList.map((emp) => ({
      companyName,
      id: emp.id,
      timestamp,
      data: emp,
    }));
    await db.employees.bulkPut(records);

    return employeesList;
  } catch (error) {
    console.error(`Error loading active Firestore employees:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Load employee by ID from Firestore
 */
export async function loadEmployeeByIdFirestore(
  id: string,
  companyName: string
): Promise<Employee | null> {
  try {
    // Fetch the specific employee document by ID
    const employee = await fetchDocument<FirestoreEmployee>(
      "employees",
      id,
      companyName
    );

    if (!employee) {
      return null;
    }

    return {
      ...employee,
      startType: employee.lastPaymentPeriod
        ? typeof employee.lastPaymentPeriod.start
        : "undefined",
      endType: employee.lastPaymentPeriod
        ? typeof employee.lastPaymentPeriod.end
        : "undefined",
    };
  } catch (error) {
    console.error(`Error loading Firestore employee ${id}:`, error);
    return null; // Return null on error
  }
}

/**
 * Save only new employees to Firestore (those that don't already exist)
 */
export async function saveOnlyNewEmployeesFirestore(
  employees: Employee[],
  companyName: string
): Promise<void> {
  try {
    // First load current employees to check which ones are new
    const currentEmployees = await loadEmployeesFirestore(companyName);
    const currentEmployeeIds = new Set(currentEmployees.map((e) => e.id));

    // Filter only employees that don't exist yet
    const newEmployees = employees.filter(
      (emp) => !currentEmployeeIds.has(emp.id)
    );

    if (newEmployees.length === 0) {
      return; // No new employees to add
    }

    // Save each new employee as a separate document
    const savePromises = newEmployees.map(async (employee) => {
      const firestoreEmployee: FirestoreEmployee = {
        id: employee.id,
        name: employee.name,
        position: employee.position,
        dailyRate: employee.dailyRate,
        sss: employee.sss,
        philHealth: employee.philHealth,
        pagIbig: employee.pagIbig,
        status: employee.status,
        employmentType: employee.employmentType,
        lastPaymentPeriod:
          employee.lastPaymentPeriod &&
          typeof employee.lastPaymentPeriod !== "string"
            ? employee.lastPaymentPeriod
            : typeof employee.lastPaymentPeriod === "string" &&
              employee.lastPaymentPeriod
            ? JSON.parse(employee.lastPaymentPeriod.replace(/\\/g, ""))
            : null,
      };

      await saveDocument(
        "employees",
        employee.id,
        firestoreEmployee,
        companyName
      );
    });

    // Wait for all save operations to complete
    await Promise.all(savePromises);
  } catch (error) {
    console.error(`Error saving new Firestore employees:`, error);
    throw error;
  }
}

/**
 * Update employee status in Firestore
 */
export async function updateEmployeeStatusFirestore(
  employee: Employee,
  companyName: string
): Promise<void> {
  try {
    // Update just the status field in the employee document
    await updateDocument(
      "employees",
      employee.id,
      { status: employee.status },
      companyName
    );
  } catch (error) {
    console.error(
      `Error updating Firestore employee status for ${employee.id}:`,
      error
    );
    throw error;
  }
}

/**
 * Update employee details in Firestore
 */
export async function updateEmployeeDetailsFirestore(
  employee: Employee,
  companyName: string
): Promise<void> {
  try {
    // Ensure we have a valid lastPaymentPeriod object for Firestore
    let lastPaymentPeriod = employee.lastPaymentPeriod;
    if (typeof lastPaymentPeriod === "string" && lastPaymentPeriod) {
      try {
        lastPaymentPeriod = JSON.parse(lastPaymentPeriod.replace(/\\/g, ""));
      } catch (e) {
        console.warn(
          `Failed to parse lastPaymentPeriod for employee ${employee.id}, setting to null`
        );
        lastPaymentPeriod = null;
      }
    }

    // Prepare the employee document for Firestore
    const firestoreEmployee: FirestoreEmployee = {
      id: employee.id,
      name: employee.name,
      position: employee.position,
      dailyRate: employee.dailyRate,
      sss: employee.sss,
      philHealth: employee.philHealth,
      pagIbig: employee.pagIbig,
      status: employee.status,
      employmentType: employee.employmentType,
      lastPaymentPeriod: lastPaymentPeriod as any, // Use type assertion since we've processed it
    };

    // Save the updated employee document (overwrite)
    await saveDocument(
      "employees",
      employee.id,
      firestoreEmployee,
      companyName
    );
  } catch (error) {
    console.error(
      `Error updating Firestore employee details for ${employee.id}:`,
      error
    );
    throw error;
  }
}

/**
 * Sync employees to Firestore
 * Uploads all employees to Firestore, handling batch operations and progress tracking
 */
export async function syncToFirestore(
  employees: Employee[],
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    onProgress?.("Starting employee sync to Firestore...");

    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    for (let i = 0; i < employees.length; i += batchSize) {
      const batch = employees.slice(i, i + batchSize);
      onProgress?.(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
          employees.length / batchSize
        )}...`
      );

      // Save each employee in the batch
      const savePromises = batch.map(async (employee) => {
        const firestoreEmployee: FirestoreEmployee = {
          id: employee.id,
          name: employee.name,
          position: employee.position,
          dailyRate: employee.dailyRate,
          sss: employee.sss,
          philHealth: employee.philHealth,
          pagIbig: employee.pagIbig,
          status: employee.status,
          employmentType: employee.employmentType,
          lastPaymentPeriod:
            employee.lastPaymentPeriod &&
            typeof employee.lastPaymentPeriod !== "string"
              ? employee.lastPaymentPeriod
              : typeof employee.lastPaymentPeriod === "string" &&
                employee.lastPaymentPeriod
              ? JSON.parse(employee.lastPaymentPeriod.replace(/\\/g, ""))
              : null,
        };

        await saveDocument(
          "employees",
          employee.id,
          firestoreEmployee,
          companyName
        );
      });

      await Promise.all(savePromises);
    }

    onProgress?.("Employee sync to Firestore completed successfully.");
  } catch (error) {
    console.error("Error syncing employees to Firestore:", error);
    throw error;
  }
}

/**
 * Sync employees from Firestore
 * Downloads all employees from Firestore, handling batch operations and progress tracking
 */
export async function syncFromFirestore(
  companyName: string,
  onProgress?: (message: string) => void
): Promise<Employee[]> {
  try {
    onProgress?.("Starting employee sync from Firestore...");

    // Fetch all employees from Firestore
    const employees = await loadEmployeesFirestore(companyName);

    onProgress?.(`Retrieved ${employees.length} employees from Firestore.`);
    return employees;
  } catch (error) {
    console.error("Error syncing employees from Firestore:", error);
    throw error;
  }
}

/**
 * Create a Firestore instance for the employee model
 */
export function createEmployeeFirestore(model: EmployeeModel) {
  return {
    async syncToFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        // Load all employees from the model
        const employees = await model.loadEmployees();

        // Use the existing syncToFirestore function
        await syncToFirestore(employees, await getCompanyName(), onProgress);
      } catch (error) {
        console.error("Error syncing employees to Firestore:", error);
        throw error;
      }
    },

    async syncFromFirestore(
      onProgress?: (message: string) => void
    ): Promise<void> {
      try {
        // Use the existing syncFromFirestore function
        const employees = await syncFromFirestore(
          await getCompanyName(),
          onProgress
        );

        // Save the employees to the model
        await model.saveOnlyNewEmployees(employees);
      } catch (error) {
        console.error("Error syncing employees from Firestore:", error);
        throw error;
      }
    },
  };
}
