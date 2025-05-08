import React from "react";
import AddButton from "@/renderer/components/magicui/add-button";

interface EmptyTimesheetProps {
    onSelectEmployee: () => void;
    hasSelectedEmployee: boolean;
}

/**
 * Component displayed when there's no timesheet data to show
 */
export const EmptyTimesheet: React.FC<EmptyTimesheetProps> = ({
    onSelectEmployee,
    hasSelectedEmployee
}) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="mb-6">
                <svg
                    className="mx-auto h-24 w-24 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                </svg>
            </div>
            <h3 className="mt-2 text-xl font-semibold text-gray-900">
                {hasSelectedEmployee ? "No Timesheet Data" : "No Employee Selected"}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
                {hasSelectedEmployee
                    ? "There are no timesheet entries for this employee in the selected period."
                    : "Please select an employee from the dropdown menu to view their timesheet."}
            </p>
            {!hasSelectedEmployee && (
                <div className="mt-6">
                    <AddButton
                        text="Select Employee"
                        onClick={onSelectEmployee}
                    />
                </div>
            )}
        </div>
    );
};

export default EmptyTimesheet; 