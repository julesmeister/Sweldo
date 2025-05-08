"use client";

import React, { useState, useEffect } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { useTimesheetData } from "@/renderer/hooks/timesheet/useTimesheetData";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";

/**
 * Simple test component to verify the refactored timesheet data loading
 */
const TimesheetDataTest: React.FC = () => {
    const { dbPath, companyName } = useSettingsStore();
    const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Add debug logs to check store values
    console.log("TimesheetDataTest - Initial render:", {
        dbPath,
        companyName,
        selectedEmployeeId,
        isLoading,
        isWebMode: isWebEnvironment()
    });

    // Load employee data
    useEffect(() => {
        const loadEmployees = async () => {
            console.log("TimesheetDataTest - loadEmployees effect triggered:", {
                dbPath,
                companyName,
                isWebMode: isWebEnvironment()
            });

            // In web mode, we use companyName instead of dbPath
            const isWeb = isWebEnvironment();

            if (isWeb) {
                if (!companyName) {
                    console.log("TimesheetDataTest - companyName not available for web mode, skipping employee loading");
                    return;
                }

                try {
                    setIsLoading(true);
                    console.log("TimesheetDataTest - Loading employees from Firestore for company:", companyName);
                    const loadedEmployees = await loadActiveEmployeesFirestore(companyName);
                    console.log(`TimesheetDataTest - Loaded ${loadedEmployees.length} employees from Firestore:`, loadedEmployees);
                    setEmployees(loadedEmployees);

                    if (loadedEmployees.length > 0 && !selectedEmployeeId) {
                        console.log("TimesheetDataTest - Auto-selecting first employee:", loadedEmployees[0].id);
                        setSelectedEmployeeId(loadedEmployees[0].id);
                    }
                } catch (error) {
                    console.error("TimesheetDataTest - Error loading employees from Firestore:", error);
                    toast.error("Failed to load employees from Firestore");
                } finally {
                    setIsLoading(false);
                    console.log("TimesheetDataTest - Firestore employees loading finished, isLoading set to false");
                }
            } else {
                // Desktop mode - use dbPath
                if (!dbPath) {
                    console.log("TimesheetDataTest - dbPath not available for desktop mode, skipping employee loading");
                    return;
                }

                try {
                    setIsLoading(true);
                    console.log("TimesheetDataTest - Loading employees from local DB:", dbPath);
                    const employeeModel = createEmployeeModel(dbPath);
                    const loadedEmployees = await employeeModel.loadActiveEmployees();
                    console.log(`TimesheetDataTest - Loaded ${loadedEmployees.length} employees:`, loadedEmployees);
                    setEmployees(loadedEmployees);

                    if (loadedEmployees.length > 0 && !selectedEmployeeId) {
                        console.log("TimesheetDataTest - Auto-selecting first employee:", loadedEmployees[0].id);
                        setSelectedEmployeeId(loadedEmployees[0].id);
                    }
                } catch (error) {
                    console.error("TimesheetDataTest - Error loading employees from local DB:", error);
                    toast.error("Failed to load employees from local database");
                } finally {
                    setIsLoading(false);
                    console.log("TimesheetDataTest - Local DB employees loading finished, isLoading set to false");
                }
            }
        };

        loadEmployees();
    }, [dbPath, companyName, selectedEmployeeId, setSelectedEmployeeId]);

    // Load selected employee
    useEffect(() => {
        const loadEmployee = async () => {
            if (!selectedEmployeeId) return;

            const isWeb = isWebEnvironment();

            if (isWeb) {
                if (!companyName) return;

                // In web mode, we already have all employees loaded, so just find the selected one
                const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
                console.log("TimesheetDataTest - Found employee in already loaded employees:", selectedEmployee?.name);
                setEmployee(selectedEmployee || null);
            } else {
                // Desktop mode
                if (!dbPath) return;

                try {
                    console.log("TimesheetDataTest - Loading employee by ID from local DB:", selectedEmployeeId);
                    const employeeModel = createEmployeeModel(dbPath);
                    const loadedEmployee = await employeeModel.loadEmployeeById(selectedEmployeeId);
                    setEmployee(loadedEmployee);
                    console.log("TimesheetDataTest - Loaded employee:", loadedEmployee?.name);
                } catch (error) {
                    console.error("TimesheetDataTest - Error loading employee from local DB:", error);
                    toast.error("Failed to load employee details from local database");
                }
            }
        };

        loadEmployee();
    }, [dbPath, companyName, selectedEmployeeId, employees]);

    // Use our refactored hook to load timesheet data
    const {
        timesheetEntries,
        compensationEntries,
        validEntriesCount,
        refreshData,
        isLoading: isTimesheetLoading,
    } = useTimesheetData({
        dbPath,
        companyName,
        employeeId: selectedEmployeeId,
        employee,
        year,
        month,
    });

    // Handler for employee selection
    const handleEmployeeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedEmployeeId(event.target.value);
    };

    // Handler for month selection
    const handleMonthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setMonth(parseInt(event.target.value));
    };

    // Handler for year selection
    const handleYearChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setYear(parseInt(event.target.value));
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Timesheet Data Test</h1>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <p className="text-yellow-800">
                    This is a test page for the refactored timesheet components. Check the console for detailed logs.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Employee
                    </label>
                    <select
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={selectedEmployeeId || ""}
                        onChange={handleEmployeeChange}
                        disabled={isLoading}
                    >
                        <option value="">Select an employee</option>
                        {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                                {emp.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Month
                    </label>
                    <select
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={month}
                        onChange={handleMonthChange}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                                {new Date(2000, m - 1, 1).toLocaleString("default", {
                                    month: "long",
                                })}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Year
                    </label>
                    <select
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={year}
                        onChange={handleYearChange}
                    >
                        {Array.from(
                            { length: 5 },
                            (_, i) => new Date().getFullYear() - 2 + i
                        ).map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mb-6">
                <button
                    onClick={() => refreshData()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    disabled={isTimesheetLoading || !selectedEmployeeId}
                >
                    {isTimesheetLoading ? "Loading..." : "Refresh Data"}
                </button>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Data Summary</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Settings</h3>
                        <p className="font-mono text-xs break-all">
                            DB Path: {dbPath || "Not set"}
                        </p>
                        <p className="font-mono text-xs break-all">
                            Company: {companyName || "Not set"}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Timesheet Entries
                        </h3>
                        <p className="text-2xl font-bold">
                            {isTimesheetLoading ? "..." : timesheetEntries.length}
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Compensation Entries
                        </h3>
                        <p className="text-2xl font-bold">
                            {isTimesheetLoading ? "..." : compensationEntries.length}
                        </p>
                    </div>
                </div>

                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                    Day
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                    Time In
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                    Time Out
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                    Day Type
                                </th>
                                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                    Hours Worked
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {isTimesheetLoading ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-sm text-gray-500">
                                        Loading data...
                                    </td>
                                </tr>
                            ) : timesheetEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-sm text-gray-500">
                                        No records found
                                    </td>
                                </tr>
                            ) : (
                                timesheetEntries.map((entry) => {
                                    const compensation = compensationEntries.find(
                                        (comp) => comp.day === entry.day
                                    );
                                    return (
                                        <tr key={entry.day}>
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                {entry.day}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {entry.timeIn || "-"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {entry.timeOut || "-"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {compensation?.dayType || "-"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                {compensation?.hoursWorked || "-"}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6 bg-gray-100 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Info</h3>
                <pre className="text-xs overflow-auto max-h-40 bg-gray-800 text-gray-200 p-3 rounded">
                    {JSON.stringify(
                        {
                            dbPath,
                            companyName,
                            isWebMode: isWebEnvironment(),
                            selectedEmployeeId,
                            employee: employee
                                ? { id: employee.id, name: employee.name }
                                : null,
                            year,
                            month,
                            timesheetCount: timesheetEntries.length,
                            compensationCount: compensationEntries.length,
                        },
                        null,
                        2
                    )}
                </pre>
            </div>
        </div>
    );
};

export default TimesheetDataTest;
