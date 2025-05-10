import React, { useState, ChangeEvent } from "react";
import { toast } from "sonner";
import BaseFormDialog from "../dialogs/BaseFormDialog"; // Adjust path as necessary
import FormField from "./FormField"; // Import the new FormField
import { useDateSelectorStore } from "@/renderer/components/DateSelector"; // Import the store

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
      remainingUnpaid: parsedRemainingUnpaid,
      reason,
      status: parsedRemainingUnpaid <= 0 ? "Paid" : "Unpaid", // Auto-set status based on remainingUnpaid
    };

    onSave(formData);
    // onClose(); // onClose will be handled by BaseFormDialog or if onSave is successful in parent
  };

  return (
    <BaseFormDialog
      title={initialData ? "Edit Short" : "Add New Short"}
      isOpen={true} // ShortsForm is only rendered when it should be open
      onClose={onClose}
      onSubmit={handleSubmit} // The BaseFormDialog's submit button will trigger this
      position={position}
      submitText={initialData ? "Update" : "Submit"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Amount"
            name="amount"
            value={amount}
            onChange={handleInputChange}
            type="text" // Keep as text to allow manual input, parsing happens on submit
            prefix="₱"
            inputClassName="pl-7" // Ensure existing pl-7 is applied if FormField prefix logic changes
          />
          <FormField
            label="Date"
            name="date"
            value={date}
            onChange={handleInputChange}
            type="date"
          />
          <FormField
            label="Remaining Unpaid"
            name="remainingUnpaid"
            value={remainingUnpaid}
            onChange={handleInputChange}
            type="text" // Keep as text for consistency with amount
            prefix="₱"
            inputClassName="pl-7"
          />
        </div>
        <FormField
          label="Reason"
          name="reason"
          value={reason}
          onChange={handleInputChange}
          type="textarea"
          rows={3}
        />
      </form>
    </BaseFormDialog>
  );
};

export default ShortsForm;
