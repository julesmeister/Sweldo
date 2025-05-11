"use client";
import React from "react";
import { IoBarChartOutline, IoPieChartOutline } from "react-icons/io5";

// Chart component (mock)
const Chart = ({
    title,
    data,
    type = "bar",
}: {
    title: string;
    data: any[];
    type?: "bar" | "pie";
}) => (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
            <div className="text-center p-4">
                <div className="text-gray-400 mb-2">
                    {type === "bar" ? (
                        <IoBarChartOutline className="w-12 h-12 mx-auto" />
                    ) : (
                        <IoPieChartOutline className="w-12 h-12 mx-auto" />
                    )}
                </div>
                <p className="text-gray-500">Chart visualization would appear here</p>
                <p className="text-xs text-gray-400 mt-2">
                    (Using data: {data.length} data points)
                </p>
            </div>
        </div>
    </div>
);

export default Chart; 