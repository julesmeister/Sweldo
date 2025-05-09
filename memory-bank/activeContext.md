# Active Context

## Current Focus: Web Mode Compatibility

### Overview
The Sweldo application was originally designed for desktop use with Electron, but is now being adapted to work in web browsers via Firebase/Firestore. This transition requires careful handling of:

1. File system operations that don't exist in web mode
2. Database access patterns (local JSON files vs Firestore)
3. Date handling and parsing differences
4. UI rendering consistency across platforms

### Recent Achievements
- ✅ Fixed payroll display in web mode
- ✅ Implemented date parsing for Firestore timestamps
- ✅ Added filter functionality for payroll records

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

The immediate priorities are to resolve styling inconsistencies between desktop and web modes, and ensure all pages react properly to the global date selection component.

**Completed:**
*   Refactored `renderer/pages/settings.tsx` to correctly load and display settings from Firestore in web mode, and conditionally render sections based on the environment (web/desktop) and data availability (e.g., `dbPath`, `companyName`).
*   Addressed PIN authentication in `RoleManagement.tsx` for web mode.
*   Fixed employee list loading in `settings.tsx` for web mode.
*   Hid "Database Management" and "Data Migration" sections in `settings.tsx` for web mode.
*   Refactored `ScheduleSettings.tsx` to correctly fetch and save data in web mode (employees, month-specific schedules).
*   Corrected button styling in `CalendarDayCell.tsx` for "Work"/"Day Off" toggle.
*   Refactored `statistics.tsx` to use `selectedMonth` and `selectedYear` from `useDateSelectorStore` for its data fetching logic, removing its reliance on local `localStorage` for these values and ensuring it reacts to global date changes.
*   Refactored `renderer/pages/holidays.tsx` to use `selectedMonth` and `selectedYear` from `useDateSelectorStore` for its data fetching logic, removing its reliance on local `localStorage` for these values and ensuring it reacts to global date changes.
*   Fixed `renderer/pages/timesheet_test.tsx` to correctly handle web mode by checking for environment type and conditionally using Firestore for loading employees rather than requiring dbPath. Updated employee lookup to find from loaded data in web mode rather than making additional database calls.
*   Created a robust system for synchronizing styles between globals.css and styleInjector.js to ensure consistent styling in both desktop and web modes.
*   Fixed infinite loop issues in the timesheet.tsx page by optimizing React effect dependencies and removing excessive console logs.
*   Fixed table border styling issues in the timesheet to ensure consistent appearance in both environments.
*   Enhanced CompensationDialog form layout to improve spacing and visual consistency.

**Current Task:**
1.  **Further refinement of the CSS sync mechanism:**
    *   Test the automated CSS synchronization script with additional styles
    *   Ensure all critical styles are properly synchronized between environments
    *   Document the CSS synchronization approach in the memory bank
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

## Recent Changes
- Fixed component rendering issue with DateRangePicker by ensuring proper function components are returned
- Added comprehensive error handling and type checking for dynamically loaded components
- Added UI improvements to the DateRangePicker dialog:
  - Removed redundant date display text above the Apply button
  - Changed X button color from black to white for better contrast
  - Improved dialog border styling for better visual appearance
- Fixed a runtime error in the SimpleDateRange mock component related to null parameter destructuring
- Added default parameter values and defensive coding to prevent similar issues
- Added proper imports for all dependencies (addMonths from date-fns)
- Implemented a proxy component pattern to completely avoid CSS imports during build time
- Created DateRangePickerProxy component that dynamically loads the real component at runtime
- Removed all direct CSS imports from DateRangePicker.tsx, even conditional ones
- Updated TimesheetHeader to use the proxy component instead of direct imports
- Used dynamic runtime imports with Function('return require(...)') to avoid webpack processing
- Fixed issue with react-date-range CSS loading in web mode by implementing a dynamic CSS loader and mock component
- Created a simplified DateRange component for web mode to avoid problematic CSS imports
- Implemented dynamic component loading strategy for DateRangePicker to work in both environments
- Used conditional imports with environment detection to select the appropriate implementation
- Created comprehensive documentation of the solution in memory-bank/css-solution.md
- Fixed infinite loop issues in timesheet.tsx by optimizing React hook dependencies
- Fixed styling inconsistencies between desktop and web modes
- Implemented an automated CSS synchronization system between globals.css and styleInjector.js
- Created a script (sync-styles.js) to intelligently extract styles from globals.css and update styleInjector.js
- Added deduplication logic to prevent duplicate CSS selectors in styleInjector.js
- Fixed table border styling in the timesheet to ensure consistent appearance
- Enhanced CompensationDialog form layout with improved spacing and consistency
- Updated package.json scripts to automatically run style synchronization as part of web build processes
- Integrated the style synchronization into both development and production web builds
- Added tailwind directive handling to prevent invalid CSS in web mode
- Firebase Hosting has been initialized
- Configuration for Firebase hosting has been set up
- `firebase.json` has been configured to use `app` as the public directory
- Proper ignores for Electron-specific directories have been added to `firebase.json`
- Hosting rewrites for SPA support have been configured
- `renderer/next.config.js` has been configured for static export (`output: 'export'`)
- A web build script (`build:web`) has been added to package.json
- PostCSS configuration has been fixed for both Nextron and web builds
- Web build process has been successfully tested
- Dexie-based IndexedDB cache implemented for EmployeeList (Firestore employee queries), with a reload button to clear cache and a reusable `fetchEmployees` function
- Toast notifications added for cache reload actions in EmployeeList, HolidaysPage, and HolidayCalendar to indicate reload start and success
- Toast notifications added for cache reload actions in EmployeeList, HolidaysPage, HolidayCalendar, and MissingTimeLogs to indicate reload start and success
- Fixed authentication session persistence in web mode
- Fixed company name persistence in web mode
- Enhanced company selection in web mode
- Added support for loading employees in desktop mode
- Fixed web mode support for timesheet_test.tsx
- Completely redesigned the DateRangePicker component using ReactDOM.createPortal to prevent clipping issues in payroll.tsx and other places
- Implemented a modern, two-month calendar view in the DateRangePicker
- Determined the exact dimensions needed for the DateRangePicker dialog (669px width) to perfectly fit the calendar without extra whitespace
- Made the entire DateRangePicker clickable rather than just the individual date inputs
- Fixed issues with z-index by using portal rendering directly to the document body

## Recent Work (June 3, 2025)

### DateRangePicker and PayrollList Web Mode Improvements

1. **DateRangePicker Component**
   - Removed the date display text above the Apply button by adding a CSS override
   - Added styling to improve the appearance of the dialog including better border styling
   - The component now has a cleaner, more streamlined appearance

2. **PayrollList Web Mode Fixes**
   - Fixed issues with PayrollList not displaying payrolls in web mode
   - Improved the Firestore document querying logic to correctly find and load payroll documents
   - Added better data validation and defensive coding to handle Firestore document structures
   - Enhanced date handling to correctly convert string dates to Date objects
   - Implemented more detailed logging for easier troubleshooting
   - Created detailed documentation in `memory-bank/payroll-component.md` and `memory-bank/web-mode-issues.md`

3. **Firestore Integration**
   - Identified and documented critical Firestore document structure for payroll data
   - Added client-side filtering for payroll documents when Firestore doesn't support wildcard queries
   - Implemented more robust error handling for Firestore operations
   - Established best practices for future Firestore-related changes

### Next Steps

1. **Caching for Web Mode**
   - Consider implementing client-side caching to reduce Firestore reads
   - Add IndexedDB support for frequently accessed data like employees and payrolls

2. **Testing Both Environments**
   - Ensure all future changes are tested in both desktop (Nextron) and web modes
   - Create a testing checklist for dual-environment validation

3. **Debug Mode**
   - Add a proper debug mode switch for easier troubleshooting in production
   - Consider adding a debug panel showing current environment, data sources, and query status

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
7. Proceed to refactor `loans.tsx`, `leaves.tsx`, and `shorts.tsx` using the new hook.
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
- **CSS Synchronization Strategy**: Using an automated script to intelligently extract and synchronize styles between globals.css and styleInjector.js, with deduplication logic to prevent duplicates
- **React Hook Optimization**: Carefully managing effect dependencies and memoization to prevent infinite render loops
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
- **Build Process**: Refining the separate build processes for web (`build:web`) and desktop (`build`) versions 
- **Model Initialization**: Ensuring all model instances are created with appropriate environment checking 
- **CSS Architecture**: 
  - Using Tailwind CSS as the primary styling framework in both environments
  - Synchronizing styles between globals.css and styleInjector.js
  - Managing environment-specific style differences
  - Balancing performance with style consistency
  - Using CSS variables for theming support
  - Implementing responsive design that works across environments
- **DateRangePicker Implementation**:
  - Using ReactDOM.createPortal to bypass z-index and clipping issues
  - Applying precise dimensions (669px width) to perfectly fit the calendar content
  - Implementing a modern UI with a proper month layout and selection controls
  - Creating a non-modal experience that works consistently across various parent containers