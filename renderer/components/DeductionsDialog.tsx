import React, { useState, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { CashAdvance } from "@/renderer/model/cashAdvance";
import { createCashAdvanceModel } from "@/renderer/model/cashAdvance";

interface Deductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  enableSss: boolean;
  enablePhilHealth: boolean;
  enablePagIbig: boolean;
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

export const DeductionsDialog: React.FC<DeductionsDialogProps> = ({
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
    enableSss: false,
    enablePhilHealth: false,
    enablePagIbig: false,
  });
  const [unpaidAdvances, setUnpaidAdvances] = useState<CashAdvance[]>([]);
  const [selectedAdvances, setSelectedAdvances] = useState<Set<string>>(
    new Set()
  );
  const [deductionAmounts, setDeductionAmounts] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const loadUnpaidAdvances = async () => {
      setIsLoading(true);
      try {
        // Validate required data
        if (!employeeId) {
          console.log("No employee selected");
          return;
        }

        if (!dbPath) {
          console.error("Database path is not set");
          return;
        }

        // Match the pattern from cash advances page
        const month = startDate.getMonth() + 1;
        const year = startDate.getFullYear();

        // Use the correct folder path structure
        const cashAdvanceModel = createCashAdvanceModel(
          dbPath,
          employeeId,
          month,
          year
        );
        console.log(
          "Created cash advance model with path:",
          cashAdvanceModel.filePath
        );

        const advances = await cashAdvanceModel.loadCashAdvances(employeeId);


        const unpaid = advances.filter((advance) => {
          const isApproved = advance.approvalStatus === "Approved";
          const hasRemaining = advance.remainingUnpaid > 0;

          return isApproved && hasRemaining;
        });

        const initialDeductions: Record<string, number> = {};
        unpaid.forEach((advance) => {
          initialDeductions[advance.id] =
            advance.paymentSchedule === "Installment"
              ? advance.installmentDetails?.amountPerPayment || 0
              : advance.remainingUnpaid;
        });
        setDeductionAmounts(initialDeductions);
        setUnpaidAdvances(unpaid);
      } catch (error) {
        console.error("Error loading unpaid advances:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (isOpen) {
      loadUnpaidAdvances();
    }
  }, [isOpen, employeeId, dbPath, startDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create cash advance model
    const month = startDate.getMonth() + 1;
    const year = startDate.getFullYear();
    const cashAdvanceModel = createCashAdvanceModel(dbPath, employeeId, month, year);

    // Update each selected cash advance
    for (const advanceId of selectedAdvances) {
      const advance = unpaidAdvances.find(adv => adv.id === advanceId);
      if (advance) {
        const deductionAmount = deductionAmounts[advanceId] || 0;
        const newRemainingUnpaid = advance.remainingUnpaid - deductionAmount;
        
        // Update the cash advance
        await cashAdvanceModel.updateCashAdvance({
          ...advance,
          remainingUnpaid: newRemainingUnpaid,
          status: newRemainingUnpaid <= 0 ? 'Paid' : 'Unpaid',
          installmentDetails: advance.paymentSchedule === 'Installment' ? {
            ...advance.installmentDetails!,
            remainingPayments: Math.ceil(newRemainingUnpaid / advance.installmentDetails!.amountPerPayment)
          } : undefined
        });
      }
    }

    // Calculate total deductions and call onConfirm
    const totalCashAdvanceDeductions = Array.from(selectedAdvances).reduce(
      (total, advanceId) => {
        return total + (deductionAmounts[advanceId] || 0);
      },
      0
    );

    onConfirm({
      sss: formData.enableSss ? formData.sss : 0,
      philHealth: formData.enablePhilHealth ? formData.philHealth : 0,
      pagIbig: formData.enablePagIbig ? formData.pagIbig : 0,
      cashAdvanceDeductions: totalCashAdvanceDeductions,
      enableSss: formData.enableSss,
      enablePhilHealth: formData.enablePhilHealth,
      enablePagIbig: formData.enablePagIbig,
    });
  };

  const handleInputChange =
    (field: keyof Omit<Deductions, "cashAdvanceDeductions">) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value) || 0;
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleAdvanceSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedAdvances);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
      const newAmounts = { ...deductionAmounts };
      delete newAmounts[id];
      setDeductionAmounts(newAmounts);
    }
    setSelectedAdvances(newSelected);
  };

  const handleAdvanceAmountChange = async (id: string, amount: number) => {
    setIsCalculating((prev) => ({ ...prev, [id]: true }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    setDeductionAmounts((prev) => ({
      ...prev,
      [id]: amount,
    }));
    setIsCalculating((prev) => ({ ...prev, [id]: false }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
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
                    <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                    className={`block w-full pl-7 pr-3 py-2 rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      !formData.enableSss ? "opacity-50 cursor-not-allowed" : ""
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
                    <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                    value={formData.enablePhilHealth ? formData.philHealth : 0}
                    onChange={handleInputChange("philHealth")}
                    className={`block w-full pl-7 pr-3 py-2 rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      !formData.enablePhilHealth
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
                    <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                    className={`block w-full pl-7 pr-3 py-2 rounded-lg bg-gray-800 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      !formData.enablePagIbig
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                    placeholder="0.00"
                    disabled={!formData.enablePagIbig}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-3 space-y-3 border border-gray-700/50 hover:border-gray-600/50 transition-colors duration-200">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-gray-400">
                    Loading cash advances...
                  </p>
                </div>
              ) : unpaidAdvances.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-gray-400">
                    No unpaid cash advances available.
                  </p>
                  <p className="text-xs text-gray-500">
                    Please check back later or add new cash advances.
                  </p>
                </div>
              ) : (
                unpaidAdvances.map((advance) => (
                  <div key={advance.id} className="w-full">
                    <div
                      className={`group flex flex-col space-y-3 p-4 rounded-lg transition-all duration-200 ${
                        selectedAdvances.has(advance.id)
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
                              checked={selectedAdvances.has(advance.id)}
                              onChange={(e) =>
                                handleAdvanceSelect(advance.id, e.target.checked)
                              }
                              className="sr-only peer"
                            />
                            <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                            {new Date(advance.date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </span>
                          <span className="text-xs font-medium text-blue-400/90 group-hover:text-blue-400 mt-1 transition-colors duration-200">
                            Remaining:{" "}
                            {formatCurrency(advance.remainingUnpaid)}
                          </span>
                        </div>
                      </div>
                      {selectedAdvances.has(advance.id) && (
                        <div className="mt-2">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-400 sm:text-sm">
                                ₱
                              </span>
                            </div>
                            <input
                              type="text"
                              value={deductionAmounts[advance.id] || ""}
                              onChange={(e) =>
                                handleAdvanceAmountChange(
                                  advance.id,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className={`block w-full pl-7 pr-3 py-2 text-sm rounded-md bg-gray-800/80 border border-gray-700/50 text-white placeholder-gray-500
                                focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 hover:border-gray-600/50 transition-all duration-200 ${
                                  isCalculating[advance.id] ? "opacity-50" : ""
                                }`}
                              placeholder="Enter deduction amount"
                              disabled={isCalculating[advance.id]}
                            />
                            {isCalculating[advance.id] && (
                              <div className="absolute inset-y-0 right-3 flex items-center">
                                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
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
};