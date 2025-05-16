import React, { useState, ChangeEvent } from "react";
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
}

const ShortsForm: React.FC<ShortsFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
}) => {
  const storeSelectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const storeSelectedYear = useDateSelectorStore((state) => state.selectedYear);

  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [type, setType] = useState(initialData?.type || "Short"); // Added type state
  const [remainingUnpaid, setRemainingUnpaid] = useState(
    initialData?.remainingUnpaid?.toString() || "0"
  );
  const [date, setDate] = useState(() => {
    if (initialData?.date) {
      const d = new Date(initialData.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    const year = storeSelectedYear;
    const month = storeSelectedMonth + 1;
    const day = 1;
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  });
  const [reason, setReason] = useState(initialData?.reason || "");

  // Generic handler for FormField onChange
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    switch (name) {
      case "amount":
        setAmount(value);
        if (!initialData) {
          setRemainingUnpaid(value); // Keep this logic
        }
        break;
      case "type": // Added case for type
        setType(value);
        break;
      case "remainingUnpaid":
        setRemainingUnpaid(value);
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    // Validate remaining unpaid
    const parsedRemainingUnpaid = parseFloat(remainingUnpaid);
    // In ShortsForm, remainingUnpaid can be 0 if it's fully paid, so the check is just for NaN.
    // However, the original code had parsedRemainingUnpaid <= 0, which would prevent setting it to 0.
    // Assuming it can be 0 or greater based on typical use cases for 'remaining'.
    if (isNaN(parsedRemainingUnpaid) || parsedRemainingUnpaid < 0) {
      toast.error("Please enter a valid remaining amount (0 or greater)");
      return;
    }

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
    // onClose(); // onClose will be handled by BaseFormDialog or if onSave is successful in parent
  };

  return (
    <BaseFormDialog
      title={initialData ? "Edit Deduction" : "Add New Deduction"}
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      position={position}
      submitText={initialData ? "Update Deduction" : "Submit Deduction"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 grid-rows-2 gap-4 items-start">
          {/* Amount Field (Col 1, Row 1) */}
          <FormField
            label="Amount"
            name="amount"
            value={amount}
            onChange={handleInputChange}
            type="text" // Keep as text to allow manual input, parsing happens on submit
            prefix="₱"
            inputClassName="pl-7" // Ensure existing pl-7 is applied if FormField prefix logic changes
          />

          {/* Date Field (Col 2, Row 1) */}
          <FormField
            label="Date"
            name="date"
            value={date}
            onChange={handleInputChange}
            type="date"
          />

          {/* Reason Field (Col 3, Rows 1 & 2) */}
          <div className="row-span-2 flex flex-col h-full">
            <FormField
              label="Reason"
              name="reason"
              value={reason}
              onChange={handleInputChange}
              type="textarea"
              rows={5} // Adjusted to better fit the spanned rows
              className="flex-grow"
              inputClassName="h-full"
            />
          </div>

          {/* Remaining Unpaid Field (Col 1, Row 2) */}
          <FormField
            label="Remaining Unpaid"
            name="remainingUnpaid"
            value={remainingUnpaid}
            onChange={handleInputChange}
            type="text" // Keep as text for consistency with amount
            prefix="₱"
            inputClassName="pl-7"
          />

          {/* Type Field (Col 2, Row 2) */}
          <FormField
            label="Type"
            name="type"
            value={type}
            onChange={handleInputChange}
            type="select"
            options={[
              { value: "Short", label: "Short" },
              { value: "Withdrawal", label: "Withdrawal" },
            ]}
          />
        </div>
      </form>
    </BaseFormDialog>
  );
};

export default ShortsForm;
