import React, { useMemo } from "react";
import { Employee } from "@/renderer/model/employee";

interface EmployeeDropdownProps {
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string) => void;
  displayFormat?: "full" | "minimal"; // For different display options
  labelPrefix?: string; // To customize the label (e.g., "Timesheet", "Payroll for", etc.)
  className?: string; // Additional classes for the container
}

// Helper function for formatting employee names
const formatName = (name: string): string => {
  if (!name) return "";

  // Split the name into parts
  const nameParts = name.split(" ");

  // Capitalize each part
  return nameParts
    .map((part) => {
      if (!part) return "";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
};

export const EmployeeDropdown: React.FC<EmployeeDropdownProps> = ({
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  displayFormat = "full",
  labelPrefix = "",
  className = "",
}) => {
  // Filter active employees
  const activeEmployees = useMemo(
    () => employees.filter((emp) => emp.status === "active"),
    [employees]
  );

  // Find the selected employee
  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === selectedEmployeeId),
    [employees, selectedEmployeeId]
  );

  // Create the dropdown menu
  const employeeDropdown = useMemo(() => {
    return (
      <div className="absolute z-50 mt-2 w-72 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-blue-100/30 max-h-[320px] overflow-y-auto opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 scrollbar-thin">
        <div className="py-2">
          {activeEmployees.map((emp) => (
            <div
              key={emp.id}
              className={`mx-2 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-all duration-200 ${
                emp.id === selectedEmployeeId
                  ? "bg-gradient-to-r from-blue-50/90 to-indigo-50/90 text-blue-700 shadow-sm"
                  : "hover:bg-gradient-to-r hover:from-gray-50/90 hover:to-blue-50/50"
              }`}
              onClick={() => onSelectEmployee(emp.id)}
            >
              <div className="flex items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 shadow-sm transition-all duration-200 ${
                    emp.id === selectedEmployeeId
                      ? "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700"
                      : "bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700"
                  }`}
                >
                  <span className="text-sm font-medium">
                    {emp.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                </div>
                <div>
                  <div
                    className={`font-medium transition-colors duration-200 ${
                      emp.id === selectedEmployeeId
                        ? "text-blue-900"
                        : "text-gray-800"
                    }`}
                  >
                    {formatName(emp.name)}
                  </div>
                  <div
                    className={`text-xs mt-0.5 transition-colors duration-200 ${
                      emp.id === selectedEmployeeId
                        ? "text-blue-600/70"
                        : "text-gray-500"
                    }`}
                  >
                    {emp.position || "No position set"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [activeEmployees, selectedEmployeeId, onSelectEmployee]);

  // Create the display label
  const displayLabel = useMemo(() => {
    if (!selectedEmployee) return "Select Employee";

    if (displayFormat === "minimal") {
      return formatName(selectedEmployee.name);
    }

    // Full format with possessive
    const formattedName = formatName(selectedEmployee.name);
    const possessive = formattedName.toLowerCase().endsWith("s") ? "'" : "'s";

    return labelPrefix
      ? `${formattedName}${possessive} ${labelPrefix}`
      : formattedName;
  }, [selectedEmployee, displayFormat, labelPrefix]);

  return (
    <div className={`relative inline-block group ${className}`}>
      <span className="cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-1">
        {displayLabel}
      </span>
      {employeeDropdown}
    </div>
  );
};

export default EmployeeDropdown;
