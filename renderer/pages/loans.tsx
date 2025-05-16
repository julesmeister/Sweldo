"use client";

import { useState, useEffect, useMemo } from "react";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { useLoadingStore } from "@/renderer/stores/loadingStore";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { toast } from "sonner";
import { IoClose, IoSettingsOutline, IoPencil, IoTrash, IoList } from "react-icons/io5";
import LoanForm from "@/renderer/components/forms/LoanForm";
import { createEmployeeModel, Employee } from "@/renderer/model/employee";
import { createLoanModel, Loan, Deduction } from "@/renderer/model/loan";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

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

// Deductions Modal Component
interface DeductionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
}

const DeductionsModal: React.FC<DeductionsModalProps> = ({ isOpen, onClose, loan }) => {
  if (!isOpen || !loan) return null;

  const calculateTotalDeductions = (currentLoan: Loan): number => {
    if (!currentLoan.deductions) return 0;
    return Object.values(currentLoan.deductions).reduce((sum, deduction) => sum + deduction.amountDeducted, 0);
  };

  const totalDeducted = calculateTotalDeductions(loan);
  const displayedRemainingBalance = loan.amount - totalDeducted;

  const deductionsArray = loan.deductions ? Object.entries(loan.deductions) : [];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
      <div className="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-gray-800 text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Loan Deductions for Loan ID: {loan.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <IoClose size={24} />
          </button>
        </div>
        <div className="mb-4">
          <p><strong>Employee ID:</strong> {loan.employeeId}</p>
          <p><strong>Loan Date:</strong> {new Date(loan.date).toLocaleDateString()}</p>
          <p><strong>Loan Amount:</strong> ₱{loan.amount.toLocaleString()}</p>
          <p><strong>Loan Type:</strong> {loan.type}</p>
        </div>

        {deductionsArray.length > 0 ? (
          <div className="overflow-x-auto mb-4 max-h-80">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Deduction ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Date Deducted</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Payroll ID</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {deductionsArray.map(([deductionId, deduction]) => (
                  <tr key={deductionId}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{deductionId}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(deduction.dateDeducted).toLocaleDateString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-right">₱{deduction.amountDeducted.toLocaleString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{deduction.payrollId || "N/A"}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{deduction.notes || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-4 text-gray-400">No deductions recorded for this loan yet.</p>
        )}

        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-md"><strong>Total Deducted:</strong> <span className="font-semibold">₱{totalDeducted.toLocaleString()}</span></p>
          <p className="text-lg"><strong>Calculated Remaining Balance:</strong> <span className="font-bold text-green-400">₱{displayedRemainingBalance.toLocaleString()}</span></p>
        </div>

        <div className="text-right mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default function LoansPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [loanFormPosition, setLoanFormPosition] = useState<{
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

  const [isDeductionsModalOpen, setIsDeductionsModalOpen] = useState(false);
  const [currentLoanForDeductions, setCurrentLoanForDeductions] = useState<Loan | null>(null);

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

  const handleEditLoanClick = (loan: Loan, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dialogHeight = 550; // Approximate height of LoanForm dialog
    const dialogWidth = 500; // Width of the LoanForm dialog
    const spacing = 8;

    const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;

    setLoanFormPosition({
      top: showAbove ? rect.top - dialogHeight - spacing : rect.bottom + spacing,
      left: rect.right - dialogWidth + (rect.width / 2),
      showAbove,
      caretLeft: dialogWidth - rect.width / 2 - 8, // Adjust caret based on button position
    });
    setSelectedLoan(loan);
    setIsDialogOpen(true);
  };

  const handleApplyForLoanClick = (event: React.MouseEvent | null) => {
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dialogHeight = 550;
      const dialogWidth = 500;
      const spacing = 8;

      const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;

      setLoanFormPosition({
        top: showAbove ? rect.top - dialogHeight - spacing : rect.bottom + spacing,
        left: rect.right - dialogWidth + (rect.width / 2),
        showAbove,
        caretLeft: dialogWidth - rect.width / 2 - 8,
      });
    } else {
      setLoanFormPosition(null);
    }
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

  const calculateDisplayedRemainingBalance = (loan: Loan): number => {
    if (!loan.deductions) {
      return loan.amount; // Or loan.remainingBalance if that's preferred as starting point before deductions
    }
    const totalDeducted = Object.values(loan.deductions).reduce(
      (sum, deduction) => sum + deduction.amountDeducted,
      0
    );
    return loan.amount - totalDeducted;
  };

  const handleOpenDeductionsModal = (loan: Loan) => {
    setCurrentLoanForDeductions(loan);
    setIsDeductionsModalOpen(true);
  };

  const handleCloseDeductionsModal = () => {
    setIsDeductionsModalOpen(false);
    setCurrentLoanForDeductions(null);
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
                        onClick={handleApplyForLoanClick}
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
                          onActionClick={() => handleApplyForLoanClick(null)}
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
                                Remaining Balance
                              </th>
                              <th
                                scope="col"
                                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {loans.map((loan) => (
                              <tr
                                key={loan.id}
                                className="hover:bg-gray-50"
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
                                <td
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                  ₱{calculateDisplayedRemainingBalance(loan).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                  <button
                                    onClick={() => handleOpenDeductionsModal(loan)}
                                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md
                                    text-emerald-700 bg-emerald-100 hover:bg-emerald-200
                                    shadow-sm transition-all duration-200
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                                  >
                                    <IoList className="mr-1.5 h-3.5 w-3.5" />
                                    Show Deductions
                                  </button>
                                  <button
                                    onClick={(e) => handleEditLoanClick(loan, e)}
                                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md 
                                    text-indigo-700 bg-indigo-100 hover:bg-indigo-200 
                                    shadow-sm transition-all duration-200 
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  >
                                    <IoPencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                  </button>

                                  {hasDeleteAccess && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (loanModel) {
                                          try {
                                            setLoading(true);
                                            await loanModel.deleteLoan(loan.id, loan);
                                            toast.success("Loan deleted successfully", {
                                              position: "bottom-right",
                                              duration: 3000,
                                            });
                                            refetch(); // Refetch loans after deletion
                                          } catch (error) {
                                            console.error("Error deleting loan:", error);
                                            toast.error(`Error deleting loan: ${error instanceof Error ? error.message : String(error)}`, {
                                              position: "bottom-right",
                                              duration: 3000,
                                            });
                                          } finally {
                                            setLoading(false);
                                          }
                                        } else {
                                          console.error("Loan model is not initialized");
                                          toast.error("Loan model is not initialized");
                                        }
                                      }}
                                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-md
                                        text-red-700 bg-red-100 hover:bg-red-200
                                        shadow-sm transition-all duration-200
                                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                    >
                                      <IoTrash className="mr-1.5 h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  )}
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
                      onActionClick={() => handleApplyForLoanClick(null)}
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
                setLoanFormPosition(null);
              }
            }}
          >
            <LoanForm
              onClose={() => {
                setIsDialogOpen(false);
                setLoanFormPosition(null);
              }}
              onSave={handleSaveLoan}
              initialData={selectedLoan}
              position={loanFormPosition ? loanFormPosition : undefined}
              isWebMode={isWebMode}
              companyName={companyName}
            />
          </div>
        )}
        {/* Render Deductions Modal */}
        <DeductionsModal
          isOpen={isDeductionsModalOpen}
          onClose={handleCloseDeductionsModal}
          loan={currentLoanForDeductions}
        />
      </main>
    </RootLayout>
  );
}
