"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import {
  IoTimeOutline,
  IoCalendarOutline,
  IoWalletOutline,
  IoShieldCheckmarkOutline,
  IoSettingsOutline,
  IoInformationCircleOutline,
  IoPeopleOutline,
  IoArrowForward,
  IoArrowBack,
} from "react-icons/io5";
import { MdOutlineDataset } from "react-icons/md";
import {
  Employee,
  EmployeeModel,
  createEmployeeModel,
} from "@/renderer/model/employee";
import { toast } from "sonner";
import {
  createAttendanceSettingsModel,
  AttendanceSettings,
  EmploymentType,
} from "@/renderer/model/settings";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";

interface SettingSection {
  key: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

export default function SettingsPage() {
  const { dbPath, setDbPath, logoPath, setLogoPath } = useSettingsStore();
  const [logoExists, setLogoExists] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [isCheckingLogo, setIsCheckingLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = React.useState<string>("attendance");
  const [currentPath, setCurrentPath] = useState(dbPath);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [inactiveEmployees, setInactiveEmployees] = useState<Employee[]>([]);
  const [employeeModel, setEmployeeModel] = useState<EmployeeModel | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const attendanceSettingsModel = createAttendanceSettingsModel(dbPath);
  const [attendanceSettings, setAttendanceSettings] =
    useState<AttendanceSettings>();
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [sssRate, setSssRate] = useState("");

  useEffect(() => {
    async function checkLogoExists() {
      if (logoPath) {
        setIsCheckingLogo(true);
        try {
          const exists = await window.electron.fileExists(logoPath);
          setLogoExists(exists);
          if (!exists) {
            setLogoPath('');
            setLogoError('The selected logo file no longer exists');
          } else {
            setLogoError('');
          }
        } catch (error) {
          console.error('Error checking logo file:', error);
          setLogoError('Error checking logo file');
        } finally {
          setIsCheckingLogo(false);
        }
      } else {
        setLogoExists(false);
        setIsCheckingLogo(false);
      }
    }
    checkLogoExists();
  }, [logoPath, setLogoPath]);

  useEffect(() => {
    const loadAttendanceSettings = async () => {
      try {
        const settings = await attendanceSettingsModel.loadAttendanceSettings();
        const timeSettings = await attendanceSettingsModel.loadTimeSettings();
        setEmploymentTypes(timeSettings);
        console.log("Attendance settings loaded:", settings);
        setAttendanceSettings(settings);
      } catch (error) {
        console.error("Error loading attendance settings:", error);
      }
    };
    loadAttendanceSettings();
  }, []);

  useEffect(() => {
    if (!currentPath) return;

    const model = createEmployeeModel(currentPath);
    setEmployeeModel(model);

    const loadAndFilterEmployees = async () => {
      try {
        const allEmployees = await model.loadEmployees();
        // Ensure each employee is only in one list
        const activeList = allEmployees.filter(
          (emp) => emp.status === "active"
        );
        const inactiveList = allEmployees.filter(
          (emp) => emp.status === "inactive"
        );

        // Reset selected employees when loading new data
        setSelectedEmployees([]);
        setActiveEmployees(activeList);
        setInactiveEmployees(inactiveList);
      } catch (error) {
        console.error("Error loading employees:", error);
      }
    };

    loadAndFilterEmployees();
  }, [currentPath]);

  // Function to move selected employee to inactive
  const moveToInactive = async (employee: Employee) => {
    try {
      if (!employeeModel) {
        console.error("Employee model is not initialized");
        return;
      }

      const updatedEmployee = { ...employee, status: "inactive" as const };

      // Update the employee status in the database
      await employeeModel.updateEmployeeStatus(updatedEmployee);

      // Update the UI state using functional updates to ensure we have the latest state
      setActiveEmployees((currentActive) =>
        currentActive.filter((emp) => emp.id !== employee.id)
      );
      setInactiveEmployees((currentInactive) => {
        // Ensure we don't add duplicates
        const withoutCurrent = currentInactive.filter(
          (emp) => emp.id !== employee.id
        );
        return [...withoutCurrent, updatedEmployee];
      });

      // Clear selection after moving
      setSelectedEmployees((current) =>
        current.filter((emp) => emp.id !== employee.id)
      );
    } catch (error) {
      console.error("Error moving employee to inactive:", error);
    }
  };

  // Function to move selected employee back to active
  const moveToActive = async (employee: Employee) => {
    try {
      if (!employeeModel) {
        console.error("Employee model is not initialized");
        return;
      }

      const updatedEmployee = { ...employee, status: "active" as const };

      // Update the employee status in the database
      await employeeModel.updateEmployeeStatus(updatedEmployee);

      // Update the UI state using functional updates to ensure we have the latest state
      setInactiveEmployees((currentInactive) =>
        currentInactive.filter((emp) => emp.id !== employee.id)
      );
      setActiveEmployees((currentActive) => {
        // Ensure we don't add duplicates
        const withoutCurrent = currentActive.filter(
          (emp) => emp.id !== employee.id
        );
        return [...withoutCurrent, updatedEmployee];
      });

      // Clear selection after moving
      setSelectedEmployees((current) =>
        current.filter((emp) => emp.id !== employee.id)
      );
    } catch (error) {
      console.error("Error moving employee to active:", error);
    }
  };

  // Function to toggle employee selection
  const toggleEmployeeSelection = (employee: Employee) => {
    setSelectedEmployees((current) => {
      const isSelected = current.some(
        (selected) => selected.id === employee.id
      );
      if (isSelected) {
        return current.filter((selected) => selected.id !== employee.id);
      } else {
        return [...current, employee];
      }
    });
  };

  // Function to check if an employee is selected
  const isEmployeeSelected = (employee: Employee) => {
    return selectedEmployees.some((selected) => selected.id === employee.id);
  };

  const handleSelectionChange = (key: string | number) => {
    setSelected(key.toString());
  };

  const handleSelectDirectory = async () => {
    try {
      const folderPath = await window.electron.openFolderDialog();
      console.log("Selected Folder Path: ", folderPath);
      if (folderPath) {
        const path = folderPath as string;
        setDbPath(path);
        setCurrentPath(path);
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  };

  const [formData, setFormData] = useState({
    lateGracePeriod: Number(attendanceSettings?.lateGracePeriod) || 0,
    lateDeductionPerMinute:
      Number(attendanceSettings?.lateDeductionPerMinute) || 0,
    undertimeGracePeriod: Number(attendanceSettings?.undertimeGracePeriod) || 0,
    undertimeDeductionPerMinute:
      Number(attendanceSettings?.undertimeDeductionPerMinute) || 0,
    overtimeGracePeriod: Number(attendanceSettings?.overtimeGracePeriod) || 0,
    overtimeAdditionPerMinute:
      Number(attendanceSettings?.overtimeAdditionPerMinute) || 0,
    regularHolidayMultiplier: attendanceSettings?.regularHolidayMultiplier || 0,
    specialHolidayMultiplier: attendanceSettings?.specialHolidayMultiplier || 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  useEffect(() => {
    if (attendanceSettings) {
      setFormData({
        lateGracePeriod: attendanceSettings.lateGracePeriod,
        lateDeductionPerMinute: attendanceSettings.lateDeductionPerMinute,
        undertimeGracePeriod: attendanceSettings.undertimeGracePeriod,
        undertimeDeductionPerMinute:
          attendanceSettings.undertimeDeductionPerMinute,
        overtimeGracePeriod: attendanceSettings.overtimeGracePeriod,
        overtimeAdditionPerMinute: attendanceSettings.overtimeAdditionPerMinute,
        regularHolidayMultiplier: attendanceSettings.regularHolidayMultiplier,
        specialHolidayMultiplier: attendanceSettings.specialHolidayMultiplier,
      });
    }
  }, [attendanceSettings]);

  const handleSaveChanges = async () => {
    try {
      await attendanceSettingsModel?.saveAttendanceSettings(formData);
      toast.success("Attendance settings saved successfully!");
    } catch (error) {
      console.error("Error saving attendance settings:", error);
      toast.error("Failed to save attendance settings. Please try again.");
    }
  };

  const handleAddEmploymentType = () => {
    setEmploymentTypes([
      ...employmentTypes,
      {
        type: "",
        timeIn: "",
        timeOut: "",
        requiresTimeTracking: false,
      },
    ]);
  };

  const handleRemoveEmploymentType = (index: number) => {
    setEmploymentTypes(employmentTypes.filter((_, i) => i !== index));
  };

  const handleEmploymentTypeChange = (
    index: number,
    field: keyof EmploymentType,
    value: string | boolean
  ) => {
    setEmploymentTypes(
      employmentTypes.map((type, i) =>
        i === index ? { ...type, [field]: value } : type
      )
    );
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const relativePath = file.webkitRelativePath;

      try {
        const fullPath = await window.electron.getFullPath(relativePath);
        setDbPath(fullPath);
        setCurrentPath(fullPath);
      } catch (error) {
        console.error("Failed to get full directory path:", error);
        toast.error("Failed to get directory path");
      }
    }
  };

  const handleSaveEmploymentTypes = async () => {
    try {
      await attendanceSettingsModel?.saveTimeSettings(employmentTypes);
      toast.success("Employment types saved successfully");
    } catch (error) {
      console.error("Error saving employment types:", error);
      toast.error("Failed to save employment types");
    }
  };

  const sections: SettingSection[] = [
    {
      key: "attendance",
      title: "Attendance & Time",
      icon: <IoTimeOutline className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <IoTimeOutline className="w-5 h-5 text-blue-600" />
                Attendance & Time
              </h3>
              <div className="bg-yellow-50 rounded-lg p-4 mb-4 flex items-center gap-2 border border-yellow-300">
                <IoInformationCircleOutline className="w-6 h-6 text-yellow-900" />
                <p className="text-sm text-gray-800 font-light">
                  Tip: Select the field you want to change and use the scroll
                  wheel to adjust the value.
                  <br />
                  <span className="text-xs text-gray-700 italic">
                    (scrolling is more precise than typing)
                  </span>
                </p>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Late Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      name="lateGracePeriod"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="5"
                      value={formData.lateGracePeriod}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Late Deduction Per Minute
                    </label>
                    <div className="mt-1 relative rounded-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">₱</span>
                      </div>
                      <input
                        type="number"
                        name="lateDeductionPerMinute"
                        className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3 pl-7"
                        placeholder="1"
                        value={formData.lateDeductionPerMinute}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Undertime Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      name="undertimeGracePeriod"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="5"
                      value={formData.undertimeGracePeriod}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Undertime Deduction Per Minute
                    </label>
                    <div className="mt-1 relative rounded-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">₱</span>
                      </div>
                      <input
                        type="number"
                        name="undertimeDeductionPerMinute"
                        className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3 pl-7"
                        placeholder="1"
                        value={formData.undertimeDeductionPerMinute}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Overtime Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      name="overtimeGracePeriod"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="5"
                      value={formData.overtimeGracePeriod}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Overtime Addition Per Minute
                    </label>
                    <div className="mt-1 relative rounded-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">₱</span>
                      </div>
                      <input
                        type="number"
                        name="overtimeAdditionPerMinute"
                        className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3 pl-7"
                        placeholder="2"
                        value={formData.overtimeAdditionPerMinute}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={handleSaveChanges}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "holidays",
      title: "Holiday Pay",
      icon: <IoCalendarOutline className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <IoCalendarOutline className="w-5 h-5 text-blue-600" />
                Holiday Pay Multipliers
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Regular Holiday
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="2"
                      value={attendanceSettings?.regularHolidayMultiplier || ""}
                      onChange={(e) =>
                        attendanceSettingsModel?.setRegularHolidayMultiplier(
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Special Holiday
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="1.3"
                      value={attendanceSettings?.specialHolidayMultiplier || ""}
                      onChange={(e) =>
                        attendanceSettingsModel?.setSpecialHolidayMultiplier(
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "types",
      title: "Employment Types",
      icon: <IoWalletOutline className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <IoWalletOutline className="w-5 h-5 text-blue-600" />
                Employment Types
              </h3>
              <div className="space-y-6">
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handleAddEmploymentType}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                    >
                      Add Type
                    </button>
                  </div>
                  <div className="space-y-4">
                    {employmentTypes.map((type, index) => (
                      <div
                        key={index}
                        className="p-4 border-2 border-gray-200 rounded-lg"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Type Name
                            </label>
                            <input
                              type="text"
                              name={`type-${index}`}
                              value={type.type}
                              onChange={(e) =>
                                handleEmploymentTypeChange(
                                  index,
                                  "type",
                                  e.target.value
                                )
                              }
                              className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                            />
                          </div>
                          <div className="flex items-end justify-end">
                            <button
                              onClick={() => handleRemoveEmploymentType(index)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
                            >
                              Remove
                            </button>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Time In
                            </label>
                            <input
                              type="time"
                              name={`timeIn-${index}`}
                              value={type.timeIn || ""}
                              onChange={(e) =>
                                handleEmploymentTypeChange(
                                  index,
                                  "timeIn",
                                  e.target.value
                                )
                              }
                              className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Time Out
                            </label>
                            <input
                              type="time"
                              name={`timeOut-${index}`}
                              value={type.timeOut || ""}
                              onChange={(e) =>
                                handleEmploymentTypeChange(
                                  index,
                                  "timeOut",
                                  e.target.value
                                )
                              }
                              className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <input
                                type="checkbox"
                                name={`requiresTimeTracking-${index}`}
                                checked={Boolean(type.requiresTimeTracking)}
                                onChange={(e) =>
                                  handleEmploymentTypeChange(
                                    index,
                                    "requiresTimeTracking",
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              Requires Time Tracking
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    onClick={handleSaveEmploymentTypes}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "deductions",
      title: "Gov't Deductions",
      icon: <IoShieldCheckmarkOutline className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <IoShieldCheckmarkOutline className="w-5 h-5 text-blue-600" />
                Government Deductions
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      SSS Rate (%)
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="4.5"
                      value={sssRate ?? ""}
                      onChange={(e) => setSssRate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      PhilHealth Rate (%)
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Pag-IBIG Rate (%)
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full rounded-md border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-12 px-3"
                      placeholder="2"
                    />
                  </div>
                </div>
                <div className="pt-4">
                  <button className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "employeeManagement",
      title: "Employee Activity",
      icon: <IoPeopleOutline className="w-5 h-5" />,
      content: (
        <div className="space-y-8">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <IoPeopleOutline className="w-5 h-5 text-blue-600" />
              Manage Employees
            </h3>
            <div className="flex justify-between gap-8">
              {/* Active Employees Box */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Active Employees
                  </h4>
                  <span className="text-sm text-gray-500">
                    {activeEmployees.length} employees
                  </span>
                </div>
                <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {activeEmployees.map((employee) => (
                    <li
                      key={`active-${employee.id}`}
                      className={`rounded-lg p-3 flex items-center justify-between border border-gray-100 transition-all ${
                        isEmployeeSelected(employee)
                          ? "bg-blue-100"
                          : "bg-white"
                      } hover:border-blue-200 hover:shadow-sm`}
                      onClick={() => toggleEmployeeSelection(employee)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {employee.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {employee.position || "No position set"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToInactive(employee);
                        }}
                        className="text-sm px-3 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        Deactivate
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Center Controls */}
              <div className="flex flex-col items-center justify-center space-y-4">
                {selectedEmployees.length > 0 &&
                selectedEmployees[0].status === "inactive" ? (
                  <button
                    onClick={async () => {
                      if (!employeeModel) return;

                      try {
                        // Process employees one at a time to avoid file contention
                        for (const employee of selectedEmployees) {
                          const updatedEmployee = {
                            ...employee,
                            status: "active" as const,
                          };
                          await employeeModel.updateEmployeeStatus(
                            updatedEmployee
                          );

                          // Update UI state after each successful update
                          setInactiveEmployees((current) =>
                            current.filter((emp) => emp.id !== employee.id)
                          );
                          setActiveEmployees((current) => {
                            const withoutCurrent = current.filter(
                              (emp) => emp.id !== employee.id
                            );
                            return [...withoutCurrent, updatedEmployee];
                          });
                        }

                        // Clear selection after all updates are complete
                        setSelectedEmployees([]);
                        toast.success("Successfully updated employee status");
                      } catch (error) {
                        console.error("Error updating employee status:", error);
                        toast.error(
                          "Failed to update some employees. Please try again."
                        );
                      }
                    }}
                    className="group relative px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-2"
                  >
                    <IoArrowBack className="w-5 h-5" />
                    Activate
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!employeeModel) return;

                      try {
                        // Process employees one at a time to avoid file contention
                        for (const employee of selectedEmployees) {
                          const updatedEmployee = {
                            ...employee,
                            status: "inactive" as const,
                          };
                          await employeeModel.updateEmployeeStatus(
                            updatedEmployee
                          );

                          // Update UI state after each successful update
                          setActiveEmployees((current) =>
                            current.filter((emp) => emp.id !== employee.id)
                          );
                          setInactiveEmployees((current) => {
                            const withoutCurrent = current.filter(
                              (emp) => emp.id !== employee.id
                            );
                            return [...withoutCurrent, updatedEmployee];
                          });
                        }

                        // Clear selection after all updates are complete
                        setSelectedEmployees([]);
                        toast.success("Successfully updated employee status");
                      } catch (error) {
                        console.error("Error updating employee status:", error);
                        toast.error(
                          "Failed to update some employees. Please try again."
                        );
                      }
                    }}
                    className="group relative px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                  >
                    <IoArrowForward className="w-5 h-5" />
                    Terminate
                  </button>
                )}
              </div>

              {/* Inactive Employees Box */}
              <div className="flex-1 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    Inactive Employees
                  </h4>
                  <span className="text-sm text-gray-500">
                    {inactiveEmployees.length} employees
                  </span>
                </div>
                <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {inactiveEmployees.map((employee) => (
                    <li
                      key={`inactive-${employee.id}`}
                      className={`rounded-lg p-3 flex items-center justify-between border border-gray-100 transition-all ${
                        isEmployeeSelected(employee)
                          ? "bg-blue-100"
                          : "bg-white"
                      } hover:border-green-200 hover:shadow-sm`}
                      onClick={() => toggleEmployeeSelection(employee)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                          {employee.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {employee.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {employee.position || "No position set"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveToActive(employee);
                        }}
                        className="text-sm px-3 py-1 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      >
                        Activate
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "logo",
      title: "Company Logo",
      icon: <MdOutlineDataset className="h-5 w-5" />,
      content: (
        <div className="">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Company Logo</h2>
            <div className="bg-yellow-50 rounded-lg p-4 mb-4 flex items-center gap-2 border border-yellow-300">
              <IoInformationCircleOutline className="w-6 h-6 text-yellow-900" />
              <p className="text-sm text-gray-800 font-light">
                Select your company logo image file (PNG, JPG, or JPEG). The logo will be used in reports and other company documents.
              </p>
            </div>
            {logoError && (
              <div className="bg-red-50 rounded-lg p-4 mb-4 flex items-center gap-2 border border-red-300">
                <IoInformationCircleOutline className="w-6 h-6 text-red-900" />
                <p className="text-sm text-red-800 font-light">{logoError}</p>
              </div>
            )}
            
            {/* Logo Preview */}
            {isCheckingLogo ? (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center justify-center h-24 gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
                  <div className="text-sm text-gray-500">Checking logo file...</div>
                </div>
              </div>
            ) : !logoPath ? (
              <div 
                className={`mb-4 p-4 border rounded-lg bg-gray-50 border-dashed transition-colors duration-200 ${isDragging ? 'border-blue-500 bg-blue-50' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  setLogoError('');

                  const file = e.dataTransfer.files[0];
                  if (!file) return;

                  const ext = file.name.toLowerCase().split('.').pop();
                  if (!['png', 'jpg', 'jpeg'].includes(ext || '')) {
                    setLogoError('Please select a valid image file (PNG, JPG, or JPEG)');
                    return;
                  }

                  setLogoPath(file.path);
                }}
              >
                <div className="flex flex-col items-center justify-center h-24 gap-2 text-gray-400">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-sm">{isDragging ? 'Drop image here' : 'No logo selected - Click browse or drag an image here'}</div>
                </div>
              </div>
            ) : logoPath && logoExists && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Logo Preview</h3>
                <div className="flex items-center justify-center bg-white border rounded-lg p-4">
                  <img 
                    src={logoPath ? `local-file://${logoPath}` : ''} 
                    alt="Company Logo" 
                    className="max-h-24 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = ''; // Clear the source on error
                      console.error('Error loading logo:', logoPath);
                    }} 
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={logoPath}
                readOnly
                className="flex-1 p-2 border rounded-md bg-gray-50"
                placeholder="Select logo image..."
              />
              <button
                onClick={async () => {
                  // Clear any existing error messages
                  setLogoError('');
                  
                  const result = await window.electron.showOpenDialog({
                    properties: ['openFile'],
                    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
                  });
                  
                  if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    const ext = filePath.toLowerCase().split('.').pop();
                    if (!['png', 'jpg', 'jpeg'].includes(ext || '')) {
                      setLogoError('Please select a valid image file (PNG, JPG, or JPEG)');
                      return;
                    }
                    setLogoError('');
                    setLogoPath(filePath);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Browse
              </button>
              {logoPath && (
                <button
                  onClick={() => {
                  setLogoPath('');
                  setLogoError('');
                }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md border hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "database",
      title: "Database Management",
      icon: <MdOutlineDataset className="h-5 w-5" />,
      content: (
        <div className="">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-2">Database Location</h2>
            <div className="bg-yellow-50 rounded-lg p-4 mb-4 flex items-center gap-2 border border-yellow-300">
              <IoInformationCircleOutline className="w-6 h-6 text-yellow-900" />
              <p className="text-sm text-gray-800 font-light">
                Select the directory where your database (CSV) files will be
                stored. A folder named 'SweldoDB' will be created here if it
                doesn't already exist and will contain CSV files and folders
                with employee and payroll data.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                value={currentPath}
                readOnly
                className="flex-1 p-2 border rounded-md bg-gray-50"
                placeholder="Select database directory..."
              />
              <input
                ref={fileInputRef}
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                onClick={handleSelectDirectory}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Browse
              </button>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <RootLayout>
      <main className="max-w-12xl mx-auto py-12 sm:px-6 lg:px-8">
        <MagicCard
          className="p-0.5 rounded-2xl col-span-2"
          gradientSize={400}
          gradientColor="#9E7AFF"
          gradientOpacity={0.8}
          gradientFrom="#9E7AFF"
          gradientTo="#FE8BBB"
        >
          <div className="px-4 sm:px-0">
            <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-100">
                <div className="flex items-center gap-1 px-6 bg-gray-50">
                  {sections.map((section) => (
                    <button
                      key={section.key}
                      onClick={() => handleSelectionChange(section.key)}
                      className={`flex items-center gap-2 px-4 py-4 text-sm font-medium transition-all ${
                        selected === section.key
                          ? "text-blue-600"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <div
                        className={`transition-colors ${
                          selected === section.key
                            ? "text-blue-600"
                            : "text-gray-400"
                        }`}
                      >
                        {section.icon}
                      </div>
                      <span>{section.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6">
                {sections.find((section) => section.key === selected)?.content}
              </div>
            </div>
          </div>
        </MagicCard>
      </main>
    </RootLayout>
  );
}
