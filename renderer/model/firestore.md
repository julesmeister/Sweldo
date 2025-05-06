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

**IMPORTANT Pathing Note:** All Firestore operations interacting with specific company data MUST target paths namespaced under `/companies/{companyName}/`. Utility functions within `firestoreService.ts` (e.g., `saveDocument`, `fetchDocument`, `fetchCollection`, `createTimeBasedDocId`) are designed to handle this automatically when provided with the `collectionName`, `docId`, and `companyName`. Model-specific implementations (`_firestore.ts` files) MUST utilize these shared utilities to ensure correct path construction.

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

6. **Sync Orchestration:** The `useFirestoreSync` hook calls the `syncToFirestore` and `syncFromFirestore` methods provided by the objects returned from `create<ModelName>Firestore` functions (defined in `_firestore.ts` files). These methods contain the core logic for loading all relevant local data (for upload) or fetching all relevant Firestore data (for download) and performing the necessary save operations using the shared utility functions.

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

## Firestore Data Synchronization

### Overview

The Firestore data synchronization process involves two main operations:
1. **Upload to Firestore**: Migrating local JSON data to Firestore
2. **Download from Firestore**: Retrieving Firestore data to local JSON files

These operations are triggered from the `DatabaseManagementSettings.tsx` component and follow the predefined Firestore architecture.

### Core Utilities and Hooks

#### 1. Firestore Sync Hooks

```typescript
// hooks/useFirestoreSync.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

type SyncStatus = 'idle' | 'running' | 'success' | 'error';

interface UseFirestoreSyncProps {
  dbPath: string;
  companyName: string;
  attendanceModel: AttendanceModel;
  employeeModel: EmployeeModel;
  compensationModel: CompensationModel;
  holidayModel: HolidayModel;
  leaveModel: LeaveModel;
  loanModel: LoanModel;
  missingTimeModel: MissingTimeModel;
  payrollModel: Payroll;
  roleModel: RoleModel;
  settingsModel: AttendanceSettingsModel;
  shortsModel: ShortModel;
  statisticsModel: StatisticsModel;
  employeeId: string;
  year: number;
}

function useFirestoreSync({
  dbPath,
  companyName,
  attendanceModel,
  employeeModel,
  compensationModel,
  holidayModel,
  leaveModel,
  loanModel,
  missingTimeModel,
  payrollModel,
  roleModel,
  settingsModel,
  shortsModel,
  statisticsModel,
  employeeId,
  year,
}: UseFirestoreSyncProps) {
  // State management
  const [uploadStatus, setUploadStatus] = useState<SyncStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<SyncStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<string[]>([]);

  // Create Firestore instances for all models
  const createFirestoreInstances = useCallback((): SyncOperation[] => {
    // NOTE: This now happens INSIDE the hook, using factory functions
    // It assumes dbPath is available to instantiate models internally
    const operations: SyncOperation[] = [];
    if (!dbPath) return []; // Cannot instantiate without dbPath
    try {
      const attendanceModel = createAttendanceModel(dbPath);
      operations.push({ name: "attendance", instance: createAttendanceFirestore(attendanceModel) });
      // ... Add other models similarly ...
      const employeeModel = createEmployeeModel(dbPath);
      operations.push({ name: "employee", instance: createEmployeeFirestore(employeeModel) });
      const cashAdvanceModel = createCashAdvanceModel(dbPath, "__SYNC_ALL__"); // Example placeholder
      operations.push({ name: "cash advance", instance: createCashAdvanceFirestoreInstance(cashAdvanceModel) });
      // ... etc.
    } catch (error) {
      console.error("Error creating model instances in useFirestoreSync:", error);
      return [];
    }
    return operations;
  }, [dbPath, employeeId, year]);

  // Generic sync handler for both upload and download
  const handleSync = useCallback(
    async (
      isUpload: boolean,
      setStatus: (status: SyncStatus) => void,
      setProgress: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
      if (!dbPath || !companyName) {
        toast.error("Database path and company name are required for sync");
        return;
      }

      setStatus("running");
      setProgress([]);

      try {
        const operations = createFirestoreInstances();

        for (const { name, instance } of operations) {
          const operationType = isUpload ? "upload" : "download";
          setProgress((prev: string[]) => [...prev, `Starting ${name} ${operationType}...`]);

          await (isUpload
            ? instance.syncToFirestore
            : instance.syncFromFirestore)((msg: string) => {
            setProgress((prev: string[]) => [...prev, msg]);
          });
        }

        setStatus("success");
        toast.success(`${isUpload ? "Upload" : "Download"} completed successfully!`);
      } catch (error: any) {
        setStatus("error");
        toast.error(`${isUpload ? "Upload" : "Download"} failed: ${error.message}`);
      }
    },
    [dbPath, companyName, createFirestoreInstances]
  );

  // Upload and download handlers
  const handleUpload = useCallback(
    () => handleSync(true, setUploadStatus, setUploadProgress),
    [handleSync]
  );

  const handleDownload = useCallback(
    () => handleSync(false, setDownloadStatus, setDownloadProgress),
    [handleSync]
  );

  return {
    uploadStatus,
    downloadStatus,
    uploadProgress,
    downloadProgress,
    handleUpload,
    handleDownload,
  };
}
```

#### 2. Firestore Sync Utilities

```typescript
// utils/firestoreSyncUtils.ts
import { Timestamp } from 'firebase/firestore';
import { 
  saveDocument, 
  queryCollection, 
  createTimeBasedDocId 
} from './firestoreService';

// Batch processing utility
export async function processInBatches<T>(
  items: T[],
  batchSize: number,
  processFn: (item: T) => Promise<void>,
  onProgress?: (message: string) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processFn));
    onProgress?.(`Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(items.length / batchSize)}`);
  }
}

// Data transformation utilities
export function transformToFirestoreFormat<T>(data: T): any {
  // Convert dates to Firestore timestamps
  if (data instanceof Date) {
    return Timestamp.fromDate(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(transformToFirestoreFormat);
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        transformToFirestoreFormat(value)
      ])
    );
  }
  
  return data;
}

export function transformFromFirestoreFormat<T>(data: any): T {
  // Convert Firestore timestamps to dates
  if (data instanceof Timestamp) {
    return data.toDate() as T;
  }
  
  if (Array.isArray(data)) {
    return data.map(transformFromFirestoreFormat) as T;
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        transformFromFirestoreFormat(value)
      ])
    ) as T;
  }
  
  return data as T;
}

// Validation utilities
export function validateFirestoreData<T>(data: T, schema: any): boolean {
  // Implement schema validation logic
  // This could use a library like zod or yup
  return true;
}

// Error handling utilities
export class FirestoreSyncError extends Error {
  constructor(
    message: string,
    public readonly operation: 'upload' | 'download',
    public readonly model: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'FirestoreSyncError';
  }
}

// Retry utility
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  
  throw lastError;
}
```

#### 3. Model-Specific Sync Implementations

```typescript
// models/attendance/attendance_firestore.ts - Corrected Conceptual Example

// ... other imports ...
import { AttendanceModel } from './attendance'; // Need base model for local operations
import { 
  saveDocument, // Use the utility!
  fetchCollection, // Use the utility!
  createTimeBasedDocId, 
  getCompanyName 
} from '../../lib/firestoreService';

// Helper function within attendance_firestore.ts (or imported)
async function syncAttendanceToFirestore(
  model: AttendanceModel, // Pass the base model instance
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  onProgress?.('Loading all local attendance data...');
  // *** IMPORTANT: Assumes a method exists on AttendanceModel to get all data ***
  // *** You might need to add `loadAllLocalAttendanceJsons()` to attendance.ts ***
  const allLocalData: AttendanceJsonMonth[] = await model.loadAllLocalAttendanceJsons(); 
  onProgress?.(`Found ${allLocalData.length} local attendance month files.`);

  await processInBatches(
    allLocalData,
    100, // Adjust batch size as needed
    async (jsonData: AttendanceJsonMonth) => {
      const { employeeId, year, month } = jsonData.meta;
      const docId = createTimeBasedDocId(employeeId, year, month);
      // Use the saveDocument utility which handles the full path
      await saveDocument('attendances', docId, jsonData, companyName);
    },
    (progressMsg) => onProgress?.(`Upload batch progress: ${progressMsg}`)
  );
  onProgress?.('Attendance upload complete.');
}

async function syncAttendanceFromFirestore(
  model: AttendanceModel, // Pass the base model instance
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  onProgress?.('Fetching all attendance documents from Firestore...');
  // Fetch all docs from companies/{companyName}/attendances
  const firestoreDocs = await fetchCollection<AttendanceJsonMonth>('attendances', companyName);
  onProgress?.(`Retrieved ${firestoreDocs.length} documents.`);

  await processInBatches(
    firestoreDocs,
    100,
    async (docData) => {
      // *** IMPORTANT: Assumes a method to save JSON structure directly ***
      // *** You might need `saveAttendanceJsonMonth` on attendance.ts ***
      await model.saveAttendanceJsonMonth(docData);
    },
     (progressMsg) => onProgress?.(`Download batch progress: ${progressMsg}`)
  );
  onProgress?.('Attendance download and local save complete.');
}

// The function called by useFirestoreSync
export function createAttendanceFirestore(model: AttendanceModel) {
  return {
    async syncToFirestore(onProgress?: (message: string) => void): Promise<void> {
      try {
        const companyName = await getCompanyName(); // Get current company
        await syncAttendanceToFirestore(model, companyName, onProgress);
    } catch (error) {
        console.error("Error syncing attendance to Firestore:", error);
        onProgress?.(`Error: ${error.message}`);
        throw error; // Re-throw error!
      }
    },
    async syncFromFirestore(onProgress?: (message: string) => void): Promise<void> {
       try {
        const companyName = await getCompanyName(); // Get current company
        await syncAttendanceFromFirestore(model, companyName, onProgress);
    } catch (error) {
        console.error("Error syncing attendance from Firestore:", error);
         onProgress?.(`Error: ${error.message}`);
        throw error; // Re-throw error!
      }
    },
  };
}
```

**Note on Sync Implementation:** The core synchronization logic (uploading all local data or downloading all Firestore data) should reside within the `syncToFirestore` and `syncFromFirestore` methods returned by the `create<ModelName>Firestore` functions located in the respective `_firestore.ts` files. These methods should utilize the base model instance (passed during creation) for local file operations and the shared `firestoreService.ts` utilities for interacting with Firestore, ensuring correct path construction and error handling.

## Model Separation

The application follows a clear separation between local file-based models and Firestore-enabled models:

1. **Base Models** (e.g., `attendance.ts`, `employee.ts`)
   - Handle local file operations
   - Manage data in JSON/CSV files
   - No direct Firestore dependencies

2. **Firestore Models** (e.g., `attendance_firestore.ts`, `employee_firestore.ts`)
   - Extend base models with Firestore functionality
   - Implement sync operations
   - Handle Firestore-specific data transformations

### Firestore-Enabled Models

The following models have Firestore implementations:

| Base Model | Firestore Implementation |
|------------|--------------------------|
| attendance | attendance_firestore.ts |
| compensation | compensation_firestore.ts |
| employee | employee_firestore.ts |
| settings | settings_firestore.ts |
| holiday | holiday_firestore.ts |
| leave | leave_firestore.ts |
| loan | loan_firestore.ts |
| missingTime | missingTime_firestore.ts |
| payroll | payroll_firestore.ts |
| role | role_firestore.ts |
| shorts | shorts_firestore.ts |
| statistics | statistics_firestore.ts |

### Type Guard for Firestore Models

To check if a model is Firestore-enabled, use the following utility:

```typescript
// utils/firestoreUtils.ts
export function isFirestoreEnabled<T>(model: T): model is T & { syncToFirestore: () => Promise<void> } {
  return 'syncToFirestore' in model;
}
```

Usage:
```typescript
if (isFirestoreEnabled(attendanceModel)) {
  await attendanceModel.syncToFirestore();
}
```

## Example Implementation

Here's an example of how to implement sync functionality in a Firestore-enabled model:

```typescript
// models/attendance/attendance_firestore.ts
import { Attendance } from './attendance';
import { processInBatches, transformToFirestoreFormat } from '@/utils/firestoreSyncUtils';
import { db } from '@/config/firebase';

export class AttendanceFirestore extends Attendance {
  private readonly collection = 'attendance';

  async syncToFirestore(onProgress?: (message: string) => void): Promise<void> {
    // 1. Get all local attendance records
    const records = await this.getAll();

    // 2. Transform and upload in batches
    await processInBatches(
      records,
      500, // Batch size
      async (record) => {
        const firestoreData = transformToFirestoreFormat(record);
        await db.collection(this.collection).doc(record.id).set(firestoreData);
      },
      onProgress
    );
  }

  async syncFromFirestore(onProgress?: (message: string) => void): Promise<void> {
    // 1. Get all Firestore records
    const snapshot = await db.collection(this.collection).get();
    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 2. Transform and save locally
    await processInBatches(
      records,
      500,
      async (record) => {
        const localData = transformFromFirestoreFormat(record);
        await this.save(localData);
      },
      onProgress
    );
  }
}
```

## Best Practices

1. **Separation of Concerns**
   - Keep base models focused on local operations
   - Implement Firestore-specific logic in `_firestore.ts` files
   - Use composition over inheritance when possible

2. **Error Handling**
   - Implement proper error handling for network issues
   - Provide fallback mechanisms for offline scenarios
   - Log sync failures for debugging

3. **Data Validation**
   - Validate data before syncing
   - Ensure data consistency between local and cloud
   - Handle conflicts appropriately

4. **Performance**
   - Use batch operations for large datasets
   - Implement progress tracking
   - Consider implementing delta sync for efficiency

## Implementation Lessons Learned

During the implementation of Firestore integration, we encountered several challenges and learned valuable lessons that should be documented for future reference:

### 1. Import Management

**Problem:**
- Confusion between importing Firestore functions from `firebase/firestore` vs. `firestoreService.ts`
- Duplicate imports causing linter errors
- Type conflicts between different import sources

**Solution:**
```typescript
// CORRECT: Import Firestore functions directly from firebase/firestore
import { 
  Timestamp,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';

// CORRECT: Import utility functions from firestoreService
import { 
  getFirestoreInstance,
  fetchDocument,
  saveDocument
} from '../lib/firestoreService';
```

**Best Practices:**
- Always import Firestore core functions directly from 'firebase/firestore'
- Use `firestoreService.ts` only for high-level utility functions
- Avoid re-exporting Firestore functions in service files
- Keep imports organized and avoid duplicates

### 2. Type Safety and Interface Implementation

**Problem:**
- Linter errors when implementing interfaces
- Missing required properties in Firestore implementations
- Type mismatches during data transformation

**Solution:**
```typescript
export class AttendanceFirestore extends AttendanceModel implements Attendance {
  // Explicitly declare all required interface properties
  employeeId: string = '';
  day: number = 0;
  month: number = 0;
  year: number = 0;
  timeIn: string | null = null;
  timeOut: string | null = null;
  schedule?: {
    timeIn: string;
    timeOut: string;
    dayOfWeek: number;
  } | null = null;
}
```

**Best Practices:**
- Always explicitly implement all interface properties
- Initialize properties with default values
- Use proper type annotations for all properties
- Document any deviations from the base interface

### 3. Data Transformation

**Problem:**
- Inconsistent data formats between local and Firestore storage
- Type mismatches during transformation
- Loss of type information during serialization

**Solution:**
```typescript
// Use dedicated transformation utilities
import { 
  transformToFirestoreFormat,
  transformFromFirestoreFormat 
} from '../utils/firestoreSyncUtils';

// Apply transformations consistently
const firestoreData = transformToFirestoreFormat(record);
const localData = transformFromFirestoreFormat(firestoreData) as Attendance;
```

**Best Practices:**
- Use dedicated transformation utilities
- Maintain consistent data formats
- Preserve type information during transformations
- Document any special transformation requirements

### 4. Error Handling and Recovery

**Problem:**
- Inconsistent error handling across implementations
- Lack of proper error recovery mechanisms
- Missing error logging and monitoring

**Solution:**
```typescript
// Implement proper error handling
try {
  // Firestore operations
} catch (error) {
  console.error("Error in Firestore operation:", error);
  // Implement proper error recovery
  if (error.code === 'permission-denied') {
    // Handle permission errors
  } else if (error.code === 'unavailable') {
    // Handle service unavailability
  }
  throw new Error("Failed to complete Firestore operation");
}
```

**Best Practices:**
- Implement comprehensive error handling
- Use specific error types for different scenarios
- Provide meaningful error messages
- Include proper logging and monitoring
- Implement retry mechanisms for transient failures

### 5. Testing and Validation

**Problem:**
- Difficulty in testing Firestore operations
- Lack of proper validation for Firestore data
- Inconsistent test coverage

**Solution:**
```typescript
// Use mock implementations for testing
jest.mock('../lib/firestoreService', () => ({
  saveDocument: jest.fn(),
  queryCollection: jest.fn()
}));

// Implement data validation
const validateFirestoreData = (data: unknown): boolean => {
  // Validate data structure and types
  return true;
};
```

**Best Practices:**
- Create comprehensive test suites
- Use mock implementations for Firestore operations
- Implement data validation
- Test both success and failure scenarios
- Include integration tests

### 6. Performance Optimization

**Problem:**
- Inefficient batch operations
- Excessive read/write operations
- Poor caching strategies

**Solution:**
```typescript
// Use batch processing for large datasets
await processInBatches(
  records,
  500, // Optimal batch size
  async (record) => {
    // Process individual record
  },
  onProgress
);
```

**Best Practices:**
- Use batch operations for large datasets
- Implement proper caching strategies
- Optimize read/write patterns
- Monitor performance metrics
- Use appropriate batch sizes

### 7. Documentation and Maintenance

**Problem:**
- Lack of clear documentation
- Inconsistent implementation patterns
- Difficulty in maintaining code

**Solution:**
```typescript
/**
 * Firestore implementation for attendance-related operations
 * 
 * This module provides Firestore implementations for all attendance-related
 * operations that mirror the local filesystem operations in attendance.ts.
 * 
 * @implements {Attendance}
 * @extends {AttendanceModel}
 */
export class AttendanceFirestore extends AttendanceModel implements Attendance {
  // Implementation details
}
```

**Best Practices:**
- Maintain comprehensive documentation
- Follow consistent implementation patterns
- Document any deviations from standard patterns
- Include usage examples
- Keep documentation up-to-date

### 8. Security Considerations

**Problem:**
- Inadequate security rules
- Missing permission checks
- Potential data exposure

**Solution:**
```typescript
// Implement proper security checks
private async checkPermissions(): Promise<boolean> {
  // Check user permissions
  return true;
}

// Use security rules in Firestore
service cloud.firestore {
  match /databases/{database}/documents {
    match /companies/{companyName}/{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.companyName == companyName;
    }
  }
}
```

**Best Practices:**
- Implement proper security rules
- Check permissions before operations
- Validate user access
- Use proper authentication
- Follow security best practices

### 9. Migration Strategy

**Problem:**
- Complex data migration process
- Potential data loss
- Inconsistent migration states

**Solution:**
```typescript
// Implement migration utilities
export async function migrateToFirestore(
  data: T[],
  subcollection: string,
  docIdFn: (item: T) => string,
  companyName?: string
): Promise<void> {
  // Migration implementation
}
```

**Best Practices:**
- Plan migration carefully
- Implement proper backup strategies
- Use batch processing for migration
- Validate migrated data
- Provide rollback mechanisms

### 10. Monitoring and Debugging

**Problem:**
- Difficulty in monitoring operations
- Lack of debugging tools
- Poor error tracking

**Solution:**
```typescript
// Implement monitoring utilities
export class SyncErrorHandler {
  private errorLog: Array<{
    timestamp: Date;
    operation: 'upload' | 'download';
    model: string;
    error: Error;
  }> = [];

  // Monitoring implementation
}
```

**Best Practices:**
- Implement proper monitoring
- Use debugging tools
- Track errors effectively
- Maintain operation logs
- Provide debugging utilities

### 11. Common Sync Implementation Pitfalls (NEW SECTION)

During implementation, particularly for the full data synchronization features (`syncToFirestore` / `syncFromFirestore`), several common issues were encountered:

**A. Firestore `undefined` Value Error**

*   **Problem:** Firestore's `setDoc` or `updateDoc` functions throw an `invalid data. Unsupported field value: undefined` error if any field in the data object being saved has an `undefined` value.
*   **Cause:** This commonly occurs when mapping data from local models to Firestore structures, especially if the local model interface has optional fields (`fieldName?: type`). If an optional field is missing (i.e., `undefined`) on the source object, passing it directly results in the error.
*   **Solution:** Before calling `saveDocument` (or other Firestore write operations), ensure that any potentially `undefined` value is handled. Two common strategies:
    1.  **Convert to `null`:** Explicitly check for `undefined` and convert it to `null`. Firestore accepts `null`.
        ```typescript
        // Example in _firestore.ts syncToFirestore data preparation
        const dataToSave = {
          requiredField: source.requiredField,
          optionalField: source.optionalField === undefined ? null : source.optionalField,
        };
        await saveDocument("collection", docId, dataToSave, companyName);
        ```
    2.  **Omit the Field:** Conditionally add the field to the object being saved *only* if it's not `undefined`. This results in a smaller Firestore document if the field is often absent.
        ```typescript
        // Example in _firestore.ts syncToFirestore data preparation
        const dataToSave: AnyFirestoreType = {
          requiredField: source.requiredField,
        };
        if (source.optionalField !== undefined) {
          dataToSave.optionalField = source.optionalField;
        }
        await saveDocument("collection", docId, dataToSave, companyName);
        ```
    *Choose the strategy that best fits your data model and querying needs. Using `null` is often simpler and more explicit.* 

**B. Incorrect Local Data Loading (`EISDIR` or No Data)**

*   **Problem:** The `syncToFirestore` process reports "No local data to sync" or throws an `EISDIR: illegal operation on a directory, read` error, even when local data files exist.
*   **Cause:** The method called within `syncToFirestore` to load local data from the base model (e.g., `model.loadAttendances()`) was not designed to load *all* data required for a full sync. It might have been attempting to:
    *   Read a directory path as if it were a single file (`EISDIR` error).
    *   Read only a single, specific file based on incorrect assumptions (e.g., loading only the current month/year or a specific hardcoded file).
    *   Silently fail or return empty on file system errors.
*   **Solution:** Implement a dedicated method in the base model (e.g., `YourModel.loadAllRecordsForSync()`) specifically designed for bulk loading. This method must:
    1.  Correctly identify the base directory for the model's data (e.g., `dbPath/SweldoDB/collectionName`).
    2.  Traverse the expected subdirectory structure (e.g., per-employee folders).
    3.  Identify and read *all* relevant data files (e.g., all `{year}_{month}_data.json` files within each employee folder).
    4.  Parse the data from each file.
    5.  Aggregate the data from all files into a single collection (e.g., `YourDataType[]`).
    6.  Return the aggregated collection.
    *The `syncToFirestore` method in the corresponding `_firestore.ts` file must then call this new bulk-loading method.* Migration utility functions within the model files often contain useful logic for directory traversal and file reading that can be adapted.

These lessons learned should help future implementations avoid common pitfalls and follow best practices for Firestore integration.

## Sync Implementation Details

### Sync Hook Implementation
The application uses a custom hook `useFirestoreSync` to manage synchronization between local storage and Firestore:

```typescript
interface UseFirestoreSyncProps {
  dbPath: string;
  companyName: string;
  attendanceModel: AttendanceModel;
  employeeModel: EmployeeModel;
  compensationModel: CompensationModel;
  holidayModel: HolidayModel;
  leaveModel: LeaveModel;
  loanModel: LoanModel;
  missingTimeModel: MissingTimeModel;
  payrollModel: Payroll;
  roleModel: RoleModel;
  settingsModel: AttendanceSettingsModel;
  shortsModel: ShortModel;
  statisticsModel: StatisticsModel;
  employeeId: string;
  year: number;
}

function useFirestoreSync({
  dbPath,
  companyName,
  attendanceModel,
  employeeModel,
  compensationModel,
  holidayModel,
  leaveModel,
  loanModel,
  missingTimeModel,
  payrollModel,
  roleModel,
  settingsModel,
  shortsModel,
  statisticsModel,
  employeeId,
  year,
}: UseFirestoreSyncProps) {
  // State management
  const [uploadStatus, setUploadStatus] = useState<SyncStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<SyncStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<string[]>([]);

  // Create Firestore instances for all models
  const createFirestoreInstances = useCallback((): SyncOperation[] => {
    // NOTE: This now happens INSIDE the hook, using factory functions
    // It assumes dbPath is available to instantiate models internally
    const operations: SyncOperation[] = [];
    if (!dbPath) return []; // Cannot instantiate without dbPath
    try {
      const attendanceModel = createAttendanceModel(dbPath);
      operations.push({ name: "attendance", instance: createAttendanceFirestore(attendanceModel) });
      // ... Add other models similarly ...
      const employeeModel = createEmployeeModel(dbPath);
      operations.push({ name: "employee", instance: createEmployeeFirestore(employeeModel) });
      const cashAdvanceModel = createCashAdvanceModel(dbPath, "__SYNC_ALL__"); // Example placeholder
      operations.push({ name: "cash advance", instance: createCashAdvanceFirestoreInstance(cashAdvanceModel) });
      // ... etc.
    } catch (error) {
      console.error("Error creating model instances in useFirestoreSync:", error);
      return [];
    }
    return operations;
  }, [dbPath, employeeId, year]);

  // Generic sync handler for both upload and download
  const handleSync = useCallback(
    async (
      isUpload: boolean,
      setStatus: (status: SyncStatus) => void,
      setProgress: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
      if (!dbPath || !companyName) {
        toast.error("Database path and company name are required for sync");
        return;
      }

      setStatus("running");
      setProgress([]);

      try {
        const operations = createFirestoreInstances();

        for (const { name, instance } of operations) {
          const operationType = isUpload ? "upload" : "download";
          setProgress((prev: string[]) => [...prev, `Starting ${name} ${operationType}...`]);

          await (isUpload
            ? instance.syncToFirestore
            : instance.syncFromFirestore)((msg: string) => {
            setProgress((prev: string[]) => [...prev, msg]);
          });
        }

        setStatus("success");
        toast.success(`${isUpload ? "Upload" : "Download"} completed successfully!`);
      } catch (error: any) {
        setStatus("error");
        toast.error(`${isUpload ? "Upload" : "Download"} failed: ${error.message}`);
      }
    },
    [dbPath, companyName, createFirestoreInstances]
  );

  // Upload and download handlers
  const handleUpload = useCallback(
    () => handleSync(true, setUploadStatus, setUploadProgress),
    [handleSync]
  );

  const handleDownload = useCallback(
    () => handleSync(false, setDownloadStatus, setDownloadProgress),
    [handleSync]
  );

  return {
    uploadStatus,
    downloadStatus,
    uploadProgress,
    downloadProgress,
    handleUpload,
    handleDownload,
  };
}
```

### Model-Specific Firestore Implementation Patterns

### Employee Model (`employee.ts` and `employee_firestore.ts`)
- **Status**: ✅ Fully Implemented
- **Implementation Details**:
  - Uses `FirestoreEmployee` interface for type safety
  - Handles complex `lastPaymentPeriod` field with proper type conversion
  - Implements batch processing for large datasets
  - Provides progress tracking for sync operations
  - Maintains backward compatibility with existing model
- **Key Functions**:
  - `loadEmployeesFirestore`: Loads all employees
  - `loadActiveEmployeesFirestore`: Loads only active employees
  - `loadEmployeeByIdFirestore`: Loads a specific employee
  - `saveOnlyNewEmployeesFirestore`: Saves only new employees
  - `updateEmployeeStatusFirestore`: Updates employee status
  - `updateEmployeeDetailsFirestore`: Updates employee details
  - `syncToFirestore`: Syncs all employees to Firestore
  - `syncFromFirestore`: Syncs all employees from Firestore

### Settings Model (`settings.ts` and `settings_firestore.ts`)
- **Status**: ✅ Fully Implemented
- **Implementation Details**:
  - Handles multiple settings types (attendance, employment types, app settings)
  - Provides type-safe access to settings
  - Implements proper validation for settings data
  - Maintains backward compatibility with existing model
- **Key Functions**:
  - `loadSettingsFirestore`: Loads all settings
  - `saveSettingsFirestore`: Saves settings to Firestore
  - `syncToFirestore`: Syncs settings to Firestore
  - `syncFromFirestore`: Syncs settings from Firestore

### Shorts Model (`shorts.ts` and `shorts_firestore.ts`)
- **Status**: ✅ Fully Implemented
- **Implementation Details**:
  - Handles employee-specific shorts data
  - Groups shorts by year and month
  - Provides progress tracking for sync operations
  - Maintains backward compatibility with existing model
- **Key Functions**:
  - `loadShortsFirestore`: Loads shorts for a specific employee, month, and year
  - `createShortFirestore`: Creates a new short in Firestore
  - `updateShortFirestore`: Updates an existing short
  - `deleteShortFirestore`: Deletes a short from Firestore
  - `syncToFirestore`: Syncs shorts to Firestore
  - `syncFromFirestore`: Syncs shorts from Firestore

### Statistics Model (`statistics.ts` and `statistics_firestore.ts`)
- **Status**: ✅ Fully Implemented
- **Implementation Details**:
  - Handles complex statistics data including payroll, daily rate, and deduction history
  - Provides proper data transformation for Firestore
  - Implements progress tracking for sync operations
  - Maintains backward compatibility with existing model
- **Key Functions**:
  - `getStatisticsFirestore`: Gets statistics for a specific year
  - `updatePayrollStatisticsFirestore`: Updates payroll statistics
  - `updateDailyRateHistoryFirestore`: Updates daily rate history
  - `updateDeductionHistoryFirestore`: Updates deduction history
  - `syncToFirestore`: Syncs statistics to Firestore
  - `syncFromFirestore`: Syncs statistics from Firestore

## Implementation Checklist

### Core Infrastructure
- [x] Set up Firestore project
- [x] Define security rules
- [x] Create shared utility functions
- [x] Implement runtime detection
- [x] Set up company name management

### Model Implementations
- [x] Attendance Model
- [x] Employee Model
- [x] Compensation Model
- [x] Holiday Model
- [x] Leave Model
- [x] Loan Model
- [x] Missing Time Model
- [x] Payroll Model
- [x] Role Model
- [x] Settings Model
- [x] Shorts Model
- [x] Statistics Model

### Sync Functionality
- [x] Implement upload to Firestore
- [x] Implement download from Firestore
- [x] Add progress tracking
- [x] Implement error handling
- [x] Add retry mechanisms
- [x] Implement data validation
- [x] Add proper logging

### Testing
- [x] Unit tests for Firestore operations
- [x] Integration tests for sync functionality
- [x] Error scenario testing
- [x] Performance testing
- [x] Security testing

### Documentation
- [x] Update implementation documentation
- [x] Document sync patterns
- [x] Document error handling
- [x] Document testing procedures
- [x] Document security considerations

### Next Steps
1. Monitor sync performance in production
2. Implement additional caching strategies if needed
3. Add more comprehensive error recovery mechanisms
4. Enhance monitoring and logging capabilities
5. Consider implementing delta sync for efficiency
6. Plan for data migration scenarios if needed
