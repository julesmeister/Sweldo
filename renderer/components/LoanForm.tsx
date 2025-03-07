import React, { useState, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { Loan } from '@/renderer/model/loan';

interface LoanFormProps {
  onClose: () => void;
  onSave: (data: Loan) => void;
  initialData?: Loan;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
    caretLeft?: number;
  };
}

const LoanForm: React.FC<LoanFormProps> = ({ onClose, onSave, initialData, position }) => {
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [type, setType] = useState<'Personal' | 'Housing' | 'Emergency' | 'Other'>(
    initialData?.type || 'Personal'
  );
  const [interestRate, setInterestRate] = useState(
    initialData?.interestRate?.toString() || '12'
  );
  const [term, setTerm] = useState(initialData?.term?.toString() || '12');
  const [reason, setReason] = useState(initialData?.reason || '');
  const [monthlyPayment, setMonthlyPayment] = useState<number>(0);

  useEffect(() => {
    // Calculate monthly payment when amount, interest rate, or term changes
    const principal = parseFloat(amount) || 0;
    const rate = (parseFloat(interestRate) || 0) / 100 / 12; // Monthly interest rate
    const numberOfPayments = parseInt(term) || 1;

    if (principal > 0 && rate > 0 && numberOfPayments > 0) {
      const payment = (principal * rate * Math.pow(1 + rate, numberOfPayments)) / 
                     (Math.pow(1 + rate, numberOfPayments) - 1);
      setMonthlyPayment(Math.round(payment * 100) / 100);
    } else {
      setMonthlyPayment(0);
    }
  }, [amount, interestRate, term]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    
    const formData: Loan = {
      id: initialData?.id || crypto.randomUUID(),
      employeeId: initialData?.employeeId || '', // This should be set by the parent component
      date: today,
      amount: parseFloat(amount),
      type,
      status: initialData?.status || 'Pending',
      interestRate: parseFloat(interestRate),
      term: parseInt(term),
      monthlyPayment,
      remainingBalance: parseFloat(amount),
      nextPaymentDate: nextMonth,
      reason
    };
    onSave(formData);
    onClose();
  };

  return (
    <div 
      className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700"
      style={{ 
        top: position?.top,
        left: position?.left,
        transform: position?.showAbove ? 'translateY(-100%)' : 'none',
        maxHeight: 'calc(100vh - 200px)',
        width: '500px'
      }}
    >
      {/* Caret - outer border */}
      <div 
        className="absolute"
        style={{
          left: position?.caretLeft,
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          ...(position?.showAbove 
            ? {
                bottom: '-8px',
                borderTop: '8px solid rgb(55, 65, 81)'
              }
            : {
                top: '-8px',
                borderBottom: '8px solid rgb(55, 65, 81)'
              })
        }}
      />
      {/* Caret - inner fill */}
      <div 
        className="absolute"
        style={{
          left: position?.caretLeft,
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          ...(position?.showAbove 
            ? {
                bottom: '-6px',
                borderTop: '7px solid rgb(17, 24, 39)'
              }
            : {
                top: '-6px',
                borderBottom: '7px solid rgb(17, 24, 39)'
              })
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-100">
          {initialData ? 'Edit Loan Application' : 'Apply for Loan'}
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
          <div className="grid grid-cols-2 gap-4">
            {/* Loan Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Loan Amount
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">₱</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full pl-8 bg-gray-800 border border-gray-700 rounded-md p-2 text-gray-100 h-10 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            {/* Loan Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Loan Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'Personal' | 'Housing' | 'Emergency' | 'Other')}
                className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
              >
                <option value="Personal" className="bg-gray-800">Personal Loan</option>
                <option value="Housing" className="bg-gray-800">Housing Loan</option>
                <option value="Emergency" className="bg-gray-800">Emergency Loan</option>
                <option value="Other" className="bg-gray-800">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Interest Rate (% per year)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="block w-full pr-8 bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                  min="0"
                  step="0.1"
                  required
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400">%</span>
              </div>
            </div>

            {/* Term */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Term (months)
              </label>
              <input
                type="number"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 h-10 px-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                min="1"
                required
              />
            </div>
          </div>

          {/* Monthly Payment Display */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4">
            <div className="text-sm text-gray-300">Estimated Monthly Payment</div>
            <div className="text-xl font-semibold text-gray-100 mt-1">
              ₱{monthlyPayment.toLocaleString()}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason for Loan
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full bg-gray-800 border border-gray-700 rounded-md text-gray-100 p-3 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
              rows={3}
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="py-4 -mx-6 -mb-4 bg-gray-800 border-t border-gray-700 rounded-b-lg">
            <div className="flex flex-row space-x-3 px-6 w-full">
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
                {initialData ? 'Update' : 'Submit'} Application
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoanForm;
