"use client";

import React from "react";
import AddButton from "./magicui/add-button";
import { useDateSelectorStore } from "./DateSelector";
import DecryptedText from "../styles/DecryptedText/DecryptedText";

interface NoDataPlaceholderProps {
    employeeName?: string | null;
    dataType: string;
    actionText: string;
    onActionClick: () => void;
    onSelectEmployeeClick: () => void;
}

const NoDataPlaceholder: React.FC<NoDataPlaceholderProps> = ({
    employeeName,
    dataType,
    actionText,
    onActionClick,
    onSelectEmployeeClick,
}) => {
    const { selectedMonth, selectedYear } = useDateSelectorStore.getState();

    if (!employeeName) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="relative w-28 h-28 mx-auto mb-8">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute aspect-square w-[14rem] rounded-full border-2 border-blue-400 opacity-0 animate-ping-slow-1"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute aspect-square w-[21rem] rounded-full border-2 border-blue-300 opacity-0 animate-ping-slow-2"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute aspect-square w-[28rem] rounded-full border border-blue-200 opacity-0 animate-ping-slow-3"></div>
                    </div>

                    <div className="relative z-10 bg-white bg-opacity-70 rounded-full p-4 border border-gray-100 flex items-center justify-center w-28 h-28">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-full opacity-50"></div>

                        <svg
                            className="h-16 w-16 text-blue-500 relative z-10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3 text-center">
                    <DecryptedText text="No Employee Selected" animateOn="view" revealDirection='start' speed={50} sequential={true} />
                </h3>
                <p className="max-w-md text-center text-gray-500 mb-8 leading-relaxed">
                    Please select an employee from the dropdown menu to view their {dataType}.
                </p>
                <div className="transform hover:scale-105 transition-transform duration-300">
                    <AddButton text="Select Employee" onClick={onSelectEmployeeClick} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="text-center max-w-lg">
                <div className="relative w-24 h-24 mx-auto mb-8">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute aspect-square w-[8rem] rounded-full border-2 border-blue-400 opacity-0 animate-ping-slow-1"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute aspect-square w-[12rem] rounded-full border-2 border-blue-300 opacity-0 animate-ping-slow-2"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute aspect-square w-[16rem] rounded-full border border-blue-200 opacity-0 animate-ping-slow-3"></div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-full opacity-50"></div>
                    <div className="relative z-10 bg-white bg-opacity-70 rounded-full p-4 border border-gray-100 flex items-center justify-center w-full h-full">
                        <svg
                            className="h-16 w-16 text-blue-500 mx-auto"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    <DecryptedText text={`No ${dataType} found`} animateOn="view" revealDirection='start' speed={50} sequential={true} />
                </h3>

                <div className="inline-flex items-center justify-center space-x-1 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full mb-4">
                    <span className="text-sm font-medium text-blue-700">
                        {employeeName}
                    </span>
                    <span className="text-xs text-blue-500">•</span>
                    <span className="text-sm font-medium text-blue-600">
                        {new Date(selectedYear, selectedMonth, 1).toLocaleString(
                            "default",
                            { month: "long", year: "numeric" }
                        )}
                    </span>
                </div>

                <p className="text-gray-500 mb-6">
                    Get started by clicking the <span className="font-medium text-blue-600">"{actionText}"</span> button.
                </p>

                <div className="transform hover:scale-105 transition-transform duration-300">
                    <AddButton text={actionText} onClick={onActionClick} />
                </div>

            </div>
        </div>
    );
};

export default NoDataPlaceholder; 