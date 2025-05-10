import React, { useState } from "react";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import { DateRangePickerProxy } from "@/renderer/components/DateRangePickerProxy";
import { Employee } from "@/renderer/model/employee";
import { IoSettingsOutline } from "react-icons/io5";
import DecryptedText from "@/renderer/styles/DecryptedText/DecryptedText";

interface TimesheetHeaderProps {
    employeeId: string | null;
    onSelectEmployee: (id: string) => void;
    employees: Employee[];
    validEntriesCount: number;
    onRefresh: () => void;
    onColumnSettings: () => void;
    hasPayrollAccess: boolean;
    onRecompute: () => void;
}

/**
 * Header component for timesheet page
 */
export const TimesheetHeader: React.FC<TimesheetHeaderProps> = ({
    employeeId,
    onSelectEmployee,
    employees,
    validEntriesCount,
    onRefresh,
    onColumnSettings,
    hasPayrollAccess,
    onRecompute
}) => {
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    return (
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
            <div className="flex items-center space-x-4 flex-1">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                    {employeeId ? (
                        <EmployeeDropdown
                            employees={employees}
                            selectedEmployeeId={employeeId}
                            onSelectEmployee={onSelectEmployee}
                            labelPrefix="Timesheet"
                        />
                    ) : (
                        <DecryptedText text="Timesheet" animateOn="view" revealDirection='start' speed={50} sequential={true}/>
                    )}
                </h2>
                {employeeId && (
                    <div style={{ width: "350px" }}>
                        <DateRangePickerProxy
                            variant="timesheet"
                            onRefresh={onRefresh}
                        />
                    </div>
                )}
            </div>
            {employeeId && (
                <div className="relative flex items-center space-x-4">
                    <div className="flex items-center px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-600">
                        <span>Absences:</span>
                        <span className="ml-1.5 font-semibold text-gray-900">
                            {validEntriesCount}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasPayrollAccess && (
                            <button
                                type="button"
                                className="mr-1 p-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150"
                                onClick={onRecompute}
                            >
                                <span className="sr-only">Recompute Compensations</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 transition-transform duration-300"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        )}
                        <button
                            type="button"
                            className="p-1 rounded-md bg-gray-100 text-gray-600 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onClick={onColumnSettings}
                        >
                            <span className="sr-only">Column Settings</span>
                            <IoSettingsOutline
                                className="h-5 w-5"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimesheetHeader; 