import { IoTrashOutline } from "react-icons/io5";
import { useState, useEffect } from "react";
import { createCashAdvanceModel } from "@/renderer/model/cashAdvance";
import { createShortModel } from "@/renderer/model/shorts";
import { createLoanModel } from "@/renderer/model/loan";
import { toast } from "sonner";

interface PayrollDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  payrollData: {
    id: string;
    startDate: string;
    endDate: string;
    employeeName: string;
    employeeId: string;
    shortIDs?: string[];
    cashAdvanceIDs?: string[];
    loanDeductionIds?: { loanId: string; deductionId: string; amount: number }[];
    shortDeductions?: number;
    cashAdvanceDeductions?: number;
    loanDeductions?: number;
  };
  dbPath: string;
}

interface ReversalItem {
  id: string;
  amount: number;
  date: string;
  description?: string;
}

interface LoanReversalItem {
  loanId: string;
  deductionId: string;
  amount: number;
  type: string;
  date: string;
}

export const PayrollDeleteDialog: React.FC<PayrollDeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  payrollData,
  dbPath,
}) => {
  const [shorts, setShorts] = useState<ReversalItem[]>([]);
  const [cashAdvances, setCashAdvances] = useState<ReversalItem[]>([]);
  const [loanDeductions, setLoanDeductions] = useState<LoanReversalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadReversalItems = async () => {
      if (!isOpen) return;

      setIsLoading(true);
      try {
        const startDate = new Date(payrollData.startDate);

        // Only load shorts if there are deductions
        if (
          payrollData.shortDeductions &&
          payrollData.shortDeductions > 0 &&
          payrollData.shortIDs &&
          payrollData.shortIDs.length > 0
        ) {
          console.log("[PayrollDeleteDialog] Loading shorts for reversal:", {
            shortIDs: payrollData.shortIDs,
            deductionAmount: payrollData.shortDeductions,
          });

          // Load shorts from both current and next month
          const currentMonth = startDate.getMonth() + 1;
          const currentYear = startDate.getFullYear();

          // Calculate next month/year
          let nextMonth = currentMonth + 1;
          let nextYear = currentYear;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }

          // Create models for both months
          const currentMonthModel = createShortModel(
            dbPath,
            payrollData.employeeId,
            currentMonth,
            currentYear
          );

          const nextMonthModel = createShortModel(
            dbPath,
            payrollData.employeeId,
            nextMonth,
            nextYear
          );

          console.log("[PayrollDeleteDialog] Checking months for shorts:", {
            current: `${currentYear}-${currentMonth}`,
            next: `${nextYear}-${nextMonth}`,
            shortIDs: payrollData.shortIDs,
          });

          // Load shorts from both months
          const [currentShorts, nextShorts] = await Promise.all([
            currentMonthModel.loadShorts(payrollData.employeeId),
            nextMonthModel.loadShorts(payrollData.employeeId),
          ]);

          const allShorts = [...currentShorts, ...nextShorts];
          console.log("[PayrollDeleteDialog] Loaded shorts:", {
            total: allShorts.length,
            current: currentShorts.length,
            next: nextShorts.length,
            shortIDs: payrollData.shortIDs,
          });

          if (isMounted) {
            const filteredShorts = allShorts
              .filter((short) => {
                const matches = payrollData.shortIDs?.includes(short.id);
                console.log("[PayrollDeleteDialog] Checking short:", {
                  id: short.id,
                  matches,
                  amount: short.amount,
                  date: short.date,
                  shortIDs: payrollData.shortIDs,
                });
                return matches;
              })
              .map((short) => ({
                id: short.id,
                amount: short.amount,
                date: short.date.toISOString(),
              }));

            console.log("[PayrollDeleteDialog] Filtered shorts:", {
              shorts: filteredShorts,
              count: filteredShorts.length,
              shortIDs: payrollData.shortIDs,
            });
            setShorts(filteredShorts);
          }
        } else {
          console.log("[PayrollDeleteDialog] No shorts to load:", {
            hasDeductions: !!payrollData.shortDeductions,
            deductionAmount: payrollData.shortDeductions,
            hasIDs: !!payrollData.shortIDs,
            idCount: payrollData.shortIDs?.length,
          });
          if (isMounted) {
            setShorts([]);
          }
        }

        // Only load cash advances if there are deductions
        if (
          payrollData.cashAdvanceDeductions &&
          payrollData.cashAdvanceDeductions > 0 &&
          payrollData.cashAdvanceIDs &&
          payrollData.cashAdvanceIDs.length > 0
        ) {
          console.log(
            "[PayrollDeleteDialog] Loading cash advances for reversal:",
            {
              cashAdvanceIDs: payrollData.cashAdvanceIDs,
              deductionAmount: payrollData.cashAdvanceDeductions,
            }
          );

          // Load cash advances from both current and next month
          const currentMonth = startDate.getMonth() + 1;
          const currentYear = startDate.getFullYear();

          // Calculate next month/year
          let nextMonth = currentMonth + 1;
          let nextYear = currentYear;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
          }

          // Create models for both months
          const currentMonthModel = createCashAdvanceModel(
            dbPath,
            payrollData.employeeId,
            currentMonth,
            currentYear
          );

          const nextMonthModel = createCashAdvanceModel(
            dbPath,
            payrollData.employeeId,
            nextMonth,
            nextYear
          );

          console.log("[PayrollDeleteDialog] Checking months:", {
            current: `${currentYear}-${currentMonth}`,
            next: `${nextYear}-${nextMonth}`,
            cashAdvanceIDs: payrollData.cashAdvanceIDs,
          });

          // Load advances from both months
          const [currentAdvances, nextAdvances] = await Promise.all([
            currentMonthModel.loadCashAdvances(payrollData.employeeId),
            nextMonthModel.loadCashAdvances(payrollData.employeeId),
          ]);

          const allAdvances = [...currentAdvances, ...nextAdvances];
          console.log("[PayrollDeleteDialog] Loaded advances:", {
            total: allAdvances.length,
            current: currentAdvances.length,
            next: nextAdvances.length,
            cashAdvanceIDs: payrollData.cashAdvanceIDs,
          });

          if (isMounted) {
            const filteredCashAdvances = allAdvances
              .filter((ca) => {
                const matches = payrollData.cashAdvanceIDs?.includes(ca.id);
                console.log("[PayrollDeleteDialog] Checking advance:", {
                  id: ca.id,
                  matches,
                  amount: ca.amount,
                  date: ca.date,
                  cashAdvanceIDs: payrollData.cashAdvanceIDs,
                });
                return matches;
              })
              .map((ca) => ({
                id: ca.id,
                amount: ca.amount,
                date: ca.date.toISOString(),
              }));

            console.log("[PayrollDeleteDialog] Filtered advances:", {
              advances: filteredCashAdvances,
              count: filteredCashAdvances.length,
              cashAdvanceIDs: payrollData.cashAdvanceIDs,
            });
            setCashAdvances(filteredCashAdvances);
          }
        } else {
          console.log("[PayrollDeleteDialog] No cash advances to load:", {
            hasDeductions: !!payrollData.cashAdvanceDeductions,
            deductionAmount: payrollData.cashAdvanceDeductions,
            hasIDs: !!payrollData.cashAdvanceIDs,
            idCount: payrollData.cashAdvanceIDs?.length,
          });
          if (isMounted) {
            setCashAdvances([]);
          }
        }

        // Load loan deductions if present
        if (
          payrollData.loanDeductions &&
          payrollData.loanDeductions > 0 &&
          payrollData.loanDeductionIds &&
          payrollData.loanDeductionIds.length > 0
        ) {
          console.log("[PayrollDeleteDialog] Loading loan deductions for reversal:", {
            loanDeductionIds: payrollData.loanDeductionIds,
            deductionAmount: payrollData.loanDeductions,
          });

          // Load loans from both current and previous month
          const currentMonth = startDate.getMonth() + 1;
          const currentYear = startDate.getFullYear();

          // Calculate previous month/year
          let prevMonth = currentMonth - 1;
          let prevYear = currentYear;
          if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
          }

          // Create loan model
          const loanModel = createLoanModel(dbPath, payrollData.employeeId);

          // Load loans from both months
          const [currentMonthLoans, prevMonthLoans] = await Promise.all([
            loanModel.loadLoans(currentYear, currentMonth),
            loanModel.loadLoans(prevYear, prevMonth)
          ]);

          const allLoans = [...currentMonthLoans, ...prevMonthLoans];
          console.log("[PayrollDeleteDialog] Loaded loans:", {
            total: allLoans.length,
            current: currentMonthLoans.length,
            prev: prevMonthLoans.length,
            loanDeductionIds: payrollData.loanDeductionIds
          });

          if (isMounted) {
            const loanItems: LoanReversalItem[] = [];

            for (const deductionInfo of payrollData.loanDeductionIds) {
              const loan = allLoans.find(l => l.id === deductionInfo.loanId);

              if (loan) {
                loanItems.push({
                  loanId: deductionInfo.loanId,
                  deductionId: deductionInfo.deductionId,
                  amount: deductionInfo.amount,
                  type: loan.type,
                  date: loan.date.toISOString()
                });
              } else {
                // Still include the deduction even if we can't find the loan
                loanItems.push({
                  loanId: deductionInfo.loanId,
                  deductionId: deductionInfo.deductionId,
                  amount: deductionInfo.amount,
                  type: "Unknown",
                  date: startDate.toISOString()
                });
              }
            }

            console.log("[PayrollDeleteDialog] Filtered loan deductions:", {
              loans: loanItems,
              count: loanItems.length
            });
            setLoanDeductions(loanItems);
          }
        } else {
          console.log("[PayrollDeleteDialog] No loan deductions to load:", {
            hasDeductions: !!payrollData.loanDeductions,
            deductionAmount: payrollData.loanDeductions,
            hasIds: !!payrollData.loanDeductionIds,
            idCount: payrollData.loanDeductionIds?.length
          });
          if (isMounted) {
            setLoanDeductions([]);
          }
        }
      } catch (error) {
        if (isMounted) {
          toast.error("Failed to load reversal items");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadReversalItems();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    dbPath,
    payrollData.startDate,
    payrollData.employeeId,
    payrollData.shortIDs,
    payrollData.cashAdvanceIDs,
    payrollData.shortDeductions,
    payrollData.cashAdvanceDeductions,
    payrollData.loanDeductionIds,
    payrollData.loanDeductions
  ]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const hasReversalItems = shorts.length > 0 || cashAdvances.length > 0 || loanDeductions.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => {
          onClose();
          // CRITICAL: Simulate focus context reset that fixes the issue (like Alt+Tab)
          setTimeout(() => {
            if (window.electron && window.electron.blurWindow) {
              window.electron.blurWindow();
              setTimeout(() => {
                window.electron.focusWindow();
              }, 50);
            } else {
              window.blur();
              setTimeout(() => {
                window.focus();
                document.body.focus();
              }, 50);
            }
          }, 200);
        }}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <IoTrashOutline className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Payroll Record
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Are you sure you want to delete the payroll record for{" "}
                    {payrollData.employeeName} from{" "}
                    {formatDate(payrollData.startDate)} to{" "}
                    {formatDate(payrollData.endDate)}?
                  </p>

                  {isLoading ? (
                    <div className="mt-4 flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500" />
                    </div>
                  ) : hasReversalItems ? (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        The following deductions will be reversed and their full
                        amounts will be restored:
                      </p>

                      {shorts.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">
                            Shorts (amounts will be marked as unpaid)
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {shorts.map((short) => (
                              <div
                                key={short.id}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-600">
                                  {short.description || formatDate(short.date)}
                                </span>
                                <span className="font-medium text-gray-900">
                                  ₱{short.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {cashAdvances.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">
                            Cash Advances (amounts will be marked as unpaid)
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {cashAdvances.map((ca) => (
                              <div
                                key={ca.id}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-600">
                                  {ca.description || formatDate(ca.date)}
                                </span>
                                <span className="font-medium text-gray-900">
                                  ₱{ca.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {loanDeductions.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">
                            Loan Deductions (amounts will be added back to remaining balance)
                          </h4>
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            {loanDeductions.map((loan) => (
                              <div
                                key={`${loan.loanId}-${loan.deductionId}`}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-600">
                                  {loan.type} Loan ({formatDate(loan.date)})
                                </span>
                                <span className="font-medium text-gray-900">
                                  ₱{loan.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="mt-4 text-sm text-gray-500 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        Note: These items will be marked as unpaid and their
                        full amounts will be restored to the employee's record.
                        You will need to process these deductions again in
                        future payrolls if needed.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">
                      No deductions will be reversed as this payroll record has
                      no shorts, cash advances, or loans associated with it.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={() => {
                  onClose();
                  // CRITICAL: Simulate focus context reset that fixes the issue (like Alt+Tab)
                  setTimeout(() => {
                    if (window.electron && window.electron.blurWindow) {
                      window.electron.blurWindow();
                      setTimeout(() => {
                        window.electron.focusWindow();
                      }, 50);
                    } else {
                      window.blur();
                      setTimeout(() => {
                        window.focus();
                        document.body.focus();
                      }, 50);
                    }
                  }, 200);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                onClick={() => {
                  onConfirm();
                  // CRITICAL: Simulate focus context reset that fixes the issue (like Alt+Tab)
                  setTimeout(() => {
                    if (window.electron && window.electron.blurWindow) {
                      window.electron.blurWindow();
                      setTimeout(() => {
                        window.electron.focusWindow();
                      }, 50);
                    } else {
                      window.blur();
                      setTimeout(() => {
                        window.focus();
                        document.body.focus();
                      }, 50);
                    }
                  }, 200);
                }}
              >
                Delete Payroll
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
