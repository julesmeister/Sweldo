import { Employee } from "@/renderer/model/employee";
import { queryCollection, fetchDocument } from "./firestoreService";
import { toast } from "sonner";
import Dexie from "dexie";

// Create a Dexie database for caching employees
class EmployeeDatabase extends Dexie {
  employees: Dexie.Table<Employee, string>;

  constructor() {
    super("SweldoEmployeeCache");
    this.version(1).stores({
      employees: "id, name, status, employmentType",
    });
    this.employees = this.table("employees");
  }
}

const db = new EmployeeDatabase();

/**
 * Fetch all employees from Firestore with caching
 * @param companyName The company name to use for Firestore
 * @param forceRefresh Whether to bypass the cache and force a fresh fetch
 * @returns Array of employees
 */
export async function fetchEmployees(
  companyName: string,
  forceRefresh: boolean = false
): Promise<Employee[]> {
  try {
    console.log(
      `[EmployeeUtils] Fetching employees for ${companyName}, forceRefresh: ${forceRefresh}`
    );

    // Try to get from cache first unless forceRefresh is true
    if (!forceRefresh) {
      try {
        const cachedEmployees = await db.employees.toArray();
        if (cachedEmployees && cachedEmployees.length > 0) {
          console.log(
            `[EmployeeUtils] Found ${cachedEmployees.length} employees in cache`
          );
          return cachedEmployees;
        }
      } catch (cacheError) {
        console.warn("[EmployeeUtils] Error reading from cache", cacheError);
      }
    }

    // If not in cache or forceRefresh, fetch from Firestore
    console.log(`[EmployeeUtils] Fetching employees from Firestore`);
    const employees = await queryCollection<Employee>(
      "employees",
      [],
      companyName
    );

    console.log(
      `[EmployeeUtils] Fetched ${employees.length} employees from Firestore`
    );

    // Update cache
    try {
      await db.employees.clear();
      await db.employees.bulkAdd(employees);
      console.log(
        `[EmployeeUtils] Updated employee cache with ${employees.length} employees`
      );
    } catch (cacheError) {
      console.warn("[EmployeeUtils] Error updating cache", cacheError);
      // Don't fail the operation if caching fails
    }

    return employees;
  } catch (error) {
    console.error("[EmployeeUtils] Error fetching employees", error);
    throw error;
  }
}

/**
 * Fetch a specific employee by ID
 * @param employeeId The employee ID to fetch
 * @param companyName The company name to use for Firestore
 * @returns The employee or null if not found
 */
export async function fetchEmployeeById(
  employeeId: string,
  companyName: string
): Promise<Employee | null> {
  try {
    console.log(`[EmployeeUtils] Fetching employee by ID: ${employeeId}`);

    // Try to get from cache first
    try {
      const cachedEmployee = await db.employees.get(employeeId);
      if (cachedEmployee) {
        console.log(`[EmployeeUtils] Found employee in cache:`, cachedEmployee);
        return cachedEmployee;
      }
    } catch (cacheError) {
      console.warn("[EmployeeUtils] Error reading from cache", cacheError);
    }

    // If not in cache, fetch from Firestore
    console.log(`[EmployeeUtils] Fetching employee from Firestore`);
    const employee = await fetchDocument<Employee>(
      "employees",
      employeeId,
      companyName
    );

    if (employee) {
      console.log(`[EmployeeUtils] Found employee in Firestore:`, employee);

      // Update cache with this employee
      try {
        await db.employees.put(employee);
        console.log(
          `[EmployeeUtils] Updated cache with employee: ${employeeId}`
        );
      } catch (cacheError) {
        console.warn("[EmployeeUtils] Error updating cache", cacheError);
      }

      return employee;
    }

    console.log(`[EmployeeUtils] Employee not found: ${employeeId}`);
    return null;
  } catch (error) {
    console.error(
      `[EmployeeUtils] Error fetching employee ${employeeId}:`,
      error
    );
    return null;
  }
}

/**
 * Clear the employee cache
 * @returns Promise that resolves when cache is cleared
 */
export async function clearEmployeeCache(): Promise<void> {
  try {
    await db.employees.clear();
    toast.success("Employee cache cleared");
    console.log("[EmployeeUtils] Employee cache cleared");
    return;
  } catch (error) {
    console.error("[EmployeeUtils] Error clearing employee cache", error);
    toast.error("Failed to clear employee cache");
    throw error;
  }
}

/**
 * Debug function to inspect the Firestore payroll collection structure
 * @param companyName The company name to use for Firestore
 */

// Define an interface for the structure of objects in the docs array
interface DebugPayrollDocInfo {
  id: string;
  hasPayrolls: boolean;
  payrollsCount: number;
  meta: any; // Or a more specific type if meta structure is known and consistent
}

export async function debugFirestorePayrolls(
  companyName: string
): Promise<DebugPayrollDocInfo[]> {
  try {
    console.log(
      `[Debug] Inspecting Firestore payroll structure for ${companyName}`
    );

    // Import Firestore modules
    const { collection, getDocs } = await import("firebase/firestore");
    const { getFirestoreInstance } = await import("./firestoreService");

    const db = getFirestoreInstance();

    // Get all documents in the payrolls collection
    const payrollsRef = collection(db, `companies/${companyName}/payrolls`);
    const querySnapshot = await getDocs(payrollsRef);

    console.log(
      `[Debug] Found ${querySnapshot.size} documents in payrolls collection`
    );

    // Collect document information
    const docs: DebugPayrollDocInfo[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      docs.push({
        id: doc.id,
        hasPayrolls: !!(data && data.payrolls && Array.isArray(data.payrolls)),
        payrollsCount:
          data && data.payrolls && Array.isArray(data.payrolls)
            ? data.payrolls.length
            : 0,
        meta: data && data.meta ? data.meta : null,
      });
    });

    // Log document info
    docs.forEach((doc) => {
      console.log(
        `[Debug] Document ID: ${doc.id}, hasPayrolls: ${doc.hasPayrolls}, count: ${doc.payrollsCount}`
      );
      console.log(`[Debug] Meta:`, doc.meta);
    });

    return docs;
  } catch (error) {
    console.error(
      `[Debug] Error inspecting Firestore payroll structure:`,
      error
    );
    return [];
  }
}
