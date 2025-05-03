# Data Migration Plan: CSV to JSON

## Migration Overview

This document outlines our general approach for migrating data storage from CSV to JSON format throughout the Sweldo application. This strategy applies to all data models that currently use CSV storage.

## General Migration Pattern

1. **Preserve Original Model**
   - Rename the original model file (e.g., `attendance.ts` → `attendance_old.ts`)
   - Keep all original methods and interfaces intact for backward compatibility

2. **Create New JSON-Based Model**
   - Create a new file with the original name (e.g., `attendance.ts`)
   - Implement the same public API (methods, interfaces)
   - Change the internal implementation to use JSON storage
   - Add a toggle to switch between formats during transition (`setUseJsonFormat()`)

3. **Ensure API Compatibility**
   - Maintain identical method signatures across old and new implementations
   - Handle both formats transparently to minimize client code changes
   - Implement fallback to CSV format if JSON files don't exist yet

4. **Migrate Data**
   - Create migration utilities to convert existing CSV data to JSON
   - Implement this in a separate function to avoid bloating the model class
   - Add UI components to trigger migration

5. **Update UI**
   - Add migration buttons to settings UI for each model that needs migration
   - Provide clear feedback during migration process
   - Handle errors gracefully

## Migration UI Layout

The Data Migration Settings UI is organized in a two-column layout:

1. **Left Column: Data Structure Migrations**
   - Contains migrations that change data structure organization
   - Currently includes the Attendance Alternatives migration

2. **Right Column: CSV to JSON Format Migrations**
   - Contains all CSV to JSON migration buttons for various data models
   - Each model gets its own migration button
   - Progress feedback displayed beneath the buttons
   - Current migrations:
     - Attendance CSV to JSON
     - Compensation CSV to JSON

When adding new model migrations, follow this pattern:
- Add the migration button in the right column
- Use a unique color for each model's button
- Provide clear status indicators and logs 
- Include appropriate error handling

## Completed Migrations

### Attendance Model

The Attendance model was migrated from CSV to JSON with the following changes:

1. **File Renaming**
   - Original `attendance.ts` → `attendance_old.ts`
   - New JSON implementation created as `attendance.ts`

2. **Interface Maintenance**
   - All public interfaces (`Attendance`, etc.) preserved
   - Factory function (`createAttendanceModel`) maintained
   - All utility functions preserved

3. **Storage Format**
   - CSV: One row per day with columns for properties
   - JSON: Object with metadata and days as key-value pairs
   ```json
   {
     "meta": {
       "employeeId": "123456",
       "year": 2023,
       "month": 5,
       "lastModified": "2023-05-31T12:00:00Z"
     },
     "days": {
       "1": {
         "timeIn": "08:30",
         "timeOut": "17:30"
       },
       "2": {
         "timeIn": "08:15",
         "timeOut": "17:45"
       }
     }
   }
   ```

4. **Migration Function**
   - Added `migrateCsvToJson` function
   - Added UI button in `DataMigrationSettings.tsx`
   - Progress reporting via callback

### Compensation Model

The Compensation model was migrated from CSV to JSON with the following changes:

1. **File Renaming**
   - Original `compensation.ts` → `compensation_old.ts`
   - New JSON implementation created as `compensation.ts`

2. **Interface Maintenance**
   - All public interfaces (`Compensation`, etc.) preserved
   - Factory function (`createCompensationModel`) maintained

3. **Storage Format**
   - CSV: One row per day with columns for properties
   - JSON: Object with metadata and days as key-value pairs
   ```json
   {
     "meta": {
       "employeeId": "123456",
       "year": 2023,
       "month": 5,
       "lastModified": "2023-05-31T12:00:00Z"
     },
     "days": {
       "1": {
         "dayType": "Regular",
         "dailyRate": 500,
         "hoursWorked": 8,
         "overtimeMinutes": 30,
         // other compensation fields...
       },
       "2": {
         "dayType": "Regular",
         "dailyRate": 500,
         // other compensation fields...
       }
     }
   }
   ```

4. **Migration Function**
   - Added `migrateCsvToJson` function
   - Added UI button in `DataMigrationSettings.tsx`
   - Progress reporting via callback

## Template for Future Migrations

### 1. Rename Original Model

```typescript
// Rename existing model-name.ts to model-name_old.ts
// Keep all original code intact
```

### 2. Create New Model with JSON Implementation

```typescript
import { ExistingInterfaces } from "./model-name_old";

// Keep same interfaces
export interface ModelInterface {
  // Same structure as original
}

// New JSON structure
interface ModelJsonStructure {
  meta: {
    // Metadata like ID, timestamps, etc.
  },
  data: {
    // Your data in a JSON-friendly format
  }
}

export class ModelClass {
  private folderPath: string;
  private useJsonFormat: boolean = true;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
  }

  // Add format toggle
  public setUseJsonFormat(useJson: boolean): void {
    this.useJsonFormat = useJson;
  }

  // Implement same public API as original
  public async loadData(): Promise<ModelInterface[]> {
    // Try JSON first if preferred
    if (this.useJsonFormat) {
      const jsonExists = await this.jsonFileExists();
      if (jsonExists) {
        return this.loadFromJson();
      }
    }
    
    // Fall back to CSV
    return this.loadFromCsv();
  }

  // Additional methods...
}

// Migration utility
export async function migrateCsvToJson(
  dbPath: string,
  onProgress?: (message: string) => void
): Promise<void> {
  // Implementation
}

// Keep same factory function
export const createModel = (dbPath: string): ModelClass => {
  const folderPath = `${dbPath}/SweldoDB/path-to-data`;
  return new ModelClass(folderPath);
};
```

### 3. Update UI Component for Migration

```typescript
// In DataMigrationSettings.tsx

// Add state for new migration
const [jsonMigrationStatus, setJsonMigrationStatus] = useState<MigrationStatus>("idle");
const [jsonProgressMessages, setJsonProgressMessages] = useState<string[]>([]);

// Add handler function
const handleModelMigration = useCallback(async () => {
  if (!dbPath) return;
  if (jsonMigrationStatus === "running") return;

  setJsonMigrationStatus("running");
  setJsonProgressMessages(["Starting migration..."]);

  try {
    await migrateCsvToJson(dbPath, (message) => {
      console.log("Migration Progress:", message);
      setJsonProgressMessages((prev) => [...prev, message]);
    });
    setJsonMigrationStatus("success");
    toast.success("Migration completed successfully!");
  } catch (error) {
    setJsonMigrationStatus("error");
    toast.error(`Migration failed: ${error}`);
  }
}, [dbPath, jsonMigrationStatus]);

// Add UI Button
<button
  onClick={handleModelMigration}
  disabled={jsonMigrationStatus === "running"}
  className="button-class-here"
>
  {jsonMigrationStatus === "running" ? (
    <>Migrating...</>
  ) : (
    <>Convert Model to JSON</>
  )}
</button>
```

## Benefits of JSON Migration

1. **Data Integrity**
   - Better type preservation
   - Less string parsing/formatting
   - Easier to validate

2. **Performance**
   - Faster lookups by key (vs. searching rows)
   - Single file read/write for related data
   - More efficient updates

3. **Firebase Readiness**
   - JSON structure aligns with Firestore document model
   - Easier to sync between local and cloud storage
   - Supports partial updates

4. **Developer Experience**
   - More natural data structure in code
   - Better IDE support with typed objects
   - Simpler to extend with new properties

## Next Steps

For each model that needs migration:

1. Identify the model and its current CSV structure
2. Design the optimal JSON structure for the data
3. Follow the template to create the new implementation
4. Add a migration button to the settings UI
5. Test thoroughly with existing data
6. Deploy with both formats supported during transition