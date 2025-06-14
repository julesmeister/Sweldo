import React, { useMemo, useState, useRef, useEffect } from "react";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import { createPortal } from "react-dom";
import { getAvatarByIndex } from "@/renderer/lib/avatarUtils";
import Image from "next/image";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { toast } from "sonner";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";

interface EmployeeDropdownProps {
  employees?: Employee[]; // Now optional
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
  employees: externalEmployees,
  selectedEmployeeId,
  onSelectEmployee,
  displayFormat = "full",
  labelPrefix = "",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [internalEmployees, setInternalEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get necessary settings
  const { dbPath, companyName } = useSettingsStore();

  // Load employees if not provided externally
  useEffect(() => {
    const loadEmployees = async () => {
      if (externalEmployees && externalEmployees.length > 0) {
        // Use externally provided employees if available
        return;
      }

      setIsLoading(true);
      try {
        if (isWebEnvironment()) {
          if (!companyName) {
            toast.error("Company name not set for web mode");
            return;
          }
          const firestoreEmployees = await loadActiveEmployeesFirestore(companyName);
          setInternalEmployees(firestoreEmployees);
        } else {
          if (!dbPath) {
            toast.error("Database path not configured");
            return;
          }
          const employeeModel = createEmployeeModel(dbPath);
          const loaded = await employeeModel.loadActiveEmployees();
          setInternalEmployees(loaded);
        }
      } catch (error) {
        console.error("Error loading employees:", error);
        toast.error("Failed to load employees");
      } finally {
        setIsLoading(false);
      }
    };

    loadEmployees();
  }, [externalEmployees, dbPath, companyName]);

  // Use external employees if provided, otherwise use internal
  const employees = useMemo(() => {
    return externalEmployees && externalEmployees.length > 0
      ? externalEmployees
      : internalEmployees;
  }, [externalEmployees, internalEmployees]);

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

  // Update dropdown position based on trigger position
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX - 10,
      });
    }
  };

  // Handle opening/closing the dropdown
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Set up portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle click outside - TEMPORARILY DISABLED FOR TESTING
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Update position on scroll or resize
    const handleReposition = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    // CRITICAL FIX: Temporarily disable global listeners to test form field freeze
    // These global document listeners may be intercepting events before they reach form elements
    // document.addEventListener("click", handleClickOutside);
    // window.addEventListener("scroll", handleReposition, true);
    // window.addEventListener("resize", handleReposition);

    return () => {
      // document.removeEventListener("click", handleClickOutside);
      // window.removeEventListener("scroll", handleReposition, true);
      // window.removeEventListener("resize", handleReposition);
    };
  }, [isOpen]);

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

  const dropdownMenu = useMemo(() => {
    if (!isOpen || !mounted) return null;

    const menu = (
      <div
        ref={dropdownRef}
        className="fixed shadow-2xl border border-gray-200 bg-white rounded-xl overflow-hidden w-72"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          zIndex: 9999,
        }}
      >
        <div className="py-2 w-full overflow-y-auto max-h-[320px] scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm text-gray-600">Loading employees...</span>
            </div>
          ) : activeEmployees.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No employees found
            </div>
          ) : (
            activeEmployees.map((emp) => (
              <div
                key={emp.id}
                className={`mx-2 px-3 py-2.5 text-sm cursor-pointer rounded-lg transition-all duration-200 ${emp.id === selectedEmployeeId
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 shadow-sm"
                  : "hover:bg-blue-50 hover:text-blue-700"
                  }`}
                onClick={() => {
                  onSelectEmployee(emp.id);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 shadow-sm transition-all duration-200 overflow-hidden ${emp.id === selectedEmployeeId
                      ? "ring-2 ring-blue-200"
                      : ""
                      }`}
                  >
                    {/* Use avatar image instead of initials */}
                    <Image
                      src={getAvatarByIndex(emp.id)}
                      alt={emp.name}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div
                      className={`font-medium transition-colors duration-200 ${emp.id === selectedEmployeeId
                        ? "text-blue-900"
                        : "text-gray-800"
                        }`}
                    >
                      {formatName(emp.name)}
                    </div>
                    <div
                      className={`text-xs mt-0.5 transition-colors duration-200 ${emp.id === selectedEmployeeId
                        ? "text-blue-600/70"
                        : "text-gray-500"
                        }`}
                    >
                      {emp.employmentType ?? "No schedule set"}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );

    // Use portal to render outside of any containing elements that might have overflow: hidden
    return createPortal(menu, document.body);
  }, [
    activeEmployees,
    selectedEmployeeId,
    onSelectEmployee,
    isOpen,
    mounted,
    dropdownPosition,
    isLoading,
  ]);

  return (
    <div className={`inline-block ${className}`}>
      {/* Pill-shaped dropdown button with blue circle */}
      <div
        ref={triggerRef}
        className="flex items-center cursor-pointer border border-emerald-200 rounded-full pl-4 pr-2 py-1.5 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        onClick={toggleDropdown}
      >
        <span className="text-gray-800 text-sm mr-2">
          {displayLabel}
        </span>
        <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
          {/* Simplified, more visible arrow */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
          >
            <path
              d="M7 10L12 15L17 10"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {dropdownMenu}
    </div>
  );
};

export default EmployeeDropdown;
