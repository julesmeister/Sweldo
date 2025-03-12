'use client';

import React, { useEffect, useState, useMemo } from "react";
import { AttendanceModel, createAttendanceModel } from "@/renderer/model/attendance";
import { Attendance } from "@/renderer/model/attendance";
import { CompensationModel, createCompensationModel } from "@/renderer/model/compensation";
import { Compensation, DayType } from "@/renderer/model/compensation";
import { createAttendanceSettingsModel, EmploymentType } from "@/renderer/model/settings";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useColumnVisibilityStore } from '@/renderer/stores/columnVisibilityStore';
import { useLoadingStore } from '@/renderer/stores/loadingStore';
import { IoSettingsOutline, IoRefreshOutline } from "react-icons/io5";
import { EditableCell } from '@/renderer/components/EditableCell';
import { CompensationDialog } from '@/renderer/components/CompensationDialog';
import { Employee, EmployeeModel, createEmployeeModel } from "@/renderer/model/employee";
import { useComputeAllCompensations } from '@/renderer/hooks/computeAllCompensations';
import { Tooltip } from '@/renderer/components/Tooltip';
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";

const TimesheetPage: React.FC = () => {
  const [timesheetEntries, setTimesheetEntries] = useState<Attendance[]>([]);
  const [compensationEntries, setCompensationEntries] = useState<Compensation[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<{entry: Attendance, compensation: Compensation} | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [clickPosition, setClickPosition] = useState<{ top: number; left: number; showAbove: boolean } | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [timeSettings, setTimeSettings] = useState<EmploymentType[]>([]);
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
  const { columns, setColumns, resetToDefault } = useColumnVisibilityStore();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [validEntriesCount, setValidEntriesCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  useEffect(() => {
    if (!storedYear) {
      const currentYear = new Date().getFullYear().toString();
      localStorage.setItem("selectedYear", currentYear);
      setStoredYear(currentYear);
    }
  }, [storedYear]);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  const year = storedYear ? parseInt(storedYear, 10) : 0;
  const pathname = usePathname();

  // Create model instances with proper dbPath
  // Removed incorrect dbPath[0] access and used dbPath directly as it's already a string
  const attendanceModel = useMemo(() => createAttendanceModel(dbPath), [dbPath]);
  const compensationModel = useMemo(() => createCompensationModel(dbPath), [dbPath]);
  const attendanceSettingsModel = useMemo(
    () => createAttendanceSettingsModel(dbPath),
    [dbPath]
  );
  const employeeModel = useMemo(() => createEmployeeModel(dbPath), [dbPath]);

  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const computeCompensations = useComputeAllCompensations(
    employee,
    year,
    storedMonthInt,
    1,
    compensationModel,
    attendanceModel,
    attendanceSettingsModel,
    dbPath,
    (newCompensations) => {
      setCompensationEntries(newCompensations);
    }
  );

  // First effect: Load employee only
  useEffect(() => {
    const loadEmployee = async () => {
      if (!dbPath || !selectedEmployeeId || employeeModel == undefined) {
        return;
      }
      if (selectedEmployeeId) {
        try {
          setLoading(true);
          const emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
          if (emp !== null) setEmployee(emp);
        } catch (error) {
          toast.error('Error loading employee');
        } finally {
          setLoading(false);
        }
      }
    };
    
    loadEmployee();
  }, [selectedEmployeeId, dbPath, employeeModel, setLoading]);

  // Second effect: Load and compute data when necessary dependencies change
  useEffect(() => {
    const loadData = async () => {
      if (!employee || !dbPath || !selectedEmployeeId) {
        return;
      }

      try {
        setLoading(true);
        setIsLoading(true);
        
        const [attendanceData, compensationData] = await Promise.all([
          attendanceModel.loadAttendancesById(
            storedMonthInt,
            year,
            selectedEmployeeId
          ),
          compensationModel.loadRecords(
            storedMonthInt,
            year,
            selectedEmployeeId
          ),
        ]);

        setTimesheetEntries(attendanceData);
        setCompensationEntries(compensationData);
        setValidEntriesCount(attendanceData.length - attendanceData.filter(entry => entry.timeIn && entry.timeOut).length);

        // Compute compensations only once after loading data
        await computeCompensations(attendanceData, compensationData);
      } catch (error) {
        toast.error('Error loading timesheet data');
        setLoading(false);
        setIsLoading(false);
      } finally {
        setLoading(false);
        setIsLoading(false);
      }
    };

    loadData();
  }, [employee?.id, selectedEmployeeId, dbPath, year, storedMonthInt, setLoading]);

  // Find the employee's time tracking setting
  const employeeTimeSettings = useMemo(() => {
    if (!employee || !timeSettings.length) return null;
    const settings = timeSettings.find(type => type.type.toLowerCase() === employee.employmentType?.toLowerCase());
    return settings;
  }, [employee, timeSettings]);

  useEffect(() => {
    const loadEmploymentTypes = async () => {
      try {
        const types = await attendanceSettingsModel.loadTimeSettings();
        setTimeSettings(types);
        setEmploymentTypes(types);

        // Update column names and visibility based on time tracking requirement
        if (employee) {
          const employeeType = types.find(type => type.type.toLowerCase() === employee.employmentType?.toLowerCase());
          
          if (employeeType) {
            const updatedColumns = columns.map(col => {
              if (col.key === 'timeIn') {
                return { 
                  ...col, 
                  name: employeeType.requiresTimeTracking ? 'Time In' : 'Attendance Status',
                  visible: true 
                };
              }
              if (col.key === 'timeOut') {
                return { 
                  ...col, 
                  visible: employeeType.requiresTimeTracking 
                };
              }
              return col;
            });
            
            setColumns(updatedColumns);
          }
        }
      } catch (error) {
        toast.error('Failed to load employment types');
      }
    };
    loadEmploymentTypes();
  }, [attendanceSettingsModel, employee, setColumns]);

  const handleColumnVisibilityChange = (columnKey: string) => {
    const newColumns = columns.map((col) =>
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
  };

  const handleRowClick = (entry: Attendance, compensation: Compensation | undefined | null, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dialogHeight = 400; // Approximate height of dialog
    const spacing = 8; // Space between dialog and row

    // If there's not enough space below and more space above, show above
    const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;
    
    setClickPosition({ 
      top: showAbove ? rect.top - spacing : rect.bottom + spacing,
      left: rect.left,
      showAbove
    });

    const defaultCompensation: Compensation = {
      employeeId: entry.employeeId,
      month: storedMonthInt,
      year: year,
      day: entry.day,
      dayType: 'Regular' as DayType,
      dailyRate: 0,
      hoursWorked: 0,
      grossPay: 0,
      netPay: 0,
      manualOverride: false
    };
    setSelectedEntry({ 
      entry, 
      compensation: compensation || defaultCompensation
    });
    setIsDialogOpen(true);
  };

  const handleSaveCompensation = async (updatedCompensation: Compensation) => {
    try {
      // First ensure we have all the required fields
      if (!updatedCompensation.employeeId || !updatedCompensation.month || !updatedCompensation.year) {
        throw new Error('Missing required fields in compensation');
      }

      await compensationModel.saveOrUpdateCompensations(
        [updatedCompensation],
        updatedCompensation.month,
        updatedCompensation.year,
        updatedCompensation.employeeId
      );

      // Refresh the compensation entries
      const newCompensationEntries = await compensationModel.loadRecords(
        storedMonthInt,
        year,
        selectedEmployeeId!
      );
      setCompensationEntries(newCompensationEntries);

      // Show success message
      toast.success('Compensation saved successfully');
    } catch (error) {
      toast.error('Failed to save compensation');
    }
  };

  const handleRecompute = async () => {
    if (!timesheetEntries || !compensationEntries) return;
    
    setIsRecomputing(true);
    try {
      setLoading(true);
      await computeCompensations(timesheetEntries, compensationEntries, true).finally(() => {
        toast.success('Compensations recomputed successfully!');
      });
    } catch (error) {
      toast.error('Failed to recompute compensations.');
    } finally {
      setLoading(false);
      setIsRecomputing(false);
    }
  };

  const tooltipContent: Record<'grossPay' | 'deductions', string> = {
    grossPay: "Gross pay is calculated as the daily rate plus overtime pay",
    deductions: "Deductions include late and undertime deductions only"
  };

  const router = useRouter();
  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  return (
    <RootLayout>
      
    <main className="max-w-12xl mx-auto py-12 sm:px-6 lg:px-8">
    <MagicCard className='p-0.5 rounded-lg' gradientSize={200} gradientColor="#9E7AFF" gradientOpacity={0.8} gradientFrom="#9E7AFF" gradientTo="#FE8BBB">

      <div className="px-4 sm:px-0">
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6">
          <div className="col-span-1 md:col-span-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  {selectedEmployeeId ? employee?.name + "'s Timesheet" : "Timesheet"}
                </h2>
                {selectedEmployeeId && (
                  <div className="relative flex items-center space-x-4">
                    <div className="flex items-center px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-600">
                      <span>Absences:</span>
                      <span className="ml-1.5 font-semibold text-gray-900">{validEntriesCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* <button
                        onClick={resetToDefault}
                        className="p-2 hover:bg-gray-100 rounded-full"
                        title="Reset Column Visibility"
                      >
                        <IoRefreshOutline className="w-5 h-5" />
                      </button> */}
                      <button
                        type="button"
                        className="mr-3 p-1 rounded-md bg-gray-100 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={handleRecompute}
                      >
                        <span className="sr-only">Recompute Compensations</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isRecomputing ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                    </button>
                      <button
                        type="button"
                        className="p-1 rounded-md bg-gray-100 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onMouseEnter={() => setShowColumnMenu(true)}
                      >
                        <span className="sr-only">Column Settings</span>
                        <IoSettingsOutline className="h-5 w-5" aria-hidden="true" />
                      </button>
                      
                    {showColumnMenu && (
                      <div
                        className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                        onMouseLeave={() => setShowColumnMenu(false)}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-3">
                            <h3 className="text-sm font-medium text-gray-200">Visible Columns</h3>
                            <button
                              onClick={() => setColumns(cols => cols.map(col => ({ ...col, visible: true })))}
                              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors duration-150"
                            >
                              Show All
                            </button>
                          </div>
                          <div className="space-y-1 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {columns.map((column) => (
                              <div
                                key={column.key}
                                className="flex items-center justify-between p-2 hover:bg-gray-800/50 rounded-lg group transition-colors duration-150"
                              >
                                <span className="text-sm text-gray-300">{column.name}</span>
                                <div className="relative">
                                  <button
                                    onClick={() => {
                                      if (column.key === 'day') return;
                                      handleColumnVisibilityChange(column.key);
                                    }}
                                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none ${
                                      column.key === 'day'
                                        ? 'bg-gray-600 cursor-not-allowed'
                                        : column.visible
                                        ? 'bg-blue-500'
                                        : 'bg-gray-700'
                                    }`}
                                    disabled={column.key === 'day'}
                                  >
                                    <span
                                      className={`inline-block w-4 h-4 transform transition-transform duration-200 ease-in-out rounded-full bg-white ${
                                        column.visible ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
              {selectedEmployeeId ? (
                <div className="overflow-x-auto relative">
                  {timesheetEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">
                          No timesheet entries found
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          You have to upload the excel file from the biometrics for this month to see records here.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {columns.map((column) => 
                            column.visible && (
                              <th
                                key={column.key}
                                scope="col"
                                className={`${
                                  column.key === 'day'
                                    ? 'sticky left-0 z-10 bg-gray-50'
                                    : ''
                                } px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                                  column.key === 'day' ? 'w-20' : ''
                                }`}
                              >
                                {tooltipContent[column.key as 'grossPay' | 'deductions'] ? (
                                  <Tooltip 
                                    content={tooltipContent[column.key as 'grossPay' | 'deductions']}
                                    position="left"
                                  >
                                    {column.name}
                                  </Tooltip>
                                ) : (
                                  column.name
                                )}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Array.from(new Set(timesheetEntries.map(entry => entry.day))).map((day) => {
                          const foundEntry = timesheetEntries.find(entry => entry.day === day);
                          const foundCompensation = compensationEntries.find(comp => 
                            comp.year === year && 
                            comp.month === storedMonthInt && 
                            comp.day === Number(day)
                          );
                          const compensation = foundCompensation === undefined ? null : foundCompensation;

                          if (!foundEntry) {
                            return;
                          }

                          return (
                            <tr 
                              key={day}
                              onClick={(event) => handleRowClick(foundEntry, compensation, event)}
                              className={`cursor-pointer hover:bg-gray-50 ${
                                selectedEntry?.entry.day === day ? 'bg-indigo-50' : ''
                              }`}
                            >
                              {columns.map((column) => 
                                column.visible && (
                                  column.key === 'timeIn' || column.key === 'timeOut' ? (
                                    employeeTimeSettings?.requiresTimeTracking ? (
                                      <EditableCell
                                        key={column.key}
                                        value={column.key === 'timeIn' ? foundEntry.timeIn || '' : foundEntry.timeOut || ''}
                                        column={column}
                                        rowData={foundEntry}
                                        onClick={(event) => event.stopPropagation()}
                                        onSave={async (value, rowData) => {
                                          const updatedEntry = { ...foundEntry, [column.key]: value };
                                          await attendanceModel.saveOrUpdateAttendances(
                                            [updatedEntry],
                                            storedMonthInt,
                                            year,
                                            selectedEmployeeId!
                                          );
                                          const updatedAttendanceData = await attendanceModel.loadAttendancesById(storedMonthInt, year, selectedEmployeeId!);
                                          setTimesheetEntries(updatedAttendanceData); 
                                        }}
                                        employmentTypes={employmentTypes}
                                      />
                                    ) : column.key === 'timeIn' ? (
                                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                            checked={!!(foundEntry.timeIn || foundEntry.timeOut)}
                                            onChange={async (e) => {
                                              e.stopPropagation();
                                              const isPresent = e.target.checked;
                                              
                                              // For non-time-tracking employees, we only store a marker for presence
                                              const updatedEntry = { 
                                                ...foundEntry, 
                                                timeIn: isPresent ? 'present' : '',
                                                timeOut: isPresent ? 'present' : ''
                                              };
                                              
                                              // Save the attendance record
                                              await attendanceModel.saveOrUpdateAttendances(
                                                [updatedEntry],
                                                storedMonthInt,
                                                year,
                                                selectedEmployeeId!
                                              );
                                              
                                              // Create or update compensation record with manualOverride
                                              const existingCompensation = compensationEntries.find(c => c.day === foundEntry.day);
                                              const compensation: Compensation = {
                                                ...(existingCompensation || {}),
                                                employeeId: selectedEmployeeId!,
                                                month: storedMonthInt,
                                                year: year,
                                                day: foundEntry.day,
                                                manualOverride: true,
                                                dailyRate: employee?.dailyRate || 0,
                                                grossPay: isPresent ? (employee?.dailyRate || 0) : 0,
                                                netPay: isPresent ? (employee?.dailyRate || 0) : 0,
                                                dayType: 'Regular' as DayType
                                              };
                                              
                                              await compensationModel.saveOrUpdateCompensations(
                                                [compensation],
                                                storedMonthInt,
                                                year,
                                                selectedEmployeeId!
                                              );
                                              
                                              // Reload data
                                              const [updatedAttendanceData, updatedCompensationData] = await Promise.all([
                                                attendanceModel.loadAttendancesById(
                                                  storedMonthInt,
                                                  year,
                                                  selectedEmployeeId!
                                                ),
                                                compensationModel.loadRecords(
                                                  storedMonthInt,
                                                  year,
                                                  selectedEmployeeId!
                                                )
                                              ]);
                                              
                                              setTimesheetEntries(updatedAttendanceData);
                                              setCompensationEntries(updatedCompensationData);
                                            }}
                                          />
                                          <span className="ml-2 text-sm font-medium text-gray-700" onClick={(e) => e.stopPropagation()}>
                                            {!!(foundEntry.timeIn || foundEntry.timeOut) ? 'Present' : 'Absent'}
                                          </span>
                                        </div>
                                      </td>
                                    ) : null
                                  ) : (
                                    <td
                                      key={column.key}
                                      className={`${
                                        column.key === 'day'
                                          ? 'sticky left-0 z-10 bg-white'
                                          : ''
                                      } px-6 py-4 whitespace-nowrap text-sm ${
                                        column.key === 'day' ? 'font-medium text-gray-900' : 'text-gray-500'
                                      }`}
                                    >
                                      {column.key === 'day' && (
                                        <div className="flex flex-col items-center">
                                          <span>{day}</span>
                                          <span className="text-sm text-gray-500">
                                            {new Date(year, storedMonthInt - 1, day).toLocaleDateString('en-US', { weekday: 'short' })}
                                          </span>
                                        </div>
                                      )}
                                      {column.key === 'dayType' && (new Date(year, storedMonthInt - 1, day).toLocaleDateString('en-US', { weekday: 'short' }) === 'Sun' ? 'Sunday' : compensation?.dayType || '-')}
                                      {column.key === 'hoursWorked' && (compensation?.hoursWorked || '-')}
                                      {column.key === 'overtimeMinutes' && (compensation?.overtimeMinutes || '-')}
                                      {column.key === 'overtimePay' && (compensation?.overtimePay || '-')}
                                      {column.key === 'undertimeMinutes' && (compensation?.undertimeMinutes || '-')}
                                      {column.key === 'undertimeDeduction' && (compensation?.undertimeDeduction || '-')}
                                      {column.key === 'lateMinutes' && (compensation?.lateMinutes || '-')}
                                      {column.key === 'lateDeduction' && (compensation?.lateDeduction || '-')}
                                      {column.key === 'holidayBonus' && (Math.round((compensation?.holidayBonus || 0) * 100) / 100 || '-')}
                                      {column.key === 'leaveType' && (compensation?.leaveType || '-')}
                                      {column.key === 'leavePay' && (compensation?.leavePay || '-')}
                                      {column.key === 'grossPay' && (compensation?.grossPay || '-')}
                                      {column.key === 'deductions' && (compensation?.deductions || '-')}
                                      {column.key === 'netPay' && (compensation?.netPay || '-')}
                                    </td>
                                  )
                                )
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="mb-6">
                    <svg
                      className="mx-auto h-24 w-24 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">No Employee Selected</h3>
                  <p className="mt-2 text-sm text-gray-500">Please select an employee from the dropdown menu to view their timesheet.</p>
                  <div className="mt-6">
                    <AddButton
                      text="Select Employee"
                      onClick={() => handleLinkClick("/")}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </MagicCard>
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black opacity-50 z-40" />
      )}
      {selectedEntry && (
        <CompensationDialog
          employee={employee}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedEntry(null);
            setClickPosition(null);
          }}
          onSave={handleSaveCompensation}
          compensation={selectedEntry.compensation}
          month={storedMonthInt}
          year={year}
          day={selectedEntry.entry.day}
          timeIn={selectedEntry.entry.timeIn || undefined}
          timeOut={selectedEntry.entry.timeOut || undefined}
          position={clickPosition}
        />
      )}
    </main></RootLayout>
  );
};

<style jsx global>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(75, 85, 99, 0.1);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(75, 85, 99, 0.5);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(75, 85, 99, 0.7);
  }
`}</style>

export default TimesheetPage;
