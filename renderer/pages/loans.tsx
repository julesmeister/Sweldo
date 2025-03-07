"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { IoSettingsOutline } from "react-icons/io5";
import LoanForm from "@/renderer/components/LoanForm";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { createLoanModel } from "@/renderer/model/loan";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

import { Loan } from "@/renderer/model/loan";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId } = useEmployeeStore();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const employeeModel = useMemo(() => dbPath ? createEmployeeModel(dbPath) : null, [dbPath]);
  const pathname = usePathname();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const router = useRouter();
  useEffect(() => {
    const loadEmployee = async () => {
      console.log("[LoansPage] Loading employee with ID", selectedEmployeeId);
      if (!dbPath || !selectedEmployeeId || !employeeModel) {
        console.error(
          "[LoansPage] Error loading employee:",
          "database path is not set or no selectedEmployeeId provided or employeeModel is undefined."
        );
        console.log("[LoansPage] dbPath:", dbPath);
        console.log("[LoansPage] selectedEmployeeId:", selectedEmployeeId);
        console.log("[LoansPage] employeeModel:", employeeModel);
        return;
      }
      if (selectedEmployeeId) {
        setLoading(true);
        try {
          console.log(
            "[LoansPage] Attempting to load employee with ID",
            selectedEmployeeId
          );
          const emp = await employeeModel.loadEmployeeById(selectedEmployeeId!);
          console.log("[LoansPage] Loaded employee:", emp);
          if (emp !== null) setEmployee(emp);
        } catch (error) {
          console.error("[LoansPage] Error loading employee:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadEmployee();
  }, [dbPath, selectedEmployeeId, employeeModel, setLoading]);

  const loanModel =
    dbPath && selectedEmployeeId
      ? createLoanModel(dbPath, selectedEmployeeId)
      : null;

  console.log("loanModel:", loanModel);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  useEffect(() => {
    if (!storedYear) {
      const currentYear = new Date().getFullYear().toString();
      localStorage.setItem("selectedYear", currentYear);
      setStoredYear(currentYear);
    }
  }, [storedYear]);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;

  const year = parseInt(storedYear!, 10);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      case "Completed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getLoanTypeColor = (type: string) => {
    switch (type) {
      case "Personal":
        return "bg-blue-100 text-blue-800";
      case "Housing":
        return "bg-purple-100 text-purple-800";
      case "Emergency":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleButtonClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dialogHeight = 550; // Approximate height of dialog
    const dialogWidth = 500; // Width of the dialog
    const spacing = 8; // Space between dialog and row

    // If there's not enough space below and more space above, show above
    const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;

    setClickPosition({
      top: showAbove ? rect.top - spacing : rect.bottom + spacing,
      left: rect.right - dialogWidth,
      showAbove,
      caretLeft: dialogWidth - rect.width / 2 - 8,
    });

    setSelectedLoan(null);
    setIsDialogOpen(true);
  };

  const handleLinkClick = (path: string) => {
    if (path === pathname) return;
    console.log('Setting loading state to true');
    setLoading(true);
    setActiveLink(path);
    router.push(path);
  };

  const handleSaveLoan = (data: Loan): void => {
    console.log("Saving loan:", data);
    if (loanModel) {
      loanModel
        .createLoan(data)
        .then(() => {
          console.log("Loan saved successfully");
          toast.success("Loan saved successfully", {
            position: "bottom-right",
            duration: 3000,
          });
        })
        .catch((error) => {
          console.error("Error saving loan:", error);
          toast.error(`Error saving loan: ${error.message}`, {
            position: "bottom-right",
            duration: 3000,
          });
        });
    } else {
      console.error("Loan model is not initialized");
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
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  {selectedEmployeeId ? employee?.name + "'s Loans" : "Loans"}
                </h2>
                <div className="relative flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={handleButtonClick}
                    className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                  >
                    Apply for Loan
                  </button>
                </div>
              </div>
              {selectedEmployeeId ? (
                <div className="overflow-x-auto relative">
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
                          Amount
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
                          Monthly Payment
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Remaining Balance
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Next Payment
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
                      {loans.map((loan) => (
                        <tr
                          key={loan.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setIsDialogOpen(true);
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(loan.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getLoanTypeColor(
                                loan.type
                              )}`}
                            >
                              {loan.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₱{loan.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(
                                loan.status
                              )}`}
                            >
                              {loan.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₱{loan.monthlyPayment.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ₱{loan.remainingBalance.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(
                              loan.nextPaymentDate
                            ).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Handle delete
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    their loans.
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
        <div className="fixed inset-0 bg-black opacity-50 z-40" />
      )}
      {isDialogOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDialogOpen(false);
              setClickPosition(null);
            }
          }}
        >
          <LoanForm
            onClose={() => {
              setIsDialogOpen(false);
              setClickPosition(null);
            }}
            onSave={handleSaveLoan}
            initialData={undefined}
            position={clickPosition!}
          />
        </div>
      )}
    </main>
    </RootLayout>
  );
}
