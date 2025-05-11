# Active Context

## Current Focus: Web Mode Compatibility

### Overview
The Sweldo application was originally designed for desktop use with Electron, but is now being adapted to work in web browsers via Firebase/Firestore. This transition requires careful handling of:

1. File system operations that don't exist in web mode
2. Database access patterns (local JSON files vs Firestore)
3. Date handling and parsing differences
4. UI rendering consistency across platforms

### Current Challenges
- Some components still assume local file system access
- Need to ensure consistent UI behavior between platforms
- Data synchronization between desktop and web versions

### Immediate Next Steps
1. Test other filtering mechanisms in web mode
2. Review other areas that might have similar database path issues
3. Ensure error handling is robust in web environment
4. Add additional logging for web-specific operations

### Technical Approach
For components that need to work in both environments, we're implementing:
1. Environment detection: `isWebEnvironment()` checks
2. Path adaptation: Using `effectiveDbPath` pattern to handle both modes
3. Fallback strategies: Using ID-based lookups when direct paths fail
4. Enhanced date parsing: Robust handling of various date formats

### Key Takeaways
The primary pattern for ensuring web compatibility is:
```typescript
const isWeb = isWebEnvironment();
const effectiveDbPath = isWeb ? "web" : dbPath;
```

This allows components to work consistently in both environments without needing separate codepaths for most operations.

## Current Work Focus
The project is currently focused on enabling a web deployment of the Sweldo application via Firebase Hosting, in addition to the existing desktop application, and fixing critical authentication and session persistence issues in web mode.

The immediate priorities are to ensure all pages react properly to the global date selection component and to address any remaining UI inconsistencies now that core styling is fixed.

**Completed:**
*   Refactored `renderer/pages/settings.tsx` to correctly load and display settings from Firestore in web mode, and conditionally render sections based on the environment (web/desktop) and data availability (e.g., `dbPath`, `companyName`).
*   Refactored `ScheduleSettings.tsx` to correctly fetch and save data in web mode (employees, month-specific schedules).
*   Refactored `statistics.tsx` to use `selectedMonth` and `selectedYear` from `useDateSelectorStore` for its data fetching logic, removing its reliance on local `localStorage` for these values and ensuring it reacts to global date changes.
*   Refactored `renderer/pages/holidays.tsx` to use `selectedMonth` and `selectedYear` from `useDateSelectorStore` for its data fetching logic, removing its reliance on local `localStorage` for these values and ensuring it reacts to global date changes.
*   Fixed `renderer/pages/timesheet_test.tsx` to correctly handle web mode by checking for environment type and conditionally using Firestore for loading employees rather than requiring dbPath. Updated employee lookup to find from loaded data in web mode rather than making additional database calls.
*   **Fixed EditableCell in TimesheetRow:** Resolved an issue where the EditableCell component wasn't appearing when time cells were clicked in the timesheet. Fixed by: (1) adding the useSettingsStore hook in TimesheetRow.tsx to properly access dbPath instead of passing an empty string, (2) improving the handleClick function in EditableCell.tsx to properly manage event propagation, and (3) enhancing the handleRowClick function in timesheet.tsx to better detect clicks on editable cells. This ensures the time-editing functionality works correctly.
*   **Fixed Tailwind CSS in Web Mode:** Implemented a dedicated build step (`renderer/scripts/generate-tailwind.js` invoked by `npm run generate:tailwind` in `package.json`) to correctly process `renderer/styles/globals.css` using PostCSS, `tailwindcss` (with `renderer/tailwind.config.js`), and `autoprefixer`. This generates a complete `tailwind-web.css` (output to `renderer/public/styles/`) which is then linked by `styleInjector.js`, ensuring all Tailwind utilities and custom styles are available in the web deployment. This resolved issues of a 'bare' UI in web mode and ensures visual consistency with the desktop version.
*   The `sync-styles.js` script now plays a supplementary role, injecting specific non-Tailwind-directive based CSS rules from `globals.css` via `styleInjector.js` as needed for minimal critical overrides or additions.
*   Fixed table border styling issues in the timesheet to ensure consistent appearance in both environments.
*   Enhanced CompensationDialog form layout to improve spacing and visual consistency.

**Current Task:**
1.  **Review and Refine `sync-styles.js` Usage:** Now that Tailwind CSS is fully generated for web mode, review the styles managed by `sync-styles.js` and `styleInjector.js` to ensure they are only for genuinely critical overrides or supplementary styles not covered by the main `tailwind-web.css`. Minimize inline injected styles where possible.
2.  **Fix TypeScript errors in `renderer/pages/timesheet.tsx`:**
    *   Update hook and component interfaces (`useComputeAllCompensations`, `TimesheetRow`, `AttendanceHistoryDialog`) to correctly handle nullable models/props in web mode.
    *   Ensure `AttendanceHistoryDialog` can accept `companyName` and `isWebMode` props.
    *   Add TODO for implementing Firestore history fetching in `AttendanceHistoryDialog`.
3.  **Create a custom React hook** (e.g., `useDateAwareDataFetching`) to encapsulate the common logic of:
    *   Subscribing to `selectedMonth` and `selectedYear` from `useDateSelectorStore`.
    *   Managing loading states.
    *   Triggering data refetching when the selected date changes.
4.  **Apply this hook** to the following pages to make them reactive to the global `DateSelector` and remove redundant date management logic:
    *   `renderer/pages/cashAdvances.tsx`
    *   `renderer/pages/loans.tsx`
    *   `renderer/pages/leaves.tsx`
    *   `renderer/pages/shorts.tsx`

## Next Steps
1. Test the react-date-range solution in web mode to ensure it works correctly
   - Verify that the DateRangePicker component renders properly
   - Ensure date selection works as expected
   - Check that styles are applied correctly
   - Fix any remaining visual inconsistencies between environments

2. Finalize the CSS synchronization mechanism:
   - Test with all critical components
   - Ensure proper handling of complex selectors and nested rules
   - Document the approach thoroughly
   - Consider future optimizations to the sync process

3. Fix TypeScript errors and implement web mode logic in `renderer/pages/timesheet.tsx`:
   - Update interfaces for hooks (`useComputeAllCompensations`, etc.) and components (`TimesheetRow`, `AttendanceHistoryDialog`) to handle nullable models/props in web mode.
   - Add missing props (`companyName`, `isWebMode`) to `AttendanceHistoryDialog`.
   - Implement Firestore data fetching for history in `AttendanceHistoryDialog` (currently has TODO).
   - Test data loading and interaction in web mode.

4. Develop the `useDateAwareDataFetching` custom hook.
5. Integrate the hook into `cashAdvances.tsx`.
6. Test `cashAdvances.tsx` to ensure it correctly loads data based on the `DateSelector`.
7. Proceed to refactor `loans.tsx`, and `leaves.tsx` using the new hook, applying lessons from `shorts.tsx` and `cashAdvances.tsx`.
8. Address any linter errors that arise during these refactors.

9. Handle conditional imports/code for Electron-specific functionality
   - Identify all uses of `window.electron` API
   - Create alternative implementations for web deployment
   - Implement conditional logic to use appropriate APIs based on environment

10. Deploy to Firebase hosting (`firebase deploy --only hosting`)
    - Ensure all web-compatible code is in place
    - Run final web build
    - Execute deployment command

11. Apply Dexie caching pattern to other models (attendance, payroll, timesheet, etc.)

## Active Decisions and Considerations
- **CSS Generation and Linking Strategy for Web Mode**: The primary method for web styling is a build-time generated `tailwind-web.css` file (created by `renderer/scripts/generate-tailwind.js` using PostCSS/Tailwind) which includes all necessary Tailwind base, components, utilities, and custom styles from `globals.css`. This file is then linked by `renderer/utils/styleInjector.js`.
- **Supplementary CSS Injection**: `styleInjector.js`, with input from `sync-styles.js`, injects minimal critical styles, fonts, and specific non-Tailwind-directive based overrides from `globals.css`. This is secondary to the main linked `tailwind-web.css`.
- **React Hook Optimization**: Carefully managing effect dependencies and memoization to prevent infinite render loops.
- **Component Style Consistency**: Ensuring consistent styling between desktop and web modes through careful CSS management
- **Data Storage Strategy**: Determining the best approach for replacing local file system storage with Firestore for web deployment
- **Session Persistence**: Using localStorage for web authentication state while maintaining file-based storage for desktop
- **Configuration Persistence**: Ensuring critical settings like company name persist across page refreshes in web mode
- **User Flow**: In web mode, users must select a company even after authentication to ensure proper data context
- **UI/UX**: Providing clear company selection interface when only that step is needed, without requiring re-authentication
- **Feature Parity**: Ensuring core features work consistently across both desktop and web versions
- **Environment Detection**: Implementing reliable detection logic to determine whether the application is running in Electron or web environment
- **Visual Consistency**: Maintaining a consistent visual experience across both desktop and web environments
- **Code Organization**: Maintaining a clean separation between platform-agnostic and platform-specific code
- **Build Process**: Refining the separate build processes for web (`build:web`) and desktop (`build`) versions. The `build:web` script now includes a `generate:tailwind` step critical for correct web styling.
- **Model Initialization**: Ensuring all model instances are created with appropriate environment checking 
- **CSS Architecture**: 
  - Using Tailwind CSS as the primary styling framework in both environments.
  - For web mode, Tailwind CSS is fully processed into `tailwind-web.css` via a build script (`generate:tailwind`). This file is linked by `styleInjector.js`.
  - `styleInjector.js` and `sync-styles.js` provide a mechanism for linking `tailwind-web.css` and injecting minimal, non-Tailwind-directive based critical or override styles.
  - Managing environment-specific style differences.
- **DateRangePicker Implementation**:
  - Using ReactDOM.createPortal to bypass z-index and clipping issues
  - Applying precise dimensions (669px width) to perfectly fit the calendar content
  - Implementing a modern UI with a proper month layout and selection controls
  - Creating a non-modal experience that works consistently across various parent containers

## Current Focus (May 2024)

### Cash Advances Web Mode Implementation

We've successfully implemented the CSV to JSON migration and Firestore sync for cash advances. This was necessary because:

1. The cash advances weren't showing up in web mode since they hadn't been migrated from CSV to JSON format
2. The migrated data wasn't being synced to Firestore correctly
3. The path structure in Firestore wasn't matching the path structure used for retrieval

Key insights from the implementation:

- **Employee-specific folder structure**: Cash advances are stored in an employee-specific folder structure (`SweldoDB/cashAdvances/{employeeId}`), unlike some other data types
- **Migration pattern**: We created a `migrateCsvToJson` function in `cashAdvance.ts` that follows the pattern used in other modules like `employee.ts`
- **Firestore sync**: Updated `syncToFirestore` in `cashAdvance_firestore.ts` to properly navigate the employee-specific structure
- **Document ID format**: Established a consistent document ID format using `createCashAdvanceDocId(employeeId, year, month)` for both storing and retrieving documents

This pattern should be used for other modules that have similar structures (like loans, shorts). The main steps are:

1. Add a `migrateCsvToJson` function to the model file (e.g., `loan.ts`)
2. Add a migration button to `DataMigrationSettings.tsx`
3. Update the Firestore sync functions to correctly navigate any module-specific folder structures
4. Ensure consistent document ID formats between storing and retrieving documents

### Shorts Sync Implementation

We've successfully implemented Firestore sync for the shorts module following the pattern established with cash advances. This was necessary because:

1. The shorts module lacked integration with Firestore sync functionality
2. Shorts have an employee-specific structure that requires special handling
3. A more flexible approach was needed to allow syncing shorts for either specific employees or all employees

Key insights from the implementation:

- **Employee-specific structure**: Shorts are stored per employee (`SweldoDB/shorts/{employeeId}`), requiring special handling for sync operations
- **Bulk sync pattern**: We implemented a new pattern for bulk syncing that:
  - Loads all employees first
  - Filters to active employees only
  - Creates sync instances for each employee's shorts
  - Processes them sequentially with isolated error handling
  - Provides detailed progress reporting to the UI
- **UI enhancements**: Added an employee selector dropdown to the database management UI that enables:
  - Syncing shorts for all active employees (default)
  - Syncing shorts for a specific employee (when selected)
  - Clear visual feedback on sync progress and status

This implementation serves as a template for other employee-specific data modules like loans that have similar folder structures and requirements.

### Next Steps

1. Apply the same pattern to implement Firestore sync for other modules:
   - Loans (next priority)
   
2. Test all sync functionality thoroughly:
   - Test uploading and downloading with both single-employee and bulk modes
   - Verify that all data is correctly synced between devices

3. Document the bulk sync pattern for future reference

2. Test web mode functionality for each implemented module

3. Update documentation as we extend this pattern to other modules