import React, { useState, useEffect, useMemo, useCallback } from "react";
import { CashAdvance } from "@/renderer/model/cashAdvance";
import { createCashAdvanceModel } from "@/renderer/model/cashAdvance";
import { Short } from "@/renderer/model/shorts";
import { createShortModel } from "@/renderer/model/shorts";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { loadCashAdvancesFirestore } from "@/renderer/model/cashAdvance_firestore";
import { loadShortsFirestore } from "@/renderer/model/shorts_firestore";
import { Loan } from "@/renderer/model/loan";
import { useAllYearLoanManagement } from "@/renderer/hooks/useLoanManagement";
import BaseFormDialog from "./dialogs/BaseFormDialog";

interface Deductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  shortDeductions: number;
  loanDeductions: number;
  enableSss: boolean;
  enablePhilHealth: boolean;
  enablePagIbig: boolean;
  shortIDs?: string[];
  cashAdvanceIDs?: string[];
  loanDeductionIds?: { loanId: string; deductionId: string; amount: number }[];
}

interface DeductionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deductions: Deductions) => void;
  sss: number;
  philHealth: number;
  pagIbig: number;
  employeeId: string;
  dbPath: string;
  startDate: Date;
  endDate: Date;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
    caretLeft?: number;
  } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

const MemoizedCashAdvanceItem = React.memo(
  ({
    advance,
    isSelected,
    deductionAmount,
    isCalculating,
    onSelect,
    onAmountChange,
  }: {
    advance: CashAdvance;
    isSelected: boolean;
    deductionAmount: number;
    isCalculating: boolean;
    onSelect: (id: string, checked: boolean) => void;
    onAmountChange: (id: string, amount: number) => void;
  }) => {

    return (
      <div className="w-full">
        <div
          className={`group flex flex-col space-y-2 p-3 rounded-lg transition-all duration-200 ${isSelected
            ? "bg-blue-50 border border-blue-200 shadow-sm"
            : "bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300"
            }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2 flex-1">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={`advance-${advance.id}`}
                  checked={isSelected}
                  onChange={(e) => onSelect(advance.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" ></div>
              </label>
              <label
                htmlFor={`advance-${advance.id}`}
                className="text-sm font-medium text-gray-700 leading-5 ml-1 group-hover:text-gray-900 transition-colors duration-200 cursor-pointer flex-1 truncate"
              >
                {advance.reason}
              </label>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-200">
                {new Date(advance.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700 transition-colors duration-200">
                {formatCurrency(advance.remainingUnpaid)}
              </span>
            </div>
          </div>
          {isSelected && (
            <div className="mt-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₱</span>
                </div>
                <input
                  type="text"
                  value={deductionAmount || ""}
                  onChange={(e) =>
                    onAmountChange(advance.id, parseFloat(e.target.value) || 0)
                  }
                  className={`block w-full pl-7 pr-3 py-1.5 text-sm rounded-md bg-white border border-gray-300 text-gray-900 placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 ${isCalculating ? "opacity-50" : ""
                    }`}
                  placeholder="Enter amount"
                  disabled={isCalculating}
                />
                {isCalculating && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const shouldUpdate =
      prevProps.isSelected !== nextProps.isSelected ||
      prevProps.deductionAmount !== nextProps.deductionAmount ||
      prevProps.isCalculating !== nextProps.isCalculating ||
      prevProps.advance.id !== nextProps.advance.id ||
      prevProps.advance.remainingUnpaid !== nextProps.advance.remainingUnpaid;


    return !shouldUpdate;
  }
);

const MemoizedShortItem = React.memo(
  ({
    short,
    isSelected,
    deductionAmount,
    isCalculating,
    onSelect,
    onAmountChange,
  }: {
    short: Short;
    isSelected: boolean;
    deductionAmount: number;
    isCalculating: boolean;
    onSelect: (id: string, checked: boolean) => void;
    onAmountChange: (id: string, amount: number) => void;
  }) => {


    return (
      <div className="w-full">
        <div
          className={`group flex flex-col space-y-2 p-3 rounded-lg transition-all duration-200 ${isSelected
            ? "bg-blue-50 border border-blue-200 shadow-sm"
            : "bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300"
            }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2 flex-1">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={`short-${short.id}`}
                  checked={isSelected}
                  onChange={(e) => onSelect(short.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <label
                htmlFor={`short-${short.id}`}
                className="text-sm font-medium text-gray-700 leading-5 ml-1 group-hover:text-gray-900 transition-colors duration-200 cursor-pointer flex-1 truncate"
              >
                {short.reason}
              </label>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-200">
                {new Date(short.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700 transition-colors duration-200">
                {formatCurrency(short.remainingUnpaid)}
              </span>
            </div>
          </div>
          {isSelected && (
            <div className="mt-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₱</span>
                </div>
                <input
                  type="text"
                  value={deductionAmount || ""}
                  onChange={(e) =>
                    onAmountChange(short.id, parseFloat(e.target.value) || 0)
                  }
                  className={`block w-full pl-7 pr-3 py-1.5 text-sm rounded-md bg-white border border-gray-300 text-gray-900 placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 ${isCalculating ? "opacity-50" : ""
                    }`}
                  placeholder="Enter amount"
                  disabled={isCalculating}
                />
                {isCalculating && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const shouldUpdate =
      prevProps.isSelected !== nextProps.isSelected ||
      prevProps.deductionAmount !== nextProps.deductionAmount ||
      prevProps.isCalculating !== nextProps.isCalculating ||
      prevProps.short.id !== nextProps.short.id ||
      prevProps.short.remainingUnpaid !== nextProps.short.remainingUnpaid;



    return !shouldUpdate;
  }
);

const MemoizedLoanItem = React.memo(
  ({
    loan,
    isSelected,
    deductionAmount,
    isCalculating,
    onSelect,
    onAmountChange,
  }: {
    loan: Loan;
    isSelected: boolean;
    deductionAmount: number;
    isCalculating: boolean;
    onSelect: (id: string, checked: boolean) => void;
    onAmountChange: (id: string, amount: number) => void;
  }) => {
    return (
      <div className="w-full">
        <div
          className={`group flex flex-col space-y-2 p-3 rounded-lg transition-all duration-200 ${isSelected
            ? "bg-blue-50 border border-blue-200 shadow-sm"
            : "bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300"
            }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2 flex-1">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={`loan-${loan.id}`}
                  checked={isSelected}
                  onChange={(e) => onSelect(loan.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-10 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <label
                htmlFor={`loan-${loan.id}`}
                className="text-sm font-medium text-gray-700 leading-5 ml-1 group-hover:text-gray-900 transition-colors duration-200 cursor-pointer flex-1 truncate"
              >
                {loan.type || "Loan"}
              </label>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700 transition-colors duration-200">
                {new Date(loan.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs font-medium text-blue-600 group-hover:text-blue-700 transition-colors duration-200">
                {formatCurrency(loan.remainingBalance)}
              </span>
            </div>
          </div>
          {isSelected && (
            <div className="mt-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₱</span>
                </div>
                <input
                  type="text"
                  value={deductionAmount || ""}
                  onChange={(e) =>
                    onAmountChange(loan.id, parseFloat(e.target.value) || 0)
                  }
                  className={`block w-full pl-7 pr-3 py-1.5 text-sm rounded-md bg-white border border-gray-300 text-gray-900 placeholder-gray-400
                  focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 hover:border-gray-400 transition-all duration-200 ${isCalculating ? "opacity-50" : ""
                    }`}
                  placeholder="Enter amount"
                  disabled={isCalculating}
                />
                {isCalculating && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    const shouldUpdate =
      prevProps.isSelected !== nextProps.isSelected ||
      prevProps.deductionAmount !== nextProps.deductionAmount ||
      prevProps.isCalculating !== nextProps.isCalculating ||
      prevProps.loan.id !== nextProps.loan.id ||
      prevProps.loan.remainingBalance !== nextProps.loan.remainingBalance;

    return !shouldUpdate;
  }
);

export const DeductionsDialog: React.FC<DeductionsDialogProps> = React.memo(
  ({
    isOpen,
    onClose,
    onConfirm,
    sss,
    philHealth,
    pagIbig,
    employeeId,
    dbPath,
    startDate,
    endDate,
    position,
  }) => {
    if (!isOpen) return null;

    const [formData, setFormData] = useState<Deductions>({
      sss: sss,
      philHealth: philHealth,
      pagIbig: pagIbig,
      cashAdvanceDeductions: 0,
      shortDeductions: 0,
      loanDeductions: 0,
      enableSss: false,
      enablePhilHealth: false,
      enablePagIbig: false,
    });
    const [unpaidAdvances, setUnpaidAdvances] = useState<CashAdvance[]>([]);
    const [unpaidShorts, setUnpaidShorts] = useState<Short[]>([]);
    const [selectedAdvances, setSelectedAdvances] = useState<Set<string>>(
      new Set()
    );
    const [selectedShorts, setSelectedShorts] = useState<Set<string>>(
      new Set()
    );
    const [selectedLoans, setSelectedLoans] = useState<Set<string>>(
      new Set()
    );
    const [deductionAmounts, setDeductionAmounts] = useState<
      Record<string, number>
    >({});
    const [shortDeductionAmounts, setShortDeductionAmounts] = useState<
      Record<string, number>
    >({});
    const [loanDeductionAmounts, setLoanDeductionAmounts] = useState<
      Record<string, number>
    >({});
    const [isLoading, setIsLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState<Record<string, boolean>>(
      {}
    );
    const [hasLoadedAdvances, setHasLoadedAdvances] = useState(false);
    const [hasLoadedShorts, setHasLoadedShorts] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Load loans using our new hook that loads from all months of the year
    const { loans, isLoading: isLoadingLoans } = useAllYearLoanManagement({
      employeeId,
      year: startDate.getFullYear()
    });

    // Filter to only active loans with a remaining balance
    const activeLoans = useMemo(() =>
      loans.filter(loan =>
        loan.status !== "Completed" &&
        loan.status !== "Rejected" &&
        loan.remainingBalance > 0
      ),
      [loans]
    );

    // Memoize the dates to prevent unnecessary re-renders
    const memoizedStartDate = useMemo(
      () => new Date(startDate),
      [startDate.getTime()]
    );

    const memoizedCashAdvanceModel = useMemo(() => {
      if (!employeeId || !dbPath) return null;
      return createCashAdvanceModel(
        dbPath,
        employeeId,
        memoizedStartDate.getMonth() + 1,
        memoizedStartDate.getFullYear()
      );
    }, [employeeId, dbPath, memoizedStartDate]);

    const loadUnpaidAdvances = useCallback(async () => {
      if (hasLoadedAdvances && isOpen) {
        console.log("Skipping reload - advances already loaded");
        return;
      }

      setIsLoading(true);
      try {
        if (!employeeId || !dbPath) {
          console.log("Missing required data for loading advances");
          return;
        }

        // Get all months of the current year
        const currentYear = memoizedStartDate.getFullYear();
        const months = [];
        for (let month = 1; month <= 12; month++) {
          months.push({ year: currentYear, month });
        }

        console.log(`Loading advances for all months of year ${currentYear}`);

        // Load cash advances from all months of the year
        const allAdvances: CashAdvance[] = [];
        const isWeb = isWebEnvironment();

        if (isWeb) {
          const companyName = await getCompanyName();

          for (const { year, month } of months) {
            try {
              console.log(`Loading web advances for ${year}-${month}`);
              const advances = await loadCashAdvancesFirestore(
                employeeId,
                month,
                year,
                companyName
              );
              allAdvances.push(...advances);
            } catch (error) {
              console.warn(`Error loading advances for ${year}-${month}:`, error);
              // Continue with other months even if one fails
            }
          }
        } else {
          // Desktop mode - use existing implementation
          for (const { year, month } of months) {
            try {
              console.log(`Loading desktop advances for ${year}-${month}`);
              const cashAdvanceModel = createCashAdvanceModel(
                dbPath,
                employeeId,
                month,
                year
              );

              const advances = await cashAdvanceModel.loadCashAdvances(employeeId);
              allAdvances.push(...advances);
            } catch (error) {
              console.warn(`Error loading advances for ${year}-${month}:`, error);
              // Continue with other months even if one fails
            }
          }
        }

        console.log(`Loaded total of ${allAdvances.length} advances from all months`);

        // Filter to only unpaid advances with remaining balance
        const unpaidAdvances = allAdvances.filter(advance =>
          advance.status === "Unpaid" &&
          advance.remainingUnpaid > 0 &&
          advance.approvalStatus === "Approved"
        );

        console.log(`Filtered to ${unpaidAdvances.length} unpaid advances with remaining balance`);

        // Sort by date (oldest first)
        unpaidAdvances.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const initialDeductions: Record<string, number> = {};
        unpaidAdvances.forEach((advance) => {
          initialDeductions[advance.id] =
            advance.paymentSchedule === "Installment"
              ? advance.installmentDetails?.amountPerPayment || 0
              : advance.remainingUnpaid;
        });

        setDeductionAmounts(initialDeductions);
        setUnpaidAdvances(unpaidAdvances);
        setHasLoadedAdvances(true);
      } catch (error) {
        console.error("Error loading unpaid advances:", error);
      } finally {
        setIsLoading(false);
      }
    }, [
      employeeId,
      dbPath,
      memoizedStartDate,
      hasLoadedAdvances,
      isOpen,
    ]);

    const loadUnpaidShorts = useCallback(async () => {
      // Prevent reloading if we already have the shorts and the dialog is open
      if (hasLoadedShorts && isOpen) {
        console.log("Skipping reload - shorts already loaded");
        return;
      }

      console.log("loadUnpaidShorts called with:", {
        employeeId,
        dbPath,
        startDate: memoizedStartDate.toISOString(),
        hasLoadedShorts,
      });

      setIsLoading(true);
      try {
        if (!employeeId || !dbPath) {
          console.log("Missing required data for loading shorts");
          return;
        }

        // Get all months of the current year
        const currentYear = memoizedStartDate.getFullYear();
        const months = [];
        for (let month = 1; month <= 12; month++) {
          months.push({ year: currentYear, month });
        }

        console.log(`Loading shorts for all months of year ${currentYear}`);

        // Load shorts from all months of the year
        const allShorts: Short[] = [];
        const isWeb = isWebEnvironment();

        if (isWeb) {
          const companyName = await getCompanyName();

          for (const { year, month } of months) {
            try {
              console.log(`Loading web shorts for ${year}-${month}`);
              const shorts = await loadShortsFirestore(
                employeeId,
                month,
                year,
                companyName
              );
              allShorts.push(...shorts);
            } catch (error) {
              console.warn(`Error loading shorts for ${year}-${month}:`, error);
              // Continue with other months even if one fails
            }
          }
        } else {
          // Desktop mode - use existing implementation
          for (const { year, month } of months) {
            try {
              console.log(`Loading desktop shorts for ${year}-${month}`);
              const shortModel = createShortModel(dbPath, employeeId, month, year);
              const shorts = await shortModel.loadShorts(employeeId);
              allShorts.push(...shorts);
            } catch (error) {
              console.warn(`Error loading shorts for ${year}-${month}:`, error);
              // Continue with other months even if one fails
            }
          }
        }

        console.log(`Loaded total of ${allShorts.length} shorts from all months`);

        // Filter to only unpaid shorts with remaining balance
        const unpaidShorts = allShorts.filter(short =>
          short.status === "Unpaid" &&
          short.remainingUnpaid > 0
        );

        console.log(`Filtered to ${unpaidShorts.length} unpaid shorts with remaining balance`);

        // Sort by date (oldest first)
        unpaidShorts.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const initialDeductions: Record<string, number> = {};
        unpaidShorts.forEach((short) => {
          initialDeductions[short.id] = short.remainingUnpaid;
        });
        setShortDeductionAmounts(initialDeductions);
        setUnpaidShorts(unpaidShorts);
        setHasLoadedShorts(true);
      } catch (error) {
        console.error("Error loading unpaid shorts:", error);
      } finally {
        setIsLoading(false);
      }
    }, [
      employeeId,
      dbPath,
      memoizedStartDate,
      hasLoadedShorts,
      isOpen,
    ]);

    useEffect(() => {
      if (isOpen) {
        if (!hasLoadedAdvances) {
          loadUnpaidAdvances();
        }
        if (!hasLoadedShorts) {
          loadUnpaidShorts();
        }
      }
    }, [
      isOpen,
      loadUnpaidAdvances,
      loadUnpaidShorts,
      hasLoadedAdvances,
      hasLoadedShorts,
    ]);

    // Reset hasLoadedAdvances and hasLoadedShorts when the dialog closes
    useEffect(() => {
      if (!isOpen) {
        setHasLoadedAdvances(false);
        setHasLoadedShorts(false);
      }
    }, [isOpen]);



    const handleAdvanceSelect = useCallback((id: string, checked: boolean) => {
      setSelectedAdvances((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
    }, []);

    const handleAdvanceAmountChange = useCallback(
      async (id: string, amount: number) => {
        // Update the value immediately to maintain focus
        setDeductionAmounts((prev) => ({
          ...prev,
          [id]: amount,
        }));

        // Skip the calculation animation for better UX
        // setIsCalculating((prev) => ({ ...prev, [id]: true }));
        // await new Promise((resolve) => setTimeout(resolve, 150));
        // setIsCalculating((prev) => ({ ...prev, [id]: false }));
      },
      []
    );

    const handleShortSelect = useCallback((id: string, checked: boolean) => {
      setSelectedShorts((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
    }, []);

    const handleShortAmountChange = useCallback(
      async (id: string, amount: number) => {


        // Update the value immediately to maintain focus
        setShortDeductionAmounts((prev) => ({
          ...prev,
          [id]: amount,
        }));

        // Skip the calculation animation for better UX
        // setIsCalculating((prev) => ({ ...prev, [id]: true }));
        // await new Promise((resolve) => setTimeout(resolve, 150));
        // setIsCalculating((prev) => ({ ...prev, [id]: false }));
      },
      []
    );

    const handleLoanSelect = useCallback((id: string, checked: boolean) => {
      setSelectedLoans((prev) => {
        const newSet = new Set(prev);
        if (checked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
    }, []);

    const handleLoanAmountChange = useCallback(
      async (id: string, amount: number) => {
        // Update the value immediately to maintain focus
        setLoanDeductionAmounts((prev) => {
          const updated = {
            ...prev,
            [id]: amount,
          };
          return updated;
        });
      },
      []
    );

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      // Get all months between start and end date
      const months = [];
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        months.push({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      const isWeb = isWebEnvironment();

      // Update each selected short in its respective month
      for (const shortId of selectedShorts) {
        const short = unpaidShorts.find((s) => s.id === shortId);
        if (short) {
          const deductionAmount = shortDeductionAmounts[shortId] || 0;
          const newRemainingUnpaid = short.remainingUnpaid - deductionAmount;



          // Find the correct month for this short
          const shortDate = new Date(short.date);
          const month = shortDate.getMonth() + 1;
          const year = shortDate.getFullYear();

          if (isWeb) {
            const companyName = await getCompanyName();
            const { updateShortFirestore } = await import("@/renderer/model/shorts_firestore");

            await updateShortFirestore({
              ...short,
              remainingUnpaid: newRemainingUnpaid,
              status: newRemainingUnpaid <= 0 ? "Paid" : "Unpaid",
            }, month, year, companyName);
          } else {
            // Update the short in its correct month
            const shortModel = createShortModel(dbPath, employeeId, month, year);
            await shortModel.updateShort({
              ...short,
              remainingUnpaid: newRemainingUnpaid,
              status: newRemainingUnpaid <= 0 ? "Paid" : "Unpaid",
            });
          }
        }
      }

      // Calculate total deductions
      const totalCashAdvanceDeductions = Array.from(selectedAdvances).reduce(
        (total, advanceId) => {
          return total + (deductionAmounts[advanceId] || 0);
        },
        0
      );

      const totalShortDeductions = Array.from(selectedShorts).reduce(
        (total, shortId) => {
          const amount = shortDeductionAmounts[shortId] || 0;
          return total + amount;
        },
        0
      );

      // Create loan deductions with detailed logging
      const loanDeductionIds: { loanId: string; deductionId: string; amount: number }[] = [];
      let totalLoanDeductions = 0;

      for (const loanId of selectedLoans) {
        const loan = activeLoans.find(l => l.id === loanId);
        if (loan) {
          const deductionAmount = loanDeductionAmounts[loanId] || 0;

          if (deductionAmount > 0) {
            // Create a unique deduction ID
            const deductionId = crypto.randomUUID();

            // Add to the list of deduction IDs - include the amount
            loanDeductionIds.push({
              loanId,
              deductionId,
              amount: deductionAmount
            });
            totalLoanDeductions += deductionAmount;
          }
        }
      }



      // Prepare final deductions structure
      const finalDeductions = {
        sss: formData.enableSss ? formData.sss : 0,
        philHealth: formData.enablePhilHealth ? formData.philHealth : 0,
        pagIbig: formData.enablePagIbig ? formData.pagIbig : 0,
        cashAdvanceDeductions: totalCashAdvanceDeductions,
        shortDeductions: totalShortDeductions,
        loanDeductions: totalLoanDeductions,
        enableSss: formData.enableSss,
        enablePhilHealth: formData.enablePhilHealth,
        enablePagIbig: formData.enablePagIbig,
        shortIDs: Array.from(selectedShorts),
        cashAdvanceIDs: Array.from(selectedAdvances),
        loanDeductionIds: loanDeductionIds,
      };



      // Log full object details for loan deductions


      onConfirm(finalDeductions);
    };

    const handleInputChange =
      (
        field: keyof Omit<
          Deductions,
          "cashAdvanceDeductions" | "shortDeductions"
        >
      ) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = parseFloat(e.target.value) || 0;
          setFormData((prev) => ({
            ...prev,
            [field]: value,
          }));
        };

    return (
      <BaseFormDialog
        title="Confirm Deductions"
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleSubmit}
        position={position}
        submitText="Confirm & Generate"
        isBottomSheet={true}
      >
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-6">
            <div className="sm:col-span-1 md:col-span-4">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="sss"
                  className="text-sm font-medium text-gray-700"
                >
                  SSS Contribution
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="sss"
                    checked={formData.enableSss}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        enableSss: e.target.checked,
                        sss: e.target.checked ? prev.sss : 0,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                    style={{
                      backgroundColor: formData.enableSss ? '#2563eb' : '#d1d5db',
                    }}
                  ></div>
                </label>
              </div>
              <div className="relative rounded-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₱</span>
                </div>
                <input
                  type="number"
                  name="sss"
                  id="sss"
                  step="0.01"
                  value={formData.enableSss ? formData.sss : 0}
                  onChange={handleInputChange("sss")}
                  className={`block w-full pl-7 pr-3 py-2 rounded-md border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!formData.enableSss
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                    }`}
                  placeholder="0.00"
                  disabled={!formData.enableSss}
                />
              </div>
            </div>

            <div className="sm:col-span-1 md:col-span-4">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="philHealth"
                  className="text-sm font-medium text-gray-700"
                >
                  PhilHealth Contribution
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="philHealth"
                    checked={formData.enablePhilHealth}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        enablePhilHealth: e.target.checked,
                        philHealth: e.target.checked ? prev.philHealth : 0,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                    style={{
                      backgroundColor: formData.enablePhilHealth ? '#2563eb' : '#d1d5db',
                    }}
                  ></div>
                </label>
              </div>
              <div className="relative rounded-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₱</span>
                </div>
                <input
                  type="number"
                  name="philHealth"
                  id="philHealth"
                  step="0.01"
                  value={
                    formData.enablePhilHealth ? formData.philHealth : 0
                  }
                  onChange={handleInputChange("philHealth")}
                  className={`block w-full pl-7 pr-3 py-2 rounded-md border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!formData.enablePhilHealth
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                    }`}
                  placeholder="0.00"
                  disabled={!formData.enablePhilHealth}
                />
              </div>
            </div>

            <div className="sm:col-span-1 md:col-span-4">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="pagIbig"
                  className="text-sm font-medium text-gray-700"
                >
                  Pag-IBIG Contribution
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="pagIbig"
                    checked={formData.enablePagIbig}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        enablePagIbig: e.target.checked,
                        pagIbig: e.target.checked ? prev.pagIbig : 0,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                    style={{
                      backgroundColor: formData.enablePagIbig ? '#2563eb' : '#d1d5db',
                    }}
                  ></div>
                </label>
              </div>
              <div className="relative rounded-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₱</span>
                </div>
                <input
                  type="number"
                  name="pagIbig"
                  id="pagIbig"
                  step="0.01"
                  value={formData.enablePagIbig ? formData.pagIbig : 0}
                  onChange={handleInputChange("pagIbig")}
                  className={`block w-full pl-7 pr-3 py-2 rounded-md border border-gray-300 text-gray-900 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!formData.enablePagIbig
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                    }`}
                  placeholder="0.00"
                  disabled={!formData.enablePagIbig}
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-4 border border-gray-200 transition-colors duration-200">
            {isLoading || isLoadingLoans ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                <p className="text-sm text-gray-500">
                  Loading deductions...
                </p>
              </div>
            ) : unpaidAdvances.length === 0 && unpaidShorts.length === 0 && activeLoans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <p className="text-sm text-gray-500">
                  No unpaid deductions available.
                </p>
                <p className="text-xs text-gray-400">
                  Please check back later or add new deductions.
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-medium text-gray-900 text-base mb-4">Select items to include in deductions</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Loans Column */}
                  <div className="md:col-span-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 pb-1 border-b border-gray-200">Loans</h3>
                    {activeLoans.length > 0 ? (
                      <div className="space-y-3">
                        {activeLoans.map((loan) => (
                          <MemoizedLoanItem
                            key={loan.id}
                            loan={loan}
                            isSelected={selectedLoans.has(loan.id)}
                            deductionAmount={loanDeductionAmounts[loan.id]}
                            isCalculating={isCalculating[loan.id]}
                            onSelect={handleLoanSelect}
                            onAmountChange={handleLoanAmountChange}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 bg-white rounded-lg border border-gray-200 text-center">
                        <p className="text-sm text-gray-500">No active loans</p>
                      </div>
                    )}
                  </div>

                  {/* Cash Advances Column */}
                  <div className="md:col-span-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 pb-1 border-b border-gray-200">Cash Advances</h3>
                    {unpaidAdvances.length > 0 ? (
                      <div className="space-y-3">
                        {unpaidAdvances.map((advance) => (
                          <MemoizedCashAdvanceItem
                            key={advance.id}
                            advance={advance}
                            isSelected={selectedAdvances.has(advance.id)}
                            deductionAmount={deductionAmounts[advance.id]}
                            isCalculating={isCalculating[advance.id]}
                            onSelect={handleAdvanceSelect}
                            onAmountChange={handleAdvanceAmountChange}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 bg-white rounded-lg border border-gray-200 text-center">
                        <p className="text-sm text-gray-500">No cash advances</p>
                      </div>
                    )}
                  </div>

                  {/* Shorts Column */}
                  <div className="md:col-span-1">
                    <h3 className="text-sm font-medium text-gray-700 mb-3 pb-1 border-b border-gray-200">Deductions</h3>
                    {unpaidShorts.length > 0 ? (
                      <div className="space-y-3">
                        {unpaidShorts.map((short) => (
                          <MemoizedShortItem
                            key={short.id}
                            short={short}
                            isSelected={selectedShorts.has(short.id)}
                            deductionAmount={shortDeductionAmounts[short.id]}
                            isCalculating={isCalculating[short.id]}
                            onSelect={handleShortSelect}
                            onAmountChange={handleShortAmountChange}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 bg-white rounded-lg border border-gray-200 text-center">
                        <p className="text-sm text-gray-500">No deductions</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </BaseFormDialog>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.employeeId === nextProps.employeeId &&
      prevProps.dbPath === nextProps.dbPath &&
      prevProps.startDate.getTime() === nextProps.startDate.getTime() &&
      prevProps.endDate.getTime() === nextProps.endDate.getTime() &&
      prevProps.sss === nextProps.sss &&
      prevProps.philHealth === nextProps.philHealth &&
      prevProps.pagIbig === nextProps.pagIbig
    );
  }
);
