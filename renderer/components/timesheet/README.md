# Timesheet Component Refactoring

This directory contains the refactored timesheet components that were previously part of the monolithic `renderer/pages/timesheet.tsx` file. Breaking down the components helps with:

1. Reducing file size and complexity
2. Improving maintainability
3. Easier debugging
4. Better code organization

## Components

### TimesheetHeader
The header component displaying the employee dropdown, date range picker, and action buttons.

### TimesheetRow
Represents a single row in the timesheet table, handling cell rendering based on column type.

### EmptyTimesheet
Displayed when there's no timesheet data to show, either because no employee is selected or because no data is available for the selected time period.

## Integration

These components are designed to be used with the following related files:

- `renderer/hooks/timesheet/useTimesheetData.ts` - Hook for loading and managing timesheet data
- `renderer/services/TimesheetService.ts` - Service for handling API calls to load timesheet data

## Usage

```tsx
import { TimesheetHeader } from '@/renderer/components/timesheet/TimesheetHeader';
import { TimesheetRow } from '@/renderer/components/timesheet/TimesheetRow';
import { EmptyTimesheet } from '@/renderer/components/timesheet/EmptyTimesheet';
import { useTimesheetData } from '@/renderer/hooks/timesheet/useTimesheetData';

// Use in your component
const TimesheetPage = () => {
  // ... component logic
  
  const { 
    timesheetEntries, 
    compensationEntries,
    isLoading,
    validEntriesCount,
    refreshData
  } = useTimesheetData({
    dbPath,
    companyName,
    employeeId,
    employee,
    year,
    month
  });
  
  return (
    <>
      <TimesheetHeader 
        // ... props
      />
      
      {!employeeId ? (
        <EmptyTimesheet hasSelectedEmployee={false} onSelectEmployee={handleSelectEmployee} />
      ) : timesheetEntries.length === 0 ? (
        <EmptyTimesheet hasSelectedEmployee={true} onSelectEmployee={handleSelectEmployee} />
      ) : (
        <table>
          {/* ... table headers */}
          <tbody>
            {/* Map rows */}
            {days.map(day => (
              <TimesheetRow
                key={day}
                day={day}
                // ... other props
              />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
};
```

## Debugging

To help with debugging, extensive console logs have been added throughout the components, hooks, and services. You can find logs with prefixes like:

- "TimesheetService.*" - For logging in the service layer
- "useTimesheetData.*" - For logging in the hook
- "DEBUG - Timesheet*" - For general debugging logs 