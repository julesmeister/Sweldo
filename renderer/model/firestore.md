# Firestore Integration Strategy

This document outlines a potential strategy for integrating Google Firestore as a data backend, drawing inspiration from the current local file-based storage patterns (e.g., `attendance.ts`, `leave.ts`, `loan.ts`). The goal is to design a structure that is reasonably efficient for Firestore's read/write model and considers future web-based deployment needs, particularly caching.

## Current Local File-Based Approach

The existing system primarily relies on the local file system:

1.  **Data Segregation:** Data is typically stored in dedicated directories (e.g., `SweldoDB/attendances`, `SweldoDB/leaves`).
2.  **Employee-Specific Storage:** Within these directories, data is further segregated into subdirectories based on `employeeId`.
3.  **Time-Based Segmentation:** Inside an employee's directory, data is often stored in files segmented by time periods, commonly year and month (e.g., `2025_4_attendance.json`, `2025_4_leaves.json`).
4.  **File Format:** Data is stored in formats like JSON or CSV within these files.
5.  **Operations:** Loading data involves reading the specific file(s) for the required employee and time period. Saving involves reading the file, updating the data in memory, and writing the entire file back. Backups might involve separate files or appending to backup logs.

## Proposed Firestore Structure

To mirror the efficiency of the file-based system (minimizing operations for common tasks) while leveraging Firestore's capabilities, we can adopt a similar granularity, organized under the company's name.

```text
Firestore Root
└── companies (collection)
    └── {companyName} (document, e.g., "AcmeCorp")
        ├── metadata (fields in company document)
        │   ├── displayName: string
        │   ├── createdAt: timestamp
        │   ├── address: string
        │   └── contactEmail: string
        │
        ├── employees (subcollection)
        │   ├── {employeeId} (document)
        │   │   ├── id: string
        │   │   ├── name: string
        │   │   ├── position: string
        │   │   ├── dailyRate: number
        │   │   ├── sss: number
        │   │   ├── philHealth: number
        │   │   ├── pagIbig: number
        │   │   ├── status: "active" | "inactive"
        │   │   ├── employmentType: string
        │   │   └── lastPaymentPeriod: object | null
        │   │
        │   └── ... (more employee documents)
        │
        ├── attendances (subcollection)
        │   ├── {employeeId}_{year}_{month} (document)
        │   │   ├── meta: object (employeeId, year, month, lastModified)
        │   │   └── days: object (map of day numbers to AttendanceJsonDay objects)
        │   │
        │   └── ... (more attendance documents)
        │
        ├── compensations (subcollection)
        │   ├── {employeeId}_{year}_{month} (document)
        │   │   ├── meta: object (employeeId, year, month, lastModified)
        │   │   └── days: object (map of day numbers to CompensationJsonDay objects)
        │   │
        │   └── ... (more compensation documents)
        │
        ├── alternatives (subcollection)
        │   ├── {employeeId} (document)
        │   │   └── times: string[] (array of alternative time values)
        │   │
        │   └── ... (more alternatives documents)
        │
        ├── attendance_backups (subcollection)
        │   ├── {employeeId}_{year}_{month} (document)
        │   │   ├── employeeId: string
        │   │   ├── year: number
        │   │   ├── month: number
        │   │   └── backups: BackupEntry[] (array of backup entries)
        │   │
        │   └── ... (more backup documents)
        │
        ├── compensation_backups (subcollection)
        │   ├── {employeeId}_{year}_{month} (document)
        │   │   ├── employeeId: string
        │   │   ├── year: number
        │   │   ├── month: number
        │   │   └── backups: BackupEntry[] (array of backup entries)
        │   │
        │   └── ... (more backup documents)
        │
        ├── leaves (subcollection)
        │   └── ... (leave documents organized similar to attendances)
        │
        ├── loans (subcollection)
        │   └── ... (loan documents organized by employee and period)
        │
        └── settings (subcollection)
            ├── attendance (document)
            │   ├── overtimeEnabled: boolean
            │   ├── overtimeHourlyMultiplier: number
            │   ├── overtimeThresholdHours: number
            │   └── ... (other attendance settings)
            │
            ├── employment_types (document)
            │   └── employmentTypes: EmploymentType[] (array of employment type configs)
            │
            ├── app_settings (document)
            │   ├── theme: string
            │   ├── language: string
            │   ├── notificationsEnabled: boolean
            │   └── timeFormat: "12-hour" | "24-hour"
            │
            └── auth (document)
                ├── pins: {
                │       [pinCode: string]: {
                │           role: "admin" | "manager" | "user",
                │           permissions: string[]
                │       }
                │   }
                └── accessControl: {
                        allowedIPs: string[],
                        restrictOutsideHours: boolean
                    }
```

## Centralized Company Name Management

To ensure consistency across the application, we use a centralized approach for company name management:

1. **Single Source of Truth:**
   - The company name is centrally managed in the `firestoreService.ts` module
   - A cached version is maintained for performance
   - The settings store (`settingsStore.ts`) is the primary source of the company name

2. **API for Company Name Operations:**
   - `setFirestoreCompanyName(name)`: Manually sets the company name
   - `getCompanyName()`: Retrieves the company name from cache or settings store

3. **Model Implementation Strategy:**
   - Model files (e.g., `attendance.ts`) do NOT store the company name
   - They dynamically fetch it from `firestoreService.ts` when in web mode
   - Firestore implementation files (e.g., `attendance_firestore.ts`) accept company name as a parameter

4. **Runtime Detection:**
   - `isWebEnvironment()`: Function to detect if running in web or desktop mode
   - Models use this to determine whether to use Firestore or local storage

This approach ensures:
- No redundancy in company name storage across different model classes
- Consistency in company name usage throughout the application
- Centralized control and updates
- Clean separation between models and their Firestore implementations

## Implementation Architecture

To ensure a clean separation of concerns and maintain the existing functionality, we'll implement the following architecture:

1. **Separate Firestore-Specific Files:**
   * For each model file (e.g., `attendance.ts`), create a corresponding Firestore implementation file with a `_firestore.ts` suffix (e.g., `attendance_firestore.ts`).
   * These files will contain all Firestore-specific CRUD operations for their respective data types.

2. **Preservation of Current Functionality:**
   * The original model files (e.g., `attendance.ts`) will remain untouched in their core functionality.
   * They will continue to use the existing local file system operations via `window.electron` in desktop mode.

3. **Conditional Runtime Detection:**
   * Each model file will import its corresponding `_firestore.ts` module.
   * The model will include a runtime environment detection mechanism to determine whether to use:
     * Local file system operations (desktop/Electron mode)
     * Firestore operations (web mode)

4. **Shared Utility Functions:**
   * To avoid code duplication and ensure consistency, we use shared utility functions from `renderer/lib/firestoreService.ts`.
   * These utilities handle common operations like:
     * Initializing Firebase
     * Creating document paths
     * Fetching, saving, and updating documents
     * Creating document IDs for time-based collections

5. **Code Reuse Best Practices:**
   * Import interfaces from the original model files rather than redefining them
   * Use the shared utility functions for all Firestore operations
   * Maintain consistent function signatures with the "Firestore" suffix
   * Document any Firestore-specific behaviors or limitations

6. **Example Implementation Structure:**

```typescript
// attendance_firestore.ts - Contains all Firestore-specific operations
import { Attendance, SharedAlternatives } from './attendance';
import { 
  fetchDocument, 
  saveDocument, 
  createTimeBasedDocId,
  getCompanyName 
} from '../lib/firestoreService';

export async function loadAttendanceFirestore(employeeId, year, month, companyName) {
  const docId = createTimeBasedDocId(employeeId, year, month);
  const data = await fetchDocument('attendances', docId, companyName);
  // Transform data to Attendance[] format
}

export async function saveAttendanceFirestore(data, employeeId, year, month, companyName) {
  const docId = createTimeBasedDocId(employeeId, year, month);
  // Transform data to Firestore format
  await saveDocument('attendances', docId, transformedData, companyName);
}

// Additional Firestore-specific methods...
```

```typescript
// attendance.ts - The original model with conditional logic
import { loadAttendanceFirestore, saveAttendanceFirestore } from './attendance_firestore';
import { isWebEnvironment, getCompanyName } from '../lib/firestoreService';

export class AttendanceModel {
  // ... existing properties (but NO companyName property) ...

  async loadAttendance(employeeId, year, month) {
    if (isWebEnvironment()) {
      // Web mode - use Firestore
      const companyName = await getCompanyName();
      return await loadAttendanceFirestore(employeeId, year, month, companyName);
    } else {
      // Desktop mode - use existing file system logic
      // (Existing implementation remains unchanged)
      return await window.electron.readAttendance(employeeId, year, month);
    }
  }
}
```

This pattern would be repeated for all model classes: `LeaveModel`, `LoanModel`, `EmployeeModel`, etc.

## Implementation Patterns and Guidelines

### Step-by-Step Implementation Process

Follow these steps when implementing Firestore for each model:

1. **Create the `*_firestore.ts` file**:
   ```typescript
   /**
    * Firestore implementation for [model]-related operations
    * 
    * This module provides Firestore implementations for all [model]-related
    * operations that mirror the local filesystem operations in [model].ts.
    */
   
   import { [ModelInterfaces] } from "./[model]";
   import { Timestamp } from "firebase/firestore";
   import {
     fetchDocument,
     saveDocument,
     createTimeBasedDocId,
     // Import other utility functions as needed
   } from "../lib/firestoreService";
   
   // Only define interfaces that don't exist in the original model
   interface FirestoreSpecificInterface {
     // ...
   }
   
   // Implement each operation with a "Firestore" suffix
   export async function loadModelFirestore(..., companyName: string): Promise<...> {
     try {
       const docId = createTimeBasedDocId(...);
       const data = await fetchDocument(..., companyName);
       // Transform data to model format
       return transformedData;
     } catch (error) {
       console.error(`Error in Firestore operation:`, error);
       return defaultValue; // Or throw as appropriate
     }
   }
   
   export async function saveModelFirestore(..., companyName: string): Promise<void> {
     try {
       const docId = createTimeBasedDocId(...);
       // Transform model data to Firestore format
       await saveDocument(..., companyName);
     } catch (error) {
       console.error(`Error in Firestore operation:`, error);
       throw error;
     }
   }
   
   // Add other necessary Firestore-specific operations
   ```

2. **Update the Original Model File**:
   ```typescript
   import { 
     loadModelFirestore, 
     saveModelFirestore,
     // Import other Firestore operations
   } from "./model_firestore";
   import { isWebEnvironment, getCompanyName } from "../lib/firestoreService";
   
   export class ModelClass {
     // No companyName property - remove if it exists
     
     public async loadModel(...): Promise<...> {
       if (isWebEnvironment()) {
         // Web mode - use Firestore, fetch company name at runtime
         const companyName = await getCompanyName();
         return loadModelFirestore(..., companyName);
       } else {
         // Desktop mode - use existing implementation
         // (Existing code remains unchanged)
       }
     }
     
     public async saveModel(...): Promise<void> {
       if (isWebEnvironment()) {
         // Web mode - use Firestore, fetch company name at runtime
         const companyName = await getCompanyName();
         await saveModelFirestore(..., companyName);
       } else {
         // Desktop mode - use existing implementation
         // (Existing code remains unchanged)
       }
     }
     
     // Repeat pattern for other methods
   }
   ```

### Document Structure Patterns

Use these consistent patterns for document structure:

- **Time-based data** (attendance, leaves, etc.):
  - Document ID: `{employeeId}_{year}_{month}`
  - Path: `companies/{companyName}/{collection}/{employeeId}_{year}_{month}`

- **Settings**:
  - Document ID: `{setting_name}`
  - Path: `companies/{companyName}/settings/{setting_name}`

- **Employee data**:
  - Document ID: `{employeeId}`
  - Path: `companies/{companyName}/employees/{employeeId}`

### Best Practices

- Always use utility functions from `firestoreService.ts` rather than direct Firestore calls
- Import interfaces from original model files instead of redefining them
- Follow consistent naming patterns with "Firestore" suffix for all operations
- Use the `isWebEnvironment()` utility for runtime detection
- Use `getCompanyName()` to fetch the company name when in web mode
- Handle errors consistently and provide meaningful error messages
- Test both desktop and web modes during development

## Saving Data to Firestore

*   **Read-Modify-Write:**
    1.  **Read:** Fetch the single monthly document (e.g., `companies/AcmeCorp/attendances/2_2025_4`).
    2.  **Modify:** Update the data in memory.
    3.  **Write:** Save the entire modified document back using `set` or `update`.
*   **New Month:** If a document for the month doesn't exist within the company's subcollection, create it.
*   **Transactions:** Use transactions when necessary, ensuring paths include the `companyName`.

## Retrieving Data from Firestore

*   **Single Month:** Loading data for one employee for a specific month still requires reading only **one** document (e.g., `companies/AcmeCorp/attendances/2_2025_4`).
*   **Multiple Months/Year:** Requires reading multiple monthly documents from the appropriate company subcollection.
*   **Queries:** Queries would target specific subcollections (e.g., query `companies/AcmeCorp/attendances` where `employeeId == "2"` and `year == 2025`). Collection Group Queries could be used to query across *all* companies' attendance records if ever needed, but standard queries within a company's subcollection are more common.

## Efficiency and Cost Management

*   **Monthly Granularity:** This structure balances granularity and cost. It avoids the high cost of per-entry documents while being more flexible than yearly files/documents.
*   **Document Size Limit:** Be mindful of Firestore's 1 MiB limit per document. For extremely detailed daily data or very long months, monthly documents *could* approach this limit, but it's unlikely for typical attendance/leave data. If it becomes an issue, consider splitting into smaller documents (e.g., weekly) or using subcollections (though this increases complexity and read operations).
*   **Write Operations:** Updates require reading and writing the *entire* document. While efficient in terms of operation count (1 read, 1 write), it consumes bandwidth proportional to the document size.

## Web-Based Deployment & Caching (CRITICAL)

When moving to a web-based application where the client potentially interacts directly with Firestore:

*   **Direct Client Access:** Directly accessing Firestore from the client is possible but makes managing read/write costs crucial. Every time a user views a month's data, it could trigger a Firestore read if not cached.
*   **Aggressive Caching is ESSENTIAL:** To mitigate Firestore costs and improve performance:
    *   **Client-Side State Management:** Use React state, Context, Zustand, Redux, or similar stores to hold fetched data. Avoid refetching data that's already loaded and displayed.
    *   **Data Fetching Libraries:** Libraries like `React Query` or `SWR` excel at caching, background updates, and stale-while-revalidate strategies. They can significantly reduce redundant Firestore reads. Configure cache times appropriately.
    *   **Firestore Offline Persistence:** While primarily for offline support, Firestore's built-in persistence *can* act as a cache, but rely more on application-level caching for cost control.
    *   **Backend Layer (Optional but Recommended for Scale):** For larger applications or stricter cost control, introduce a backend layer (e.g., Cloud Functions, a dedicated server).
        *   The client talks to your backend API.
        *   The backend handles Firestore interactions.
        *   This allows for server-side caching (e.g., using Redis or MemoryStore), data aggregation, and better security/validation logic. It centralizes Firestore access, making cost monitoring easier.

## Comparison

| Feature          | Local Filesystem             | Firestore (Company-Namespaced Monthly Docs) |
| :--------------- | :--------------------------- | :------------------------------------------ |
| **Scalability**  | Limited                      | Highly Scalable                             |
| **Accessibility**| Local only                   | Web Accessible                              |
| **Multi-Tenancy**| Difficult/Manual             | Built-in (via `companyName` document ID)    |
| **Real-time**    | Manual                       | Yes                                         |
| **Cost**         | Free (local storage)         | Potential costs (reads/writes)                |
| **Complexity**   | Simpler (basic file I/O)     | More complex (async, rules)                    |
| **Backup**       | Manual/Requires setup        | Managed by Google Cloud                        |
| **Ops/Month View**| 1 file read                | 1 document read                                |
| **Ops/Entry Edit**| 1 read, 1 write (full file)| 1 read, 1 write (full doc)                     |

## Next Steps

1.  Set up a Firestore project.
2.  Define security rules to protect data.
3.  Create `*_firestore.ts` files for each model:
    * `attendance_firestore.ts`
    * `leave_firestore.ts`
    * `loan_firestore.ts`
    * `employee_firestore.ts`
    * etc.
4.  Implement Firestore CRUD operations in these files:
    * Import interfaces from original model files
    * Use utility functions from `firestoreService.ts`
    * Follow consistent naming patterns with "Firestore" suffix
5.  Add conditional logic to the original model files to:
    * Keep existing functionality intact for desktop mode
    * Use the Firestore implementations for web mode
6.  Create a shared utility file (e.g., `renderer/lib/firestoreUtils.ts`) for common Firestore operations:
    * Initialization
    * Path construction
    * Runtime detection
    * Company name retrieval
7.  Implement caching strategies, especially if targeting web deployment.
8.  Plan data migration from local files to Firestore if needed.
