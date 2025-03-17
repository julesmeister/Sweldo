"use client";

import {
  useState,
  useEffect,
  JSXElementConstructor,
  Key,
  ReactElement,
  ReactNode,
  ReactPortal,
} from "react";
import { useEmployeeStore } from "@/renderer/stores/employeeStore"; // Adjust the path as needed
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import {
  EmploymentType,
  AttendanceSettings,
  createAttendanceSettingsModel,
} from "@/renderer/model/settings";
import Papa from "papaparse";

interface EmployeeFormData {
  name: string;
  position: string;
  dailyRate: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  employmentType: string;
}

export default function EditEmployee() {
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const employeeModel = createEmployeeModel(dbPath);
  const attendanceSettingsModel = createAttendanceSettingsModel(dbPath);
  const [settings, setSettings] = useState<EmploymentType[]>();
  let timeSettings: EmploymentType[] = [];
  const formatTime = (time: string | undefined): string => {
    if (!time) return "-";
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 || 12; // Convert 0 to 12
    return `${formattedHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  useEffect(() => {
    const loadTimeSettings = async () => {
      try {
        const timeSettings = await attendanceSettingsModel.loadTimeSettings();
        setSettings(timeSettings);
      } catch (error) {
        console.error("Error loading attendance settings:", error);
      }
    };
    loadTimeSettings();
  }, [dbPath]);

  const [formData, setFormData] = useState<EmployeeFormData>({
    name: "",
    position: "",
    dailyRate: 0,
    sss: 0,
    philHealth: 0,
    pagIbig: 0,
    employmentType: "",
  });

  useEffect(() => {
    const loadEmployee = async () => {
      if (selectedEmployeeId) {
        const employee = await employeeModel.loadEmployeeById(
          selectedEmployeeId
        );
        if (employee) {
          setFormData({
            name: employee.name || "",
            position: employee.position || "",
            dailyRate: employee.dailyRate || 0,
            sss: employee.sss || 0,
            philHealth: employee.philHealth || 0,
            pagIbig: employee.pagIbig || 0,
            employmentType: employee.employmentType || "regular",
          });
        }
      }
    };
    loadEmployee();
  }, [selectedEmployeeId, dbPath]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "name" || name === "position" ? value : parseFloat(value) || 0,
    }));
  };

  const handleEmploymentTypeChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setFormData({ ...formData, employmentType: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // First get the current employee to preserve existing fields
      const currentEmployee = await employeeModel.loadEmployeeById(
        selectedEmployeeId!
      );
      if (!currentEmployee) {
        throw new Error("Employee not found");
      }

      // Create updated employee object by combining current employee with form data
      const updatedEmployee: Employee = {
        ...currentEmployee,
        ...formData,
      };

      await employeeModel.updateEmployeeDetails(updatedEmployee);
      console.log("Employee details updated successfully.");
    } catch (error) {
      console.error("Error updating employee details:", error);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden transition-all duration-200 hover:shadow-xl">
      <div className="px-6 py-4 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
        <h2 className="text-xl font-bold text-gray-100">
          {selectedEmployeeId ? "Edit Employee" : "Employee Details"}
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Manage employee information and benefits
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto"
      >
        <div className="space-y-4">
          {/* Name Field */}
          <div className="group">
            <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-10 px-3 shadow-sm transition-all duration-200 hover:border-gray-600"
              placeholder="Enter employee name"
            />
          </div>

          {/* Position Field */}
          <div className="group">
            <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
              Position
            </label>
            <textarea
              name="position"
              value={formData.position}
              onChange={handleChange}
              rows={2}
              className="mt-1 block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-20 px-3 py-2 shadow-sm transition-all duration-200 hover:border-gray-600"
              placeholder="Describe the employee's position"
            />
          </div>

          {/* Daily Rate Field */}
          <div className="group">
            <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
              Daily Rate
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">₱</span>
              </div>
              <input
                type="text"
                name="dailyRate"
                value={formData.dailyRate}
                onChange={handleChange}
                className="pl-7 block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-10 px-3 transition-all duration-200 hover:border-gray-600"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Employment Type Field */}
          <div className="group">
            <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
              Employment Type
            </label>
            <div className="relative">
              <select
                value={formData.employmentType}
                onChange={handleEmploymentTypeChange}
                className="block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-10 px-3 pr-8 transition-all duration-200 hover:border-gray-600"
              >
                {settings?.map((type) => (
                  <option
                    key={type.type}
                    value={type.type}
                    className="bg-gray-800"
                  >
                    {type.type.charAt(0).toUpperCase() + type.type.slice(1)}{" "}
                    {type.requiresTimeTracking
                      ? "(Scheduled)"
                      : "(No time tracking)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Benefits Section */}
            <h3 className="text-lg font-medium text-gray-200 mb-3">Benefits</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* SSS */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
                  SSS
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₱</span>
                  </div>
                  <input
                    type="text"
                    name="sss"
                    value={formData.sss}
                    onChange={handleChange}
                    className="pl-7 block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-10 px-3 transition-all duration-200 hover:border-gray-600"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* PhilHealth */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
                  PhilHealth
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₱</span>
                  </div>
                  <input
                    type="text"
                    name="philHealth"
                    value={formData.philHealth}
                    onChange={handleChange}
                    className="pl-7 block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-10 px-3 transition-all duration-200 hover:border-gray-600"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Pag-IBIG */}
              <div className="group">
                <label className="block text-sm font-medium text-gray-300 mb-1 group-hover:text-blue-400 transition-colors duration-200">
                  Pag-IBIG
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₱</span>
                  </div>
                  <input
                    type="text"
                    name="pagIbig"
                    value={formData.pagIbig}
                    onChange={handleChange}
                    className="pl-7 block w-full rounded-md bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring focus:ring-blue-500/20 text-gray-100 text-sm h-10 px-3 transition-all duration-200 hover:border-gray-600"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
      </form>

      {/* Footer */}
      <div className="mt-3 px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
        <div className="flex flex-row space-x-3 w-full">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
