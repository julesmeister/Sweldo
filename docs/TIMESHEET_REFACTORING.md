# Timesheet Refactoring Plan

This document outlines the plan for refactoring the monolithic `timesheet.tsx` file into smaller, more maintainable components.

## Current Issues

1. The `timesheet.tsx` file is too large and complex, making it difficult to maintain and debug
2. There are multiple concerns mixed together (UI, data loading, business logic)
3. The same code has been modified multiple times, leading to inconsistencies
4. Web mode data loading is not working properly

## New Architecture

### Component Structure

```
renderer/
├── components/
│   └── timesheet/
│       ├── TimesheetRow.tsx         - Individual timesheet row
│       ├── TimesheetHeader.tsx      - Header with employee selection and actions
│       ├── EmptyTimesheet.tsx       - Empty state display
│       └── README.md                - Documentation
├── hooks/
│   └── timesheet/
│       └── useTimesheetData.ts      - Data loading hook
│   ├── useTimesheetCheckbox.ts      - Checkbox handling
│   ├── useTimesheetEdit.ts          - Cell edit handling
│   ├── useTimesheetHistoryOperations.ts - History operations
│   └── utils/
│       └── useSchedule.ts           - Schedule management
├── services/
│   └── TimesheetService.ts          - Data loading service
└── pages/
    ├── timesheet.tsx                - Original file (to be replaced)
    ├── timesheet_refactored.tsx     - New refactored implementation
    └── timesheet_test.tsx           - Test page for debugging
```

## Migration Strategy

### Phase 1: Foundation Setup ✅

1. Create the necessary directory structure
2. Extract core components to their own files
3. Create the data loading service and hooks
4. Add extensive logging throughout for debugging

### Phase 2: Testing ⏳

1. Create a minimal test page (`timesheet_test.tsx`) that uses the refactored components
2. Verify data loading works in both desktop and web mode
3. Debug any issues found during testing

### Phase 3: Implementation

1. Replace the content of `timesheet.tsx` with the refactored version
2. Or create a new route to the refactored version and switch once validated
3. Remove temporary test files

## Testing Approach

Before fully replacing the original implementation, we can:

1. Test the refactored code path in isolation using the test page
2. Compare data loading between original and refactored implementations
3. Ensure logs provide full visibility into the data flow

## Debugging Tools

The refactored code includes extensive logging:

- **TimesheetService** - Data loading operations in both web and desktop modes
- **useTimesheetData** - Hook-level operations for data management
- **Component Hooks** - All user interactions and data updates

## Known Issues and Solutions

| Issue | Solution |
|-------|----------|
| Web mode data not loading | Fixed in TimesheetService by properly using companyName from settings |
| Inconsistent company name | Using a single service to manage data access |
| Excessive rerenders | Properly memoized dependencies in hooks |
| Complex state management | Separated concerns into dedicated hooks |

## Migration Checklist

- [x] Extract TimesheetRow component
- [x] Extract TimesheetHeader component
- [x] Extract EmptyTimesheet component
- [x] Create TimesheetService
- [x] Create useTimesheetData hook
- [x] Create useTimesheetCheckbox hook
- [x] Create useTimesheetEdit hook
- [x] Create useTimesheetHistoryOperations hook
- [x] Create useSchedule hook
- [x] Create test page
- [ ] Test in desktop mode
- [ ] Test in web mode
- [ ] Replace original implementation
- [ ] Remove temporary test files

## Benefits of Refactoring

1. **Improved Maintainability**: Smaller, focused components are easier to understand and modify
2. **Better Debugging**: Isolated components with specific responsibilities
3. **Easier Testing**: Separated concerns allow for better unit testing
4. **Consistent Data Loading**: Single service for data access logic
5. **Clear Component API**: Well-defined props and interfaces
6. **Performance Improvements**: Better memoization and reduced rerenders 