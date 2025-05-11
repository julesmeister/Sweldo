"use client";
import React from "react";
import { IoWalletOutline } from "react-icons/io5";
import { DailyRateHistory } from "../../model/statistics"; // Adjusted path

// Timeline component for daily rate changes
const Timeline = ({
    data,
}: {
    data: (DailyRateHistory & { groupKey: string; displayName: string })[];
}) => {
    // Group data by the consistent 'groupKey'
    const employeeGroups = data.reduce((groups, item) => {
        const key = item.groupKey; // Use the new groupKey
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {} as Record<string, typeof data>);

    // If no data, show a message
    if (data.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Daily Rate History
                </h3>
                <div className="flex flex-col items-center justify-center py-12 px-4">
                    <div className="bg-blue-50 p-4 rounded-full mb-4">
                        <IoWalletOutline className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                        No Daily Rate History
                    </p>
                    <p className="text-gray-500 text-center max-w-md">
                        There are no daily rate changes recorded for this year. Daily rate
                        changes will appear here when they are added.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Daily Rate History
            </h3>

            {Object.entries(employeeGroups).map(([groupKey, historyItems]) => {
                // Sort history by date in descending order (most recent first)
                const sortedHistory = [...historyItems].sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );

                // Display name should come from the first item in the sorted history
                const employeeDisplayName = sortedHistory[0]?.displayName || groupKey;

                return (
                    <div key={groupKey} className="mb-8 last:mb-0">
                        <h4 className="text-md font-medium text-gray-700 mb-4">
                            {employeeDisplayName}
                        </h4>
                        <div className="overflow-x-auto">
                            <div className="relative flex items-start min-w-max">
                                {sortedHistory.map((item, index) => (
                                    <div key={index} className="flex-none mr-8 last:mr-0">
                                        <div className="flex items-center">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                                                <IoWalletOutline className="w-4 h-4" />
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-sm font-medium text-gray-900">
                                                    ₱{item.rate.toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(item.date).toLocaleDateString("en-PH", {
                                                        year: "numeric",
                                                        month: "long",
                                                        day: "numeric",
                                                    })}
                                                </p>
                                            </div>
                                            {index < sortedHistory.length - 1 && (
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

export default Timeline; 