import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { toast } from "sonner";

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
      remainingUnpaid: parsedRemainingUnpaid, // For new shorts, remaining unpaid equals the amount
      reason,
      status: "Unpaid", // New shorts start as unpaid
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

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-100">
          {initialData ? "Edit Short" : "Add New Short"}
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
                  onChange={(e) => {
                    setAmount(e.target.value);
                    // If there's no initial data, update remainingUnpaid to match amount
                    if (!initialData) {
                      setRemainingUnpaid(e.target.value);
                    }
                  }}
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
              rows={3}
            />
          </div>
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

export default ShortsForm;
