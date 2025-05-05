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
}

export function useFirestoreSync({ dbPath, companyName }: UseFirestoreSyncProps) {
  const [uploadStatus, setUploadStatus] = useState<SyncStatus>('idle');
  const [downloadStatus, setDownloadStatus] = useState<SyncStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<string[]>([]);

  const handleUpload = useCallback(async () => {
    if (!dbPath || !companyName) return;
    
    setUploadStatus('running');
    setUploadProgress([]);
    
    try {
      // Upload settings first
      await uploadSettingsToFirestore(dbPath, companyName, (msg) => {
        setUploadProgress(prev => [...prev, msg]);
      });
      
      // Upload other models in sequence
      await uploadEmployeesToFirestore(dbPath, companyName, (msg) => {
        setUploadProgress(prev => [...prev, msg]);
      });
      
      // Continue with other models...
      
      setUploadStatus('success');
      toast.success('Upload completed successfully!');
    } catch (error) {
      setUploadStatus('error');
      toast.error(`Upload failed: ${error.message}`);
    }
  }, [dbPath, companyName]);

  const handleDownload = useCallback(async () => {
    if (!dbPath || !companyName) return;
    
    setDownloadStatus('running');
    setDownloadProgress([]);
    
    try {
      // Download settings first
      await downloadSettingsFromFirestore(dbPath, companyName, (msg) => {
        setDownloadProgress(prev => [...prev, msg]);
      });
      
      // Download other models in sequence
      await downloadEmployeesFromFirestore(dbPath, companyName, (msg) => {
        setDownloadProgress(prev => [...prev, msg]);
      });
      
      // Continue with other models...
      
      setDownloadStatus('success');
      toast.success('Download completed successfully!');
    } catch (error) {
      setDownloadStatus('error');
      toast.error(`Download failed: ${error.message}`);
    }
  }, [dbPath, companyName]);

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
// models/attendance/attendanceSync.ts
import { 
  processInBatches, 
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
  validateFirestoreData,
  withRetry
} from '../../utils/firestoreSyncUtils';
import { Attendance, AttendanceJsonMonth } from './attendance';
import { saveDocument, queryCollection } from '../../utils/firestoreService';

const BATCH_SIZE = 50;

export async function uploadAttendanceToFirestore(
  dbPath: string,
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // 1. Load all local JSON files
  const localFiles = await window.electron.listFiles(`${dbPath}/SweldoDB/attendances`);
  
  // 2. Process each file
  await processInBatches(
    localFiles,
    BATCH_SIZE,
    async (file) => {
      const data = await window.electron.readJsonFile(file);
      const firestoreData = transformToFirestoreFormat(data);
      
      if (!validateFirestoreData(firestoreData, attendanceSchema)) {
        throw new FirestoreSyncError(
          'Invalid attendance data',
          'upload',
          'attendance'
        );
      }
      
      const docId = createTimeBasedDocId(
        data.employeeId,
        data.year,
        data.month
      );
      
      await withRetry(() => 
        saveDocument('attendances', docId, firestoreData, companyName)
      );
    },
    onProgress
  );
}

export async function downloadAttendanceFromFirestore(
  dbPath: string,
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // 1. Query all attendance documents
  const querySnapshot = await queryCollection('attendances', companyName);
  
  // 2. Process each document
  await processInBatches(
    querySnapshot.docs,
    BATCH_SIZE,
    async (doc) => {
      const data = transformFromFirestoreFormat(doc.data());
      const filePath = createLocalFilePath(
        dbPath,
        data.employeeId,
        data.year,
        data.month
      );
      
      await window.electron.writeJsonFile(filePath, data);
    },
    onProgress
  );
}
```

### Additional Model-Specific Implementations

#### 1. Employee Model Sync

```typescript
// models/employee/employeeSync.ts
import { 
  processInBatches, 
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
  validateFirestoreData,
  withRetry
} from '../../utils/firestoreSyncUtils';
import { Employee } from './employee';
import { saveDocument, queryCollection } from '../../utils/firestoreService';

const BATCH_SIZE = 50;

const employeeSchema = {
  id: 'string',
  name: 'string',
  position: 'string',
  dailyRate: 'number',
  sss: 'number',
  philHealth: 'number',
  pagIbig: 'number',
  status: ['active', 'inactive'],
  employmentType: 'string',
  lastPaymentPeriod: {
    year: 'number',
    month: 'number'
  }
};

export async function uploadEmployeesToFirestore(
  dbPath: string,
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // 1. Load all local JSON files
  const localFiles = await window.electron.listFiles(`${dbPath}/SweldoDB/employees`);
  
  // 2. Process each file
  await processInBatches(
    localFiles,
    BATCH_SIZE,
    async (file) => {
      const data = await window.electron.readJsonFile(file);
      const firestoreData = transformToFirestoreFormat(data);
      
      if (!validateFirestoreData(firestoreData, employeeSchema)) {
        throw new FirestoreSyncError(
          'Invalid employee data',
          'upload',
          'employee'
        );
      }
      
      await withRetry(() => 
        saveDocument('employees', data.id, firestoreData, companyName)
      );
    },
    onProgress
  );
}

export async function downloadEmployeesFromFirestore(
  dbPath: string,
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // 1. Query all employee documents
  const querySnapshot = await queryCollection('employees', companyName);
  
  // 2. Process each document
  await processInBatches(
    querySnapshot.docs,
    BATCH_SIZE,
    async (doc) => {
      const data = transformFromFirestoreFormat(doc.data());
      const filePath = `${dbPath}/SweldoDB/employees/${data.id}.json`;
      
      await window.electron.writeJsonFile(filePath, data);
    },
    onProgress
  );
}
```

#### 2. Settings Model Sync

```typescript
// models/settings/settingsSync.ts
import { 
  transformToFirestoreFormat,
  transformFromFirestoreFormat,
  validateFirestoreData,
  withRetry
} from '../../utils/firestoreSyncUtils';
import { 
  AttendanceSettings, 
  EmploymentTypeSettings,
  AppSettings 
} from './settings';
import { saveDocument, queryCollection } from '../../utils/firestoreService';

const settingsSchemas = {
  attendance: {
    overtimeEnabled: 'boolean',
    overtimeHourlyMultiplier: 'number',
    overtimeThresholdHours: 'number',
    autoClockOutEnabled: 'boolean',
    autoClockOutHour: 'number',
    autoClockOutMinute: 'number',
    hoursPerWorkDay: 'number'
  },
  employmentTypes: {
    employmentTypes: [{
      type: 'string',
      hoursOfWork: 'number',
      schedules: 'array',
      monthSchedules: 'object',
      requiresTimeTracking: 'boolean'
    }]
  },
  app: {
    theme: 'string',
    language: 'string',
    notificationsEnabled: 'boolean',
    timeFormat: ['12-hour', '24-hour']
  }
};

export async function uploadSettingsToFirestore(
  dbPath: string,
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // 1. Load all settings files
  const settingsFiles = [
    { type: 'attendance', path: `${dbPath}/SweldoDB/settings/attendance.json` },
    { type: 'employmentTypes', path: `${dbPath}/SweldoDB/settings/employmentTypes.json` },
    { type: 'app', path: `${dbPath}/SweldoDB/settings/app.json` }
  ];

  // 2. Process each settings file
  for (const { type, path } of settingsFiles) {
    try {
      const data = await window.electron.readJsonFile(path);
      const firestoreData = transformToFirestoreFormat(data);
      
      if (!validateFirestoreData(firestoreData, settingsSchemas[type])) {
        throw new FirestoreSyncError(
          `Invalid ${type} settings data`,
          'upload',
          'settings'
        );
      }
      
      await withRetry(() => 
        saveDocument('settings', type, firestoreData, companyName)
      );
      
      onProgress?.(`Uploaded ${type} settings`);
    } catch (error) {
      if (error instanceof FirestoreSyncError) {
        throw error;
      }
      throw new FirestoreSyncError(
        `Failed to upload ${type} settings`,
        'upload',
        'settings',
        error
      );
    }
  }
}

export async function downloadSettingsFromFirestore(
  dbPath: string,
  companyName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const settingsTypes = ['attendance', 'employmentTypes', 'app'];
  
  for (const type of settingsTypes) {
    try {
      const doc = await queryCollection('settings', companyName)
        .where('type', '==', type)
        .limit(1)
        .get();
      
      if (doc.empty) {
        onProgress?.(`No ${type} settings found in Firestore`);
        continue;
      }
      
      const data = transformFromFirestoreFormat(doc.docs[0].data());
      const filePath = `${dbPath}/SweldoDB/settings/${type}.json`;
      
      await window.electron.writeJsonFile(filePath, data);
      onProgress?.(`Downloaded ${type} settings`);
    } catch (error) {
      throw new FirestoreSyncError(
        `Failed to download ${type} settings`,
        'download',
        'settings',
        error
      );
    }
  }
}
```

### Enhanced Validation Utilities

```typescript
// utils/validationUtils.ts
import { z } from 'zod';

// Base schemas
export const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format'
});

export const timeSchema = z.string().refine((val) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val), {
  message: 'Invalid time format (HH:MM)'
});

// Model-specific schemas
export const attendanceSchema = z.object({
  meta: z.object({
    employeeId: z.string(),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
    lastModified: dateSchema
  }),
  days: z.record(
    z.string().refine((val) => /^\d+$/.test(val)),
    z.object({
      timeIn: timeSchema.nullable(),
      timeOut: timeSchema.nullable(),
      schedule: z.string().nullable()
    })
  )
});

export const employeeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  position: z.string().min(1),
  dailyRate: z.number().positive(),
  sss: z.number().min(0),
  philHealth: z.number().min(0),
  pagIbig: z.number().min(0),
  status: z.enum(['active', 'inactive']),
  employmentType: z.string().min(1),
  lastPaymentPeriod: z.object({
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12)
  }).nullable()
});

// Validation function
export function validateWithZod<T>(
  data: unknown,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    )
  };
}
```

### Error Handling Scenarios

```typescript
// utils/errorHandling.ts
import { FirestoreSyncError } from './firestoreSyncUtils';

export class SyncErrorHandler {
  private static instance: SyncErrorHandler;
  private errorLog: Array<{
    timestamp: Date;
    operation: 'upload' | 'download';
    model: string;
    error: Error;
  }> = [];

  private constructor() {}

  static getInstance(): SyncErrorHandler {
    if (!SyncErrorHandler.instance) {
      SyncErrorHandler.instance = new SyncErrorHandler();
    }
    return SyncErrorHandler.instance;
  }

  async handleError(
    error: Error,
    operation: 'upload' | 'download',
    model: string,
    onError?: (message: string) => void
  ): Promise<void> {
    // Log the error
    this.errorLog.push({
      timestamp: new Date(),
      operation,
      model,
      error
    });

    // Handle specific error types
    if (error instanceof FirestoreSyncError) {
      onError?.(`${operation} failed for ${model}: ${error.message}`);
      return;
    }

    if (error.name === 'FirebaseError') {
      switch (error.code) {
        case 'permission-denied':
          onError?.(`Permission denied for ${operation} operation`);
          break;
        case 'unavailable':
          onError?.(`Firestore service unavailable, please try again later`);
          break;
        case 'resource-exhausted':
          onError?.(`Firestore quota exceeded, please try again later`);
          break;
        default:
          onError?.(`Firestore error during ${operation}: ${error.message}`);
      }
      return;
    }

    // Handle network errors
    if (error.name === 'NetworkError') {
      onError?.(`Network error during ${operation}, please check your connection`);
      return;
    }

    // Handle file system errors
    if (error.name === 'FileSystemError') {
      onError?.(`File system error during ${operation}: ${error.message}`);
      return;
    }

    // Generic error
    onError?.(`Unexpected error during ${operation}: ${error.message}`);
  }

  getErrorLog(): typeof this.errorLog {
    return this.errorLog;
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }
}
```

### Testing Guidelines

```typescript
// tests/firestoreSync.test.ts
import { 
  uploadModelToFirestore,
  downloadModelFromFirestore,
  validateFirestoreData
} from '../utils/firestoreSyncUtils';
import { SyncErrorHandler } from '../utils/errorHandling';
import { validateWithZod } from '../utils/validationUtils';

describe('Firestore Sync Operations', () => {
  const mockDbPath = '/test/db/path';
  const mockCompanyName = 'TestCompany';
  
  beforeEach(() => {
    // Mock window.electron methods
    window.electron = {
      listFiles: jest.fn(),
      readJsonFile: jest.fn(),
      writeJsonFile: jest.fn()
    };
    
    // Mock Firestore methods
    jest.mock('../utils/firestoreService', () => ({
      saveDocument: jest.fn(),
      queryCollection: jest.fn()
    }));
  });

  describe('Upload Operations', () => {
    it('should successfully upload valid data', async () => {
      // Arrange
      const mockData = { /* valid test data */ };
      window.electron.readJsonFile.mockResolvedValue(mockData);
      
      // Act
      await uploadModelToFirestore(mockDbPath, mockCompanyName);
      
      // Assert
      expect(window.electron.readJsonFile).toHaveBeenCalled();
      expect(saveDocument).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        mockCompanyName
      );
    });

    it('should handle invalid data gracefully', async () => {
      // Arrange
      const mockData = { /* invalid test data */ };
      window.electron.readJsonFile.mockResolvedValue(mockData);
      
      // Act & Assert
      await expect(
        uploadModelToFirestore(mockDbPath, mockCompanyName)
      ).rejects.toThrow(FirestoreSyncError);
    });

    it('should retry failed operations', async () => {
      // Arrange
      const mockData = { /* valid test data */ };
      window.electron.readJsonFile.mockResolvedValue(mockData);
      saveDocument.mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      
      // Act
      await uploadModelToFirestore(mockDbPath, mockCompanyName);
      
      // Assert
      expect(saveDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('Download Operations', () => {
    it('should successfully download and save data', async () => {
      // Arrange
      const mockData = { /* valid test data */ };
      queryCollection.mockResolvedValue({
        docs: [{ data: () => mockData }]
      });
      
      // Act
      await downloadModelFromFirestore(mockDbPath, mockCompanyName);
      
      // Assert
      expect(window.electron.writeJsonFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle empty collections', async () => {
      // Arrange
      queryCollection.mockResolvedValue({ docs: [] });
      
      // Act & Assert
      await expect(
        downloadModelFromFirestore(mockDbPath, mockCompanyName)
      ).resolves.not.toThrow();
    });
  });

  describe('Validation', () => {
    it('should validate data against schema', () => {
      // Arrange
      const validData = { /* valid test data */ };
      const invalidData = { /* invalid test data */ };
      
      // Act & Assert
      expect(validateWithZod(validData, attendanceSchema).success).toBe(true);
      expect(validateWithZod(invalidData, attendanceSchema).success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should log and handle different error types', async () => {
      // Arrange
      const errorHandler = SyncErrorHandler.getInstance();
      const mockOnError = jest.fn();
      
      // Act
      await errorHandler.handleError(
        new Error('Test error'),
        'upload',
        'test',
        mockOnError
      );
      
      // Assert
      expect(mockOnError).toHaveBeenCalled();
      expect(errorHandler.getErrorLog()).toHaveLength(1);
    });
  });
});
```

### Testing Best Practices

1. **Unit Testing**
   - Test each utility function in isolation
   - Mock external dependencies (Firestore, file system)
   - Test both success and failure scenarios
   - Verify error handling and retry mechanisms

2. **Integration Testing**
   - Test the complete upload/download flow
   - Verify data transformation
   - Check file system operations
   - Validate Firestore operations

3. **Error Scenario Testing**
   - Network failures
   - Permission issues
   - Invalid data
   - File system errors
   - Firestore quota limits

4. **Performance Testing**
   - Large dataset handling
   - Batch processing efficiency
   - Memory usage
   - Network bandwidth usage

5. **Security Testing**
   - Data validation
   - Permission checks
   - Input sanitization
   - Error message security

### Next Steps

1. Implement the remaining model-specific sync functions
2. Add comprehensive validation schemas
3. Set up automated testing
4. Implement monitoring and logging
5. Create user documentation
6. Plan for data migration scenarios

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

These lessons learned should help future implementations avoid common pitfalls and follow best practices for Firestore integration.
