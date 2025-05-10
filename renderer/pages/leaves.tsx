"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { IoSettingsOutline } from "react-icons/io5";
import LeaveForm from "@/renderer/components/LeaveForm";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { createLeaveModel } from "@/renderer/model/leave";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import { loadLeavesFirestore } from "@/renderer/model/leave_firestore";
import NoDataPlaceholder from "@/renderer/components/NoDataPlaceholder";
import DecryptedText from "../styles/DecryptedText/DecryptedText";

interface Leave {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  type: "Sick" | "Vacation" | "Emergency" | "Other";
  status: "Pending" | "Approved" | "Rejected";
  reason: string;
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | undefined>(
    undefined
  );
  const { setLoading, setActiveLink } = useLoadingStore();
  const { dbPath, companyName: companyNameFromSettings } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const { selectedMonth: storeSelectedMonth, selectedYear: storeSelectedYear } = useDateSelectorStore();
  const pathname = usePathname();
  const employeeModel = useMemo(() => {
    if (isWebEnvironment() || !dbPath) return null;
    return createEmployeeModel(dbPath);
  }, [dbPath]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const router = useRouter();

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  useEffect(() => {
    const loadSelectedEmployeeDetails = async () => {
      if (!selectedEmployeeId) {
        setEmployee(null);
        return;
      }
      setLoading(true);
      try {
        if (isWebEnvironment()) {
          const foundEmployee = employees.find(emp => emp.id === selectedEmployeeId);
          setEmployee(foundEmployee || null);
          if (!foundEmployee) {
            console.warn(`[LeavesPage WEB] Employee with ID ${selectedEmployeeId} not found in the loaded list.`);
          }
        } else {
          if (employeeModel) {
            const emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
            setEmployee(emp);
          } else {
            setEmployee(null);
            console.warn("[LeavesPage Desktop] employeeModel is null, cannot load employee details.");
          }
        }
      } catch (error) {
        console.error("Error loading selected employee details:", error);
        toast.error("Failed to load employee details.");
        setEmployee(null);
      } finally {
        setLoading(false);
      }
    };
    loadSelectedEmployeeDetails();
  }, [selectedEmployeeId, employees, employeeModel, setLoading]);

  useEffect(() => {
    const loadLeavesData = async () => {
      if (!selectedEmployeeId) {
        setLeaves([]);
        return;
      }

      setLoading(true);
      try {
        const monthForQuery = storeSelectedMonth + 1;

        if (isWebEnvironment()) {
          if (companyNameFromSettings) {
            console.log(`[LeavesPage WEB] Loading leaves for ${selectedEmployeeId}, ${storeSelectedYear}/${monthForQuery}, company: ${companyNameFromSettings}`);
            const employeeLeaves = await loadLeavesFirestore(
              selectedEmployeeId,
              storeSelectedYear,
              monthForQuery,
              companyNameFromSettings
            );
            setLeaves(employeeLeaves);
          } else {
            setLeaves([]);
            console.warn("[LeavesPage WEB] companyNameFromSettings is not set. Cannot load leaves.");
          }
        } else {
          if (dbPath) {
            console.log(`[LeavesPage Desktop] Loading leaves for ${selectedEmployeeId}, ${monthForQuery}/${storeSelectedYear}`);
            const leaveModel = createLeaveModel(dbPath, selectedEmployeeId);
            const employeeLeaves = await leaveModel.loadLeaves(
              selectedEmployeeId,
              storeSelectedYear,
              monthForQuery
            );
            setLeaves(employeeLeaves);
          } else {
            setLeaves([]);
            console.warn("[LeavesPage Desktop] dbPath is not set. Cannot load leaves.");
          }
        }
      } catch (error: any) {
        setLeaves([]);
        if (error.message?.includes("ENOENT")) {
          console.log("[LeavesPage] File not found, setting leaves to empty.");
        } else {
          console.error("Error loading leave data:", error);
          toast.error("Failed to load leave requests. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadLeavesData();
  }, [
    selectedEmployeeId,
    dbPath,
    companyNameFromSettings,
    storeSelectedMonth,
    storeSelectedYear,
    setLoading,
  ]);

  useEffect(() => {
    // Reset state when employee changes
    if (!selectedEmployeeId) {
      setEmployee(null);
      setLeaves([]);
    }
  }, [selectedEmployeeId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Sick":
        return "bg-orange-100 text-orange-800";
      case "Vacation":
        return "bg-blue-100 text-blue-800";
      case "Emergency":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);

  const handleButtonClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent event bubbling
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 400; // Approximate height of dialog
    const dialogWidth = 400; // Approximate width of dialog
    const spacing = 8; // Space between dialog and trigger

    // Calculate vertical position
    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    // Calculate horizontal position
    let left = rect.left + rect.width / 2 - dialogWidth / 2 - 180;

    // Keep dialog within window bounds
    left = Math.max(
      spacing,
      Math.min(left, windowWidth - dialogWidth - spacing)
    );

    // Calculate caret position relative to the dialog
    const caretLeft = rect.left + rect.width / 2 - left;

    setClickPosition({
      top,
      left,
      showAbove,
      caretLeft,
    });

    setSelectedLeave(undefined);
    setIsDialogOpen(true);
  };

  const handleRowClick = (event: React.MouseEvent, leave: Leave) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 450;
    const dialogWidth = 550;
    const spacing = 8;

    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;

    // Calculate left position to align with button's right edge
    let left = rect.right - dialogWidth + 5;

    // Ensure the dialog stays within viewport bounds
    if (left < 0) {
      left = 0; // Align to left edge of viewport if it would go off-screen
    } else if (left + dialogWidth > windowWidth) {
      left = windowWidth - dialogWidth; // Align to right edge of viewport
    }

    setClickPosition({
      top: showAbove
        ? rect.top - dialogHeight - spacing
        : rect.bottom + spacing,
      left,
      showAbove,
      caretLeft: dialogWidth - rect.width / 2, // Adjusted caret position
    });

    setSelectedLeave(leave);
    setIsDialogOpen(true);
  };

  const handleSaveLeave = async (leave: Leave) => {
    try {
      if (!dbPath || !selectedEmployeeId || !employeeModel) {
        return;
      }

      setLoading(true);
      const leaveModel = createLeaveModel(dbPath, selectedEmployeeId);

      // Ensure the leave has the correct employeeId
      const leaveWithEmployee = {
        ...leave,
        employeeId: selectedEmployeeId,
      };

      await leaveModel.saveOrUpdateLeave(leaveWithEmployee);
      setIsDialogOpen(false);

      // Refresh leaves list
      if (employee) {
        const updatedLeaves = await leaveModel.loadLeaves(
          employee.id,
          storeSelectedYear,
          storeSelectedMonth + 1
        );
        setLeaves(updatedLeaves);
        toast.success(`Leave request saved successfully`);
      }
    } catch (error: any) {
      console.error("Error saving leave:", error);
      toast.error(`Error saving leave: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeave = async (leave: Leave) => {
    try {
      if (!dbPath || !selectedEmployeeId || !employeeModel) {
        console.log("[LeavesPage] Missing dependencies:", {
          dbPath: !!dbPath,
          selectedEmployeeId: !!selectedEmployeeId,
          employeeModel: !!employeeModel,
        });
        return;
      }

      if (!confirm("Are you sure you want to delete this leave request?")) {
        return;
      }

      setLoading(true);
      const leaveModel = createLeaveModel(dbPath, selectedEmployeeId);
      await leaveModel.deleteLeave(leave.id, leave);

      if (employee) {
        const loadedLeaves = await leaveModel.loadLeaves(
          employee.id,
          storeSelectedYear,
          storeSelectedMonth + 1
        );
        setLeaves(loadedLeaves);
        toast.success("Leave request deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting leave:", error);
      toast.error(
        error instanceof Error
          ? `Error deleting leave: ${error.message}`
          : "Error deleting leave"
      );
    } finally {
      setLoading(false);
    }
  };

  // Add effect to load all employees
  useEffect(() => {
    const loadEmployees = async () => {
      setLoading(true);
      try {
        if (isWebEnvironment()) {
          if (companyNameFromSettings) {
            const loadedEmployees = await loadActiveEmployeesFirestore(companyNameFromSettings);
            setEmployees(loadedEmployees);
          } else {
            setEmployees([]);
            console.warn("[LeavesPage] Web mode: companyNameFromSettings is not set. Cannot load employees.");
          }
        } else {
          if (dbPath) {
            const model = createEmployeeModel(dbPath);
            const loadedEmployees = await model.loadActiveEmployees();
            setEmployees(loadedEmployees);
          } else {
            setEmployees([]);
            console.warn("[LeavesPage] Desktop mode: dbPath is not set. Cannot load employees.");
          }
        }
      } catch (error) {
        toast.error("Error loading employees");
        console.error("Error loading employees:", error);
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [dbPath, companyNameFromSettings, setLoading]);

  return (
    <RootLayout>
      <main className="max-w-12xl mx-auto py-12 sm:px-6 lg:px-8">
        <MagicCard
          className="p-0.5 rounded-lg col-span-2"
          gradientSize={200}
          gradientColor="#9E7AFF"
          gradientOpacity={0.8}
          gradientFrom="#9E7AFF"
          gradientTo="#FE8BBB"
        >
          <div className="px-4 sm:px-0">
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6">
              <div className="col-span-1 md:col-span-1">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900">
                      {selectedEmployeeId ? (
                        <EmployeeDropdown
                          employees={employees}
                          selectedEmployeeId={selectedEmployeeId}
                          onSelectEmployee={setSelectedEmployeeId}
                          labelPrefix="Leave Requests"
                        />
                      ) : (
                        <DecryptedText text="Leave Requests" animateOn="view" revealDirection='start' speed={50} sequential={true}/>
                      )}
                    </h2>
                    <button
                      type="button"
                      onClick={handleButtonClick}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150 ease-in-out"
                    >
                      Request Leave
                    </button>
                  </div>
                  {selectedEmployeeId === null ? (
                    <NoDataPlaceholder
                      dataType="leave requests"
                      actionText="Request Leave"
                      onActionClick={() => handleButtonClick}
                      onSelectEmployeeClick={() => handleLinkClick("/")}
                    />
                  ) : (
                    <div className="overflow-x-auto relative">
                      {leaves.length === 0 ? (
                        <NoDataPlaceholder
                          employeeName={employee?.name}
                          dataType="leave requests"
                          actionText="Request Leave"
                          onActionClick={() => handleButtonClick}
                          onSelectEmployeeClick={() => handleLinkClick("/")}
                        />
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Date
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Type
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Reason
                              </th>
                              <th
                                scope="col"
                                className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                              >
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {leaves.map((leave) => (
                              <tr
                                key={leave.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={(e) => handleRowClick(e, leave)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(
                                    leave.startDate
                                  ).toLocaleDateString()}{" "}
                                  -{" "}
                                  {new Date(leave.endDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getTypeColor(
                                      leave.type
                                    )}`}
                                  >
                                    {leave.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(
                                      leave.status
                                    )}`}
                                  >
                                    {leave.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {leave.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleDeleteLeave(leave);
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
        {isDialogOpen && (
          <Fragment>
            <div className="fixed inset-0 bg-black/30 z-40" />
            <div
              className="fixed inset-0 z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setIsDialogOpen(false);
                  setClickPosition(null);
                }
              }}
            >
              <LeaveForm
                onClose={() => {
                  setIsDialogOpen(false);
                  setClickPosition(null);
                }}
                onSave={handleSaveLeave}
                initialData={selectedLeave}
                position={clickPosition!}
              />
            </div>
          </Fragment>
        )}
      </main>
    </RootLayout>
  );
}
