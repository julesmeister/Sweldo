import React, { useState, ChangeEvent, useEffect } from "react";
import { IoClose } from "react-icons/io5";
import { Leave } from "@/renderer/model/leave";
import BaseFormDialog from "../dialogs/BaseFormDialog";
import FormField from "./FormField";
import OptionSelector from "./OptionSelector";
import { useDateSelectorStore } from "@/renderer/components/DateSelector";

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
  isOpen: boolean;
}

const LeaveForm: React.FC<LeaveFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
  isOpen,
}) => {
  // Get selected month and year from the DateSelector store
  const storeSelectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const storeSelectedYear = useDateSelectorStore((state) => state.selectedYear);

  const [type, setType] = useState<"Vacation" | "Sick" | "Emergency" | "Other">("Vacation");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"Pending" | "Approved" | "Rejected">("Pending");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<{
    reason?: string;
    dateRange?: string;
  }>({});

  // Initialize form data when component opens or initialData changes
  useEffect(() => {
    if (!isOpen) return; // Don't update when dialog is closed

    if (initialData) {
      console.log("[LeaveForm] Setting form with initialData:", initialData);
      setType(initialData.type || "Vacation");
      setReason(initialData.reason || "");
      setStatus(initialData.status || "Pending");

      if (initialData.startDate) {
        const d = new Date(initialData.startDate);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        setStartDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      } else {
        const year = storeSelectedYear;
        const month = storeSelectedMonth + 1;
        const day = 1;
        setStartDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      }

      if (initialData.endDate) {
        const d = new Date(initialData.endDate);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        setEndDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      } else {
        const year = storeSelectedYear;
        const month = storeSelectedMonth + 1;
        const lastDay = new Date(storeSelectedYear, storeSelectedMonth + 1, 0).getDate();
        setEndDate(`${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`);
      }
    } else {
      // Reset form when adding a new leave request
      console.log("[LeaveForm] Resetting form for new leave request");
      setType("Vacation");
      setReason("");
      setStatus("Pending");

      // Set default start date to the first day of the selected month
      const year = storeSelectedYear;
      const month = storeSelectedMonth + 1;
      const day = 1;
      setStartDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);

      // Set default end date to the last day of the selected month
      const lastDay = new Date(storeSelectedYear, storeSelectedMonth + 1, 0).getDate();
      setEndDate(`${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`);
    }
  }, [initialData, isOpen, storeSelectedMonth, storeSelectedYear]);

  const handleTypeChange = (newType: "Vacation" | "Sick" | "Emergency" | "Other") => {
    setType(newType);
  };

  const handleStatusChange = (newStatus: "Pending" | "Approved" | "Rejected") => {
    setStatus(newStatus);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    switch (name) {
      case "reason":
        // Capitalize first letter
        setReason(value.charAt(0).toUpperCase() + value.slice(1));
        setErrors({ ...errors, reason: undefined });
        break;
      case "startDate":
        setStartDate(value);
        validateDateRange(value, endDate);
        break;
      case "endDate":
        setEndDate(value);
        validateDateRange(startDate, value);
        break;
      default:
        break;
    }
  };

  const validateDateRange = (start: string, end: string): boolean => {
    if (!start || !end) return true;

    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    if (endDateObj < startDateObj) {
      setErrors({ ...errors, dateRange: "End date cannot be before start date" });
      return false;
    }

    setErrors({ ...errors, dateRange: undefined });
    return true;
  };

  const validateForm = (): boolean => {
    const newErrors: { reason?: string; dateRange?: string } = {};

    // Validate reason
    if (!reason.trim()) {
      newErrors.reason = "Please provide a reason for the leave";
    }

    // Validate date range
    if (!validateDateRange(startDate, endDate)) {
      newErrors.dateRange = "End date cannot be before start date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    const formDataToSave: Leave = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || "",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type: type,
      status: status,
      reason: reason,
    };

    console.log("[LeaveForm] Submitting leave:", formDataToSave);
    onSave(formDataToSave);
  };

  const dialogTitle = initialData ? "Edit Leave Request" : "New Leave Request";
  const submitButtonText = initialData ? "Update" : "Submit";

  const leaveTypeOptions = [
    { value: "Vacation", label: "Vacation Leave" },
    { value: "Sick", label: "Sick Leave" },
    { value: "Emergency", label: "Emergency Leave" },
    { value: "Other", label: "Other" },
  ];

  const leaveStatusOptions = [
    { value: "Pending", label: "Pending" },
    { value: "Approved", label: "Approved" },
    { value: "Rejected", label: "Rejected" },
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
      <form onSubmit={handleSubmit} className="space-y-4 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={startDate}
              onChange={handleInputChange}
              className="block w-full bg-white border border-gray-300 text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={endDate}
              onChange={handleInputChange}
              min={startDate}
              className={`block w-full bg-white border ${errors.dateRange ? "border-red-500" : "border-gray-300"} text-gray-900 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400`}
              required
            />
            {errors.dateRange && (
              <p className="mt-1 text-sm text-red-500">{errors.dateRange}</p>
            )}
          </div>

          <div className="md:col-span-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Type
            </label>
            <div className="grid grid-cols-4 gap-0 h-10 border border-gray-300">
              <button
                type="button"
                onClick={() => handleTypeChange("Vacation")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "Vacation"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Vacation
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("Sick")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "Sick"
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Sick
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("Emergency")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "Emergency"
                  ? "bg-amber-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Emergency
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("Other")}
                className={`w-full h-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${type === "Other"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Other
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mt-4">
          <div className="md:col-span-12">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leave Status
            </label>
            <div className="grid grid-cols-3 gap-0 h-10 border border-gray-300">
              <button
                type="button"
                onClick={() => handleStatusChange("Pending")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${status === "Pending"
                  ? "bg-yellow-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("Approved")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${status === "Approved"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("Rejected")}
                className={`w-full h-full flex items-center justify-center text-sm font-medium transition-colors duration-200 ${status === "Rejected"
                  ? "bg-red-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
                  } border-l border-gray-300`}
              >
                Rejected
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mt-4">
          <div className="md:col-span-12">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              name="reason"
              value={reason}
              onChange={handleInputChange}
              rows={1}
              className={`block w-full bg-white border ${errors.reason ? "border-red-500" : "border-gray-300"} text-gray-900 px-3 py-2 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-400`}
              required
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-500">{errors.reason}</p>
            )}
          </div>
        </div>
      </form>
    </BaseFormDialog>
  );
};

export default LeaveForm;
