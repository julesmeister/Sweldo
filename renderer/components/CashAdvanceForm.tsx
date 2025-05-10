import React, { useState, ChangeEvent } from "react";
import { toast } from "sonner";
import BaseFormDialog from "@/renderer/components/dialogs/BaseFormDialog";
import FormField from "@/renderer/components/forms/FormField";
import OptionSelector from "@/renderer/components/forms/OptionSelector";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";

interface CashAdvanceFormProps {
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

const CashAdvanceForm: React.FC<CashAdvanceFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
}) => {
  const storeSelectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const storeSelectedYear = useDateSelectorStore((state) => state.selectedYear);

  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [remainingUnpaid, setRemainingUnpaid] = useState(
    initialData?.remainingUnpaid?.toString() || initialData?.amount?.toString() || "0"
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
  const [paymentSchedule, setPaymentSchedule] = useState(
    initialData?.paymentSchedule || "One-time"
  );
  const [approvalStatus, setApprovalStatus] = useState(
    initialData?.approvalStatus || "Approved"
  );
  const [numberOfPayments, setNumberOfPayments] = useState(
    initialData?.installmentDetails?.numberOfPayments?.toString() || "1"
  );

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    switch (name) {
      case "amount":
        setAmount(value);
        if (!initialData?.id) { // Only auto-update remainingUnpaid for new entries
          setRemainingUnpaid(value);
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
      case "numberOfPayments":
        setNumberOfPayments(value);
        break;
      default:
        break;
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    const parsedRemainingUnpaid = parseFloat(remainingUnpaid);
    if (isNaN(parsedRemainingUnpaid) || parsedRemainingUnpaid < 0) {
      toast.error("Please enter a valid remaining amount (0 or greater)");
      return;
    }
    const numPayments = parseInt(numberOfPayments);
    if (paymentSchedule === "Installment" && (isNaN(numPayments) || numPayments <= 0)) {
      toast.error("Please enter a valid number of payments for installment.");
      return;
    }

    const formData = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || "",
      date: new Date(date),
      amount: parsedAmount,
      remainingUnpaid: parsedRemainingUnpaid,
      reason,
      approvalStatus,
      status: parsedRemainingUnpaid <= 0 ? "Paid" : "Unpaid",
      paymentSchedule,
      installmentDetails:
        paymentSchedule === "Installment"
          ? {
            numberOfPayments: numPayments,
            amountPerPayment: parsedAmount / numPayments,
            // Ensure remainingPayments considers existing data if editing
            remainingPayments: initialData?.installmentDetails?.remainingPayments && initialData?.id && paymentSchedule === initialData?.paymentSchedule
              ? initialData.installmentDetails.remainingPayments
              : numPayments,
          }
          : null,
    };
    onSave(formData);
  };

  const paymentScheduleOptions = [
    { value: "One-time", label: "One-time" },
    { value: "Installment", label: "Installment" },
  ];

  const approvalStatusOptions = [
    { value: "Approved", label: "Approved" },
    { value: "Pending", label: "Pending" },
    { value: "Rejected", label: "Rejected" },
  ];

  return (
    <BaseFormDialog
      title={initialData ? "Edit Cash Advance" : "Request Cash Advance"}
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      position={position}
      submitText={initialData ? "Update" : "Save Request"}
      dialogWidth="850px"
    >
      <form onSubmit={handleSubmit} className="">
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Amount"
            name="amount"
            type="text"
            value={amount}
            onChange={handleInputChange}
            prefix="₱"
            required
            inputClassName="pl-7"
          />
          <FormField
            label="Date"
            name="date"
            type="date"
            value={date}
            onChange={handleInputChange}
            required
          />
          {paymentSchedule === "Installment" && (
            <FormField
              label="Number of Payments"
              name="numberOfPayments"
              type="number"
              value={numberOfPayments}
              onChange={handleInputChange}
              required
              inputProps={{ min: "1" }}
            />
          )}
          <FormField
            label="Remaining Unpaid"
            name="remainingUnpaid"
            type="text"
            value={remainingUnpaid}
            onChange={handleInputChange}
            prefix="₱"
            required
            inputClassName="pl-7"
            // If it's a new record, remainingUnpaid is typically readOnly or mirrors amount
            // For existing, it should be editable. This logic can be enhanced if needed.
            readOnly={!initialData?.id}
          />
        </div>

        <FormField
          label="Reason"
          name="reason"
          type="textarea"
          value={reason}
          onChange={handleInputChange}
          rows={1}
          required
          className=" mb-3"
        />

        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment Schedule
            </label>
            <OptionSelector
              options={paymentScheduleOptions}
              selectedValue={paymentSchedule}
              onChange={setPaymentSchedule}
              columns={2}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Approval Status
            </label>
            <OptionSelector
              options={approvalStatusOptions}
              selectedValue={approvalStatus}
              onChange={setApprovalStatus}
              columns={3}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            />
          </div>
        </div>

        {paymentSchedule === "Installment" && parseFloat(amount) > 0 && parseInt(numberOfPayments) > 0 && (
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-md">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Installment Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
              <p>Amount per payment: ₱{(parseFloat(amount) / parseInt(numberOfPayments)).toFixed(2)}</p>
              <p>Total payments: {parseInt(numberOfPayments)}</p>
            </div>
          </div>
        )}
      </form>
    </BaseFormDialog>
  );
};

export default CashAdvanceForm;
