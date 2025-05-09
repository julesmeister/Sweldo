# Active Context - Sweldo

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

## Next Steps
1. Finalize the CSS synchronization mechanism:
   - Test with all critical components
   - Ensure proper handling of complex selectors and nested rules
   - Document the approach thoroughly
   - Consider future optimizations to the sync process

2. Fix TypeScript errors and implement web mode logic in `renderer/pages/timesheet.tsx`:
   - Update interfaces for hooks (`useComputeAllCompensations`, etc.) and components (`TimesheetRow`, `AttendanceHistoryDialog`) to handle nullable models/props in web mode.
   - Add missing props (`companyName`, `isWebMode`) to `AttendanceHistoryDialog`.
   - Implement Firestore data fetching for history in `AttendanceHistoryDialog` (currently has TODO).
   - Test data loading and interaction in web mode.

3. Develop the `useDateAwareDataFetching` custom hook.
4. Integrate the hook into `cashAdvances.tsx`.
5. Test `cashAdvances.tsx` to ensure it correctly loads data based on the `DateSelector`.
6. Proceed to refactor `loans.tsx`, `leaves.tsx`, and `shorts.tsx` using the new hook.
7. Address any linter errors that arise during these refactors.

8. Handle conditional imports/code for Electron-specific functionality
   - Identify all uses of `window.electron` API
   - Create alternative implementations for web deployment
   - Implement conditional logic to use appropriate APIs based on environment

9. Deploy to Firebase hosting (`firebase deploy --only hosting`)
   - Ensure all web-compatible code is in place
   - Run final web build
   - Execute deployment command

10. Apply Dexie caching pattern to other models (attendance, payroll, timesheet, etc.)

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