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
        ├── employees (subcollection)
        │   └── {employeeId} (document)
        ├── attendances (subcollection)
        │   └── {employeeId}_{year}_{month} (document)
        ├── leaves (subcollection)
        │   └── {employeeId}_{year}_{month} (document)
        ├── loans (subcollection)
        │   └── ... (structure TBD/flexible)
        └── settings (subcollection)
            └── ... (company-specific settings docs)
```

**Fetching the Company Name:** The `companyName` would first be retrieved from the application's settings (like those managed by `settingsStore`). This name will form the root of our data structure for that specific company. Let's assume the `companyName` is "AcmeCorp" for the examples.

1.  **Top-Level Company Collection:** Create a top-level collection, perhaps named `companies`. Each document within this collection represents a company, with the document ID being the `companyName`.
    *   `companies/{companyName}` (e.g., `companies/AcmeCorp`)
    *   This top-level document could store company-wide metadata if needed.

2.  **Subcollections per Data Type:** Within each company's document, use subcollections for the major data types:
    *   `companies/{companyName}/employees`: Stores employee master data. Document ID could be the `employeeId`.
    *   `companies/{companyName}/attendances`: Stores monthly attendance documents.
    *   `companies/{companyName}/leaves`: Stores monthly leave documents.
    *   `companies/{companyName}/loans`: Stores loan documents/monthly loan data.
    *   `companies/{companyName}/settings`: Stores company-specific application settings (if they differ from global settings).

3.  **Document Structure (Time-Based Data like Attendance/Leaves/Loans):**
    *   **Avoid Documents per Entry:** Creating a Firestore document for *every single* log remains inefficient.
    *   **Monthly Documents within Subcollections:** Create *one document per employee per month* within the relevant subcollection.
        *   **Document ID:** A composite ID like `{employeeId}_{year}_{month}` (e.g., `2_2025_4`).
        *   **Document Path Example:** `companies/AcmeCorp/attendances/2_2025_4`
        *   **Document Content:** The content remains the same as previously described - a map of days for that month.
        ```json
        // Example: companies/AcmeCorp/attendances/2_2025_4
        {
          "employeeId": "2",
          "year": 2025,
          "month": 4,
          "lastModified": "2024-...", // Firestore Timestamp preferred
          "days": {
            "1": { "timeIn": "08:01", "timeOut": "17:03", "schedule": { ... } },
            "2": { "timeIn": "07:58", "timeOut": "17:00", "schedule": { ... } },
            // ... other days
            "15": { "timeIn": null, "timeOut": null, "schedule": { ... } }
          }
        }
        ```
        *   Similarly for leaves: `companies/AcmeCorp/leaves/2_2025_4` containing monthly leave data.
        *   Loans would follow a similar pattern within `companies/AcmeCorp/loans/`.

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
3.  Refactor data model classes (`AttendanceModel`, `LeaveModel`, etc.) or create new ones to interact with Firestore instead of the local filesystem API (`window.electron`).
    *   **Recommendation:** To keep models clean and avoid repeating Firestore interaction logic, create a dedicated service file (e.g., `renderer/lib/firestoreService.ts`). This file should contain reusable helper functions for common Firestore operations like initializing Firebase, constructing document paths, and performing generic CRUD (Create, Read, Update, Delete) operations, especially for the established monthly document pattern.
4.  **Adapt Data Models for Conditional Storage:** The core data model classes (`AttendanceModel`, `LeaveModel`, etc.) will need to be refactored to handle *both* storage mechanisms conditionally. They will need to detect the runtime environment:
    *   **Electron/Nextron Environment:** Continue using the `window.electron` API for local file system access (the current offline mechanism).
    *   **Web Environment (Future):** Use the Firebase SDK to interact with Firestore (the online mechanism).
    *   These models would ideally call the helper functions from `firestoreService.ts` when targeting the online/Firestore environment. The conditional logic (Electron vs. Web) could potentially reside either within the models themselves or within the helper functions in `firestoreService.ts`.
5.  Implement caching strategies, especially if targeting web deployment.
6.  Plan data migration from local files to Firestore if needed.
