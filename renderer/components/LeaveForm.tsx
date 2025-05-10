import React, { useState, ChangeEvent } from "react";
import { IoClose } from "react-icons/io5";
import { Leave } from "@/renderer/model/leave";
import BaseFormDialog from "./dialogs/BaseFormDialog";
import FormField from "./forms/FormField";
import OptionSelector from "./forms/OptionSelector";
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

  // Get selected month and year from the DateSelector store
  const storeSelectedMonth = useDateSelectorStore((state) => state.selectedMonth);
  const storeSelectedYear = useDateSelectorStore((state) => state.selectedYear);

  const [formState, setFormState] = useState({
    type: initialData?.type || "Vacation",
    reason: initialData?.reason || "",
    status: initialData?.status || "Pending",
    startDate:
      initialData?.startDate
        ? (() => {
          const d = new Date(initialData.startDate);
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const day = d.getDate();
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        })()
        : (() => {
          const year = storeSelectedYear;
          const month = storeSelectedMonth + 1;
          const day = 1;
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        })(),
    endDate:
      initialData?.endDate
        ? (() => {
          const d = new Date(initialData.endDate);
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const day = d.getDate();
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        })()
        : (() => {
          const year = storeSelectedYear;
          const month = storeSelectedMonth + 1;
          // For endDate, get the last day of the storeSelectedMonth
          const lastDay = new Date(storeSelectedYear, storeSelectedMonth + 1, 0).getDate();
          return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        })(),
  });

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]:
        name === "reason"
          ? value.charAt(0).toUpperCase() + value.slice(1) // Capitalize reason
          : value,
    }));
  };

  const handleStatusChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      status: value as "Pending" | "Approved" | "Rejected",
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const formDataToSave: Leave = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || "",
      startDate: new Date(formState.startDate),
      endDate: new Date(formState.endDate),
      type: formState.type as "Sick" | "Vacation" | "Emergency" | "Other",
      status: formState.status as "Pending" | "Approved" | "Rejected",
      reason: formState.reason,
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

  // Adjust position for LeaveForm specific layout
  const adjustedPosition = position ? {
    ...position,
    left: position.left - 100, // Apply the original offset
    // Caret position in BaseFormDialog is relative to its own body,
    // so if the main dialog is shifted left by 100, the caretLeft 
    // from the original event might still be okay, or might need adjustment 
    // if it was meant to be centered on the original button BEFORE the shift.
    // The original caret style was `left: position.caretLeft! + 100`. 
    // This implies the caretLeft from the event was 100px to the left of where the caret should be.
    // Let's assume position.caretLeft is already correct for the *button* center.
    // BaseFormDialog will place the caret relative to its new `left` position.
    // If the original position.caretLeft was, for example, half the button width,
    // and BaseFormDialog centers its caret based on its own width or a passed caretLeft,
    // we might need to ensure caretLeft passed to BaseFormDialog is also adjusted or set appropriately.
    // For now, let's just adjust the main dialog `left` and see. 
    // The caret in BaseFormDialog is positioned via `style={{ left: currentPosition.caretLeft }}`.
    // The original was `left: position.caretLeft! + 100`. 
    // If position.caretLeft was the center of the button (e.g. 50px from button's left edge)
    // and the button itself is not moving, then to make the caret appear at the same screen spot
    // relative to the button, but now relative to a dialog shifted left by 100px, 
    // caretLeft for BaseFormDialog needs to be position.caretLeft + 100.
    caretLeft: position.caretLeft !== undefined ? position.caretLeft + 100 : undefined
  } : undefined;

  return (
    <BaseFormDialog
      title={dialogTitle}
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      position={adjustedPosition} // Use the adjusted position
      submitText={submitButtonText}
      dialogWidth="550px"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            label="Start Date"
            name="startDate"
            type="date"
            value={formState.startDate}
            onChange={handleInputChange}
          />
          <FormField
            label="End Date"
            name="endDate"
            type="date"
            value={formState.endDate}
            onChange={handleInputChange}
            inputProps={{ min: formState.startDate }} // Ensure end date is not before start date
          />
          <FormField
            label="Leave Type"
            name="type"
            type="select"
            value={formState.type}
            onChange={handleInputChange}
            options={leaveTypeOptions}
          />
        </div>

        <OptionSelector
          label="Leave Status"
          name="status" // Optional, as selection is handled by value/onChange
          options={leaveStatusOptions}
          selectedValue={formState.status}
          onChange={handleStatusChange}
          columns={3}
        // className="bg-gray-800 rounded-lg p-4 border border-gray-700" // Add this if boxing is desired
        />

        <FormField
          label="Reason"
          name="reason"
          type="textarea"
          value={formState.reason}
          onChange={handleInputChange}
          rows={1} // Original form used 1 row, can be adjusted
        />
      </form>
    </BaseFormDialog>
  );
};

export default LeaveForm;
