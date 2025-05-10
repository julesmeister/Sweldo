"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { IoSettingsOutline } from "react-icons/io5";
import LoanForm from "@/renderer/components/forms/LoanForm";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { createLoanModel } from "@/renderer/model/loan";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

import { Loan } from "@/renderer/model/loan";
import RootLayout from "@/renderer/components/layout";
import { MagicCard } from "../components/magicui/magic-card";
import AddButton from "@/renderer/components/magicui/add-button";
import EmployeeDropdown from "@/renderer/components/EmployeeDropdown";
import { useDateAwareDataFetching } from "@/renderer/hooks/useDateAwareDataFetching";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { useAuthStore } from "../stores/authStore";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";
import NoDataPlaceholder from "@/renderer/components/NoDataPlaceholder";
import DecryptedText from "../styles/DecryptedText/DecryptedText";

export default function LoansPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [clickPosition, setClickPosition] = useState<{
    top: number;
    left: number;
    showAbove: boolean;
    caretLeft: number;
  } | null>(null);
  const { dbPath } = useSettingsStore();
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isWebMode, setIsWebMode] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const pathname = usePathname();
  const { setLoading, activeLink, setActiveLink } = useLoadingStore();
  const router = useRouter();
  const { hasAccess } = useAuthStore();

  const hasDeleteAccess = hasAccess("MANAGE_PAYROLL");

  // Check if running in web mode
  useEffect(() => {
    const checkWebMode = async () => {
      const isWeb = isWebEnvironment();
      setIsWebMode(isWeb);

      if (isWeb) {
        const company = await getCompanyName();
        setCompanyName(company);
      }
    };

    checkWebMode();
  }, []);

  const effectiveDbPath = isWebMode ? "web" : dbPath;

  const employeeModel = useMemo(
    () => (effectiveDbPath ? createEmployeeModel(effectiveDbPath) : null),
    [effectiveDbPath]
  );

  const loanModel = useMemo(
    () =>
      effectiveDbPath && selectedEmployeeId
        ? createLoanModel(effectiveDbPath, selectedEmployeeId)
        : null,
    [effectiveDbPath, selectedEmployeeId]
  );

  useEffect(() => {
    const loadEmployee = async () => {
      if (!effectiveDbPath) {
        return;
      }
      if (!selectedEmployeeId) {
        return;
      }
      if (!employeeModel) {
        return;
      }
      if (selectedEmployeeId) {
        setLoading(true);
        try {
          const emp = await employeeModel.loadEmployeeById(selectedEmployeeId!);
          if (emp !== null) setEmployee(emp);
        } catch (error) {
          console.error("Error loading employee:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadEmployee();
  }, [effectiveDbPath, selectedEmployeeId, employeeModel, setLoading]);

  // Use the date-aware data fetching hook
  const fetchLoans = async (year: number, month: number) => {
    if (!loanModel) return [];
    return loanModel.loadLoans(year, month);
  };

  const { data: loans, isLoading, error, refetch } = useDateAwareDataFetching<Loan[]>(
    fetchLoans,
    [],
    [loanModel, selectedEmployeeId]
  );

  // Display error if any
  useEffect(() => {
    if (error) {
      toast.error(`Error loading loans: ${error.message}`);
    }
  }, [error]);

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

  const handleLinkClick = async (path: string) => {
    if (path === pathname) return;
    try {
      setLoading(true);
      setActiveLink(path);
      await router.push(path);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLoan = async (data: Loan): Promise<void> => {
    if (loanModel) {
      try {
        await loanModel.createLoan(data);
        toast.success("Loan saved successfully", {
          position: "bottom-right",
          duration: 3000,
        });
        // Refetch loans after saving
        refetch();
      } catch (error) {
        console.error("Error saving loan:", error);
        toast.error(`Error saving loan: ${error instanceof Error ? error.message : String(error)}`, {
          position: "bottom-right",
          duration: 3000,
        });
      }
    } else {
      console.error("Loan model is not initialized");
      toast.error("Loan model is not initialized");
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
                      {selectedEmployeeId ? (
                        <EmployeeDropdown
                          selectedEmployeeId={selectedEmployeeId}
                          onSelectEmployee={setSelectedEmployeeId}
                          labelPrefix="Loans"
                        />
                      ) : (
                        <DecryptedText text="Loans" animateOn="view" revealDirection='start' speed={50} sequential={true} />
                      )}
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
                      {loans.length === 0 ? (
                        <NoDataPlaceholder
                          employeeName={employee?.name}
                          dataType="loans"
                          actionText="Apply for Loan"
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
                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150 ease-in-out ${!hasDeleteAccess
                                      ? "opacity-50 cursor-not-allowed"
                                      : "cursor-pointer"
                                      }`}
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
                      dataType="loans"
                      actionText="Apply for Loan"
                      onActionClick={() => handleButtonClick}
                      onSelectEmployeeClick={() => handleLinkClick("/")}
                    />
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
              initialData={selectedLoan}
              position={clickPosition!}
              isWebMode={isWebMode}
              companyName={companyName}
            />
          </div>
        )}
      </main>
    </RootLayout>
  );
}
