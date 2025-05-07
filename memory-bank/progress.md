# Progress - Sweldo

## What Works
- ✅ Full desktop application functionality via Electron
- ✅ Local file system data storage in `SweldoDB/`
- ✅ PDF generation for payroll and schedules
- ✅ Employee management
- ✅ Attendance tracking
- ✅ Compensation calculation
- ✅ React UI with Next.js and shadcn/ui components
- ✅ Tailwind CSS styling
- ✅ TypeScript type safety
- ✅ Zustand state management
- ✅ Web build process setup
- ✅ Firebase hosting configuration
- ✅ Firestore integration for web data storage (employees & payroll sync) implemented
- ✅ Login dialog supports both desktop and web modes with company selection
- ✅ EmployeeList supports both desktop and web modes, loads employees from Firestore/local DB and sorts by ID ascending
- ✅ HolidayCalendar and HolidaysPage support web mode with Firestore-based CRUD operations
- ✅ Dexie-based IndexedDB caching implemented for EmployeeList (Firestore employee queries)
- ✅ Toast notifications on cache reloads for EmployeeList, HolidaysPage, and HolidayCalendar
- ✅ Dexie-based IndexedDB caching implemented for Holidays and missingTime logs with toasts on reload
- ✅ Authentication session persistence in web mode via localStorage (fixed login state being lost on page refresh)
- ✅ Company name persistence in web mode via localStorage (fixed records not loading after page refresh)
- ✅ Enhanced company selection UI with dedicated flow for authenticated users
- ✅ Critical bug fix for login dialog not appearing when company selection needed

## What's Left to Build
- 🔲 Alternative to `window.electron` API for web deployment
- 🔲 Web-compatible PDF generation solution
- 🔲 Environment detection for conditional imports
- 🔲 Layout fixes for web deployment
- 🔲 Firebase deployment
- 🔲 Apply Dexie caching to other Firestore-based models (holidays, attendance, payroll, timesheet, etc.)

## Current Status
The project is currently in a transition phase from being exclusively a desktop application to supporting both desktop and web deployments. The core application functionality is complete and working in the desktop environment, with the web adaptation in progress.

### Desktop Version:
- **Status**: ✅ Complete and functional
- **Data Storage**: Local file system
- **PDF Generation**: Via Electron IPC and Node.js modules
- **Platform**: Cross-platform via Electron

### Web Version:
- **Status**: 🔲 In progress
- **Data Storage**: ✅ Firestore integration implemented
- **Authentication**: ✅ Working with localStorage-based session persistence
- **Configuration**: ✅ Company name and settings persist across page refreshes
- **User Flow**: ✅ Enforced company selection with dedicated UI for authenticated users
- **PDF Generation**: 🔲 Needs implementation
- **Platform**: 🔲 Firebase Hosting (configured but not deployed)

## Known Issues

### PostCSS and Tailwind CSS Configuration
- Creating a custom `postcss.config.js` in the root or renderer directory can break Tailwind CSS processing
- Plugin naming conflicts between different versions can cause errors
- Multiple configuration files in both root and `renderer/` directories create conflicts

### Web/Nextron Layout Differences
- Centered content may appear "pulled up" in web mode compared to desktop
- This affects pages like the Payroll page's "Access Restricted" message
- Fix: Use `min-h-screen` on flex containers requiring vertical centering

### Desktop-Specific Code
- All code using `window.electron` API needs alternative implementations for web
- PDF generation relies on Node.js modules not available in browser
- File system operations need to be replaced with Firestore API calls

### Build Process
- Current web build process is functional but may need refinements
- Need to handle conditional imports for platform-specific code
- Webpack configuration may need adjustments for handling Node.js module fallbacks 