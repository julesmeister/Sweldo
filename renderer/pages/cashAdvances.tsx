"use client";

import { useState, useEffect, useMemo } from "react";
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

export default function CashAdvancesPage() {
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCashAdvance, setSelectedCashAdvance] =
    useState<CashAdvance | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);

  // Initialize month/year from localStorage on first render
  const [dateContext] = useState(() => {
    const month =
      localStorage.getItem("selectedMonth") || new Date().getMonth().toString();
    const year =
      localStorage.getItem("selectedYear") ||
      new Date().getFullYear().toString();
    return { month, year };
  });

  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
  const pathname = usePathname();
  const employeeModel = useMemo(() => createEmployeeModel(dbPath), [dbPath]);
  const cashAdvanceModel = useMemo(() => {
    if (!selectedEmployeeId || !dbPath) return null;
    return createCashAdvanceModel(
      dbPath,
      selectedEmployeeId,
      parseInt(dateContext.month, 10) + 1,
      parseInt(dateContext.year, 10)
    );
  }, [dbPath, selectedEmployeeId, dateContext]);
  const { hasAccess } = useAuthStore();

  const hasDeleteAccess = hasAccess("MANAGE_PAYROLL");

  // Load employee and cash advances data
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (
        !selectedEmployeeId ||
        !dbPath ||
        !employeeModel ||
        !cashAdvanceModel
      ) {
        return;
      }

      setLoading(true);
      try {
        const [emp, advances] = await Promise.all([
          employeeModel.loadEmployeeById(selectedEmployeeId),
          cashAdvanceModel.loadCashAdvances(selectedEmployeeId),
        ]);

        if (!mounted) return;

        if (emp !== null) setEmployee(emp);
        setCashAdvances(advances);
      } catch (error) {
        console.error("Error loading data:", error);
        if (mounted) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load data"
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
  }, [selectedEmployeeId, dbPath, employeeModel, cashAdvanceModel]);

  // Filter advances based on month/year
  const filteredAdvances = useMemo(() => {
    return cashAdvances.filter((advance) => {
      const advanceDate = new Date(advance.date);
      return (
        advanceDate.getMonth() === parseInt(dateContext.month, 10) &&
        advanceDate.getFullYear() === parseInt(dateContext.year, 10)
      );
    });
  }, [cashAdvances, dateContext]);

  const storedMonthInt = dateContext.month
    ? parseInt(dateContext.month, 10) + 1
    : 0;
  const yearInt = dateContext.year
    ? parseInt(dateContext.year, 10)
    : new Date().getFullYear();
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

    setSelectedCashAdvance(advance);
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

  async function handleSaveCashAdvance(data: CashAdvance): Promise<void> {
    if (!cashAdvanceModel) {
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
      if (selectedCashAdvance) {
        // Update existing cash advance
        await cashAdvanceModel.updateCashAdvance({
          ...data,
          id: selectedCashAdvance.id,
          employeeId: selectedEmployeeId!,
          date: data.date, // Use the new date from the form
        });
        toast.success("Cash advance updated successfully", {
          position: "bottom-right",
          duration: 3000,
        });
      } else {
        // Create new cash advance
        await cashAdvanceModel.createCashAdvance({
          ...data,
          id: crypto.randomUUID(),
          employeeId: selectedEmployeeId!,
          date: data.date,
        });
        toast.success("Cash advance created successfully", {
          position: "bottom-right",
          duration: 3000,
        });
      }

      // Reload the cash advances to get the updated list
      const advances = await cashAdvanceModel.loadCashAdvances(
        selectedEmployeeId!
      );
      setCashAdvances(advances);

      // Close the dialog
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
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-medium text-gray-900 flex items-center">
                      {selectedEmployeeId
                        ? employee?.name + "'s Cash Advances"
                        : "Cash Advances"}
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
                                parseInt(
                                  dateContext.year ||
                                    new Date().getFullYear().toString()
                                ),
                                parseInt(dateContext.month),
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
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      if (!hasDeleteAccess) {
                                        toast.error(
                                          "You don't have permission to delete cash advance records"
                                        );
                                        return;
                                      }

                                      if (!cashAdvanceModel) {
                                        toast.error(
                                          "System not properly initialized"
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

                                      setLoading(true);
                                      try {
                                        await cashAdvanceModel.deleteCashAdvance(
                                          advance.id
                                        );
                                        const advances =
                                          await cashAdvanceModel.loadCashAdvances(
                                            selectedEmployeeId!
                                          );
                                        setCashAdvances(advances);
                                        toast.success(
                                          "Cash advance deleted successfully"
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error deleting cash advance:",
                                          error
                                        );
                                        toast.error(
                                          error instanceof Error
                                            ? `Error deleting cash advance: ${error.message}`
                                            : "Error deleting cash advance"
                                        );
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out ${
                                      !hasDeleteAccess
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
