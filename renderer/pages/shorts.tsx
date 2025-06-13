"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { Short, createShortModel } from "@/renderer/model/shorts";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import ShortsForm from "@/renderer/components/forms/ShortsForm";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import { useAuthStore } from "@/renderer/stores/authStore";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";
import {
  loadShortsFirestore,
  createShortFirestore,
  updateShortFirestore,
} from "@/renderer/model/shorts_firestore";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import NoDataPlaceholder from "@/renderer/components/NoDataPlaceholder";
import DecryptedText from "../styles/DecryptedText/DecryptedText";

export default function DeductionsPage() {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedShort, setSelectedShort] = useState<Short | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
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
      storeSelectedMonth + 1,
      storeSelectedYear
    );
  }, [dbPath, selectedEmployeeId, storeSelectedMonth, storeSelectedYear]);
  const { hasAccess } = useAuthStore();

  const hasDeleteAccess = hasAccess("MANAGE_PAYROLL");

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!selectedEmployeeId) {
        setShorts([]);
        return;
      }

      setLoading(true);
      try {
        let allShorts: Short[] = [];
        // Use year from the Zustand store
        const currentShortYear = storeSelectedYear;

        if (isWebEnvironment()) {
          console.log(`[DeductionsPage WEB] Starting to load deductions for employee: ${selectedEmployeeId}, year: ${currentShortYear}`);
          if (!companyNameFromSettings) {
            toast("Company name not configured for web mode. Cannot load deductions.");
            if (mounted) setLoading(false);
            return;
          }

          // Load deductions from all months in Firestore
          for (let month = 1; month <= 12; month++) {
            try {
              console.log(`[DeductionsPage WEB] Loading deductions for ${selectedEmployeeId}, month: ${month}, year: ${currentShortYear}`);
              const monthShorts = await loadShortsFirestore(
                selectedEmployeeId,
                month,
                currentShortYear,
                companyNameFromSettings
              );
              allShorts.push(...monthShorts);
            } catch (error) {
              console.warn(`[DeductionsPage WEB] Error loading shorts for month ${month}:`, error);
              // Continue with other months even if one fails
            }
          }

          console.log(`[DeductionsPage WEB] Loaded ${allShorts.length} total deductions for the year from Firestore.`);
        } else {
          // Desktop mode
          console.log(`[DeductionsPage DESKTOP] Starting to load deductions for employee: ${selectedEmployeeId}, year: ${currentShortYear}`);
          if (!dbPath || !employeeModel) {
            toast("System not fully initialized for desktop mode. Cannot load deductions.");
            if (mounted) setLoading(false);
            return;
          }

          // Load deductions from all months using the model
          for (let month = 1; month <= 12; month++) {
            try {
              const monthModel = createShortModel(
                dbPath,
                selectedEmployeeId,
                month,
                currentShortYear
              );
              const monthShorts = await monthModel.loadShorts(selectedEmployeeId);
              allShorts.push(...monthShorts);
            } catch (error) {
              console.warn(`[DeductionsPage DESKTOP] Error loading shorts for month ${month}:`, error);
              // Continue with other months even if one fails
            }
          }

          console.log(`[DeductionsPage DESKTOP] Loaded ${allShorts.length} total deductions for the year.`);
        }

        if (!mounted) return;

        // Sort shorts by date (newest first)
        allShorts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setShorts(allShorts);
      } catch (error) {
        console.error("Error loading deductions data:", error);
        if (mounted) {
          toast(
            error instanceof Error ? error.message : "Failed to load deductions data"
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
  }, [selectedEmployeeId, dbPath, companyNameFromSettings, employeeModel, storeSelectedYear, setLoading]);

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
            toast("Company name not set. Cannot load selected employee for web mode.");
            setEmployee(null);
            return;
          }
          // Find from the already loaded 'employees' list
          const foundEmp = employees.find(e => e.id === selectedEmployeeId);
          setEmployee(foundEmp || null);
          if (!foundEmp) {
            console.warn(`[DeductionsPage WEB] loadSelectedEmployee: Employee ${selectedEmployeeId} not found in preloaded list.`);
          } else {
            console.log(`[DeductionsPage WEB] loadSelectedEmployee: Successfully found employee ${selectedEmployeeId} in preloaded list.`);
          }
        } else {
          if (!dbPath) {
            toast("Database path not set. Cannot load selected employee for desktop mode.");
            setEmployee(null);
            return;
          }
          const desktopEmployeeModel = createEmployeeModel(dbPath);
          const emp = await desktopEmployeeModel.loadEmployeeById(selectedEmployeeId);
          setEmployee(emp);
          if (!emp) {
            toast("Error loading selected employee details.");
          }
        }
      } catch (error) {
        console.error("[DeductionsPage] Error in loadSelectedEmployee:", error);
        toast("Error loading selected employee details.");
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
            toast("Company name not set. Cannot load employees for web mode.");
            setEmployees([]);
            return;
          }
          console.log("[DeductionsPage WEB] Loading active employees from Firestore for dropdown.");
          const firestoreEmployees = await loadActiveEmployeesFirestore(companyNameFromSettings);
          setEmployees(firestoreEmployees);
        } else {
          if (!dbPath) {
            toast("Database path not set. Cannot load employees for desktop mode.");
            setEmployees([]);
            return;
          }
          console.log("[DeductionsPage DESKTOP] Loading active employees from local DB for dropdown.");
          const employeeModel = createEmployeeModel(dbPath);
          const loadedEmployees = await employeeModel.loadActiveEmployees();
          setEmployees(loadedEmployees);
        }
      } catch (error) {
        console.error("Error loading employees for dropdown:", error);
        toast("Error loading employees for dropdown");
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
    setSelectedShort(null);
  };

  const handleButtonClick = () => {
    setSelectedShort(null);
    setIsDialogOpen(true);
  };

  const handleRowClick = (event: React.MouseEvent, short: Short) => {
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
    if (!selectedEmployeeId) {
      toast("Please select an employee first");
      return;
    }

    setLoading(true);
    try {
      if (isWebEnvironment()) {
        // Web Mode
        if (!companyNameFromSettings) {
          toast("Company name not configured for web mode. Cannot save deduction.");
          setLoading(false);
          return;
        }

        const currentMonthForFirestore = storeSelectedMonth + 1; // Zustand month is 0-indexed
        const currentYearForFirestore = storeSelectedYear;

        if (selectedShort) {
          // Update existing deduction in Firestore
          await updateShortFirestore(
            { ...data, employeeId: selectedEmployeeId! }, // Ensure current employeeId is used
            currentMonthForFirestore,
            currentYearForFirestore,
            companyNameFromSettings
          );
          toast("Deduction updated successfully", {
            position: "bottom-right",
            duration: 3000,
          });
        } else {
          // Create new deduction in Firestore
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...shortDataForCreate } = data; // Firestore backend generates ID if needed, or uses provided if structured that way by the model
          await createShortFirestore(
            shortDataForCreate, // Pass data without the form-generated ID
            selectedEmployeeId!,
            currentMonthForFirestore,
            currentYearForFirestore,
            companyNameFromSettings
          );
          toast("Deduction created successfully", {
            position: "bottom-right",
            duration: 3000,
          });
        }

        // Reload the deductions from Firestore for all months to get the updated list
        let allShorts: Short[] = [];
        for (let month = 1; month <= 12; month++) {
          try {
            const monthShorts = await loadShortsFirestore(
              selectedEmployeeId!,
              month,
              currentYearForFirestore,
              companyNameFromSettings
            );
            allShorts.push(...monthShorts);
          } catch (error) {
            console.warn(`Error loading shorts for month ${month}:`, error);
          }
        }
        allShorts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setShorts(allShorts);
      } else {
        // Desktop Mode (Existing Logic)
        if (!dbPath) {
          toast("Database path is not configured for desktop mode.");
          setLoading(false);
          return;
        }
        if (!shortModel) {
          toast("Deductions system (desktop) not properly initialized. Ensure employee & date context.");
          setLoading(false);
          return;
        }

        if (selectedShort) {
          // Update existing deduction
          await shortModel.updateShort({
            ...data,
            id: selectedShort.id,
            employeeId: selectedEmployeeId!,
            date: data.date, // Use the new date from the form
          });
          toast("Deduction updated successfully", {
            position: "bottom-right",
            duration: 3000,
          });
        } else {
          // Create new deduction
          await shortModel.createShort({
            ...data,
            employeeId: selectedEmployeeId!,
            date: data.date,
          });
          toast("Deduction created successfully", {
            position: "bottom-right",
            duration: 3000,
          });
        }

        // Reload the deductions from all months to get the updated list
        let allShorts: Short[] = [];
        for (let month = 1; month <= 12; month++) {
          try {
            const monthModel = createShortModel(
              dbPath,
              selectedEmployeeId!,
              month,
              storeSelectedYear
            );
            const monthShorts = await monthModel.loadShorts(selectedEmployeeId!);
            allShorts.push(...monthShorts);
          } catch (error) {
            console.warn(`Error loading shorts for month ${month}:`, error);
          }
        }
        allShorts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setShorts(allShorts);
      }

      // Close the dialog
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving deduction:", error);
      toast(
        error instanceof Error
          ? `Error saving deduction: ${error.message}`
          : "Error saving deduction",
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
    console.log(`[DeductionsPage FILTER] Total shorts loaded: ${shorts.length}`);
    // We're already loading shorts for the entire year, so we don't need to filter by month anymore
    return shorts;
  }, [shorts]);

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
                            labelPrefix="Deductions"
                          />
                        ) : (
                          <DecryptedText text="Deductions" animateOn="view" revealDirection='start' speed={50} sequential={true} />
                        )}
                        <span className="ml-2 text-sm text-gray-500">
                          (Year {storeSelectedYear})
                        </span>
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
                          Add Deduction
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      {showTip && (
                        <div className="mt-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-md border border-blue-100">
                          Deductions are amounts owed by an employee to the company. These can be for items like company store purchases, unpaid payables, or other company-related expenses. These are tracked and can be paid back over time.
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedEmployeeId ? (
                    <div className="overflow-x-auto relative">
                      {filteredShorts.length === 0 ? (
                        <NoDataPlaceholder
                          employeeName={employee?.name}
                          dataType="deductions"
                          actionText="Add Deduction"
                          onActionClick={handleButtonClick}
                          onSelectEmployeeClick={() => handleLinkClick("/")}
                        />
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
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24"
                              >
                                Type
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {short.type || "Short"}
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
                                        toast(
                                          "You don't have permission to delete deduction records"
                                        );
                                        return;
                                      }

                                      if (!shortModel) {
                                        toast(
                                          "System not properly initialized"
                                        );
                                        return;
                                      }

                                      if (
                                        !confirm(
                                          "Are you sure you want to delete this deduction?"
                                        )
                                      ) {
                                        return;
                                      }

                                      setLoading(true);
                                      try {
                                        if (isWebEnvironment()) {
                                          // Web mode - use Firestore delete and reload all months
                                          const companyName = companyNameFromSettings;
                                          if (!companyName) {
                                            toast("Company name not configured", {
                                              position: "bottom-right",
                                              duration: 3000,
                                            });
                                            return;
                                          }
                                          
                                          // Delete using Firestore (need to implement deleteShortFirestore)
                                          // For now, we'll use the model's delete method
                                          await shortModel.deleteShort(short.id);
                                          
                                          // Reload all months from Firestore
                                          let allShorts: Short[] = [];
                                          for (let month = 1; month <= 12; month++) {
                                            try {
                                              const monthShorts = await loadShortsFirestore(
                                                selectedEmployeeId!,
                                                month,
                                                storeSelectedYear,
                                                companyName
                                              );
                                              allShorts.push(...monthShorts);
                                            } catch (error) {
                                              console.warn(`Error loading shorts for month ${month}:`, error);
                                            }
                                          }
                                          allShorts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                          setShorts(allShorts);
                                        } else {
                                          // Desktop mode - delete and reload all months
                                          await shortModel.deleteShort(short.id);
                                          
                                          let allShorts: Short[] = [];
                                          for (let month = 1; month <= 12; month++) {
                                            try {
                                              const monthModel = createShortModel(
                                                dbPath!,
                                                selectedEmployeeId!,
                                                month,
                                                storeSelectedYear
                                              );
                                              const monthShorts = await monthModel.loadShorts(selectedEmployeeId!);
                                              allShorts.push(...monthShorts);
                                            } catch (error) {
                                              console.warn(`Error loading shorts for month ${month}:`, error);
                                            }
                                          }
                                          allShorts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                          setShorts(allShorts);
                                        }
                                        
                                        toast(
                                          "Deduction deleted successfully",
                                          {
                                            position: "bottom-right",
                                            duration: 3000,
                                          }
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error deleting deduction:",
                                          error
                                        );
                                        toast(
                                          error instanceof Error
                                            ? `Error deleting deduction: ${error.message}`
                                            : "Error deleting deduction",
                                          {
                                            position: "bottom-right",
                                            duration: 3000,
                                          }
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
                    <NoDataPlaceholder
                      dataType="deductions"
                      actionText="Add Deduction"
                      onActionClick={handleButtonClick}
                      onSelectEmployeeClick={() => handleLinkClick("/")}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
        <ShortsForm
          onClose={handleCloseDialog}
          onSave={handleSaveShort}
          initialData={selectedShort}
          isOpen={isDialogOpen}
        />
      </main>
    </RootLayout>
  );
}
