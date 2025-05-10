import React, { useState, useEffect, ChangeEvent } from "react";
// IoClose is imported but BaseFormDialog will handle its own close icon.
// import { IoClose } from "react-icons/io5"; 
import { Loan } from "@/renderer/model/loan";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import BaseFormDialog from "./dialogs/BaseFormDialog"; // Import BaseFormDialog
import FormField from "./forms/FormField"; // Import FormField

interface LoanFormProps {
  onClose: () => void;
  onSave: (data: Loan) => void;
  initialData?: Loan | null;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
    caretLeft?: number;
  };
  isWebMode?: boolean; // This prop seems informational, BaseFormDialog doesn't use it directly
  companyName?: string | null; // This prop seems informational
}

const LoanForm: React.FC<LoanFormProps> = ({
  onClose,
  onSave,
  initialData,
  position,
  isWebMode = false,
  // companyName prop is not used in LoanForm logic directly
}) => {
  const [formDataState, setFormDataState] = useState({
    amount: initialData?.amount?.toString() || "",
    type: initialData?.type || "Personal",
    interestRate: initialData?.interestRate?.toString() || "12",
    term: initialData?.term?.toString() || "12",
    reason: initialData?.reason || "",
  });
  const [monthlyPayment, setMonthlyPayment] = useState<number>(0);
  const { selectedEmployeeId } = useEmployeeStore();

  useEffect(() => {
    // Calculate monthly payment when amount, interest rate, or term changes
    const principal = parseFloat(formDataState.amount) || 0;
    const rate = (parseFloat(formDataState.interestRate) || 0) / 100 / 12; // Monthly interest rate
    const numberOfPayments = parseInt(formDataState.term) || 1;

    if (principal > 0 && rate > 0 && numberOfPayments > 0) {
      const payment =
        (principal * rate * Math.pow(1 + rate, numberOfPayments)) /
        (Math.pow(1 + rate, numberOfPayments) - 1);
      setMonthlyPayment(Math.round(payment * 100) / 100);
    } else {
      setMonthlyPayment(0);
    }
  }, [formDataState.amount, formDataState.interestRate, formDataState.term]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormDataState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const today = new Date();
    const nextMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    );

    if (!selectedEmployeeId) {
      console.error("No employee selected");
      return;
    }

    const processedFormData: Loan = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: selectedEmployeeId,
      date: today,
      amount: parseFloat(formDataState.amount),
      type: formDataState.type as "Personal" | "Housing" | "Emergency" | "Other",
      status: initialData?.status || "Pending",
      interestRate: parseFloat(formDataState.interestRate),
      term: parseInt(formDataState.term),
      monthlyPayment,
      remainingBalance: parseFloat(formDataState.amount),
      nextPaymentDate: nextMonth,
      reason: formDataState.reason,
    };
    onSave(processedFormData);
    // BaseFormDialog handles calling onClose via its own cancel button if configured,
    // or parent calls onClose when onSave completes. Here, it implies success.
    // onClose(); // Typically called after onSave promise resolves in parent
  };

  const dialogTitle = initialData ? "Edit Loan Application" : "Apply for Loan";
  const submitButtonText = (initialData ? "Update" : "Submit") + " Loan";

  const loanTypeOptions = [
    { value: "Personal", label: "Personal Loan" },
    { value: "Housing", label: "Housing Loan" },
    { value: "Emergency", label: "Emergency Loan" },
    { value: "Other", label: "Other" },
  ];

  return (
    <BaseFormDialog
      title={dialogTitle}
      isOpen={true} // Assuming LoanForm is only rendered when it should be open
      onClose={onClose}
      onSubmit={handleSubmit} // The form inside children will also call this
      position={position}
      submitText={submitButtonText}
      // cancelText="Cancel" // BaseFormDialog has default "Cancel"
      dialogWidth="500px" // As per old style
      dialogMaxHeight="calc(100vh - 200px)" // As per old style
    >
      {/* Form Content will be the child of BaseFormDialog */}
      <form onSubmit={handleSubmit} className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Loan Amount"
            name="amount"
            type="number"
            value={formDataState.amount}
            onChange={handleInputChange}
            prefix="₱"
            inputClassName="pl-8"
            inputProps={{ min: "0", step: "0.01" }}
          />
          <FormField
            label="Loan Type"
            name="type"
            type="select"
            value={formDataState.type}
            onChange={handleInputChange}
            options={loanTypeOptions}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Interest Rate (% per year)"
            name="interestRate"
            type="number"
            value={formDataState.interestRate}
            onChange={handleInputChange}
            suffix="%"
            inputClassName="pr-8"
            inputProps={{ min: "0", step: "0.1" }}
          />
          <FormField
            label="Term (months)"
            name="term"
            type="number"
            value={formDataState.term}
            onChange={handleInputChange}
            inputProps={{ min: "1" }}
          />
        </div>

        {/* Monthly Payment Display */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4">
          <div className="text-sm text-gray-300">
            Estimated Monthly Payment
          </div>
          <div className="text-xl font-semibold text-gray-100 mt-1">
            ₱{monthlyPayment.toLocaleString()}
          </div>
        </div>

        <FormField
          label="Reason for Loan"
          name="reason"
          type="textarea"
          value={formDataState.reason}
          onChange={handleInputChange}
          rows={3}
        />
      </form>
    </BaseFormDialog>
  );
};

export default LoanForm;
