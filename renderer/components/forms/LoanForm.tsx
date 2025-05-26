import React, { useState, useEffect, ChangeEvent } from "react";
// IoClose is imported but BaseFormDialog will handle its own close icon.
// import { IoClose } from "react-icons/io5"; 
import { Loan } from "@/renderer/model/loan";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import BaseFormDialog from "@/renderer/components/dialogs/BaseFormDialog"; // Import BaseFormDialog
import FormField from "@/renderer/components/forms/FormField"; // Import FormField
import { useDateSelectorStore } from "@/renderer/components/DateSelector";

interface LoanFormProps {
  onClose: () => void;
  onSave: (data: Loan) => void;
  initialData?: Loan | null;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
    caretLeft?: number;
  };
  isWebMode?: boolean; // This prop seems informational, BaseFormDialog doesn't use it directly
  companyName?: string | null; // This prop seems informational
  isOpen: boolean;
}

const LoanForm: React.FC<LoanFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
  isWebMode = false,
  isOpen,
}) => {
  const storeSelectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const storeSelectedYear = useDateSelectorStore((state) => state.selectedYear);

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"Personal" | "PagIbig" | "SSS" | "Other">("Personal");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<{
    amount?: string;
  }>({});

  const { selectedEmployeeId } = useEmployeeStore();

  // Initialize form data when component opens or initialData changes
  useEffect(() => {
    if (!isOpen) return; // Don't update when dialog is closed

    if (initialData) {
      console.log("[LoanForm] Setting form with initialData:", initialData);
      setAmount(initialData.amount?.toString() || "");
      setType(initialData.type || "Personal");

      if (initialData.date) {
        const d = new Date(initialData.date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        setDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      } else {
        const year = storeSelectedYear;
        const month = storeSelectedMonth + 1;
        const day = 1;
        setDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      }
    } else {
      // Reset form when adding a new loan
      console.log("[LoanForm] Resetting form for new loan");
      setAmount("");
      setType("Personal");

      const year = storeSelectedYear;
      const month = storeSelectedMonth + 1;
      const day = 1;
      setDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    }
  }, [initialData, isOpen, storeSelectedMonth, storeSelectedYear]);

  const handleTypeChange = (newType: "Personal" | "PagIbig" | "SSS" | "Other") => {
    setType(newType);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    switch (name) {
      case "amount":
        setAmount(value);
        setErrors({ ...errors, amount: undefined });
        break;
      case "date":
        setDate(value);
        break;
      default:
        break;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { amount?: string } = {};

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    if (!selectedEmployeeId) {
      console.error("No employee selected");
      return;
    }

    const processedFormData: Loan = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: selectedEmployeeId,
      date: new Date(date),
      amount: parseFloat(amount),
      type: type,
      status: initialData?.status || "Pending",
      remainingBalance: parseFloat(amount), // Assuming remaining balance is initially the full amount
    };

    onSave(processedFormData);
  };

  const dialogTitle = initialData ? "Edit Loan Application" : "Apply for Loan";
  const submitButtonText = (initialData ? "Update" : "Submit") + " Loan";

  const loanTypeOptions = [
    { value: "PagIbig", label: "Pag-Ibig Loan" },
    { value: "SSS", label: "SSS Loan" },
    { value: "Personal", label: "Personal Loan" },
    { value: "Other", label: "Other" },
  ];

  return (
    <BaseFormDialog
      title={dialogTitle}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      position={position}
      submitText={submitButtonText}
      isBottomSheet={true}
    >
      <form className="space-y-4">
        {/* All fields in one line */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Amount Field */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loan Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                ₱
              </div>
              <input
                type="text"
                name="amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors({ ...errors, amount: undefined });
                }}
                className={`block w-full bg-white border ${errors.amount ? "border-red-500" : "border-gray-300"
                  } text-gray-900 h-10 px-3 pl-7 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400`}
                required
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Date Field */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loan Date
            </label>
            <input
              type="date"
              name="date"
              value={date}
              onChange={handleInputChange}
              className="block w-full bg-white border border-gray-300 text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
              required
            />
          </div>

          {/* Type Field */}
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loan Type
            </label>
            <div className="grid grid-cols-4 gap-0 h-10 border border-gray-300">
              <button
                type="button"
                onClick={() => handleTypeChange("Personal")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "Personal"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("PagIbig")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "PagIbig"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Pag-Ibig
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("SSS")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "SSS"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                SSS
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("Other")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "Other"
                  ? "bg-orange-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Other
              </button>
            </div>
          </div>
        </div>
      </form>
    </BaseFormDialog>
  );
};

export default LoanForm;
