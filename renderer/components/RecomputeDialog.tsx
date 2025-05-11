import { IoWarningOutline, IoCalendarOutline, IoCalendarNumberOutline } from "react-icons/io5";
import { useState } from "react";
import { useDateSelectorStore } from "./DateSelector";
import { useDateRangeStore } from "../stores/dateRangeStore";

interface RecomputeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecompute: (useRange: boolean) => void;
}

export const RecomputeDialog: React.FC<RecomputeDialogProps> = ({
  isOpen,
  onClose,
  onRecompute,
}) => {
  const [useRange, setUseRange] = useState(false);
  const { selectedMonth, selectedYear } = useDateSelectorStore();
  const { dateRange } = useDateRangeStore();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDateRangeText = () => {
    if (dateRange?.startDate && dateRange?.endDate) {
      return `${dateRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${dateRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (dateRange?.startDate) {
      return dateRange.startDate.toLocaleDateString();
    }
    return "No date range selected";
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <IoWarningOutline className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <h3 className="ml-3 text-lg font-semibold text-gray-900">
                  Recompute All Compensations
                </h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Please select a date range for recomputation:
              </p>

              {/* Selection Cards */}
              <div className="grid grid-cols-1 gap-3 mb-5">
                {/* Whole Month Option */}
                <div
                  className={`relative flex cursor-pointer rounded-lg border p-4 transition-all items-center ${!useRange
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => setUseRange(false)}
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${!useRange ? "bg-blue-100" : "bg-gray-100"
                    }`}>
                    <IoCalendarOutline className={`h-5 w-5 ${!useRange ? "text-blue-600" : "text-gray-500"
                      }`} />
                  </div>
                  <div className="ml-3 flex-grow">
                    <div className="text-sm font-medium text-gray-900">Whole Month</div>
                    <div className="text-sm text-gray-500">{months[selectedMonth]} {selectedYear}</div>
                  </div>
                  <div className="ml-auto pl-3">
                    <input
                      id="whole-month"
                      type="radio"
                      name="recompute-range"
                      checked={!useRange}
                      onChange={() => setUseRange(false)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Date Range Option */}
                <div
                  className={`relative flex cursor-pointer rounded-lg border p-4 transition-all items-center ${useRange
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  onClick={() => setUseRange(true)}
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${useRange ? "bg-blue-100" : "bg-gray-100"
                    }`}>
                    <IoCalendarNumberOutline className={`h-5 w-5 ${useRange ? "text-blue-600" : "text-gray-500"
                      }`} />
                  </div>
                  <div className="ml-3 flex-grow">
                    <div className="text-sm font-medium text-gray-900">Date Range</div>
                    <div className="text-sm text-gray-500">{getDateRangeText()}</div>
                  </div>
                  <div className="ml-auto pl-3">
                    <input
                      id="date-range"
                      type="radio"
                      name="recompute-range"
                      checked={useRange}
                      onChange={() => setUseRange(true)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Warning and Changes */}
              <div className="rounded-lg bg-gray-50 p-4 text-sm mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  This action will make the following changes:
                </p>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <span>Reset any manual changes made to compensations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <span>Recalculate all overtime, holiday, and other pay adjustments</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <span>Update all compensations based on current time in and time out</span>
                  </li>
                </ul>
              </div>
              <p className="text-sm font-medium text-red-600">
                This action cannot be undone.
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-500"
                onClick={() => {
                  onClose();
                  onRecompute(useRange);
                }}
              >
                Recompute
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
