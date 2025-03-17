import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { Leave } from "@/renderer/model/leave";

interface LeaveFormProps {
  onClose: () => void;
  onSave: (data: Leave) => void;
  initialData?: Leave;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
    caretLeft?: number;
  };
}

const LeaveForm: React.FC<LeaveFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
}) => {
  if (!position) {
    return null; // Prevent rendering if position is not set
  }

  const [type, setType] = useState<"Sick" | "Vacation" | "Emergency" | "Other">(
    initialData?.type || "Vacation"
  );
  const [reason, setReason] = useState(initialData?.reason || "");
  const [status, setStatus] = useState<"Pending" | "Approved" | "Rejected">(
    initialData?.status || "Pending"
  );

  const storedMonth = localStorage.getItem("selectedMonth");
  let storedMonthInt = storedMonth
    ? parseInt(storedMonth, 10)
    : new Date().getMonth();
  if (isNaN(storedMonthInt) || storedMonthInt < 1 || storedMonthInt > 12) {
    storedMonthInt = new Date().getMonth();
  }

  let storedYear = localStorage.getItem("selectedYear");
  if (!storedYear || isNaN(parseInt(storedYear))) {
    const currentYear = new Date().getFullYear().toString();
    localStorage.setItem("selectedYear", currentYear);
    storedYear = currentYear;
  }

  const [startDateState, setStartDateState] = useState(
    initialData?.startDate
      ? new Date(initialData.startDate).toISOString().split("T")[0]
      : new Date(`${storedYear}-${storedMonthInt + 1 || "1"}-01`)
          .toISOString()
          .split("T")[0]
  );
  const [endDateState, setEndDateState] = useState(
    initialData?.endDate
      ? new Date(initialData.endDate).toISOString().split("T")[0]
      : new Date(
          new Date(`${storedYear}-${storedMonthInt + 1 || "1"}-01`).setMonth(
            storedMonthInt + 1,
            0
          )
        )
          .toISOString()
          .split("T")[0]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const formData: Leave = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || "", // This should be set by the parent component
      startDate: new Date(startDateState),
      endDate: new Date(endDateState),
      type,
      status,
      reason,
    };
    console.log("[LeaveForm] Submitting leave:", formData);
    onSave(formData);
    onClose();
  };

  return (
    <div
      style={{
        position: "absolute",
        top: position.top,
        left: position.left - 100,
        width: "550px",
        transform: position.showAbove ? "translateY(-100%)" : "none",
      }}
      className="bg-gray-900 rounded-lg shadow-xl border border-gray-700"
    >
      {/* Caret */}
      <div
        style={{
          position: "absolute",
          left: position.caretLeft! + 100,
          [position.showAbove ? "bottom" : "top"]: position.showAbove
            ? "-8px"
            : "-8px",
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          ...(position.showAbove
            ? { borderTop: "8px solid rgb(17, 24, 39)" }
            : { borderBottom: "8px solid rgb(17, 24, 39)" }),
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-100">
          {initialData ? "Edit Leave Request" : "New Leave Request"}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDateState}
                onChange={(e) => setStartDateState(e.target.value)}
                className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600 [color-scheme:dark]"
                required
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDateState}
                min={startDateState}
                onChange={(e) => setEndDateState(e.target.value)}
                className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600 [color-scheme:dark]"
                required
              />
            </div>

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Leave Type
              </label>
              <select
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value as
                      | "Sick"
                      | "Vacation"
                      | "Emergency"
                      | "Other"
                  )
                }
                className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
              >
                <option value="Vacation" className="bg-gray-800">
                  Vacation Leave
                </option>
                <option value="Sick" className="bg-gray-800">
                  Sick Leave
                </option>
                <option value="Emergency" className="bg-gray-800">
                  Emergency Leave
                </option>
                <option value="Other" className="bg-gray-800">
                  Other
                </option>
              </select>
            </div>
          </div>

          {/* Leave Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Leave Status
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {["Pending", "Approved", "Rejected"].map((option) => (
                <div
                  key={option}
                  className={`
                    relative flex items-center px-3 py-2.5 cursor-pointer
                    rounded-lg border transition-all duration-200
                    ${
                      status === option
                        ? "border-blue-500 bg-blue-900/50 text-blue-300"
                        : "border-gray-700 hover:border-gray-600 hover:bg-gray-700 text-gray-300"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option}
                    checked={status === option}
                    onChange={() =>
                      setStatus(option as "Pending" | "Approved" | "Rejected")
                    }
                    className="absolute opacity-0 w-full h-full"
                  />
                  <div className="flex items-center space-x-3">
                    <div
                      className={`
                      w-4 h-4 rounded-full border-2 flex items-center justify-center
                      transition-colors duration-200
                      ${
                        status === option
                          ? "border-blue-500"
                          : "border-gray-500"
                      }
                    `}
                    >
                      {status === option && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{option}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) =>
                setReason(
                  e.target.value.charAt(0).toUpperCase() +
                    e.target.value.slice(1)
                )
              }
              rows={1}
              className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
              required
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

export default LeaveForm;
