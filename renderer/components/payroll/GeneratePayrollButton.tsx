import React, { useState } from 'react';
import { IoInformationCircle } from 'react-icons/io5';

interface GeneratePayrollButtonProps {
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    disabled: boolean;
}

export const GeneratePayrollButton: React.FC<GeneratePayrollButtonProps> = ({
    onClick,
    disabled
}) => {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-9 relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
            </svg>
            Generate Payroll

            {showTooltip && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50 w-[380px]">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100/20 p-4 relative">
                        {/* Arrow pointing up */}
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-white"></div>
                        </div>

                        {/* Tooltip content */}
                        <div className="space-y-3 text-left">
                            <div className="flex items-start gap-2.5">
                                <IoInformationCircle className="w-[18px] h-[18px] text-blue-600 flex-shrink-0 mt-0.5" />
                                <h4 className="text-[15px] font-semibold text-gray-900">
                                    Payroll Generation Details
                                </h4>
                            </div>

                            {/* Information items */}
                            <div className="space-y-2.5 ml-[26px]">
                                <TooltipItem
                                    text="Summarizes all"
                                    highlights={["attendances", "compensations", "deductions"]}
                                    suffix="within the selected date range"
                                />

                                <TooltipItem
                                    text="Includes available"
                                    highlights={["cash advances", "shorts", "loans", "leaves"]}
                                />

                                <TooltipItem
                                    text="You can select and adjust which deductions to apply and their amounts in the next step"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </button>
    );
};

/**
 * Tooltip item with highlighted text
 */
const TooltipItem: React.FC<{
    text: string;
    highlights?: string[];
    suffix?: string;
}> = ({ text, highlights = [], suffix = "" }) => (
    <div className="flex gap-2.5 items-start">
        <div className="w-2 h-[2px] bg-gray-300 mt-[9px] flex-shrink-0" />
        <p className="text-[13px] text-gray-600 leading-normal">
            {text}{" "}
            {highlights.map((item, index) => (
                <React.Fragment key={index}>
                    <span className="font-medium text-gray-900">
                        {item}
                    </span>
                    {index < highlights.length - 1 && ", "}
                </React.Fragment>
            ))}
            {suffix && ` ${suffix}`}
        </p>
    </div>
); 