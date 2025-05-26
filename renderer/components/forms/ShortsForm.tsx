import React, { useState, ChangeEvent, useEffect } from "react";
import { toast } from "sonner";
import BaseFormDialog from "../dialogs/BaseFormDialog"; // Adjust path as necessary
import FormField from "./FormField"; // Import the new FormField
import { useDateSelectorStore } from "@/renderer/components/DateSelector"; // Import the store

interface Short {
  id: string;
  employeeId: string;
  date: Date;
  amount: number;
  remainingUnpaid: number;
  reason: string;
  status: "Paid" | "Unpaid";
  type?: "Short" | "Withdrawal"; // Added type field
}

interface ShortsFormProps {
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
    caretLeft?: number;
  };
  isOpen: boolean;
}

const ShortsForm: React.FC<ShortsFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
  isOpen,
}) => {
  const storeSelectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const storeSelectedYear = useDateSelectorStore((state) => state.selectedYear);

  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [type, setType] = useState(initialData?.type || "Short"); // Added type state
  const [remainingUnpaid, setRemainingUnpaid] = useState(
    initialData?.remainingUnpaid?.toString() || "0"
  );
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{
    amount?: string;
    remainingUnpaid?: string;
  }>({});

  // Initialize form data when component opens or initialData changes
  useEffect(() => {
    if (!isOpen) return; // Don't update when dialog is closed

    if (initialData) {
      console.log("[ShortsForm] Setting form with initialData:", initialData);
      setAmount(initialData.amount?.toString() || "");
      setType(initialData.type || "Short");
      setRemainingUnpaid(initialData.remainingUnpaid?.toString() || "0");

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

      setReason(initialData.reason || "");
    } else {
      // Reset form when adding a new deduction
      console.log("[ShortsForm] Resetting form for new deduction");
      setAmount("");
      setType("Short");
      setRemainingUnpaid("0");

      const year = storeSelectedYear;
      const month = storeSelectedMonth + 1;
      const day = 1;
      setDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);

      setReason("");
    }
  }, [initialData, isOpen, storeSelectedMonth, storeSelectedYear]);

  const handleTypeChange = (newType: "Short" | "Withdrawal") => {
    setType(newType);
  };

  // Generic handler for direct input changes
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    switch (name) {
      case "amount":
        setAmount(value);
        if (!initialData) {
          setRemainingUnpaid(value); // Keep this logic
        }
        setErrors({ ...errors, amount: undefined });
        break;
      case "type": // Added case for type
        setType(value as "Short" | "Withdrawal");
        break;
      case "remainingUnpaid":
        setRemainingUnpaid(value);
        setErrors({ ...errors, remainingUnpaid: undefined });
        break;
      case "date":
        setDate(value);
        break;
      case "reason":
        setReason(value);
        break;
      default:
        break;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      amount?: string;
      remainingUnpaid?: string;
    } = {};

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }

    // Validate remaining unpaid
    const parsedRemainingUnpaid = parseFloat(remainingUnpaid);
    if (isNaN(parsedRemainingUnpaid) || parsedRemainingUnpaid < 0) {
      newErrors.remainingUnpaid = "Please enter a valid remaining amount (0 or greater)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    const parsedAmount = parseFloat(amount);
    const parsedRemainingUnpaid = parseFloat(remainingUnpaid);

    const formData = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || "", // This will be set by the parent component
      date: new Date(date),
      amount: parsedAmount,
      type, // Added type to formData
      remainingUnpaid: parsedRemainingUnpaid,
      reason,
      status: parsedRemainingUnpaid <= 0 ? "Paid" : "Unpaid", // Auto-set status based on remainingUnpaid
    };

    onSave(formData);
  };

  return (
    <BaseFormDialog
      title={initialData ? "Edit Deduction" : "Add New Deduction"}
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      position={position}
      submitText={initialData ? "Update Deduction" : "Submit Deduction"}
      isBottomSheet={true}
    >
      <form className="space-y-4">
        {/* All fields in one line */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Amount Field */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
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
                  if (!initialData) {
                    setRemainingUnpaid(e.target.value);
                  }
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
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
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

          {/* Remaining Unpaid Field */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remaining Unpaid
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                ₱
              </div>
              <input
                type="text"
                name="remainingUnpaid"
                value={remainingUnpaid}
                onChange={(e) => {
                  setRemainingUnpaid(e.target.value);
                  setErrors({ ...errors, remainingUnpaid: undefined });
                }}
                className={`block w-full bg-white border ${errors.remainingUnpaid ? "border-red-500" : "border-gray-300"
                  } text-gray-900 h-10 px-3 pl-7 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400`}
                required
              />
            </div>
            {errors.remainingUnpaid && (
              <p className="mt-1 text-sm text-red-500">{errors.remainingUnpaid}</p>
            )}
          </div>

          {/* Type Field */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <div className="grid grid-cols-2 gap-0 h-10 border border-gray-300">
              <button
                type="button"
                onClick={() => handleTypeChange("Short")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${type === "Short"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Short
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("Withdrawal")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${type === "Withdrawal"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Withdrawal
              </button>
            </div>
          </div>

          {/* Reason Field - spans entire width */}
          <div className="md:col-span-12 mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              name="reason"
              value={reason}
              onChange={handleInputChange}
              rows={1}
              className="block w-full bg-white border border-gray-300 text-gray-900 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
            />
          </div>
        </div>
      </form>
    </BaseFormDialog>
  );
};

export default ShortsForm;
