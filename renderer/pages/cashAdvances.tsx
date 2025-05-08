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
import CashAdvanceForm from "@/renderer/components/CashAdvanceForm";
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

export default function CashAdvancesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCashAdvance, setSelectedCashAdvance] =
    useState<CashAdvance | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);

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
        return null;
      }

      const { year, month, dbPath: hookDbPath, companyName: hookCompanyName } = params;
      let advances: CashAdvance[] = [];
      let emp: Employee | null = null;

      try {
        if (isWebEnvironment()) {
          if (!hookCompanyName) {
            toast.error("Company name not available for web mode.");
            throw new Error("Company name not available for web mode.");
          }
          advances = await loadCashAdvancesFirestore(
            selectedEmployeeId,
            month + 1,
            year,
            hookCompanyName
          );
        } else {
          if (!hookDbPath) {
            toast.error("Database path not available for desktop mode.");
            throw new Error("Database path not available for desktop mode.");
          }
          const cashAdvanceModel = createCashAdvanceModel(
            hookDbPath,
            selectedEmployeeId,
            month + 1,
            year
          );
          advances = await cashAdvanceModel.loadCashAdvances(selectedEmployeeId);

          const employeeModel = createEmployeeModel(hookDbPath);
          emp = await employeeModel.loadEmployeeById(selectedEmployeeId);
          setEmployee(emp);
        }
        return advances;
      } catch (error) {
        console.error("Error loading cash advances data:", error);
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

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

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

  const filteredAdvances = cashAdvances || [];

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
    setClickPosition(null);
    setSelectedCashAdvance(null);
  };

  const handleButtonClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 450;
    const dialogWidth = 850;
    const spacing = 8;

    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    let left = rect.left + rect.width / 2 - dialogWidth / 2;

    left =
      Math.max(spacing, Math.min(left, windowWidth - dialogWidth - spacing)) -
      60;

    const caretLeft = rect.left + rect.width / 2 - left;

    setClickPosition({
      top,
      left,
      showAbove,
      caretLeft,
    });

    setSelectedCashAdvance(null);
    setIsDialogOpen(true);
  };

  const handleRowClick = (event: React.MouseEvent, advance: CashAdvance) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const dialogHeight = 450;
    const dialogWidth = 850;
    const spacing = 8;

    const spaceBelow = windowHeight - rect.bottom;
    const showAbove = spaceBelow < dialogHeight && rect.top > dialogHeight;
    const top = showAbove
      ? rect.top - dialogHeight - spacing
      : rect.bottom + spacing;

    let left = rect.left + rect.width / 2 - dialogWidth / 2;

    left = Math.max(
      spacing,
      Math.min(left, windowWidth - dialogWidth - spacing)
    );

    const caretLeft = rect.left + rect.width / 2 - left;

    setClickPosition({
      top,
      left,
      showAbove,
      caretLeft,
    });

    setSelectedCashAdvance(advance);
    setIsDialogOpen(true);
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

    const currentYear = useDateSelectorStore.getState().selectedYear;
    const currentMonth = useDateSelectorStore.getState().selectedMonth + 1;

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
          currentMonth,
          currentYear,
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
          currentMonth,
          currentYear
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
    }
  }

  async function handleDeleteCashAdvance(advanceId: string) {
    if (!selectedEmployeeId) return;

    const currentYear = useDateSelectorStore.getState().selectedYear;
    const currentMonth = useDateSelectorStore.getState().selectedMonth + 1;

    setLoading(true);
    try {
      if (isWebEnvironment()) {
        if (!companyNameFromSettings) throw new Error("Company name not set.");
        await deleteCashAdvanceFirestore(
          advanceId,
          selectedEmployeeId,
          currentMonth,
          currentYear,
          companyNameFromSettings
        );
      } else {
        if (!dbPath) throw new Error("Database path not set.");
        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          selectedEmployeeId,
          currentMonth,
          currentYear
        );
        await cashAdvanceModel.deleteCashAdvance(advanceId);
      }
      toast.success("Cash advance deleted successfully");
      refetchData();
    } catch (error) {
      console.error("Error deleting cash advance:", error);
      toast.error(
        error instanceof Error
          ? `Error deleting cash advance: ${error.message}`
          : "Error deleting cash advance"
      );
    } finally {
    }
  }

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
                      {selectedEmployeeId ? (
                        <EmployeeDropdown
                          selectedEmployeeId={selectedEmployeeId}
                          onSelectEmployee={setSelectedEmployeeId}
                          labelPrefix="Cash Advances"
                        />
                      ) : (
                        "Cash Advances"
                      )}
                    </h2>
                    <div className="relative flex items-center space-x-4">
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
                              No cash advances found for{" "}
                              {new Date(
                                useDateSelectorStore.getState().selectedYear,
                                useDateSelectorStore.getState().selectedMonth,
                                1
                              ).toLocaleString("default", {
                                month: "long",
                                year: "numeric",
                              })}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Get started by clicking the "Apply for Cash
                              Advance" button above.
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
                                onClick={(e) => handleRowClick(e, advance)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(advance.date).toLocaleDateString()}
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
              <CashAdvanceForm
                onClose={handleCloseDialog}
                onSave={handleSaveCashAdvance}
                initialData={selectedCashAdvance}
                position={clickPosition!}
              />
            </div>
          </>
        )}
      </main>
    </RootLayout>
  );
}
