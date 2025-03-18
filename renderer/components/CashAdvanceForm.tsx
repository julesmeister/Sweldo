import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { toast } from "sonner";

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
  const [amount, setAmount] = useState(initialData?.amount || "");
  const [remainingUnpaid, setRemainingUnpaid] = useState(
    initialData?.remainingUnpaid || "0"
  );
  const [date, setDate] = useState(() => {
    if (initialData?.date) {
      const d = new Date(initialData.date);
      return d.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [reason, setReason] = useState(() => {
    return initialData?.reason || "";
  });
  const [paymentSchedule, setPaymentSchedule] = useState(
    initialData?.paymentSchedule || "One-time"
  );
  const [approvalStatus, setApprovalStatus] = useState(
    initialData?.approvalStatus || "Approved"
  );
  const [numberOfPayments, setNumberOfPayments] = useState(
    initialData?.installmentDetails?.numberOfPayments || 1
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    // Validate amount
    const parsedRemainingUnpaid = parseFloat(remainingUnpaid);
    if (isNaN(parsedRemainingUnpaid) || parsedRemainingUnpaid <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    const formData = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || "", // This will be set by the parent component
      date: new Date(date),
      amount: parsedAmount,
      remainingUnpaid: parsedRemainingUnpaid, // For new cash advances, remaining unpaid equals the amount
      reason,
      approvalStatus,
      status: "Unpaid", // New cash advances start as unpaid
      paymentSchedule,
      installmentDetails:
        paymentSchedule === "Installment"
          ? {
              numberOfPayments: parseInt(numberOfPayments.toString()),
              amountPerPayment:
                parsedAmount / parseInt(numberOfPayments.toString()),
              remainingPayments: parseInt(numberOfPayments.toString()),
            }
          : undefined,
    };

    onSave(formData);
    onClose();
  };

  return (
    <div
      className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700"
      style={{
        position: "absolute",
        top: position?.top,
        left: position?.left,
        width: "850px",
        transform: position?.showAbove ? "translateY(-100%)" : "none",
        maxHeight: "calc(100vh - 100px)",
      }}
    >
      {/* Caret */}
      <div
        style={{
          position: "absolute",
          left: position?.caretLeft,
          [position?.showAbove ? "bottom" : "top"]: position?.showAbove
            ? "-8px"
            : "-8px",
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          ...(position?.showAbove
            ? { borderTop: "8px solid rgb(17, 24, 39)" }
            : { borderBottom: "8px solid rgb(17, 24, 39)" }),
        }}
        className="absolute"
      />

      {/* Remove the inner caret as LeaveForm uses only one */}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-100">
          {initialData ? "Edit Cash Advance" : "Request Cash Advance"}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-300 transition-colors duration-200"
        >
          <IoClose size={24} />
        </button>
      </div>

      {/* Form Content */}
      <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400">₱</span>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600 [color-scheme:dark]"
                required
              />
            </div>

            {/* Number of Payments (shown inline when Installment is selected) */}
            {paymentSchedule === "Installment" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Number of Payments
                </label>
                <input
                  type="number"
                  value={numberOfPayments}
                  onChange={(e) =>
                    setNumberOfPayments(parseInt(e.target.value))
                  }
                  className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                  required
                  min="1"
                />
              </div>
            )}

            {/* Remaining Unpaid */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Remaining Unpaid
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-400">₱</span>
                <input
                  type="text"
                  value={remainingUnpaid}
                  onChange={(e) => setRemainingUnpaid(e.target.value)}
                  className="pl-7 block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                  required
                />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
              required
              rows={1}
            />
          </div>

          <div className="grid grid-cols-5 gap-4">
            {/* Payment Schedule */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Payment Schedule
              </label>
              <div className="grid grid-cols-2 gap-3">
                {["One-time", "Installment"].map((option) => (
                  <div
                    key={option}
                    onClick={() => setPaymentSchedule(option)}
                    className={`
                      relative flex items-center px-4 py-2.5 cursor-pointer
                      rounded-lg border transition-all duration-200
                      ${
                        paymentSchedule === option
                          ? "border-blue-500 bg-blue-900/50 text-blue-300"
                          : "border-gray-700 hover:border-gray-600 hover:bg-gray-700 text-gray-300"
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`
                        w-4 h-4 rounded-full border-2 flex items-center justify-center
                        transition-colors duration-200
                        ${
                          paymentSchedule === option
                            ? "border-blue-500"
                            : "border-gray-500"
                        }
                      `}
                      >
                        {paymentSchedule === option && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{option}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 col-span-3">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Approval Status
              </label>
              <div className="grid grid-cols-3 gap-3">
                {["Approved", "Pending", "Rejected"].map((option) => (
                  <div
                    key={option}
                    onClick={() => setApprovalStatus(option)}
                    className={`
                      relative flex items-center px-3 py-2.5 cursor-pointer
                      rounded-lg border transition-all duration-200
                      ${
                        approvalStatus === option
                          ? "border-blue-500 bg-blue-900/50 text-blue-300"
                          : "border-gray-700 hover:border-gray-600 hover:bg-gray-700 text-gray-300"
                      }
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`
                        w-4 h-4 rounded-full border-2 flex items-center justify-center
                        transition-colors duration-200
                        ${
                          approvalStatus === option
                            ? "border-blue-500"
                            : "border-gray-500"
                        }
                      `}
                      >
                        {approvalStatus === option && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{option}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Show installment calculation if applicable */}
          {paymentSchedule === "Installment" &&
            amount &&
            numberOfPayments > 0 && (
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-md">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Installment Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                  <p>
                    Amount per payment: ₱
                    {(parseFloat(amount) / numberOfPayments).toFixed(2)}
                  </p>
                  <p>Total payments: {numberOfPayments}</p>
                </div>
              </div>
            )}
        </form>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
        <div className="flex flex-row space-x-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
          >
            {initialData ? "Update" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashAdvanceForm;
