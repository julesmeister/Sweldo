import React, { useState } from 'react';
import { IoInformationCircle, IoPrintOutline } from 'react-icons/io5';

interface PDFExportButtonsProps {
    potentialPayrollCount: number;
    generatePayslipsForAll: () => void;
    generateSummaryForAll: () => void;
    isGeneratingPDF: boolean;
    dateRangeText: string;
}

export const PDFExportButtons: React.FC<PDFExportButtonsProps> = ({
    potentialPayrollCount,
    generatePayslipsForAll,
    generateSummaryForAll,
    isGeneratingPDF,
    dateRangeText
}) => {
    const [showPayslipsTooltip, setShowPayslipsTooltip] = useState(false);
    const [showSummaryTooltip, setShowSummaryTooltip] = useState(false);

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
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
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                        </svg>
                        <span className="text-[13px] font-medium text-gray-600">
                            Employee Data
                        </span>
                    </div>
                    <span className="text-[11px] text-gray-500">
                        {potentialPayrollCount} Employees {dateRangeText}
                    </span>
                </div>
            </div>
            <div className="flex gap-4">
                <button
                    onClick={generatePayslipsForAll}
                    disabled={isGeneratingPDF}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 relative"
                    onMouseEnter={() => setShowPayslipsTooltip(true)}
                    onMouseLeave={() => setShowPayslipsTooltip(false)}
                    style={{
                        height: "38px",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 16px",
                    }}
                >
                    <span className="flex items-center gap-2">
                        Generate Payslips PDF
                        {potentialPayrollCount > 0 && (
                            <span className="bg-green-400 text-white text-xs font-medium rounded px-1.5 py-0.5">
                                {potentialPayrollCount}
                            </span>
                        )}
                    </span>

                    {/* Payslips Tooltip */}
                    {showPayslipsTooltip && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 w-[340px]">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100/20 p-4 relative">
                                {/* Arrow pointing up */}
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                                    <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
                                </div>

                                <div className="space-y-3 text-left">
                                    <div className="flex items-start gap-2.5">
                                        <IoPrintOutline className="w-[18px] h-[18px] text-green-600 flex-shrink-0 mt-0.5" />
                                        <h4 className="text-[15px] font-semibold text-gray-900">
                                            Printing Requirements
                                        </h4>
                                    </div>
                                    <div className="space-y-2.5 ml-[26px]">
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                            <p className="text-[13px] text-gray-600 leading-normal">
                                                Use{" "}
                                                <span className="font-medium text-gray-900">
                                                    long bond paper (8.5" × 13")
                                                </span>{" "}
                                                for optimal printing results
                                            </p>
                                        </div>
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                            <p className="text-[13px] text-gray-600 leading-normal">
                                                Each payslip is specifically formatted for
                                                this paper size
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </button>

                <button
                    onClick={generateSummaryForAll}
                    disabled={isGeneratingPDF}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2 relative"
                    onMouseEnter={() => setShowSummaryTooltip(true)}
                    onMouseLeave={() => setShowSummaryTooltip(false)}
                    style={{
                        height: "38px",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 16px",
                    }}
                >
                    <span className="flex items-center gap-2">
                        Generate Summary PDF
                        {potentialPayrollCount > 0 && (
                            <span className="bg-blue-400 text-white text-xs font-medium rounded px-1.5 py-0.5">
                                {potentialPayrollCount}
                            </span>
                        )}
                    </span>

                    {/* Summary Tooltip */}
                    {showSummaryTooltip && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 w-[340px]">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100/20 p-4 relative">
                                {/* Arrow pointing up */}
                                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                                    <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
                                </div>

                                <div className="space-y-3 text-left">
                                    <div className="flex items-start gap-2.5">
                                        <IoInformationCircle className="w-[18px] h-[18px] text-blue-600 flex-shrink-0 mt-0.5" />
                                        <h4 className="text-[15px] font-semibold text-gray-900">
                                            Payroll Summary Information
                                        </h4>
                                    </div>
                                    <div className="space-y-2.5 ml-[26px]">
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                            <p className="text-[13px] text-gray-600 leading-normal">
                                                Only includes employees with{" "}
                                                <span className="font-medium text-gray-900">
                                                    existing payroll records
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
                                            <p className="text-[13px] text-gray-600 leading-normal">
                                                Employees without payroll data will not
                                                appear in the summary
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}; 