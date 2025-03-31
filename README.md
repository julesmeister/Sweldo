## Compensation Handling

### Saving Compensation Records

The `handleSaveCompensation` function is responsible for saving or updating compensation records. It takes an `updatedCompensation` object as a parameter, which contains details about the employee's compensation.

1. **Saving Process**:
   - Calls `compensationModel.saveOrUpdateRecords` with:
     - `employeeId`: ID of the employee.
     - `date.getFullYear()`: Year of the compensation date.
     - `date.getMonth() + 1`: Month of the compensation date (months are zero-indexed).
     - An array containing the `updatedCompensation` object.
   - Upon successful save, retrieves updated compensation entries using `compensationModel.loadRecords` with:
     - `storedMonthInt`: The month for which records are being loaded.
     - `year`: The year for which records are being loaded.
     - `selectedEmployeeId`: ID of the selected employee.
   - Sets the retrieved entries to the state using `setCompensationEntries`.

2. **Error Handling**:
   - If an error occurs during the save operation, it is logged to the console.

### CompensationDialog Component

#### Overview

The `CompensationDialog` component is a React functional component that manages the user interface for entering and saving compensation records for an employee. It is designed to be displayed as a modal dialog.

#### Props

The component accepts the following props:

* `isOpen`: A boolean that determines if the dialog is currently open.
* `onClose`: A function to close the dialog.
* `onSave`: A function that takes a `Compensation` object and saves it.
* `employee`: An object representing the employee for whom the compensation is being recorded.
* `compensation`: The current compensation details to be edited.
* `date`: The date associated with the compensation.
* `position`: An optional object that defines the position of the dialog on the screen.
* `timeIn`: The time the employee started working.
* `timeOut`: The time the employee finished working.
* `day`: The day of the month for the compensation.

#### State Management

The component uses `useState` to manage local state for the following:

* `formData`: Holds the compensation data being edited.
* `employmentTypes`: An array of employment types loaded from the settings.
* `employmentType`: The specific employment type for the current employee.
* `attendanceSettings`: Settings related to attendance, such as grace periods and deductions.

#### Effects

The component uses `useEffect` to handle the following effects:

* **Loading Attendance Settings**:
  - On component mount and when `compensation.employeeId` changes, it loads attendance settings and updates the state.
  - The `attendanceSettingsModel.loadTimeSettings()` method is called to fetch the available employment types. This method returns a promise that resolves to the time settings.
  - Once the settings are loaded, the employment types are stored in the `employmentTypes` state. Additionally, the component checks if the loaded employment types include the type associated with the current employee (`employee?.employmentType`). If found, it sets the `employmentType` state accordingly. The loaded attendance settings are also fetched using `attendanceSettingsModel.loadAttendanceSettings()`, which updates the `attendanceSettings` state.

```javascript
useEffect(() => {
  attendanceSettingsModel.loadTimeSettings().then((timeSettings) => {
    setEmploymentTypes(timeSettings);
    const foundType = timeSettings.find(type => type.type === employee?.employmentType);
    setEmploymentType(foundType || null);
  });
  attendanceSettingsModel.loadAttendanceSettings().then((settings) => {
    setAttendanceSettings(settings);
  });
}, [compensation.employeeId]);
```

#### Loading Attendance Settings

The component utilizes the `useEffect` hook to load attendance settings when the component mounts and whenever the `compensation.employeeId` changes. The `attendanceSettingsModel.loadTimeSettings()` method is called to fetch the available employment types. This method returns a promise that resolves to the time settings.

Once the settings are loaded, the employment types are stored in the `employmentTypes` state. Additionally, the component checks if the loaded employment types include the type associated with the current employee (`employee?.employmentType`). If found, it sets the `employmentType` state accordingly. The loaded attendance settings are also fetched using `attendanceSettingsModel.loadAttendanceSettings()`, which updates the `attendanceSettings` state.

```javascript
useEffect(() => {
  attendanceSettingsModel.loadTimeSettings().then((timeSettings) => {
    setEmploymentTypes(timeSettings);
    const foundType = timeSettings.find(type => type.type === employee?.employmentType);
    setEmploymentType(foundType || null);
  });
  attendanceSettingsModel.loadAttendanceSettings().then((settings) => {
    setAttendanceSettings(settings);
  });
}, [compensation.employeeId]);
```

#### Updating Form Data

Another `useEffect` hook is employed to synchronize the `formData` state with the incoming `compensation` prop. Whenever the `compensation` prop changes (e.g., when editing an existing compensation record), the `formData` state is updated to reflect these changes. This ensures that the form fields display the correct values when the dialog is opened or when the compensation details are modified.

```javascript
useEffect(() => {
  setFormData(compensation);
}, [compensation]);
```

#### Computed Values

The component uses the `useMemo` hook to calculate various compensation-related metrics based on the input times and attendance settings. It checks if the `employmentType` requires time tracking. If not, it initializes all computed values (late minutes, undertime minutes, etc.) to zero. If time tracking is required, it calculates:
- **Late Minutes**: The difference between the actual time in and the scheduled time in.
- **Undertime Minutes**: The difference between the scheduled time out and the actual time out.
- **Overtime Minutes**: The difference between the actual time out and the scheduled time out.
- **Hours Worked**: The total hours between the actual time in and time out.
- **Deductions**: Based on the attendance settings, it applies grace periods for late and undertime minutes.
- **Gross Pay**: Calculated based on the employee's daily rate and any overtime additions.
- **Net Pay**: The gross pay minus any deductions.

```javascript
const computedValues = useMemo(() => {
  if (!employmentType?.requiresTimeTracking || !timeIn || !timeOut || !attendanceSettings) {
    return {
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      hoursWorked: 0,
      grossPay: 0,
      deductions: 0,
      netPay: 0,
    };
  }
  // Calculations for lateMinutes, undertimeMinutes, overtimeMinutes, etc.
}, [employmentType, timeIn, timeOut, attendanceSettings]);

#### Detailed Documentation for Computed Values

1. **Purpose**:
   - The `computedValues` useMemo hook is designed to calculate various metrics related to employee compensation based on the input times (`timeIn` and `timeOut`) and the employee's attendance settings.

2. **Conditions**:
   - The calculations are performed only if the following conditions are met:
     - The `employmentType` requires time tracking.
     - Both `timeIn` and `timeOut` values are provided.
     - The attendance settings are loaded.

3. **Calculations**:
   - If the conditions are not met, the function returns default values of zero for all computed metrics.

   ```javascript
   const computedValues = useMemo(() => {
     if (!employmentType?.requiresTimeTracking || !timeIn || !timeOut || !attendanceSettings) {
       return {
         lateMinutes: 0,
         undertimeMinutes: 0,
         overtimeMinutes: 0,
         hoursWorked: 0,
         grossPay: 0,
         deductions: 0,
         netPay: 0,
       };
     }
   ```

   - If the conditions are satisfied, the following calculations are performed:
     - **Actual Time In/Out**: Converts the `timeIn` and `timeOut` strings into `Date` objects.
     - **Scheduled Time In/Out**: Converts the scheduled time from the `employmentType` into `Date` objects.

     ```javascript
     const actualTimeIn = new Date(`1970-01-01T${timeIn}`);
     const actualTimeOut = new Date(`1970-01-01T${timeOut}`);
     const schedTimeIn = new Date(`1970-01-01T${employmentType.timeIn}`);
     const schedTimeOut = new Date(`1970-01-01T${employmentType.timeOut}`);
     ```

     - **Late Minutes**: Calculates the number of minutes the employee was late by comparing the actual time in with the scheduled time in.
     - **Undertime Minutes**: Calculates the number of minutes the employee left early by comparing the actual time out with the scheduled time out.
     - **Overtime Minutes**: Calculates the number of minutes the employee worked overtime by comparing the actual time out with the scheduled time out.

     ```javascript
     const lateMinutes = actualTimeIn > schedTimeIn 
       ? Math.round((actualTimeIn.getTime() - schedTimeIn.getTime()) / (1000 * 60))
       : 0;

     const undertimeMinutes = actualTimeOut < schedTimeOut
       ? Math.round((schedTimeOut.getTime() - actualTimeOut.getTime()) / (1000 * 60))
       : 0;

     const overtimeMinutes = actualTimeOut > schedTimeOut
       ? Math.round((actualTimeOut.getTime() - schedTimeOut.getTime()) / (1000 * 60))
       : 0;
     ```

     - **Hours Worked**: Calculates the total hours worked by finding the difference between actual time in and actual time out.

     ```javascript
     const hoursWorked = Math.round((actualTimeOut.getTime() - actualTimeIn.getTime()) / (1000 * 60 * 60));
     ```

4. **Deductions and Pay Calculations**:
   - **Late Deduction**: If late minutes exceed the grace period, calculates the deduction based on the attendance settings.
   - **Undertime Deduction**: Similar calculation for undertime minutes.
   - **Overtime Addition**: Calculates additional pay for overtime worked beyond the grace period.
   - **Total Deductions**: Sums up all deductions.
   - **Gross Pay**: Calculates gross pay based on the employee's daily rate and any overtime additions.
   - **Net Pay**: Calculates net pay by subtracting total deductions from gross pay.

   ```javascript
   const deductions = lateDeduction + undertimeDeduction + overtimeAddition;
   const dailyRate = parseFloat((employee?.dailyRate || 0).toString());
   const grossPay = (dailyRate + overtimeAddition);
   const netPay = grossPay - deductions;
   ```

5. **Return Values**:
   - Finally, the computed values are returned as an object containing all calculated metrics.

   ```javascript
   return {
     lateMinutes,
     undertimeMinutes,
     overtimeMinutes,
     lateDeduction,
     undertimeDeduction,
     overtimeAddition,
     hoursWorked,
     grossPay,
     deductions,
     netPay,
   };
   ```

#### Updating Hours Worked

The component also calculates the hours worked based on the `timeIn` and `timeOut` values using another `useMemo` hook. It creates `Date` objects from the `timeIn` and `timeOut` strings and computes the difference in milliseconds. If the difference is positive, it converts this value into hours and updates the `formData` state accordingly.

```javascript
const hoursWorked = useMemo(() => {
  if (timeIn && timeOut) {
    const start = new Date(`1970-01-01T${timeIn}`);
    const end = new Date(`1970-01-01T${timeOut}`);
    const diffInMs = end.getTime() - start.getTime();
    return diffInMs > 0 ? Math.round(diffInMs / (1000 * 60 * 60)) : 0;
  }
  return 0;
}, [timeIn, timeOut]);
```

#### Event Handlers

The component defines the following event handlers:

* **handleSubmit**: 
  - Handles form submission, calls the `onSave` function with the current `formData`, and closes the dialog.
* **handleInputChange**: 
  - Updates the `formData` state when input fields change, ensuring numerical values are parsed correctly.

#### Rendering

The component renders a modal dialog that includes input fields for various compensation details. It listens for clicks outside the dialog to close it.

#### Usage

To use the `CompensationDialog` component, simply import it and render it with the required props. For example:

```jsx
import CompensationDialog from './CompensationDialog';

const App = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [compensation, setCompensation] = useState({});

  const handleSave = (compensation) => {
    // Save compensation logic here
  };

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>Open Dialog</button>
      <CompensationDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        employee={{ id: 1, name: 'John Doe' }}
        compensation={compensation}
        date={new Date()}
        timeIn="08:00"
        timeOut="17:00"
        day={1}
      />
    </div>
  );
};
```

## Payroll Calculation Algorithm

The payroll calculation in Sweldo Electron follows these steps to generate a payroll summary for an employee over a specified date range:

### 1. Data Loading
```typescript
// Load required data
const [employee, attendanceSettings] = await Promise.all([
  employeeModel.loadEmployeeById(employeeId),
  attendanceSettingsModel.loadAttendanceSettings()
]);
```
- Loads employee details (rates, deductions)
- Loads attendance settings (grace periods, deduction rates)

### 2. Compensation Records Collection
```typescript
// Get all relevant months
const months = [];
while (currentDate <= endDate) {
  months.push({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear()
  });
  currentDate.setMonth(currentDate.getMonth() + 1);
}

// Load and filter compensations
const allCompensations = [];
for (const { month, year } of months) {
  const compensations = await loadRecords(month, year, employeeId);
  allCompensations.push(...compensations);
}
```
- Determines all months in the date range
- Loads compensation records for each month
- Filters records to exact date range

### 3. Per-Day Calculations
For each day's compensation record:

#### Basic Pay
```typescript
const dailyRate = employee.dailyRate || 0;
const basicPay = parseFloat(`${dailyRate}`);
totalBasicPay += basicPay;
```
- Uses employee's daily rate as basic pay
- Accumulates for total period

#### Late Deductions
```typescript
const lateMinutes = comp.lateMinutes || 0;
const lateDeduction = lateMinutes > attendanceSettings.lateGracePeriod
  ? (lateMinutes - attendanceSettings.lateGracePeriod) * attendanceSettings.lateDeductionPerMinute
  : 0;
```
- Applies only after grace period
- Rate: attendanceSettings.lateDeductionPerMinute per minute

#### Undertime Deductions
```typescript
const undertimeMinutes = comp.undertimeMinutes || 0;
const undertimeDeduction = undertimeMinutes > attendanceSettings.undertimeGracePeriod
  ? (undertimeMinutes - attendanceSettings.undertimeGracePeriod) * attendanceSettings.undertimeDeductionPerMinute
  : 0;
```
- Applies only after grace period
- Rate: attendanceSettings.undertimeDeductionPerMinute per minute

#### Overtime Pay
```typescript
const overtimeMinutes = comp.overtimeMinutes || 0;
const overtimePay = overtimeMinutes > attendanceSettings.overtimeGracePeriod
  ? (overtimeMinutes - attendanceSettings.overtimeGracePeriod) * attendanceSettings.overtimeAdditionPerMinute
  : 0;
```
- Applies only after grace period
- Rate: attendanceSettings.overtimeAdditionPerMinute per minute

#### Daily Gross Pay
```typescript
const dailyGrossPay = basicPay + overtimePay + (comp.holidayBonus || 0) + (comp.leavePay || 0);
```
Includes:
- Basic daily rate
- Overtime pay
- Holiday bonuses
- Leave pay

#### Daily Deductions
```typescript
const dailyDeductions = lateDeduction + undertimeDeduction + (comp.deductions || 0);
```
Includes:
- Late deductions
- Undertime deductions
- Other daily deductions

### 4. Final Calculations

#### Total Gross Pay
```typescript
totalGrossPay += dailyGrossPay;
```
Sum of all daily gross pay amounts

#### Total Deductions
```typescript
// Government mandated
const governmentDeductions = (employee.sss || 0) + (employee.philHealth || 0) + (employee.pagIbig || 0);

// Total deductions including daily deductions
const totalDeductions = dailyDeductions + governmentDeductions;
```

#### Net Pay
```typescript
const totalNetPay = totalGrossPay - totalDeductions;
```
Final take-home pay after all deductions

### Important Notes:
1. Basic pay is now the flat daily rate, not calculated from hours worked
2. Grace periods affect when deductions or additions start applying
3. Government deductions (SSS, PhilHealth, Pag-IBIG) are applied to the whole period
4. Payment date is set to 3 days after period end date

### Example:
```typescript
// For a daily rate of ₱500, with 2 days work:
basicPay = ₱500 * 2 = ₱1,000

// If 30 minutes late (grace period 15 mins, ₱1/min):
lateDeduction = (30 - 15) * ₱1 = ₱15

// If 1 hour overtime (grace period 30 mins, ₱2/min):
overtimePay = (60 - 30) * ₱2 = ₱60

// Daily gross = ₱500 + ₱60 = ₱560
// Daily deductions = ₱15
// Daily net = ₱560 - ₱15 = ₱545
```

## TimesheetPage Component

### loadEmployee Function
The `loadEmployee` function is responsible for loading the employee details based on the selected employee ID. It performs the following tasks:

1. **Checks for Validity**: Ensures that the database path, selected employee ID, and employee model are defined.
2. **Loads Employee Data**: If the selected employee ID is valid, it fetches the employee details using `employeeModel.loadEmployeeById(selectedEmployeeId!)`.
3. **Sets Employee State**: If the employee data is successfully retrieved, it updates the state with the loaded employee.

### loadData Function
The `loadData` function handles loading attendance and compensation data for the selected employee. It executes the following steps:

1. **Loading State**: Sets the loading state to true to indicate that data is being fetched.
2. **Fetches Attendance and Compensation Data**: Uses `Promise.all` to load both attendance and compensation records based on the selected employee ID, month, and year.
3. **Updates State**: Once the data is loaded, it updates the state for timesheet entries and compensation entries. It also calculates the valid entries count based on the loaded attendance data.
4. **Computes Compensations**: Calls the `useComputeAllCompensations` function to compute the compensation entries based on the loaded attendance data.

This function is essential for ensuring that the TimesheetPage displays the correct information for the selected employee and allows for accurate compensation calculations.

The CompensationDialog component is responsible for handling the saving of compensation records. When the user submits the compensation form, the `handleSaveCompensation` function is called to save the updated compensation records.

## Dialog Form Styling Guide

### CashAdvanceForm Component

The `CashAdvanceForm` component follows a consistent styling pattern for dialogs in the application. Here's a detailed breakdown of the styling implementation:

#### 1. Dialog Container
```tsx
<div 
  className="absolute bg-white rounded-lg shadow-xl border border-gray-200"
  style={{ 
    top: position?.top,
    left: position?.left,
    transform: position?.showAbove ? 'translateY(-100%)' : 'none',
    maxHeight: 'calc(100vh - 100px)',
    width: '500px'
  }}
>
```
- Uses absolute positioning for precise placement
- Consistent width of 500px
- Maximum height calculation to prevent overflow
- Rounded corners and shadow for elevation
- White background with subtle border

#### 2. Caret (Arrow Pointer)
```tsx
<div 
  className="absolute"
  style={{
    left: position?.caretLeft,
    width: 0,
    height: 0,
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    ...(position?.showAbove 
      ? {
          bottom: '-8px',
          borderTop: '8px solid rgb(229, 231, 235)'
        }
      : {
          top: '-8px',
          borderBottom: '8px solid rgb(229, 231, 235)'
        })
  }}
/>
```
- CSS triangle implementation using borders
- Dynamic positioning based on dialog placement
- Matches border color for seamless appearance
- Inner white fill for clean look

#### 3. Header Section
```tsx
<div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
  <h2 className="text-lg font-semibold text-gray-900">
    {title}
  </h2>
  <button className="text-gray-400 hover:text-gray-500">
    <IoClose size={24} />
  </button>
</div>
```
- Light gray background
- Consistent padding
- Flex layout for title and close button
- Rounded top corners
- Bottom border for separation

#### 4. Form Layout
```tsx
<div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
  <form className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      {/* Form fields */}
    </div>
  </form>
</div>
```
- Grid system for field layout
- Consistent spacing
- Scrollable content area
- Responsive design

#### 5. Form Fields
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Field Label
  </label>
  <input
    className="block w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
  />
</div>
```
- Consistent label styling
- Full-width inputs
- Focus states for better UX
- Rounded corners on inputs

#### 6. Footer Section
```tsx
<div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
  <div className="flex justify-end space-x-3">
    <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
      Cancel
    </button>
    <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
      Submit
    </button>
  </div>
</div>
```
- Light gray background
- Right-aligned buttons
- Consistent button styling
- Primary and secondary button variants
- Rounded bottom corners

This styling guide ensures consistency across all dialog forms in the application and provides a professional, modern appearance with good user experience.

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

## Compensation Calculation Formulas

### Field Relationships and Calculations

The compensation calculation system follows these relationships between fields:

1. **Time-Based Fields Affecting Pay/Deductions**:
   - `overtimeMinutes` → `overtimePay`
     - Calculated using: `Math.floor(overtimeMinutes / 60) * hourlyRate * overtimeHourlyMultiplier`
     - Where:
       - `hourlyRate = dailyRate / 8`
       - `overtimeHourlyMultiplier` defaults to 1.25 if not set in settings
   - `undertimeMinutes` → `undertimeDeduction`
     - Calculated using: `undertimeMinutes * undertimeDeductionPerMinute`
   - `lateMinutes` → `lateDeduction`
     - Calculated using: `lateMinutes * lateDeductionPerMinute`

2. **Pay/Duction Fields Affecting Gross Pay**:
   - `grossPay` = `basePay` + `overtimePay` + `holidayBonus` + `nightDifferentialPay`
   - Changes to any of these components will update the gross pay accordingly

3. **Deduction Fields Affecting Net Pay**:
   - `deductions` = `lateDeduction` + `undertimeDeduction`
   - `netPay` = `grossPay` - `deductions` + `leavePay`
   - Changes to any deduction will update the total deductions and net pay

### Manual Override Behavior

When manual override is enabled:
1. Users can directly edit computed fields
2. Changes to time-based fields (minutes) will not automatically update their corresponding pay/deduction fields
3. Changes to pay/deduction fields will still affect gross pay and net pay calculations
4. The system maintains the relationship between gross pay, deductions, and net pay

### Example Calculations

```typescript
// Base calculations
const hourlyRate = dailyRate / 8; // Standard 8-hour workday

// Overtime calculation
const overtimePay = Math.floor(overtimeMinutes / 60) * hourlyRate * overtimeHourlyMultiplier;

// Night differential calculation
const nightDiffRate = hourlyRate * (1 + nightDifferentialMultiplier);
const nightDifferentialPay = nightDifferentialHours * nightDiffRate;

// Holiday pay calculation
const holidayBonus = dailyRate * holidayMultiplier;

// Deduction calculations
const lateDeduction = lateMinutes * lateDeductionPerMinute;
const undertimeDeduction = undertimeMinutes * undertimeDeductionPerMinute;

// Final calculations
const grossPay = dailyRate + overtimePay + holidayBonus + nightDifferentialPay;
const totalDeductions = lateDeduction + undertimeDeduction;
const netPay = grossPay - totalDeductions + leavePay;
```

## PDF Generator Dimensions

### Previous Layout (A4 - 8.5" x 11")
- Page Size: 595.28 x 841.89 points (A4)
- Layout: 2 columns x 4 rows (8 payslips per page)
- Payslip Dimensions:
  - Width: (pageWidth - margin * 3) / 2
  - Height: (pageHeight - margin * 5) / 4
- Margins: 20 points
- Logo Size: 25 points
- Row Height: 10 points
- Font Size: 6 points

### New Layout (Long Bond Paper - 8" x 13")
- Page Size: 576 x 936 points (8" x 13")
- Layout: 2 columns x 5 rows (10 payslips per page)
- Payslip Dimensions:
  - Width: (pageWidth - margin * 3) / 2
  - Height: (pageHeight - margin * 6) / 5
- Margins: 20 points
- Logo Size: 20 points (reduced for better fit)
- Row Height: 8 points (reduced for better fit)
- Font Size: 6 points

### Layout Changes
1. Increased number of payslips per page from 8 to 10
2. Reduced individual payslip size to accommodate more rows
3. Adjusted spacing and margins for optimal readability
4. Maintained font size for legibility while reducing other dimensions