import React from 'react';
import { Employee } from '@/renderer/model/employee';
import { PayrollHeader } from './PayrollHeader';
import { GeneratePayrollButton } from './GeneratePayrollButton';
import { PDFExportButtons } from './PDFExportButtons';
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";

interface PayrollControlsProps {
    employees: Employee[];
    selectedEmployeeId: string | null;
    onSelectEmployee: (id: string) => void;
    handleDeductionsClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    potentialPayrollCount: number;
    generatePayslipsForAll: () => void;
    generateSummaryForAll: () => void;
    isGeneratingPDF: boolean;
    isLoading: boolean;
    hasManageAccess: boolean;
    hasReportAccess: boolean;
    dateRange: {
        startDate: Date | null;
        endDate: Date | null;
    };
    employee: Employee | null;
}

export const PayrollControls: React.FC<PayrollControlsProps> = ({
    employees,
    selectedEmployeeId,
    onSelectEmployee,
    handleDeductionsClick,
    potentialPayrollCount,
    generatePayslipsForAll,
    generateSummaryForAll,
    isGeneratingPDF,
    isLoading,
    hasManageAccess,
    hasReportAccess,
    dateRange,
    employee
}) => {
    // Format date range for display
    const dateRangeText = `From ${dateRange.startDate
        ? new Date(dateRange.startDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
        : ""
        } To ${dateRange.endDate
            ? new Date(dateRange.endDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
            : ""
        }`;

    return (
        <div className="bg-white/40 backdrop-blur-sm rounded-lg shadow-sm border border-blue-100 p-3 mb-4 relative z-20">
            <div className="flex items-center justify-between gap-4">
                {/* Date Range Picker Only */}
                <PayrollHeader
                    hasManageAccess={hasManageAccess}
                />

                <div className="flex gap-4">
                    {/* Generate Payroll Button with Employee Dropdown */}
                    {hasManageAccess && (
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                                <svg
                                    className="w-3.5 h-3.5 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                    />
                                </svg>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[13px] font-medium text-gray-600">
                                            For
                                        </span>
                                        <EmployeeDropdown
                                            employees={employees}
                                            selectedEmployeeId={selectedEmployeeId}
                                            onSelectEmployee={onSelectEmployee}
                                            displayFormat="minimal"
                                            className="text-[13px] font-medium text-blue-600"
                                        />
                                        <span className="text-[13px] font-medium text-gray-600 mr-1.5">
                                            Only
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <GeneratePayrollButton
                                onClick={handleDeductionsClick}
                                disabled={!selectedEmployeeId || isLoading}
                            />
                        </div>
                    )}

                    {/* PDF Export Buttons */}
                    {hasReportAccess && (
                        <PDFExportButtons
                            potentialPayrollCount={potentialPayrollCount}
                            generatePayslipsForAll={generatePayslipsForAll}
                            generateSummaryForAll={generateSummaryForAll}
                            isGeneratingPDF={isGeneratingPDF}
                            dateRangeText={dateRangeText}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}; 