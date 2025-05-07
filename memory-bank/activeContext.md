# Active Context - Sweldo

## Current Work Focus
The project is currently focused on enabling a web deployment of the Sweldo application via Firebase Hosting, in addition to the existing desktop application, and fixing critical authentication and session persistence issues in web mode.

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

## Next Steps
1. Test the authentication session persistence fixes in web mode
   - Ensure login state is maintained across page refreshes
   - Verify session timeout works correctly
   - Test logout functionality across both environments
   - Confirm company name persists across page refreshes and data loads correctly

2. Handle conditional imports/code for Electron-specific functionality
   - Identify all uses of `window.electron` API
   - Create alternative implementations for web deployment
   - Implement conditional logic to use appropriate APIs based on environment

3. Deploy to Firebase hosting (`firebase deploy --only hosting`)
   - Ensure all web-compatible code is in place
   - Run final web build
   - Execute deployment command

4. Address potential web/desktop layout differences
   - Review all pages for centering issues
   - Apply the `min-h-screen` fix where needed for proper vertical centering in web mode

5. Apply Dexie caching pattern to other models (holidays, attendance, payroll, timesheet, etc.)

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