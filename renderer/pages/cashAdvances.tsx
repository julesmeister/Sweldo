"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import {
  CashAdvance,
  createCashAdvanceModel,
} from "@/renderer/model/cashAdvance";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import CashAdvanceForm from "@/renderer/components/forms/CashAdvanceForm";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";
import { useAuthStore } from "@/renderer/stores/authStore";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import useDateAwareData from "@/renderer/hooks/useDateAwareData";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import {
  loadCashAdvancesFirestore,
  saveCashAdvanceFirestore,
  deleteCashAdvanceFirestore,
} from "@/renderer/model/cashAdvance_firestore";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";
import NoDataPlaceholder from "@/renderer/components/NoDataPlaceholder";
import DecryptedText from "../styles/DecryptedText/DecryptedText";
import { IoInformationCircleOutline, IoPrintOutline } from "react-icons/io5";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateCashAdvancesWebPDF } from "@/renderer/components/cashAdvance/web/pdfGeneratorCashAdvance";

export default function CashAdvancesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCashAdvance, setSelectedCashAdvance] =
    useState<CashAdvance | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const { activeLink, setActiveLink } = useLoadingStore();
  const { dbPath, companyName: companyNameFromSettings } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const pathname = usePathname();
  const { hasAccess } = useAuthStore();
  const hasDeleteAccess = hasAccess("MANAGE_PAYROLL");

  const fetchCashAdvancesAndEmployee = useCallback(
    async (params: {
      year: number;
      month: number;
      dbPath: string | null;
      companyName: string | null;
    }) => {
      if (!selectedEmployeeId) {
        setEmployee(null);
        console.log("[DEBUG] fetchCashAdvancesAndEmployee - No selectedEmployeeId, returning null");
        return null;
      }

      const { year, month, dbPath: hookDbPath, companyName: hookCompanyName } = params;
      console.log(`[DEBUG] fetchCashAdvancesAndEmployee - Starting fetch for employee: ${selectedEmployeeId}, year: ${year}`);
      console.log(`[DEBUG] fetchCashAdvancesAndEmployee - isWebEnvironment: ${isWebEnvironment()}, dbPath: ${hookDbPath}, companyName: ${hookCompanyName}`);

      let allAdvances: CashAdvance[] = [];
      let emp: Employee | null = null;

      try {
        if (isWebEnvironment()) {
          console.log(`[DEBUG] fetchCashAdvancesAndEmployee - In web mode`);
          if (!hookCompanyName) {
            console.error("[DEBUG] fetchCashAdvancesAndEmployee - Company name not available for web mode");
            toast.error("Company name not available for web mode.");
            throw new Error("Company name not available for web mode.");
          }

          // Load advances for all months in the year
          for (let m = 1; m <= 12; m++) {
            console.log(`[DEBUG] fetchCashAdvancesAndEmployee - Web mode: Loading month ${m}`);
            try {
              const monthAdvances = await loadCashAdvancesFirestore(
                selectedEmployeeId,
                m,
                year,
                hookCompanyName
              );
              allAdvances = [...allAdvances, ...monthAdvances];
            } catch (error) {
              console.warn(`[DEBUG] Error loading cash advances for month ${m}:`, error);
              // Continue with other months even if one fails
            }
          }
          console.log(`[DEBUG] fetchCashAdvancesAndEmployee - Web mode: Loaded ${allAdvances.length} total cash advances for the year`);
        } else {
          console.log(`[DEBUG] fetchCashAdvancesAndEmployee - In desktop mode`);
          if (!hookDbPath) {
            console.error("[DEBUG] fetchCashAdvancesAndEmployee - Database path not available for desktop mode");
            toast.error("Database path not available for desktop mode.");
            throw new Error("Database path not available for desktop mode.");
          }

          // Load advances for all months in the year
          for (let m = 1; m <= 12; m++) {
            console.log(`[DEBUG] fetchCashAdvancesAndEmployee - Desktop mode: Loading month ${m}`);
            try {
              const cashAdvanceModel = createCashAdvanceModel(
                hookDbPath,
                selectedEmployeeId,
                m,
                year
              );
              const monthAdvances = await cashAdvanceModel.loadCashAdvances(selectedEmployeeId);
              allAdvances = [...allAdvances, ...monthAdvances];
            } catch (error) {
              console.warn(`[DEBUG] Error loading cash advances for month ${m}:`, error);
              // Continue with other months even if one fails
            }
          }
          console.log(`[DEBUG] fetchCashAdvancesAndEmployee - Desktop mode: Loaded ${allAdvances.length} total cash advances for the year`);

          const employeeModel = createEmployeeModel(hookDbPath);
          emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
          setEmployee(emp);
        }
        console.log(`[DEBUG] fetchCashAdvancesAndEmployee - Successfully completed with ${allAdvances.length} advances for the full year`);
        return allAdvances;
      } catch (error) {
        console.error("[DEBUG] fetchCashAdvancesAndEmployee - Error loading cash advances data:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to load cash advances"
        );
        if (isWebEnvironment()) setEmployee(null);
        return null;
      }
    },
    [selectedEmployeeId]
  );

  const { data: cashAdvances, isLoading, refetchData } = useDateAwareData<CashAdvance[]>(
    fetchCashAdvancesAndEmployee
  );

  const { setLoading } = useLoadingStore();

  // REMOVED: This useEffect was causing race conditions with delete operations
  // The loading state was getting stuck, causing LoadingBar z-index 9999 to block all input interactions
  // useEffect(() => {
  //   setLoading(isLoading);
  // }, [isLoading, setLoading]);

  useEffect(() => {
    const loadSelectedEmployee = async () => {
      if (!selectedEmployeeId) {
        setEmployee(null);
        return;
      }
      if (isWebEnvironment()) {
        if (!companyNameFromSettings) return;
        const foundEmp = employees.find(e => e.id === selectedEmployeeId);
        setEmployee(foundEmp || null);
      } else {
        if (!dbPath) return;
        const employeeModel = createEmployeeModel(dbPath);
        const emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
        setEmployee(emp);
      }
    };
    loadSelectedEmployee();
  }, [selectedEmployeeId, dbPath, companyNameFromSettings, employees]);

  useEffect(() => {
    const loadEmps = async () => {
      if (isWebEnvironment()) {
        if (!companyNameFromSettings) {
          setEmployees([]);
          return;
        }
        try {
          const firestoreEmployees = await loadActiveEmployeesFirestore(companyNameFromSettings);
          setEmployees(firestoreEmployees);
        } catch (error) {
          console.error("Error loading active employees from Firestore for dropdown:", error);
          toast.error("Error loading employees for dropdown (web)");
          setEmployees([]);
        }
      } else {
        if (!dbPath) {
          setEmployees([]);
          return;
        }
        try {
          const model = createEmployeeModel(dbPath);
          const loaded = await model.loadActiveEmployees();
          setEmployees(loaded);
        } catch (error) {
          console.error("Error loading active employees from local DB for dropdown:", error);
          toast.error("Error loading employees for dropdown (desktop)");
          setEmployees([]);
        }
      }
    };
    loadEmps();
  }, [dbPath, companyNameFromSettings]);

  const filteredAdvances = useMemo(() => {
    if (!cashAdvances) return [];

    // Sort cash advances by date, newest first
    return [...cashAdvances].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [cashAdvances]);

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

  const getScheduleColor = (schedule: string) => {
    return schedule === "One-time"
      ? "bg-blue-100 text-blue-800"
      : "bg-purple-100 text-purple-800";
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCashAdvance(null);
  };

  const handleButtonClick = () => {
    setSelectedCashAdvance(null);
    setIsDialogOpen(true);
  };

  const handleEditCashAdvance = (advance: CashAdvance) => {
    setSelectedCashAdvance(advance);
    setIsDialogOpen(true);
    console.log("Editing cash advance:", advance);
  };

  const router = useRouter();
  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  async function handleSaveCashAdvance(data: CashAdvance): Promise<void> {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee first");
      return;
    }

    // Use the month from the date field of the cash advance
    const advanceDate = new Date(data.date);
    const advanceMonth = advanceDate.getMonth() + 1; // Convert from 0-based to 1-based
    const advanceYear = advanceDate.getFullYear();

    setLoading(true);
    try {
      if (isWebEnvironment()) {
        if (!companyNameFromSettings) {
          toast.error("Company name not set for web mode.");
          throw new Error("Company name not set for web mode.");
        }
        const advanceToSave = {
          ...data,
          id: selectedCashAdvance ? selectedCashAdvance.id : crypto.randomUUID(),
          employeeId: selectedEmployeeId,
        };
        await saveCashAdvanceFirestore(
          advanceToSave,
          advanceMonth,
          advanceYear,
          companyNameFromSettings
        );
      } else {
        if (!dbPath) {
          toast.error("Database path is not configured");
          throw new Error("Database path is not configured");
        }
        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          selectedEmployeeId,
          advanceMonth,
          advanceYear
        );
        if (selectedCashAdvance) {
          await cashAdvanceModel.updateCashAdvance({
            ...data,
            id: selectedCashAdvance.id,
            employeeId: selectedEmployeeId!,
          });
        } else {
          await cashAdvanceModel.createCashAdvance({
            ...data,
            id: crypto.randomUUID(),
            employeeId: selectedEmployeeId!,
          });
        }
      }
      toast.success(
        `Cash advance ${selectedCashAdvance ? "updated" : "created"} successfully`,
        {
          position: "bottom-right",
          duration: 3000,
        }
      );
      refetchData();
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving cash advance:", error);
      toast.error(
        error instanceof Error
          ? `Error saving cash advance: ${error.message}`
          : "Error saving cash advance",
        {
          position: "bottom-right",
          duration: 3000,
        }
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCashAdvance(advanceId: string) {
    if (!selectedEmployeeId) return;

    // Find the cash advance to get its date
    const advanceToDelete = filteredAdvances.find(adv => adv.id === advanceId);
    if (!advanceToDelete) {
      toast.error("Cash advance not found");
      return;
    }

    // Get month and year from the cash advance date
    const advanceDate = new Date(advanceToDelete.date);
    const advanceMonth = advanceDate.getMonth() + 1; // Convert from 0-based to 1-based
    const advanceYear = advanceDate.getFullYear();

    setLoading(true);
    try {
      if (isWebEnvironment()) {
        if (!companyNameFromSettings) throw new Error("Company name not set.");
        await deleteCashAdvanceFirestore(
          advanceId,
          selectedEmployeeId,
          advanceMonth,
          advanceYear,
          companyNameFromSettings
        );
      } else {
        if (!dbPath) throw new Error("Database path not set.");
        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          selectedEmployeeId,
          advanceMonth,
          advanceYear
        );
        await cashAdvanceModel.deleteCashAdvance(advanceId);
      }
      toast.success("Cash advance deleted successfully");
      refetchData();
      
      // CRITICAL: Force loading state to false to prevent LoadingBar from blocking interactions
      setTimeout(() => {
        setLoading(false);
      }, 500);
      
      // CRITICAL: Simulate focus context reset that fixes the issue (like Alt+Tab)
      setTimeout(() => {
        // Try to programmatically trigger the same focus reset that Alt+Tab provides
        if (window.electron && window.electron.blurWindow) {
          // Electron method to blur the window and refocus
          window.electron.blurWindow();
          setTimeout(() => {
            window.electron.focusWindow();
          }, 50);
        } else {
          // Web fallback - try to simulate focus loss/regain
          window.blur();
          setTimeout(() => {
            window.focus();
            document.body.focus();
          }, 50);
        }
      }, 200);
    } catch (error) {
      console.error("Error deleting cash advance:", error);
      toast.error(
        error instanceof Error
          ? `Error deleting cash advance: ${error.message}`
          : "Error deleting cash advance"
      );
    } finally {
      setLoading(false);
    }
  }

  // Function to print cash advances as PDF
  const handlePrintCashAdvances = async () => {
    const currentYear = useDateSelectorStore.getState().selectedYear;

    setLoading(true);
    toast.info("Preparing cash advances report for the entire year...");

    try {
      // Fetch cash advances for all employees for the entire year
      let allCashAdvances: CashAdvance[] = [];

      if (isWebEnvironment()) {
        if (!companyNameFromSettings) {
          throw new Error("Company name not set for web mode.");
        }

        // Fetch advances for all employees for all months
        for (const emp of employees) {
          for (let month = 1; month <= 12; month++) {
            try {
              const advancesForEmployee = await loadCashAdvancesFirestore(
                emp.id,
                month,
                currentYear,
                companyNameFromSettings
              );
              allCashAdvances = [...allCashAdvances, ...advancesForEmployee];
            } catch (error) {
              console.error(`Error loading cash advances for employee ${emp.id} in month ${month}:`, error);
              // Continue with other months even if one fails
            }
          }
        }
      } else {
        if (!dbPath) {
          throw new Error("Database path not set for desktop mode.");
        }

        // Fetch advances for all employees for all months
        for (const emp of employees) {
          for (let month = 1; month <= 12; month++) {
            try {
              const cashAdvanceModel = createCashAdvanceModel(
                dbPath,
                emp.id,
                month,
                currentYear
              );
              const advancesForEmployee = await cashAdvanceModel.loadCashAdvances(emp.id);
              allCashAdvances = [...allCashAdvances, ...advancesForEmployee];
            } catch (error) {
              console.error(`Error loading cash advances for employee ${emp.id} in month ${month}:`, error);
              // Continue with other months even if one fails
            }
          }
        }
      }

      // Check if we've found any advances
      if (allCashAdvances.length === 0) {
        toast.info(`No cash advances found for the year ${currentYear}`);
        setLoading(false);
        return;
      }

      // Check if we're in web environment
      if (isWebEnvironment()) {
        try {
          // Generate PDF using the utility function
          const doc = generateCashAdvancesWebPDF(
            allCashAdvances,
            employees,
            0, // 0 indicates all months
            currentYear
          );

          // Save PDF
          doc.save(`CashAdvances-${currentYear}-AllMonths.pdf`);
          toast.success("Cash advances report downloaded successfully!");
        } catch (error) {
          console.error("Error generating PDF in web mode:", error);
          toast.error("Failed to generate PDF. See console for details.");
        }
      } else {
        // Desktop mode - use Electron IPC
        try {
          // Gather all data needed for PDF generation
          const cashAdvancesData = {
            advances: allCashAdvances,
            employees: employees,
            month: 0, // 0 indicates all months
            year: currentYear,
            monthName: "All Months"
          };

          if (window.electron) {
            window.electron.generateCashAdvancesPdf(cashAdvancesData)
              .then((filePath: string | null) => {
                if (filePath) {
                  console.log(`Cash advances PDF saved to: ${filePath}`);
                  // Open the saved file
                  window.electron.openPath(filePath)
                    .then(() => console.log(`Opened path: ${filePath}`))
                    .catch((openErr: Error) => console.error(`Failed to open path ${filePath}:`, openErr));
                  toast.success("Cash advances report generated successfully!");
                } else {
                  console.log("Cash advances PDF save was cancelled.");
                }
              })
              .catch((err: Error) => {
                console.error("Error generating cash advances PDF:", err);
                toast.error("Failed to generate PDF. See console for details.");
              });
          } else {
            toast.error("Electron API not available");
          }
        } catch (error) {
          console.error("Error generating PDF in desktop mode:", error);
          toast.error("Failed to generate PDF. See console for details.");
        }
      }
    } catch (error) {
      console.error("Error preparing cash advances report:", error);
      toast.error("Failed to prepare cash advances report");
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
          <div className="px-4sm:px-0">
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-1 gap-6">
              <div className="col-span-1 md:col-span-1">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                      {selectedEmployeeId && employees.length > 0 ? (
                        <EmployeeDropdown
                          employees={employees}
                          selectedEmployeeId={selectedEmployeeId}
                          onSelectEmployee={setSelectedEmployeeId}
                          labelPrefix="Cash Advances"
                        />
                      ) : (
                        <DecryptedText text="Cash Advances" animateOn="view" revealDirection='start' speed={50} sequential={true} />
                      )}
                      <span className="ml-2 text-sm text-gray-500">
                        (Year {useDateSelectorStore.getState().selectedYear})
                      </span>
                    </h2>
                    <div className="relative flex items-center space-x-4">
                      {/* Print PDF Button */}
                      <button
                        type="button"
                        onClick={handlePrintCashAdvances}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                      >
                        <IoPrintOutline className="h-4 w-4 mr-2" />
                        Print Report
                      </button>
                      <button
                        type="button"
                        onClick={handleButtonClick}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                      >
                        Apply for Cash Advance
                      </button>
                    </div>
                  </div>
                  {selectedEmployeeId ? (
                    <div className="overflow-x-auto relative">
                      {filteredAdvances.length === 0 ? (
                        <NoDataPlaceholder
                          employeeName={employee?.name}
                          dataType="cash advances"
                          actionText="Apply for Cash Advance"
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
                                Month
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28"
                              >
                                Amount
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64"
                              >
                                Reason
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
                              >
                                Payment Type
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32"
                              >
                                Approval Status
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28"
                              >
                                Remaining Payments
                              </th>
                              <th
                                scope="col"
                                className="relative py-3.5 pl-3 pr-4 sm:pr-6 w-24"
                              >
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAdvances.map((advance) => (
                              <tr
                                key={advance.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleEditCashAdvance(advance)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(advance.date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(advance.date).toLocaleString('default', { month: 'long' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ₱{advance.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {advance.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getScheduleColor(
                                      advance.paymentSchedule
                                    )}`}
                                  >
                                    {advance.paymentSchedule}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span
                                    className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(
                                      advance.approvalStatus
                                    )}`}
                                  >
                                    {advance.approvalStatus}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ₱{advance.remainingUnpaid.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      if (!hasDeleteAccess) {
                                        toast.error(
                                          "You don't have permission to delete cash advance records"
                                        );
                                        return;
                                      }

                                      if (
                                        !confirm(
                                          "Are you sure you want to delete this cash advance?"
                                        )
                                      ) {
                                        return;
                                      }
                                      handleDeleteCashAdvance(advance.id);
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
                      dataType="cash advances"
                      actionText="Apply for Cash Advance"
                      onActionClick={handleButtonClick}
                      onSelectEmployeeClick={() => handleLinkClick("/")}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </MagicCard>
        <CashAdvanceForm
          key={selectedCashAdvance?.id || 'new-cash-advance'}
          onClose={handleCloseDialog}
          onSave={handleSaveCashAdvance}
          initialData={selectedCashAdvance || undefined}
          isOpen={isDialogOpen}
        />
      </main>
    </RootLayout>
  );
}

