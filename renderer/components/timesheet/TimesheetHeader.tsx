import React, { useState, useMemo } from "react";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import { DateRangePickerProxy } from "@/renderer/components/DateRangePickerProxy";
import { Employee } from "@/renderer/model/employee";
import { IoSettingsOutline } from "react-icons/io5";
import { IoStatsChart } from "react-icons/io5";
import DecryptedText from "@/renderer/styles/DecryptedText/DecryptedText";
import { Compensation } from "@/renderer/model/compensation";
import { Attendance } from "@/renderer/model/attendance";
import { useDateRangeStore } from "@/renderer/stores/dateRangeStore";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface TimesheetHeaderProps {
    employeeId: string | null;
    onSelectEmployee: (id: string) => void;
    employees: Employee[];
    validEntriesCount: number;
    onRefresh: () => void;
    onColumnSettings: () => void;
    hasPayrollAccess: boolean;
    onRecompute: () => void;
    entries: Attendance[];
    compensations: Compensation[];
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
    onRecompute,
    entries,
    compensations
}) => {
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const { dateRange } = useDateRangeStore();

    // Calculate total net, gross pay, and deductions only for days that have entries (filtered by date range)
    const { totalNetPay, totalGrossPay, totalDeductions } = useMemo(() => {
        if (!dateRange?.startDate || !dateRange?.endDate) {
            const allNetPay = compensations.reduce((total, comp) => total + (comp.netPay || 0), 0);
            const allGrossPay = compensations.reduce((total, comp) => total + (comp.grossPay || 0), 0);
            return {
                totalNetPay: allNetPay,
                totalGrossPay: allGrossPay,
                totalDeductions: allGrossPay - allNetPay
            };
        }

        // Adjust startDate by subtracting one day to match the filtering in timesheet.tsx
        const adjustedStartDate = new Date(dateRange.startDate);
        adjustedStartDate.setDate(adjustedStartDate.getDate() - 1);
        const startDateMs = adjustedStartDate.getTime();
        const endDateMs = new Date(dateRange.endDate).getTime();

        // Get unique days from filtered entries
        const entryDays = new Set(entries.map(entry => entry.day));

        // Filter compensations by date range and entry days
        const filteredCompensations = compensations.filter(comp => {
            if (!comp.day || !comp.month || !comp.year) return false;
            const compDate = new Date(comp.year, comp.month - 1, comp.day).getTime();
            return compDate >= startDateMs &&
                compDate <= endDateMs &&
                entryDays.has(comp.day);
        });

        const netPay = filteredCompensations.reduce((total, comp) => total + (comp.netPay || 0), 0);
        const grossPay = filteredCompensations.reduce((total, comp) => total + (comp.grossPay || 0), 0);

        return {
            totalNetPay: netPay,
            totalGrossPay: grossPay,
            totalDeductions: grossPay - netPay
        };
    }, [entries, compensations, dateRange]);

    // Chart data
    const chartData = {
        labels: ['Gross Pay', 'Deductions', 'Net Pay'],
        datasets: [
            {
                data: [totalGrossPay, totalDeductions, totalNetPay],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.5)', // Blue for gross
                    'rgba(239, 68, 68, 0.5)',  // Red for deductions
                    'rgba(16, 185, 129, 0.5)'  // Green for net
                ],
                borderColor: [
                    'rgb(59, 130, 246)',
                    'rgb(239, 68, 68)',
                    'rgb(16, 185, 129)'
                ],
                borderWidth: 1,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        return `₱${context.raw.toLocaleString()}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value: any) {
                        return '₱' + value.toLocaleString();
                    }
                }
            }
        },
        maintainAspectRatio: false,
    };

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
                        <DecryptedText text="Timesheet" animateOn="view" revealDirection='start' speed={50} sequential={true} />
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
                    <div className="flex items-center gap-2">
                        {/* Compact Summary with Hover Dropdown */}
                        <div
                            className="relative"
                            onMouseEnter={() => setShowSummary(true)}
                            onMouseLeave={() => setShowSummary(false)}
                        >
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm text-gray-600 transition-colors duration-150">
                                <IoStatsChart className="h-4 w-4" />
                                <span>₱{totalNetPay.toLocaleString()}</span>
                            </button>

                            {/* Dropdown Summary */}
                            {showSummary && (
                                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                                    <div className="p-4">
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">Payment Summary</h3>

                                        {/* Bar Chart */}
                                        <div className="h-40 mb-4">
                                            <Bar data={chartData} options={chartOptions} />
                                        </div>

                                        {/* Detailed Summary */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Total Gross Pay:</span>
                                                <span className="text-sm font-medium text-gray-900">₱{totalGrossPay.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Total Deductions:</span>
                                                <span className="text-sm font-medium text-red-600">-₱{totalDeductions.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                                                <span className="text-sm font-medium text-gray-900">Total Net Pay:</span>
                                                <span className="text-sm font-medium text-gray-900">₱{totalNetPay.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="text-sm text-gray-600">Total Absences:</span>
                                                <span className="text-sm font-medium text-gray-900">{validEntriesCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        {hasPayrollAccess && (
                            <button
                                type="button"
                                className="p-1.5 rounded-md bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150"
                                onClick={onRecompute}
                            >
                                <span className="sr-only">Recompute Compensations</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 transition-transform duration-300"
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
                            className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onClick={onColumnSettings}
                        >
                            <span className="sr-only">Column Settings</span>
                            <IoSettingsOutline
                                className="h-4 w-4"
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