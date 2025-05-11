import React from "react";
import { Attendance } from "@/renderer/model/attendance";
import { Compensation, DayType } from "@/renderer/model/compensation";
import { EmploymentType } from "@/renderer/model/settings";
import { EditableCell } from "@/renderer/components/EditableCell";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";

interface TimesheetRowProps {
    day: number;
    foundEntry: Attendance;
    compensation: Compensation | null;
    columns: { key: string; name: string; visible: boolean }[];
    employeeTimeSettings: EmploymentType | null;
    employmentTypes: EmploymentType[];
    selectedEntry: { entry: Attendance; compensation: Compensation } | null;
    scheduleMap: Map<number, { isRestDay: boolean; hasSchedule: boolean }>;
    hasAccess: (code: string) => boolean;
    editingCellKey: string | null;
    handleTimesheetEdit: (value: string, rowData: any, columnKey: string) => Promise<void>;
    handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>, entry: Attendance) => void;
    handleStartEdit: (cellKey: string) => void;
    handleStopEdit: () => void;
    handleRowClick: (entry: Attendance, compensation: Compensation | null, event: React.MouseEvent) => void;
    handleDayCellClick: (day: number, event: React.MouseEvent) => void;
    handleSwapTimes: (rowData: any) => Promise<void>;
    year: number;
    storedMonthInt: number;
}

/**
 * Renders a single row in the timesheet
 */
export const TimesheetRow: React.FC<TimesheetRowProps> = ({
    day,
    foundEntry,
    compensation,
    columns,
    employeeTimeSettings,
    employmentTypes,
    selectedEntry,
    scheduleMap,
    hasAccess,
    editingCellKey,
    handleTimesheetEdit,
    handleCheckboxChange,
    handleStartEdit,
    handleStopEdit,
    handleRowClick,
    handleDayCellClick,
    handleSwapTimes,
    year,
    storedMonthInt,
}) => {
    // Access the dbPath from the settings store
    const { dbPath } = useSettingsStore();
    const isWeb = isWebEnvironment();

    const entryDate = new Date(year, storedMonthInt - 1, day);
    const scheduleInfo = scheduleMap.get(day);
    const hasTimeEntries = !!(foundEntry.timeIn || foundEntry.timeOut);
    const dayOfWeek = entryDate.toLocaleDateString("en-US", { weekday: "short" });
    const isSunday = dayOfWeek === "Sun";

    // Only mark as absent if there's a schedule and no time entries
    const isAbsent =
        scheduleInfo?.hasSchedule && !scheduleInfo.isRestDay && !hasTimeEntries;

    const rowClass = `cursor-pointer border-t border-b border-gray-200 ${isAbsent
        ? "bg-red-50 hover:bg-red-100"
        : scheduleInfo?.isRestDay
            ? "bg-gray-50/50 hover:bg-gray-100/50"
            : "hover:bg-gray-50"
        } ${selectedEntry?.entry.day === day ? "bg-indigo-50" : ""}`;

    // Helper function to render column content
    const renderColumnContent = (
        columnKey: string,
        entry: Attendance,
        compensation: Compensation | null
    ) => {
        // Log compensation values for debugging
        if (columnKey === "grossPay" || columnKey === "netPay" || columnKey === "deductions") {
            console.log(`[TimesheetRow] Rendering ${columnKey} for day ${entry.day}:`,
                compensation ? compensation[columnKey] : 'null');
        }

        switch (columnKey) {
            case "day":
                return (
                    <div className="flex flex-col items-center">
                        <span>{entry.day}</span>
                        <span className="text-sm text-gray-500">
                            {new Date(year, storedMonthInt - 1, entry.day).toLocaleDateString(
                                "en-US",
                                {
                                    weekday: "short",
                                }
                            )}
                        </span>
                    </div>
                );
            case "dayType":
                const scheduleInfo = scheduleMap.get(entry.day);
                if (scheduleInfo?.isRestDay) {
                    return "Day Off";
                }
                return compensation?.dayType || "Regular";
            case "hoursWorked":
                return compensation?.hoursWorked
                    ? Math.round(compensation.hoursWorked)
                    : "-";
            case "overtimeMinutes":
                return compensation?.overtimeMinutes || "-";
            case "overtimePay":
                return compensation?.overtimePay
                    ? Math.round(compensation.overtimePay)
                    : "-";
            case "undertimeMinutes":
                return compensation?.undertimeMinutes || "-";
            case "undertimeDeduction":
                return compensation?.undertimeDeduction
                    ? Math.round(compensation.undertimeDeduction)
                    : "-";
            case "lateMinutes":
                return compensation?.lateMinutes || "-";
            case "lateDeduction":
                return compensation?.lateDeduction
                    ? Math.round(compensation.lateDeduction)
                    : "-";
            case "holidayBonus":
                return compensation?.holidayBonus
                    ? Math.round(compensation.holidayBonus)
                    : "-";
            case "leaveType":
                return compensation?.leaveType || "-";
            case "leavePay":
                return compensation?.leavePay ? Math.round(compensation.leavePay) : "-";
            case "grossPay":
                return compensation?.grossPay ? Math.round(compensation.grossPay) : "-";
            case "deductions":
                return compensation?.deductions
                    ? Math.round(compensation.deductions)
                    : "-";
            case "netPay":
                return compensation?.netPay ? Math.round(compensation.netPay) : "-";
            case "nightDifferentialHours":
                return compensation?.nightDifferentialHours || "-";
            case "nightDifferentialPay":
                return compensation?.nightDifferentialPay
                    ? Math.round(compensation.nightDifferentialPay)
                    : "-";
            default:
                return "-";
        }
    };

    return (
        <tr
            key={day}
            onClick={(event) => handleRowClick(foundEntry, compensation, event)}
            className={rowClass}
        >
            {columns.map(
                (column) =>
                    column.visible &&
                    (column.key === "timeIn" || column.key === "timeOut" ? (
                        employeeTimeSettings?.requiresTimeTracking ? (
                            hasAccess("MANAGE_ATTENDANCE") ? (
                                (() => {
                                    // IIFE to calculate cellKey
                                    const cellKey = `${column.key}-${day}`;
                                    const isCurrentlyEditing = editingCellKey === cellKey;
                                    // console.log(`TimesheetRow: Rendering EditableCell ${cellKey}, isEditing=${isCurrentlyEditing}, value=${column.key === "timeIn" ? foundEntry.timeIn : foundEntry.timeOut}`);
                                    return (
                                        <EditableCell
                                            key={cellKey} // Use cellKey for React key as well
                                            value={column.key === "timeIn"
                                                ? foundEntry.timeIn || ""
                                                : foundEntry.timeOut || ""}
                                            column={column}
                                            rowData={foundEntry}
                                            isEditing={isCurrentlyEditing} // Pass isEditing state
                                            onStartEdit={() => handleStartEdit(cellKey)} // Pass start edit handler
                                            onStopEdit={handleStopEdit} // Pass stop edit handler
                                            onSave={async (value, rowData) => {
                                                await handleTimesheetEdit(
                                                    value.toString(),
                                                    rowData,
                                                    column.key
                                                );
                                                handleStopEdit(); // Stop editing on successful save
                                            }}
                                            onSwapTimes={handleSwapTimes} // Pass swap handler
                                            employmentTypes={employmentTypes}
                                            dbPath={isWeb ? "" : dbPath || ""} />
                                    );
                                })()
                            ) : (
                                <td
                                    key={column.key}
                                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                    {column.key === "timeIn"
                                        ? foundEntry.timeIn || ""
                                        : foundEntry.timeOut || ""}
                                </td>
                            )
                        ) : column.key === "timeIn" ? (
                            <td
                                key={column.key}
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                            >
                                <div
                                    className="flex items-center justify-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {hasAccess("MANAGE_ATTENDANCE") ? (
                                        <>
                                            <input
                                                type="checkbox"
                                                checked={
                                                    foundEntry?.timeIn === "present" &&
                                                    foundEntry?.timeOut === "present"
                                                }
                                                onChange={(e) => handleCheckboxChange(e, foundEntry)}
                                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                            />
                                            <span
                                                className="ml-2 text-sm font-medium text-gray-700"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {!!(foundEntry.timeIn || foundEntry.timeOut)
                                                    ? "Present"
                                                    : scheduleInfo?.isRestDay
                                                        ? "Rest Day"
                                                        : "Absent"}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-sm font-medium text-gray-700">
                                            {!!(foundEntry.timeIn || foundEntry.timeOut)
                                                ? "Present"
                                                : scheduleInfo?.isRestDay
                                                    ? "Rest Day"
                                                    : "Absent"}
                                        </span>
                                    )}
                                </div>
                            </td>
                        ) : null
                    ) : (
                        <td
                            key={column.key}
                            className={`${column.key === "day"
                                ? `timesheet-day-cell ${isSunday ? 'sunday' : 'weekday'} sticky left-0 z-10 bg-white`
                                : ""} px-6 py-4 whitespace-nowrap text-sm ${column.key === "day"
                                    ? "font-medium text-gray-900"
                                    : "text-gray-500"}`}
                        >
                            {column.key === "day" ? (
                                // Wrap day content in a div and add onClick for history
                                <div
                                    onClick={(e) => handleDayCellClick(day, e)}
                                    className="cursor-pointer hover:text-blue-600 w-full h-full flex flex-col items-center justify-center"
                                >
                                    {renderColumnContent(column.key, foundEntry, compensation)}
                                </div>
                            ) : (
                                renderColumnContent(column.key, foundEntry, compensation)
                            )}
                        </td>
                    ))
            )}
        </tr>
    );
};

export default TimesheetRow; 