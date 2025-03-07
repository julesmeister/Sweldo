<p align="center"><img src="https://i.imgur.com/a9QWW0v.png"></p>

## Usage

### Create an App

```
# with npx
$ npx create-nextron-app my-app --example with-tailwindcss

# with yarn
$ yarn create nextron-app my-app --example with-tailwindcss

# with pnpm
$ pnpm dlx create-nextron-app my-app --example with-tailwindcss
```

### Install Dependencies

```
$ cd my-app

# using yarn or npm
$ yarn (or `npm install`)

# using pnpm
$ pnpm install --shamefully-hoist
```

### Use it

```
# development mode
$ yarn dev (or `npm run dev` or `pnpm run dev`)

# production build
$ yarn build (or `npm run build` or `pnpm run build`)
```

## Implementation Details

### File System Operations

The app uses Electron's IPC system for secure file operations:

- **Main Process (`background.ts`)**: Handles file system operations using `fs/promises`
- **Preload Script (`preload.ts`)**: Exposes safe file operations via `contextBridge`
- **Renderer Process**: Accesses file operations through `window.electron`

### Path Handling

#### Database Path
The app uses a centralized database path management through the settings store:
```typescript
// settingsStore.ts
const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dbPath: '', // Base path for all database operations
      setDbPath: (path) => set({ dbPath: path }),
    }),
    {
      name: 'settings-storage',
    }
  )
);
```

#### Model Initialization
When initializing models (e.g., AttendanceModel, EmployeeModel), always use the full `dbPath` string:
```typescript
// Correct usage
const attendanceModel = createAttendanceModel(dbPath);

// Incorrect usage - never access individual characters
const attendanceModel = createAttendanceModel(dbPath[0]); // This would only use 'C' from 'C:\path\to\db'
```

### Security Considerations

1. **Context Isolation**: The app uses Electron's context isolation for security
2. **Node Integration**: Disabled to prevent direct access to Node.js APIs
3. **Path Validation**: All file paths are validated in the main process
4. **Error Handling**: Comprehensive error handling for file operations

### Data Storage Structure

The app uses a structured directory layout for data storage:
```
SweldoDB/
├── attendances/
│   └── attendance.csv
├── settings.csv
└── timeSettings.csv
```

Make sure to follow these patterns when implementing new features or modifying existing ones.
