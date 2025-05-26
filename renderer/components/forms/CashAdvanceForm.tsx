import React, { useState, ChangeEvent, useEffect } from "react";
import { toast } from "sonner";
import BaseFormDialog from "@/renderer/components/dialogs/BaseFormDialog";
import FormField from "@/renderer/components/forms/FormField";
import OptionSelector from "@/renderer/components/forms/OptionSelector";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";

interface CashAdvanceFormProps {
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  isOpen: boolean;
}

const CashAdvanceForm: React.FC<CashAdvanceFormProps> = ({
  onClose,
  onSave,
  initialData,
  isOpen,
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

  // Update form state when initialData changes
  useEffect(() => {
    if (initialData) {
      console.log("Updating form with initialData:", initialData);
      setAmount(initialData.amount?.toString() || "");
      setRemainingUnpaid(initialData.remainingUnpaid?.toString() || initialData.amount?.toString() || "0");

      if (initialData.date) {
        const d = new Date(initialData.date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        setDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      }

      setReason(initialData.reason || "");
      setPaymentSchedule(initialData.paymentSchedule || "One-time");
      setApprovalStatus(initialData.approvalStatus || "Approved");
      setNumberOfPayments(initialData.installmentDetails?.numberOfPayments?.toString() || "1");
    } else {
      // Reset form when creating new cash advance
      setAmount("");
      setRemainingUnpaid("0");

      const year = storeSelectedYear;
      const month = storeSelectedMonth + 1;
      const day = 1;
      setDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);

      setReason("");
      setPaymentSchedule("One-time");
      setApprovalStatus("Approved");
      setNumberOfPayments("1");
    }
  }, [initialData, storeSelectedMonth, storeSelectedYear]);

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
      reason: reason || "No reason indicated",
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
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText={initialData ? "Update" : "Save Request"}
      isBottomSheet={true}
    >
      <form className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">₱</span>
              </div>
              <input
                type="text"
                name="amount"
                value={amount}
                onChange={handleInputChange}
                className="block w-full bg-white border border-gray-300 text-gray-900 h-10 pl-7 pr-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
                required
              />
            </div>
          </div>

          <div className="md:col-span-4">
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

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remaining Unpaid
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="text-gray-500">₱</span>
              </div>
              <input
                type="text"
                name="remainingUnpaid"
                value={remainingUnpaid}
                onChange={handleInputChange}
                className="block w-full bg-white border border-gray-300 text-gray-900 h-10 pl-7 pr-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
                required
                readOnly={!initialData?.id}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason
          </label>
          <textarea
            name="reason"
            value={reason}
            onChange={handleInputChange}
            rows={1}
            className="block w-full bg-white border border-gray-300 text-gray-900 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Schedule
            </label>
            <div className="grid grid-cols-2 gap-0 h-10 border border-gray-300">
              {paymentScheduleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentSchedule(option.value)}
                  className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${paymentSchedule === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    } ${option.value !== paymentScheduleOptions[0].value ? "border-l border-gray-300" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {paymentSchedule === "Installment" && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Payments
              </label>
              <input
                type="number"
                name="numberOfPayments"
                value={numberOfPayments}
                onChange={handleInputChange}
                min="1"
                className="block w-full bg-white border border-gray-300 text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
                required
              />
            </div>
          )}

          <div className={paymentSchedule === "Installment" ? "md:col-span-5" : "md:col-span-8"}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Approval Status
            </label>
            <div className="grid grid-cols-3 gap-0 h-10 border border-gray-300">
              {approvalStatusOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setApprovalStatus(option.value)}
                  className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${approvalStatus === option.value
                    ? option.value === "Approved"
                      ? "bg-green-600 text-white"
                      : option.value === "Pending"
                        ? "bg-amber-500 text-white"
                        : "bg-red-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                    } ${index !== 0 ? "border-l border-gray-300" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {paymentSchedule === "Installment" && parseFloat(amount) > 0 && parseInt(numberOfPayments) > 0 && (
          <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400">
            <h3 className="text-sm font-medium text-blue-800 mb-1">Installment Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
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
