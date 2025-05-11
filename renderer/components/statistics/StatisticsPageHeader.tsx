"use client";
import React from "react";
import { IoRefreshOutline } from "react-icons/io5";
import { MdOutlineDataset } from "react-icons/md";
import DecryptedText from "../../styles/DecryptedText/DecryptedText"; // Adjusted path
import YearPickerDropdown from "../YearPickerDropdown"; // Adjusted path

interface StatisticsPageHeaderProps {
    isLoading: boolean;
    onRefresh: () => void;
    selectedYear: number;
    onSelectYear: (year: number) => void;
    years: number[];
}

const StatisticsPageHeader: React.FC<StatisticsPageHeaderProps> = ({ isLoading, onRefresh, selectedYear, onSelectYear, years }) => {
    return (
        <div className="border-b border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50">
                <div className="flex items-center gap-2">
                    <MdOutlineDataset className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-gray-900">
                        <DecryptedText text="Payroll Statistics" animateOn="view" revealDirection='start' speed={50} sequential={true} />
                    </h2>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onRefresh}
                        className="flex items-center justify-between cursor-pointer border border-gray-300 rounded-full pl-3 pr-1.5 py-1 bg-white hover:bg-gray-50 transition-colors shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-auto"
                        title="Refresh statistics data"
                        disabled={isLoading}
                    >
                        <span className="text-gray-700 font-medium mr-1.5">Refresh</span>
                        <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded-full">
                            <IoRefreshOutline
                                className={`w-3 h-3 text-white ${isLoading ? "animate-spin" : ""}`}
                            />
                        </div>
                    </button>
                    <YearPickerDropdown
                        selectedYear={selectedYear}
                        onSelectYear={onSelectYear}
                        years={years}
                        className="w-20"
                    />
                </div>
            </div>
        </div>
    );
};

export default StatisticsPageHeader; 