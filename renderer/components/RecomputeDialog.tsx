import { IoWarningOutline } from "react-icons/io5";

interface RecomputeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecompute: () => void;
}

export const RecomputeDialog: React.FC<RecomputeDialogProps> = ({
  isOpen,
  onClose,
  onRecompute,
}) => {
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
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <IoWarningOutline className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Recompute All Compensations
                  </h3>
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-gray-500">
                      This action will recompute all compensation data for this
                      month. Please review the following changes that will
                      occur:
                    </p>
                    <div className="rounded-lg bg-gray-50 p-4 text-sm">
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Reset any manual changes made to compensations
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Recalculate all overtime, holiday, and other pay
                          adjustments
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Update all compensations based on current time in and
                          time out
                        </li>
                      </ul>
                    </div>
                    <p className="text-sm font-medium text-red-600">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
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
                  onRecompute();
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
