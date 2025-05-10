# System Patterns - Sweldo

## System Architecture
Sweldo follows a dual-process architecture typical of Electron applications:

1. **Main Process (Node.js Environment)**:
   - Application lifecycle management
   - Window creation and management
   - Native OS interactions
   - Backend-like services (PDF generation, file system operations)
   - IPC handler registration

2. **Renderer Process (Browser-like Environment)**:
   - Next.js React application
   - User interface components
   - Application state management
   - Business logic implementation

3. **IPC Communication Bridge**:
   - Allows the renderer process to request privileged operations from the main process
   - Exposes a secure API via the preload script as `window.electron`

## Key Technical Decisions
- **Nextron Framework**: Chosen to combine Next.js for UI development with Electron for desktop capabilities
- **Local File Storage**: Using the file system for data persistence (in `SweldoDB/` directory)
- **Zustand State Management**: For simpler, more flexible state management compared to Redux
- **Tailwind CSS**: For rapid UI development with utility-first approach
- **TypeScript**: For type safety and improved development experience
- **shadcn/ui Components**: For consistent, accessible UI components

## Design Patterns in Use
1. **Process Isolation Pattern**:
   - Separation of main and renderer processes
   - Communication via IPC for security and stability

2. **State Management Pattern**:
   - Zustand stores for application state
   - Model-based data structures

3. **Component-Based UI Architecture**:
   - Reusable React components
   - Composition over inheritance

4. **Service Pattern**:
   - Specialized services for PDF generation
   - Utility functions organized by domain

5. **Bridge Pattern**:
   - Preload script bridging Electron APIs to renderer
   - `window.electron` as the abstraction layer

6. **Dexie-based IndexedDB Caching Pattern**:
   - On load functions (e.g., `loadActiveEmployeesFirestore`), first check local cache stored in IndexedDB via Dexie
   - If cache hit, return cached data immediately
   - If cache miss, query Firestore, then bulk store results in Dexie cache
   - Provide manual cache invalidation (e.g., refresh button triggering `clearEmployeeCache`) and optional TTL logic
   - Apply same pattern to other models: `loadHolidaysFirestore`, `getMissingTimeLogsFirestore`, etc., using separate Dexie tables and `clearXCache` utilities

7. **CSS Architecture Pattern**:
   - **Core Structure**:
     - Tailwind CSS (v3) as the primary styling framework
     - PostCSS configuration at project root pointing to renderer-specific Tailwind config
     - `globals.css` with Tailwind directives and custom utilities
     - CSS variables for theming in both light and dark modes using oklch color format
     - Component-specific animations and keyframes
   
   - **Loading Mechanisms**:
     - Standard CSS imports in Nextron/desktop mode 
     - Runtime style injection for web mode using `styleInjector.js`
     - Early font loading via `_document.js` to prevent FOUC (Flash of Unstyled Content)
     - Critical styles embedded directly in HTML head
   
   - **Style Organization**:
     - Layer-based organization using Tailwind's `@layer` directive
     - Custom component classes defined in the components layer
     - Utility extensions in the utilities layer
     - Base styles in the base layer including CSS variables
   
   - **Custom Styling Solutions**:
     - Scrollbar customization with progressive enhancement
     - Animation keyframes for UI microinteractions (pulse, shine, blob, firework)
     - Semantic theming using CSS variables
     - Border radius inheritance utilities

8. **Environment-Aware Styling Pattern**:
   - Detection of runtime environment (web vs desktop) via `isWebEnvironment()`
   - Environment-specific style loading strategies
   - Conditional font and style injection in web mode
   - Different DOM manipulation approaches based on environment

9. **Self-contained Component Pattern**:
   - Components manage their own data loading rather than requiring all data from parents
   - Environment-aware data fetching from either local file system or Firestore
   - Graceful loading and error states handled internally
   - Optional props to override internal data when needed
   - Example: EmployeeDropdown manages its own employee data loading

## Component Relationships
- **Page Components** → Use → **UI Components**
- **Page Components** → Use → **Hooks** → Use → **Stores**
- **Stores** → Use → **Models** and **Utils**
- **UI Components** → Use → `window.electron` → Triggers → **IPC Handlers** → Execute → **Services**
- **Services** (in main process) → Use → **Node.js APIs** (fs, path, etc.)

## Special Considerations
- Adaptations needed for web deployment (replacing Electron-specific code)
- PostCSS and Tailwind configuration requirements
- Conditional code for platform-specific features

## Sync Patterns

### Basic Firebase Sync

For simple data models (settings, holidays, etc.), we use a straightforward sync pattern:

```typescript
export function createModelFirestoreInstance(model: Model) {
  return {
    async syncToFirestore(onProgress?: (message: string) => void): Promise<void> {
      try {
        // Load data from the model
        const data = await model.loadData();
        
        // Sync to Firestore
        const companyName = await getCompanyName();
        await saveDocument("collection", "documentId", data, companyName);
        
        onProgress?.("Sync completed successfully");
      } catch (error) {
        console.error("Error syncing to Firestore:", error);
        throw error;
      }
    },
    
    async syncFromFirestore(onProgress?: (message: string) => void): Promise<void> {
      try {
        // Load from Firestore
        const companyName = await getCompanyName();
        const data = await fetchDocument("collection", "documentId", companyName);
        
        // Save to local model
        if (data) {
          await model.saveData(data);
        }
        
        onProgress?.("Download completed successfully");
      } catch (error) {
        console.error("Error syncing from Firestore:", error);
        throw error;
      }
    }
  };
}
```

### Employee-Specific Bulk Sync

For data models that are employee-specific (shorts, loans, cash advances), we use a more sophisticated bulk sync pattern:

```typescript
// For a specific employee (used when employeeId is provided)
export function createModelFirestoreInstance(model: Model, employeeId: string) {
  return {
    async syncToFirestore(onProgress?: (message: string) => void): Promise<void> {
      try {
        // Load data for this specific employee
        const data = await model.loadData(employeeId);
        
        // Sync to Firestore
        const companyName = await getCompanyName();
        const docId = createDocId(employeeId, year, month);
        await saveDocument("collection", docId, data, companyName);
        
        onProgress?.("Sync completed successfully");
      } catch (error) {
        console.error("Error syncing to Firestore:", error);
        throw error;
      }
    },
    
    async syncFromFirestore(onProgress?: (message: string) => void): Promise<void> {
      // Similar implementation for download
    }
  };
}

// Bulk sync implementation in useFirestoreSync.ts
// This is added when no specific employeeId is provided
if (!employeeId) {
  try {
    // Get all employees
    const employeeModel = createEmployeeModel(dbPath);
    const loadedEmployees = await employeeModel.loadEmployees();
    const activeEmployees = loadedEmployees.filter(
      (emp) => emp.status === "active"
    );
    
    // Create a special bulk sync operation
    operations.push({
      name: "modelName",
      instance: {
        async syncToFirestore(
          progressCallback: (msg: string) => void
        ): Promise<void> {
          progressCallback(`Starting sync for ${activeEmployees.length} employees...`);
          
          // Process each employee's data
          for (let i = 0; i < activeEmployees.length; i++) {
            const employee = activeEmployees[i];
            progressCallback(`Processing employee ${i+1}/${activeEmployees.length}: ${employee.name}`);
            
            try {
              // Create model instance for this employee
              const model = createModel(dbPath, employee.id);
              const syncInstance = createModelFirestoreInstance(model, employee.id);
              
              // Sync this employee's data
              await syncInstance.syncToFirestore((msg) => 
                progressCallback(`[${employee.id}] ${msg}`)
              );
            } catch (error) {
              // Log error but continue with next employee
              progressCallback(`Error for employee ${employee.id}: ${error}`);
              console.error(`Error syncing for employee ${employee.id}:`, error);
            }
          }
          
          progressCallback(`Completed sync for ${activeEmployees.length} employees`);
        },
        
        async syncFromFirestore(
          progressCallback: (msg: string) => void
        ): Promise<void> {
          // Similar implementation for download
        }
      }
    });
  } catch (error) {
    console.error("Error setting up bulk sync:", error);
  }
}
```

This pattern has these key characteristics:

1. **Isolation**: Each employee's data is processed independently with its own error handling
2. **Fault Tolerance**: Failures for one employee don't stop the sync for others
3. **Progress Reporting**: Detailed progress is reported for the overall operation and per-employee
4. **Flexibility**: Works with both specific employee selection and bulk operations
5. **Reusability**: The same pattern can be applied to loans, cash advances, and other employee-specific data

### UI Integration for Employee Selection

The DatabaseManagementSettings component provides a dropdown for employee selection:

```tsx
<div className="mb-6 border rounded-md p-4 bg-blue-50/30">
  <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
    <IoPeopleOutline className="text-blue-600" />
    Employee Selection for Sync
  </h3>
  <p className="text-sm text-gray-600 mb-3">
    Select an employee or leave empty for all active employees.
  </p>
  <div className="relative">
    <select
      value={selectedEmployeeId}
      onChange={(e) => setSelectedEmployeeId(e.target.value)}
      className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
    >
      <option value="">All Active Employees</option>
      {employees
        .filter(e => e.status === 'active')
        .map(employee => (
          <option key={employee.id} value={employee.id}>
            {employee.name} ({employee.id})
          </option>
        ))
      }
    </select>
  </div>
</div>
```

The `selectedEmployeeId` is passed to the `useFirestoreSync` hook, which then determines whether to use single-employee sync or bulk sync:

```tsx
const {
  uploadStatus,
  downloadStatus,
  handleUpload,
  handleDownload,
  modelStatuses,
  availableModelNames,
} = useFirestoreSync({
  dbPath: dbPath || "",
  companyName: companyName || "",
  employeeId: selectedEmployeeId || undefined,
  // Other optional parameters...
});
```

This pattern provides a consistent and reusable approach for syncing employee-specific data across the application.

## Core Architecture

The Sweldo application uses a hybrid architecture that enables it to run in two distinct environments:

1. **Desktop Application (Electron)**: Uses local file system for data storage
2. **Web Application (Browser)**: Uses Firestore for cloud data storage

### Environment Detection

The core pattern for environment detection uses the `isWebEnvironment()` utility:

```typescript
// Detect if running in web or desktop environment
const isWebEnvironment = () => {
  return typeof window !== 'undefined' && !window.electron;
};

// Usage
const isWeb = isWebEnvironment();
const effectiveDbPath = isWeb ? "web" : dbPath;
```

This pattern is used throughout the application to adapt functionality based on the runtime environment.

## Database Access Patterns

### Local Storage (Desktop)

For desktop mode, we use a file-based JSON database structure:

```
SweldoDB/
  employees/
    employee_list.json
  settings/
    attendance_settings.json
  payroll/
    2023-05/
      payroll_records.json
  timesheet/
    2023-05/
      employee_123/
        timesheet.json
  ...
```

Access to this storage is through file system operations wrapped in model methods:

```typescript
// Example: Attendance settings model for desktop
export class AttendanceSettingsModelImpl implements AttendanceSettingsModel {
  private dbPath: string;
  
  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }
  
  async loadAttendanceSettings(): Promise<AttendanceSettings> {
    const filePath = path.join(this.dbPath, 'settings', 'attendance_settings.json');
    return await fs.readJSON(filePath);
  }
  
  // ...
}
```

### Firestore Storage (Web)

For web mode, we use a Firestore collection structure that mirrors the desktop structure:

```
companies/{companyName}/employees/employee_list
companies/{companyName}/settings/attendance_settings
companies/{companyName}/payroll/2023-05/records
companies/{companyName}/timesheet/2023-05/employee_123/data
```

Access to this storage is through Firestore operations wrapped in model methods:

```typescript
// Example: Attendance settings model for web
export class AttendanceSettingsFirestoreModel implements AttendanceSettingsModel {
  private companyName: string;
  
  constructor(companyName: string) {
    this.companyName = companyName;
  }
  
  async loadAttendanceSettings(): Promise<AttendanceSettings> {
    const docRef = doc(db, 'companies', this.companyName, 'settings', 'attendance_settings');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as AttendanceSettings;
    }
    
    return getDefaultAttendanceSettings();
  }
  
  // ...
}
```

### Factory Pattern for Models

To seamlessly handle both environments, we use a factory pattern to create the appropriate model implementation:

```typescript
export function createAttendanceSettingsModel(pathOrCompany: string): AttendanceSettingsModel {
  const isWeb = isWebEnvironment();
  
  if (isWeb) {
    return new AttendanceSettingsFirestoreModel(pathOrCompany);
  } else {
    return new AttendanceSettingsModelImpl(pathOrCompany);
  }
}
```

## UI Patterns

### Conditional Rendering

Components check the environment and render accordingly:

```tsx
const isWeb = isWebEnvironment();

return (
  <div>
    {isWeb ? (
      <WebSpecificComponent companyName={companyName} />
    ) : (
      <DesktopSpecificComponent dbPath={dbPath} />
    )}
  </div>
);
```

### Proxy Components

For components that require different implementations based on the environment (especially those with CSS imports that don't work in web mode), we use a proxy pattern:

```tsx
// DateRangePickerProxy.tsx
export const DateRangePickerProxy = (props) => {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  
  useEffect(() => {
    const isWeb = isWebEnvironment();
    
    async function loadComponent() {
      if (isWeb) {
        const { SimpleDateRange } = await import('./SimpleDateRange');
        setComponent(() => SimpleDateRange);
      } else {
        const { DateRangePicker } = await import('./DateRangePicker');
        setComponent(() => DateRangePicker);
      }
    }
    
    loadComponent();
  }, []);
  
  if (!Component) {
    return <div>Loading...</div>;
  }
  
  return <Component {...props} />;
};
```

## State Management Patterns

### Zustand Stores

Zustand is used for global state management. Key stores include:

- `authStore`: Manages authentication state
- `settingsStore`: Manages application settings
- `dateSelectorStore`: Manages the currently selected date across the application

### Local State with Debounced Store Updates

For input fields that update global state, we use a pattern of local state with debounced updates to the global store to prevent excessive re-renders:

```tsx
// Component with input field
const MyComponent = () => {
  const { globalValue, setGlobalValue } = useMyStore();
  
  // Local state for immediate UI feedback
  const [localValue, setLocalValue] = useState(globalValue);
  
  // Handle input changes
  const handleChange = (e) => {
    // Update local state immediately for responsive UI
    setLocalValue(e.target.value);
    
    // Debounce the update to the global store
    if (window.updateTimeout) {
      clearTimeout(window.updateTimeout);
    }
    
    window.updateTimeout = setTimeout(() => {
      // Update global store after user stops typing
      setGlobalValue(e.target.value);
    }, 500); // 500ms debounce
  };
  
  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
    />
  );
};
```

This pattern is particularly useful in settings pages where updating global state on every keystroke can cause substantial re-rendering and performance issues. It provides a responsive UI experience without the overhead of frequent global state updates.

### Side-effect Prevention in useEffect

To prevent infinite loops and unnecessary side-effects, useEffect dependencies are carefully managed:

```tsx
// Bad pattern - can cause infinite loops if globalState changes on every render
useEffect(() => {
  fetchData();
}, [globalState]);

// Good pattern - memoize values that shouldn't trigger reruns
const memoizedValue = useMemo(() => computeValue(globalState), [globalState.id]);

useEffect(() => {
  fetchData();
}, [memoizedValue]);
``` 