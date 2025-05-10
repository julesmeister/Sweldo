import React, { useState, useEffect, useMemo, useCallback } from "react";
import { IoClose } from "react-icons/io5";
import { CashAdvance } from "@/renderer/model/cashAdvance";
import { createCashAdvanceModel } from "@/renderer/model/cashAdvance";
import { Short } from "@/renderer/model/shorts";
import { createShortModel } from "@/renderer/model/shorts";
import { isWebEnvironment, getCompanyName } from "@/renderer/lib/firestoreService";
import { loadCashAdvancesFirestore } from "@/renderer/model/cashAdvance_firestore";
import { loadShortsFirestore } from "@/renderer/model/shorts_firestore";

interface Deductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  shortDeductions: number;
  enableSss: boolean;
  enablePhilHealth: boolean;
  enablePagIbig: boolean;
  shortIDs?: string[];
  cashAdvanceIDs?: string[];
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
          className={`group flex flex-col space-y-3 p-4 rounded-lg transition-all duration-200 ${isSelected
            ? "bg-gray-800/80 border border-blue-500/30 shadow-lg shadow-blue-500/5"
            : "bg-gray-900/50 hover:bg-gray-800/60 border border-gray-800/50 hover:border-gray-700/50"
            }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={`advance-${advance.id}`}
                  checked={isSelected}
                  onChange={(e) => onSelect(advance.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" ></div>
              </label>
              <label
                htmlFor={`advance-${advance.id}`}
                className="text-sm font-medium text-gray-200 leading-5 ml-2 group-hover:text-white transition-colors duration-200 cursor-pointer"
              >
                {advance.reason}
              </label>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300 transition-colors duration-200">
                {new Date(advance.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs font-medium text-blue-400/90 group-hover:text-blue-400 mt-1 transition-colors duration-200">
                Remaining: {formatCurrency(advance.remainingUnpaid)}
              </span>
            </div>
          </div>
          {isSelected && (
            <div className="mt-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 sm:text-sm">₱</span>
                </div>
                <input
                  type="text"
                  value={deductionAmount || ""}
                  onChange={(e) =>
                    onAmountChange(advance.id, parseFloat(e.target.value) || 0)
                  }
                  className={`block w-full pl-7 pr-3 py-2 text-sm rounded-md bg-gray-800/80 border border-gray-700/50 text-white placeholder-gray-500
                focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 hover:border-gray-600/50 transition-all duration-200 ${isCalculating ? "opacity-50" : ""
                    }`}
                  placeholder="Enter deduction amount"
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
    console.log("MemoizedShortItem rendered:", {
      id: short.id,
      isSelected,
      deductionAmount,
      isCalculating,
    });

    return (
      <div className="w-full">
        <div
          className={`group flex flex-col space-y-3 p-4 rounded-lg transition-all duration-200 ${isSelected
            ? "bg-gray-800/80 border border-blue-500/30 shadow-lg shadow-blue-500/5"
            : "bg-gray-900/50 hover:bg-gray-800/60 border border-gray-800/50 hover:border-gray-700/50"
            }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={`short-${short.id}`}
                  checked={isSelected}
                  onChange={(e) => onSelect(short.id, e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                  style={{
                    backgroundColor: isSelected ? '#2563eb' : '#374151', /* blue-600 : gray-700 */
                  }}
                ></div>
              </label>
              <label
                htmlFor={`short-${short.id}`}
                className="text-sm font-medium text-gray-200 leading-5 ml-2 group-hover:text-white transition-colors duration-200 cursor-pointer"
              >
                {short.reason}
              </label>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-gray-400 group-hover:text-gray-300 transition-colors duration-200">
                {new Date(short.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs font-medium text-blue-400/90 group-hover:text-blue-400 mt-1 transition-colors duration-200">
                Remaining: {formatCurrency(short.remainingUnpaid)}
              </span>
            </div>
          </div>
          {isSelected && (
            <div className="mt-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 sm:text-sm">₱</span>
                </div>
                <input
                  type="text"
                  value={deductionAmount || ""}
                  onChange={(e) =>
                    onAmountChange(short.id, parseFloat(e.target.value) || 0)
                  }
                  className={`block w-full pl-7 pr-3 py-2 text-sm rounded-md bg-gray-800/80 border border-gray-700/50 text-white placeholder-gray-500
                focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 hover:border-gray-600/50 transition-all duration-200 ${isCalculating ? "opacity-50" : ""
                    }`}
                  placeholder="Enter deduction amount"
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

    console.log("MemoizedShortItem memo comparison:", {
      id: prevProps.short.id,
      shouldUpdate,
      changes: {
        isSelected: prevProps.isSelected !== nextProps.isSelected,
        deductionAmount:
          prevProps.deductionAmount !== nextProps.deductionAmount,
        isCalculating: prevProps.isCalculating !== nextProps.isCalculating,
        id: prevProps.short.id !== nextProps.short.id,
        remainingUnpaid:
          prevProps.short.remainingUnpaid !== nextProps.short.remainingUnpaid,
      },
    });

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
    const [formData, setFormData] = useState<Deductions>({
      sss: sss,
      philHealth: philHealth,
      pagIbig: pagIbig,
      cashAdvanceDeductions: 0,
      shortDeductions: 0,
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
    const [deductionAmounts, setDeductionAmounts] = useState<
      Record<string, number>
    >({});
    const [shortDeductionAmounts, setShortDeductionAmounts] = useState<
      Record<string, number>
    >({});
    const [isLoading, setIsLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState<Record<string, boolean>>(
      {}
    );
    const [hasLoadedAdvances, setHasLoadedAdvances] = useState(false);
    const [hasLoadedShorts, setHasLoadedShorts] = useState(false);

    // Memoize the dates to prevent unnecessary re-renders
    const memoizedStartDate = useMemo(
      () => new Date(startDate),
      [startDate.getTime()]
    );
    const memoizedEndDate = useMemo(
      () => new Date(endDate),
      [endDate.getTime()]
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

      console.log("loadUnpaidAdvances called with:", {
        employeeId,
        dbPath,
        startDate: memoizedStartDate.toISOString(),
        endDate: memoizedEndDate.toISOString(),
        memoizedCashAdvanceModel: !!memoizedCashAdvanceModel,
        hasLoadedAdvances,
      });

      setIsLoading(true);
      try {
        if (!employeeId || !dbPath) {
          console.log("Missing required data for loading advances");
          return;
        }

        // Get all months between start and end date
        const months = new Set<string>();
        let currentDate = new Date(memoizedStartDate);
        while (currentDate <= memoizedEndDate) {
          months.add(
            `${currentDate.getFullYear()}_${currentDate.getMonth() + 1}`
          );
          currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log("Loading advances for months:", Array.from(months));

        // Load cash advances from all relevant months
        const allAdvances: CashAdvance[] = [];
        const isWeb = isWebEnvironment();

        if (isWeb) {
          const companyName = await getCompanyName();
          console.log(`[DeductionsDialog] Web mode: Loading advances for ${companyName}`);

          for (const monthKey of months) {
            const [year, month] = monthKey.split("_").map(Number);
            const advances = await loadCashAdvancesFirestore(
              employeeId,
              month,
              year,
              companyName
            );
            allAdvances.push(...advances);
          }
        } else {
          // Desktop mode - use existing implementation
          for (const monthKey of months) {
            const [year, month] = monthKey.split("_").map(Number);
            const cashAdvanceModel = createCashAdvanceModel(
              dbPath,
              employeeId,
              month,
              year
            );

            const advances = await cashAdvanceModel.loadCashAdvances(employeeId);
            allAdvances.push(...advances);
          }
        }

        // Filter advances by date range
        const filteredAdvances = allAdvances.filter((advance) => {
          const advanceDate = new Date(advance.date);
          return (
            advanceDate >= memoizedStartDate && advanceDate <= memoizedEndDate
          );
        });

        console.log("Filtered advances:", filteredAdvances);

        // Sort by date (oldest first)
        filteredAdvances.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const initialDeductions: Record<string, number> = {};
        filteredAdvances.forEach((advance) => {
          initialDeductions[advance.id] =
            advance.paymentSchedule === "Installment"
              ? advance.installmentDetails?.amountPerPayment || 0
              : advance.remainingUnpaid;
        });

        setDeductionAmounts(initialDeductions);
        setUnpaidAdvances(filteredAdvances);
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
      memoizedEndDate,
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
        endDate: memoizedEndDate.toISOString(),
        hasLoadedShorts,
      });

      setIsLoading(true);
      try {
        if (!employeeId || !dbPath) {
          console.log("Missing required data for loading shorts");
          return;
        }

        // Get all months between start and end date
        const months = [];
        let currentDate = new Date(memoizedStartDate);
        while (currentDate <= memoizedEndDate) {
          months.push({
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
          });
          currentDate.setMonth(currentDate.getMonth() + 1);
        }

        // Load shorts from all relevant months
        const allShorts: Short[] = [];
        const isWeb = isWebEnvironment();

        if (isWeb) {
          const companyName = await getCompanyName();
          console.log(`[DeductionsDialog] Web mode: Loading shorts for ${companyName}`);

          for (const { month, year } of months) {
            const shorts = await loadShortsFirestore(
              employeeId,
              month,
              year,
              companyName
            );
            allShorts.push(...shorts);
          }
        } else {
          // Desktop mode - use existing implementation
          for (const { month, year } of months) {
            const shortModel = createShortModel(dbPath, employeeId, month, year);
            const shorts = await shortModel.loadShorts(employeeId);
            allShorts.push(...shorts);
          }
        }

        // Filter unpaid shorts
        const unpaid = allShorts.filter((short) => {
          const hasRemaining = short.remainingUnpaid > 0;
          return hasRemaining;
        });

        // Sort by date (oldest first)
        unpaid.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const initialDeductions: Record<string, number> = {};
        unpaid.forEach((short) => {
          initialDeductions[short.id] = short.remainingUnpaid;
        });
        setShortDeductionAmounts(initialDeductions);
        setUnpaidShorts(unpaid);
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
      memoizedEndDate,
      hasLoadedShorts,
      isOpen,
    ]);

    useEffect(() => {
      console.log("DeductionsDialog useEffect triggered:", {
        isOpen,
        employeeId,
        dbPath,
        startDate: memoizedStartDate.toISOString(),
        endDate: memoizedEndDate.toISOString(),
        hasLoadedAdvances,
        hasLoadedShorts,
      });

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

    // Add a debug effect to track re-renders
    useEffect(() => {
      console.log("DeductionsDialog re-rendered:", {
        selectedAdvances: Array.from(selectedAdvances),
        selectedShorts: Array.from(selectedShorts),
        unpaidAdvancesLength: unpaidAdvances.length,
        unpaidShortsLength: unpaidShorts.length,
        deductionAmountsKeys: Object.keys(deductionAmounts),
        shortDeductionAmountsKeys: Object.keys(shortDeductionAmounts),
        isCalculatingKeys: Object.keys(isCalculating),
      });
    }, [
      selectedAdvances,
      selectedShorts,
      unpaidAdvances,
      unpaidShorts,
      deductionAmounts,
      shortDeductionAmounts,
      isCalculating,
    ]);

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
        setIsCalculating((prev) => ({ ...prev, [id]: true }));
        await new Promise((resolve) => setTimeout(resolve, 150));
        setDeductionAmounts((prev) => ({
          ...prev,
          [id]: amount,
        }));
        setIsCalculating((prev) => ({ ...prev, [id]: false }));
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
        console.log("[DeductionsDialog] Changing short amount:", {
          id,
          amount,
        });
        setIsCalculating((prev) => ({ ...prev, [id]: true }));
        await new Promise((resolve) => setTimeout(resolve, 150));
        setShortDeductionAmounts((prev) => ({
          ...prev,
          [id]: amount,
        }));
        setIsCalculating((prev) => ({ ...prev, [id]: false }));
      },
      []
    );

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      console.log("[DeductionsDialog] Starting handleSubmit with shorts:", {
        selectedShorts: Array.from(selectedShorts),
        shortDeductionAmounts,
        unpaidShorts: unpaidShorts.map((s) => ({
          id: s.id,
          remainingUnpaid: s.remainingUnpaid,
        })),
      });

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

          console.log("[DeductionsDialog] Processing short:", {
            shortId,
            originalRemaining: short.remainingUnpaid,
            deductionAmount,
            newRemainingUnpaid,
          });

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
          console.log("[DeductionsDialog] Adding to total shorts:", {
            shortId,
            amount,
            runningTotal: total + amount,
          });
          return total + amount;
        },
        0
      );

      console.log("[DeductionsDialog] Final deduction totals:", {
        totalShortDeductions,
        totalCashAdvanceDeductions,
        selectedShortIds: Array.from(selectedShorts),
        shortDeductionAmounts,
      });

      onConfirm({
        sss: formData.enableSss ? formData.sss : 0,
        philHealth: formData.enablePhilHealth ? formData.philHealth : 0,
        pagIbig: formData.enablePagIbig ? formData.pagIbig : 0,
        cashAdvanceDeductions: totalCashAdvanceDeductions,
        shortDeductions: totalShortDeductions,
        enableSss: formData.enableSss,
        enablePhilHealth: formData.enablePhilHealth,
        enablePagIbig: formData.enablePagIbig,
        shortIDs: Array.from(selectedShorts),
        cashAdvanceIDs: Array.from(selectedAdvances),
      });
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

    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            position: "absolute",
            top: position?.top,
            left: position!.left - 20,
            width: "800px",
            transform: position?.showAbove ? "translateY(-100%)" : "none",
            maxHeight: "calc(100vh - 100px)",
          }}
          className="bg-gray-900 rounded-lg shadow-xl border border-gray-700"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">
              Confirm Deductions
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <IoClose size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="sss"
                      className="text-sm font-medium text-gray-200"
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
                      <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                        style={{
                          backgroundColor: formData.enableSss ? '#2563eb' : '#374151', /* blue-600 : gray-700 */
                        }}
                      ></div>
                    </label>
                  </div>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 sm:text-sm">₱</span>
                    </div>
                    <input
                      type="number"
                      name="sss"
                      id="sss"
                      step="0.01"
                      value={formData.enableSss ? formData.sss : 0}
                      onChange={handleInputChange("sss")}
                      className={`block w-full pl-7 pr-3 py-2 rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!formData.enableSss
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                        }`}
                      placeholder="0.00"
                      disabled={!formData.enableSss}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="philHealth"
                      className="text-sm font-medium text-gray-200"
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
                      <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                        style={{
                          backgroundColor: formData.enablePhilHealth ? '#2563eb' : '#374151', /* blue-600 : gray-700 */
                        }}
                      ></div>
                    </label>
                  </div>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 sm:text-sm">₱</span>
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
                      className={`block w-full pl-7 pr-3 py-2 rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!formData.enablePhilHealth
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                        }`}
                      placeholder="0.00"
                      disabled={!formData.enablePhilHealth}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="pagIbig"
                      className="text-sm font-medium text-gray-200"
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
                      <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                        style={{
                          backgroundColor: formData.enablePagIbig ? '#2563eb' : '#374151', /* blue-600 : gray-700 */
                        }}
                      ></div>
                    </label>
                  </div>
                  <div className="relative rounded-lg">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 sm:text-sm">₱</span>
                    </div>
                    <input
                      type="number"
                      name="pagIbig"
                      id="pagIbig"
                      step="0.01"
                      value={formData.enablePagIbig ? formData.pagIbig : 0}
                      onChange={handleInputChange("pagIbig")}
                      className={`block w-full pl-7 pr-3 py-2 rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!formData.enablePagIbig
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                        }`}
                      placeholder="0.00"
                      disabled={!formData.enablePagIbig}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3 space-y-3 border border-gray-700/50 transition-colors duration-200">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                    <p className="text-sm text-gray-400">
                      Loading deductions...
                    </p>
                  </div>
                ) : unpaidAdvances.length === 0 && unpaidShorts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <p className="text-sm text-gray-400">
                      No unpaid deductions available.
                    </p>
                    <p className="text-xs text-gray-500">
                      Please check back later or add new deductions.
                    </p>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Confirm & Generate
              </button>
            </div>
          </form>
        </div>
      </div>
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
