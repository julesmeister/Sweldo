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
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
  const pathname = usePathname();
  const employeeModel = useMemo(() => createEmployeeModel(dbPath), [dbPath]);
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  const [employee, setEmployee] = useState<Employee | null>(null);
  let storedYearInt = storedYear
    ? parseInt(storedYear, 10)
    : new Date().getFullYear();
  if (!storedYear) {
    const currentYear = new Date().getFullYear().toString();
    if (typeof window !== "undefined") {
      localStorage.setItem("selectedYear", currentYear);
    }
    storedYearInt = parseInt(currentYear, 10);
  }
  const router = useRouter();
  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    console.log("Setting loading state to true");
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  useEffect(() => {
    const loadEmployeeAndLeaves = async () => {
      if (!dbPath || !selectedEmployeeId || !employeeModel) {
        console.log("[LeavesPage] Missing dependencies:", {
          dbPath: !!dbPath,
          selectedEmployeeId: !!selectedEmployeeId,
          employeeModel: !!employeeModel,
        });
        return;
      }

      setLoading(true);
      try {
        // Load employee
        console.log(
          "[LeavesPage] Loading employee with ID",
          selectedEmployeeId
        );
        const emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
        if (emp !== null) {
          setEmployee(emp);

          // Load leaves for the employee using stored year and month
          const leaveModel = createLeaveModel(dbPath, selectedEmployeeId);
          const employeeLeaves = await leaveModel.loadLeaves(
            selectedEmployeeId,
            storedYearInt,
            storedMonthInt
          );
          console.log("[LeavesPage] Loaded leaves:", employeeLeaves);
          setLeaves(employeeLeaves);
        }
      } catch (error: any) {
        console.error("[LeavesPage] Error loading data:", error);
        // Check if the error is a 'file not found' error
        // The exact structure might vary, adjust if needed based on console logs
        if (error.message?.includes("ENOENT")) {
          console.warn(
            "[LeavesPage] Leave file not found, treating as empty leaves."
          );
          setLeaves([]); // Set leaves to empty array if file doesn't exist
          // Optionally, show a less alarming toast or no toast at all
          // toast.info("No leave records found for this period.");
        } else {
          // For other errors, show a generic error message
          toast.error("Failed to load leave requests. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadEmployeeAndLeaves();
  }, [
    selectedEmployeeId,
    dbPath,
    employeeModel,
    setLoading,
    storedYearInt,
    storedMonthInt,
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
        console.log("[LeavesPage] Missing dependencies:", {
          dbPath: !!dbPath,
          selectedEmployeeId: !!selectedEmployeeId,
          employeeModel: !!employeeModel,
        });
        return;
      }

      setLoading(true);
      const leaveModel = createLeaveModel(dbPath, selectedEmployeeId);

      // Ensure the leave has the correct employeeId
      const leaveWithEmployee = {
        ...leave,
        employeeId: selectedEmployeeId,
      };

      console.log("[LeavesPage] Saving leave with data:", leaveWithEmployee);
      await leaveModel.saveOrUpdateLeave(leaveWithEmployee);
      setIsDialogOpen(false);

      // Refresh leaves list
      if (employee) {
        const updatedLeaves = await leaveModel.loadLeaves(
          employee.id,
          storedYearInt,
          storedMonthInt
        );
        setLeaves(updatedLeaves);
        toast.success(`Leave request saved successfully`);
      }
    } catch (error: any) {
      console.error("[LeavesPage] Error saving leave:", error);
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
          storedYearInt,
          storedMonthInt
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
                      {selectedEmployeeId
                        ? `${employee?.name}'s Leave Requests`
                        : "Leave Requests"}
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
                        No Employee Selected
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Please select an employee from the dropdown menu to view
                        their cash advances.
                      </p>
                      <div className="mt-6">
                        <AddButton
                          text="Select Employee"
                          onClick={() => handleLinkClick("/")}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto relative">
                      {leaves.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                          <div className="text-center">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <h3 className="mt-2 text-sm font-semibold text-gray-900">
                              No leave requests found
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Get started by creating a new leave request.
                            </p>
                          </div>
                        </div>
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
