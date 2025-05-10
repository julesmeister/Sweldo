"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { Short, createShortModel } from "@/renderer/model/shorts";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import ShortsForm from "@/renderer/components/ShortsForm";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";
import { useAuthStore } from "@/renderer/stores/authStore";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";
import { loadShortsFirestore } from "@/renderer/model/shorts_firestore";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";

export default function ShortsPage() {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedShort, setSelectedShort] = useState<Short | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);
  const [showTip, setShowTip] = useState(false);

  // Initialize month/year from localStorage on first render - RETAIN for initial default, but prefer store for updates
  const [/* dateContext */, setDateContext] = useState(() => { // Renamed to avoid conflict, setDateContext might be useful if we want to sync back
    const month = localStorage.getItem("selectedMonth") || new Date().getMonth().toString();
    const year = localStorage.getItem("selectedYear") || new Date().getFullYear().toString();
    return { month, year };
  });

  // Get date from Zustand store
  const { selectedMonth: storeSelectedMonth, selectedYear: storeSelectedYear } = useDateSelectorStore();

  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const { dbPath, companyName: companyNameFromSettings } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const pathname = usePathname();
  const employeeModel = useMemo(() => {
    // For desktop mode, employeeModel is still useful
    if (!isWebEnvironment() && dbPath) {
      return createEmployeeModel(dbPath);
    }
    return null;
  }, [dbPath]);

  const shortModel = useMemo(() => {
    if (!selectedEmployeeId || !dbPath) return null; // Desktop mode still needs dbPath for shortModel
    // This model primarily serves desktop mode now for loading.
    // CUD operations will be further refactored.
    return createShortModel(
      dbPath,
      selectedEmployeeId,
      parseInt(storeSelectedMonth, 10) + 1,
      parseInt(storeSelectedYear, 10)
    );
  }, [dbPath, selectedEmployeeId, storeSelectedMonth, storeSelectedYear]);
  const { hasAccess } = useAuthStore();

  const hasDeleteAccess = hasAccess("MANAGE_PAYROLL");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!selectedEmployeeId) {
        setShorts([]);
        // setLoading(false); // setLoading is handled by the new employee loading effect mostly
        return;
      }

      // setLoading(true); // setLoading primarily handled by employee loading effect, or here if still needed
      try {
        let shortItems: Short[] = [];
        // Use month/year from the Zustand store directly
        const currentShortMonth = storeSelectedMonth + 1; // Zustand month is 0-indexed
        const currentShortYear = storeSelectedYear;

        if (isWebEnvironment()) {
          console.log(`[ShortsPage WEB] Starting to load shorts for employee: ${selectedEmployeeId}`);
          if (!companyNameFromSettings) {
            toast.error("Company name not configured for web mode. Cannot load shorts.");
            if (mounted) setLoading(false);
            return;
          }

          // Load shorts from Firestore
          console.log(`[ShortsPage WEB] Loading shorts for ${selectedEmployeeId}, ${currentShortMonth}/${currentShortYear}, company: ${companyNameFromSettings}`);
          shortItems = await loadShortsFirestore(selectedEmployeeId, currentShortMonth, currentShortYear, companyNameFromSettings);
          console.log(`[ShortsPage WEB] Loaded ${shortItems.length} shorts from Firestore.`);

        } else {
          // Desktop mode
          console.log(`[ShortsPage DESKTOP] Starting to load shorts for employee: ${selectedEmployeeId}`);
          if (!dbPath || !employeeModel || !shortModel) {
            toast.error("System not fully initialized for desktop mode. Cannot load shorts.");
            if (mounted) setLoading(false);
            return;
          }
          shortItems = await shortModel.loadShorts(selectedEmployeeId);
          console.log(`[ShortsPage DESKTOP] Loaded ${shortItems.length} shorts using shortModel.`);
        }

        if (!mounted) return;

        setShorts(shortItems);

      } catch (error) {
        console.error("Error loading shorts data:", error);
        if (mounted) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load shorts data"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [selectedEmployeeId, dbPath, companyNameFromSettings, shortModel, storeSelectedMonth, storeSelectedYear, setLoading]);

  // New useEffect to load selected employee details (similar to cashAdvances.tsx)
  useEffect(() => {
    const loadSelectedEmployee = async () => {
      if (!selectedEmployeeId) {
        setEmployee(null);
        return;
      }
      setLoading(true);
      try {
        if (isWebEnvironment()) {
          if (!companyNameFromSettings) {
            toast.warn("Company name not set. Cannot load selected employee for web mode.");
            setEmployee(null);
            return;
          }
          // Find from the already loaded 'employees' list
          const foundEmp = employees.find(e => e.id === selectedEmployeeId);
          setEmployee(foundEmp || null);
          if (!foundEmp) {
            console.warn(`[ShortsPage WEB] loadSelectedEmployee: Employee ${selectedEmployeeId} not found in preloaded list.`);
          } else {
            console.log(`[ShortsPage WEB] loadSelectedEmployee: Successfully found employee ${selectedEmployeeId} in preloaded list.`);
          }
        } else {
          if (!dbPath) {
            toast.warn("Database path not set. Cannot load selected employee for desktop mode.");
            setEmployee(null);
            return;
          }
          const desktopEmployeeModel = createEmployeeModel(dbPath);
          const emp = await desktopEmployeeModel.loadEmployeeById(selectedEmployeeId);
          setEmployee(emp);
          if (!emp) {
            toast.error(`[ShortsPage DESKTOP] loadSelectedEmployee: Employee with ID ${selectedEmployeeId} not found using model.`);
          }
        }
      } catch (error) {
        console.error("[ShortsPage] Error in loadSelectedEmployee:", error);
        toast.error("Error loading selected employee details.");
        setEmployee(null);
      } finally {
        setLoading(false); // Consider if setLoading is appropriate here or if it flickers too much
      }
    };
    loadSelectedEmployee();
  }, [selectedEmployeeId, dbPath, companyNameFromSettings, employees, setLoading]);

  // Add effect to load all employees
  useEffect(() => {
    const loadEmployees = async () => {
      setLoading(true);
      try {
        if (isWebEnvironment()) {
          if (!companyNameFromSettings) {
            toast.warn("Company name not set. Cannot load employees for web mode.");
            setEmployees([]);
            return;
          }
          console.log("[ShortsPage WEB] Loading active employees from Firestore for dropdown.");
          const firestoreEmployees = await loadActiveEmployeesFirestore(companyNameFromSettings);
          setEmployees(firestoreEmployees);
        } else {
          if (!dbPath) {
            toast.warn("Database path not set. Cannot load employees for desktop mode.");
            setEmployees([]);
            return;
          }
          console.log("[ShortsPage DESKTOP] Loading active employees from local DB for dropdown.");
          const employeeModel = createEmployeeModel(dbPath);
          const loadedEmployees = await employeeModel.loadActiveEmployees();
          setEmployees(loadedEmployees);
        }
      } catch (error) {
        console.error("Error loading employees for dropdown:", error);
        toast.error("Error loading employees for dropdown");
        setEmployees([]); // Ensure employees is empty on error
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [dbPath, companyNameFromSettings, setLoading]);

  const storedMonthInt = storeSelectedMonth + 1; // Use store value for display consistency
  const yearInt = storeSelectedYear; // Use store value for display consistency
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setClickPosition(null);
    setSelectedShort(null);
  };

  const handleButtonClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 450;
    const dialogWidth = 850;
    const spacing = 8;

    // Calculate vertical position
    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    // Calculate horizontal position
    let left = rect.left + rect.width / 2 - dialogWidth / 2;

    // Keep dialog within window bounds
    left =
      Math.max(spacing, Math.min(left, windowWidth - dialogWidth - spacing)) -
      60;

    // Calculate caret position relative to the dialog
    const caretLeft = rect.left + rect.width / 2 - left;

    setClickPosition({
      top,
      left,
      showAbove,
      caretLeft,
    });

    setSelectedShort(null);
    setIsDialogOpen(true);
  };

  const handleRowClick = (event: React.MouseEvent, short: Short) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 450;
    const dialogWidth = 850;
    const spacing = 8;

    // Calculate vertical position
    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    // Calculate horizontal position
    let left = rect.left + rect.width / 2 - dialogWidth / 2;

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

    setSelectedShort(short);
    setIsDialogOpen(true);
  };
  const router = useRouter();
  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    console.log("Setting loading state to true");
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  async function handleSaveShort(data: Short): Promise<void> {
    if (!shortModel) {
      toast.error(
        "System not properly initialized. Please ensure:\n1. An employee is selected\n2. Database path is configured\n3. Month and year are set"
      );
      return;
    }

    if (!selectedEmployeeId) {
      toast.error("Please select an employee first");
      return;
    }

    if (!dbPath) {
      toast.error("Database path is not configured");
      return;
    }

    setLoading(true);
    try {
      if (selectedShort) {
        // Update existing short
        await shortModel.updateShort({
          ...data,
          id: selectedShort.id,
          employeeId: selectedEmployeeId!,
          date: data.date, // Use the new date from the form
        });
        toast.success("Short updated successfully", {
          position: "bottom-right",
          duration: 3000,
        });
      } else {
        // Create new short
        await shortModel.createShort({
          ...data,
          employeeId: selectedEmployeeId!,
          date: data.date,
        });
        toast.success("Short created successfully", {
          position: "bottom-right",
          duration: 3000,
        });
      }

      // Reload the shorts to get the updated list
      const shortItems = await shortModel.loadShorts(selectedEmployeeId!);
      setShorts(shortItems);

      // Close the dialog
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving short:", error);
      toast.error(
        error instanceof Error
          ? `Error saving short: ${error.message}`
          : "Error saving short",
        {
          position: "bottom-right",
          duration: 3000,
        }
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredShorts = useMemo(() => {
    console.log(`[ShortsPage FILTER] Running filter. storeSelectedMonth: ${storeSelectedMonth}, storeSelectedYear: ${storeSelectedYear}`);
    console.log(`[ShortsPage FILTER] Input 'shorts' array length: ${shorts.length}`);
    if (shorts.length > 0) {
      console.log("[ShortsPage FILTER] First short raw data:", JSON.stringify(shorts[0]));
    }
    const result = shorts.filter((short) => {
      const shortDate = new Date(short.date);
      const matchesMonth = shortDate.getMonth() === storeSelectedMonth; // storeSelectedMonth is 0-indexed
      const matchesYear = shortDate.getFullYear() === storeSelectedYear;
      // Safer logging for date
      const shortDateString = shortDate instanceof Date && !isNaN(shortDate.valueOf())
        ? shortDate.toISOString()
        : `Invalid Date (original value: ${short.date})`;
      console.log(`[ShortsPage FILTER] Filtering short ID ${short.id}: shortDate: ${shortDateString}, parsedMonth: ${!isNaN(shortDate.valueOf()) ? shortDate.getMonth() : 'N/A'}, parsedYear: ${!isNaN(shortDate.valueOf()) ? shortDate.getFullYear() : 'N/A'}, matchesMonth: ${matchesMonth}, matchesYear: ${matchesYear}`);
      return matchesMonth && matchesYear;
    });
    console.log(`[ShortsPage FILTER] Output 'filteredShorts' array length: ${result.length}`);
    return result;
  }, [shorts, storeSelectedMonth, storeSelectedYear]);

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
          <div className="px-4sm:px-0">
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6">
              <div className="col-span-1 md:col-span-1">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h2 className="text-lg font-medium text-gray-900">
                        {selectedEmployeeId ? (
                          <EmployeeDropdown
                            employees={employees}
                            selectedEmployeeId={selectedEmployeeId}
                            onSelectEmployee={setSelectedEmployeeId}
                            labelPrefix="Shorts"
                          />
                        ) : (
                          "Shorts"
                        )}
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowTip((prev) => !prev)}
                          className={`inline-flex items-center justify-center rounded-md p-2 text-sm font-medium shadow-sm transition-all duration-300 ease-in-out
                            ${showTip
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white ring-2 ring-blue-500 ring-offset-2"
                              : "bg-gradient-to-r from-white to-gray-50 text-blue-600 hover:from-blue-50 hover:to-purple-50 border border-gray-200"
                            }
                            transform hover:scale-105 active:scale-95`}
                        >
                          <InformationCircleIcon
                            className={`h-5 w-5 transition-colors duration-300 ${showTip ? "text-white" : "text-blue-600"
                              }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={handleButtonClick}
                          className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                        >
                          Apply for Short
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      {showTip && (
                        <div className="mt-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-md border border-blue-100">
                          Shorts are deductions from employee pay for company
                          purchases or unpaid payables. They represent amounts
                          that employees owe to the company, such as when they
                          purchase items from the company store, have
                          insufficient funds for deductions, or need to cover
                          other company-related expenses. These amounts are
                          tracked and can be paid back over time as the employee
                          earns wages.
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedEmployeeId ? (
                    <div className="overflow-x-auto relative">
                      {filteredShorts.length === 0 ? (
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
                              No shorts found for{" "}
                              {new Date(
                                storeSelectedYear,
                                storeSelectedMonth,
                                1
                              ).toLocaleString("default", {
                                month: "long",
                                year: "numeric",
                              })}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Get started by clicking the "Apply for Short"
                              button above.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"
                              >
                                Date
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"
                              >
                                Amount
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-full"
                              >
                                Reason
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
                              >
                                Remaining Payments
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
                            {filteredShorts.map((short) => (
                              <tr
                                key={short.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={(e) => handleRowClick(e, short)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(short.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ₱{short.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                                  <div className="line-clamp-2 hover:line-clamp-none">
                                    {short.reason}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(
                                      short.status
                                    )}`}
                                  >
                                    {short.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ₱{short.remainingUnpaid.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      if (!hasDeleteAccess) {
                                        toast.error(
                                          "You don't have permission to delete short records"
                                        );
                                        return;
                                      }

                                      if (!shortModel) {
                                        toast.error(
                                          "System not properly initialized"
                                        );
                                        return;
                                      }

                                      if (
                                        !confirm(
                                          "Are you sure you want to delete this short?"
                                        )
                                      ) {
                                        return;
                                      }

                                      setLoading(true);
                                      try {
                                        await shortModel.deleteShort(short.id);
                                        const shortItems =
                                          await shortModel.loadShorts(
                                            selectedEmployeeId!
                                          );
                                        setShorts(shortItems);
                                        toast.success(
                                          "Short deleted successfully"
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error deleting short:",
                                          error
                                        );
                                        toast.error(
                                          error instanceof Error
                                            ? `Error deleting short: ${error.message}`
                                            : "Error deleting short"
                                        );
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out ${!hasDeleteAccess
                                      ? "opacity-50 cursor-not-allowed"
                                      : "cursor-pointer"
                                      }`}
                                    disabled={!hasDeleteAccess}
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
                  ) : (
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
                        their shorts.
                      </p>
                      <div className="mt-6">
                        <AddButton
                          text="Select Employee"
                          onClick={() => handleLinkClick("/")}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
        {isDialogOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" />
            <div
              className="fixed inset-0 z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  handleCloseDialog();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  handleCloseDialog();
                }
              }}
              tabIndex={0}
            >
              <ShortsForm
                onClose={handleCloseDialog}
                onSave={handleSaveShort}
                initialData={selectedShort}
                position={clickPosition!}
              />
            </div>
          </>
        )}
      </main>
    </RootLayout>
  );
}
