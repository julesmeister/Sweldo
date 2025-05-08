# Active Context - Sweldo

## Current Work Focus
The project is currently focused on enabling a web deployment of the Sweldo application via Firebase Hosting, in addition to the existing desktop application, and fixing critical authentication and session persistence issues in web mode.

The immediate priority is to ensure all pages that display month/year specific data correctly react to changes in the global `DateSelector` component, which uses `useDateSelectorStore`.

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
*   Reverted to the base CSS implementation to stabilize the project while maintaining thorough documentation of the CSS architecture.

**Current Task:**
1.  **Document and refine the CSS implementation:**
    *   Thoroughly document the current Tailwind configuration and CSS structure
    *   Organize styling approach across both web and desktop environments
    *   Ensure memory bank contains complete CSS implementation details
    *   Identify potential improvements to the current styling architecture
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
- Fixed authentication session persistence in web mode by:
  - Enhancing `authStore.ts` to save authentication state to localStorage in web mode
  - Adding localStorage-based session persistence to maintain login state across page refreshes
  - Updating `layout.tsx` to properly check authenticated state from localStorage
  - Synchronizing the session initialization flag with actual auth state
  - Ensuring login session is properly saved and loaded on app initialization
- Fixed company name persistence in web mode:
  - Updated `settingsStore.ts` to explicitly save company name to localStorage in web mode
  - Enhanced `LoginDialog.tsx` to ensure company selection is properly persisted
  - Added immediate localStorage saving of company name when selected from dropdown
  - Fixed issue where records wouldn't load after page refresh due to missing company context
- Enhanced company selection in web mode:
  - Added high-priority check in `layout.tsx` to force company selection when missing
  - Updated `LoginDialog.tsx` to support "company selection only" mode for authenticated users
  - Added dedicated UI and flow for authenticated users who only need to select a company
  - Implemented explicit company name saving to multiple storage locations for redundancy
  - Fixed critical issue preventing login dialog from appearing when company selection is needed
- Added support for loading employees in desktop mode:
  - Updated `LoginDialog.tsx` to load employees from EmployeeModel in Nextron/desktop mode
  - Added parallel employee loading logic for both web and desktop environments
  - Improved placeholder employee generation with realistic names and positions
  - Added current company name display in desktop mode login dialog
  - Enhanced the visual experience consistently across both environments
- Fixed web mode support for timesheet_test.tsx:
  - Updated to properly detect web environment using isWebEnvironment()
  - Added conditional logic to load employees from Firestore in web mode
  - Improved employee selection to work with already loaded data in web mode
  - Enhanced logging with detailed environment information
- Reverted to baseline CSS implementation:
  - Documented the current Tailwind CSS configuration and structure
  - Updated memory bank with comprehensive details on the CSS architecture
  - Created detailed documentation on styling approach for both environments
  - Identified potential improvements for future CSS implementation

## Next Steps
1. Implement a robust CSS solution for web mode:
   - Configure Tailwind CSS to work consistently in both environments
   - Create a style injection mechanism for web mode if needed
   - Ensure fonts and critical styles load properly in all environments
   - Add environment-specific style adjustments for components with rendering differences
   - Document the entire CSS implementation approach

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

10. Create a shared style utility for environment detection
    - Build a HOC or utility for injecting environment-specific styles
    - Document common patterns that work across environments
    - Create visual reference guide for key components

11. Apply Dexie caching pattern to other models (holidays, attendance, payroll, timesheet, etc.)

## Active Decisions and Considerations
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
  - Determining the most effective way to load styles in web mode
  - Managing environment-specific style differences
  - Balancing performance with style consistency
  - Using CSS variables for theming support
  - Implementing responsive design that works across environments