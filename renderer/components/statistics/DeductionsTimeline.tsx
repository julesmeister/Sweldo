"use client";
import React from "react";
import { IoWalletOutline } from "react-icons/io5";

const DeductionsTimeline = ({
    data,
}: {
    data: {
        type: string;
        changes: { date: string; amount: number; employee: string }[];
    }[];
}) => {
    if (data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Deductions History
                </h3>
                <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="bg-blue-50 p-4 rounded-full mb-4">
                        <IoWalletOutline className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                        No Deductions History
                    </p>
                    <p className="text-gray-500 text-center max-w-md mb-4">
                        There are no deductions recorded for this year. Deduction changes
                        will appear here when they are added.
                    </p>

                    <div className="bg-gray-50 rounded-lg p-4 w-full max-w-md">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Common Deduction Types:
                        </h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                            <li className="flex items-start">
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                                <span>
                                    <span className="font-medium">SSS</span> - Social Security
                                    System contributions
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                                <span>
                                    <span className="font-medium">PhilHealth</span> - Philippine
                                    Health Insurance Corporation
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                                <span>
                                    <span className="font-medium">Pag-IBIG</span> - Home
                                    Development Mutual Fund
                                </span>
                            </li>
                            <li className="flex items-start">
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                                <span>
                                    <span className="font-medium">Withholding Tax</span> - Income
                                    tax deductions
                                </span>
                            </li>
                        </ul>

                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                                Deduction rates typically update annually or when government
                                policies change. The system will automatically track these
                                changes when they are recorded.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Deductions History
            </h3>

            {data.map((deduction) => {
                // Sort changes by date in descending order (most recent first)
                const sortedChanges = [...deduction.changes].sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                return (
                    <div key={deduction.type} className="mb-8 last:mb-0">
                        <h4 className="text-md font-medium text-gray-700 mb-4">
                            {deduction.type}
                        </h4>
                        <div className="overflow-x-auto">
                            <div className="relative flex items-start min-w-max">
                                {sortedChanges.map((change, index) => (
                                    <div key={index} className="flex-none mr-8 last:mr-0">
                                        <div className="flex items-center">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                                                <IoWalletOutline className="w-4 h-4" />
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm font-medium text-gray-900">
                                                    ₱{change.amount.toLocaleString()}
                                                </p>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(change.date).toLocaleDateString("en-PH", {
                                                            year: "numeric",
                                                            month: "long",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </p>
                                                    <p className="text-xs text-gray-600 italic">
                                                        Updated {change.employee || "Unknown"}
                                                    </p>
                                                </div>
                                            </div>
                                            {index < sortedChanges.length - 1 && (
                                                <div className="h-0.5 bg-gray-200 w-8 ml-3"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DeductionsTimeline; 