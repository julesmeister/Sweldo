import React from "react";
import { PayrollSummaryModel as PayrollSummaryType } from "@/renderer/model/payroll";

interface PayrollSummaryProps {
  data: PayrollSummaryType;
  onClose?: () => void;
  canEdit?: boolean;
}

interface DiscrepancyCalculation {
  type: "Gross Pay" | "Net Pay" | "Basic Pay";
  expected: number;
  actual: number;
  difference: number;
  calculation: {
    basicPay?: number;
    overtime?: number;
    holidayBonus?: number;
    nightDifferential?: number;
    leavePay?: number;
    grossPay?: number;
    dailyRate?: number;
    daysWorked?: number;
    deductions?: {
      sss: number;
      philHealth: number;
      pagIbig: number;
      cashAdvance: number;
      shortDeductions: number;
      loanDeductions?: number;
      others: number;
    };
  };
}

export const PayrollSummary: React.FC<PayrollSummaryProps> = ({
  data,
  onClose,
  canEdit = false,
}) => {
  if (!data) {
    return null;
  }

  // IMPORTANT: Calculate total loan deduction from loanDeductionIds
  const loanDeduction = Array.isArray(data.loanDeductionIds)
    ? data.loanDeductionIds.reduce((total, loan) => total + (loan.amount || 0), 0)
    : 0;



  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getDiscrepancyDetails = (data: PayrollSummaryType) => {
    const discrepancies = [];

    // Check Gross Pay
    const expectedGrossPay =
      data.basicPay +
      data.overtime +
      (data.holidayBonus || 0) +
      (data.nightDifferentialPay || 0) +
      (data.leavePay || 0);
    if (Math.abs(data.grossPay - expectedGrossPay) >= 0.01) {
      discrepancies.push({
        type: "Gross Pay",
        expected: expectedGrossPay,
        actual: data.grossPay,
        difference: data.grossPay - expectedGrossPay,
        calculation: {
          basicPay: data.basicPay,
          overtime: data.overtime,
          holidayBonus: data.holidayBonus || 0,
          nightDifferential: data.nightDifferentialPay || 0,
          leavePay: data.leavePay || 0,
        },
      });
    }

    // Check Net Pay - FIXED calculation
    const totalDeductions =
      data.deductions.sss +
      data.deductions.philHealth +
      data.deductions.pagIbig +
      data.deductions.cashAdvanceDeductions +
      (data.deductions.shortDeductions || 0) +
      loanDeduction +
      data.deductions.others;



    const expectedNetPay = data.grossPay - totalDeductions;
    if (Math.abs(data.netPay - expectedNetPay) >= 0.01) {
      discrepancies.push({
        type: "Net Pay",
        expected: expectedNetPay,
        actual: data.netPay,
        difference: data.netPay - expectedNetPay,
        calculation: {
          grossPay: data.grossPay,
          deductions: {
            sss: data.deductions.sss,
            philHealth: data.deductions.philHealth,
            pagIbig: data.deductions.pagIbig,
            cashAdvance: data.deductions.cashAdvanceDeductions,
            shortDeductions: data.deductions.shortDeductions || 0,
            loanDeductions: loanDeduction,
            others: data.deductions.others,
          },
        },
      });
    }

    // Check Basic Pay
    const expectedBasicPay = data.dailyRate * data.daysWorked;
    if (Math.abs(data.basicPay - expectedBasicPay) >= 0.01) {
      discrepancies.push({
        type: "Basic Pay",
        expected: expectedBasicPay,
        actual: data.basicPay,
        difference: data.basicPay - expectedBasicPay,
        calculation: {
          dailyRate: data.dailyRate,
          daysWorked: data.daysWorked,
        },
      });
    }

    return discrepancies;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg">
      <div className="bg-blue-600 rounded-t-xl p-5">
        <h2 className="text-2xl font-bold text-white flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-50 p-2 rounded-lg mr-3">
              <svg
                className="w-7 h-7 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            Payroll Summary
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to List
          </button>
        </h2>
      </div>

      <div className="p-6 bg-slate-50">
        <div className="grid grid-cols-2 gap-6 grid-flow-dense">
          <div className="col-span-1 row-span-1">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm h-full">
              <h3 className="text-xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100 flex items-center">
                <div className="bg-blue-50 p-2 rounded-lg mr-3">
                  <svg
                    className="w-6 h-6 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-5">
                <div className="flex flex-col bg-slate-50/50 rounded-lg px-4 py-3">
                  <span className="text-xs uppercase tracking-wider font-medium text-slate-500 mb-1">
                    Employee
                  </span>
                  <span className="text-xl font-semibold text-slate-800">
                    {data.employeeName}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50/50 rounded-lg px-4 py-3">
                  <span className="text-xs uppercase tracking-wider font-medium text-slate-500 mb-1">
                    Daily Rate
                  </span>
                  <span className="text-xl font-semibold text-slate-800">
                    ₱{formatCurrency(data.dailyRate)}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50/50 rounded-lg px-4 py-3">
                  <span className="text-xs uppercase tracking-wider font-medium text-slate-500 mb-1">
                    Days Worked
                  </span>
                  <span className="text-xl font-semibold text-slate-800">
                    {data.daysWorked}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50/50 rounded-lg px-4 py-3">
                  <span className="text-xs uppercase tracking-wider font-medium text-slate-500 mb-1">
                    Absences
                  </span>
                  <span className="text-xl font-semibold text-slate-800">
                    {Math.abs(data.absences)}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50/50 rounded-lg px-4 py-3 col-span-2">
                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-sm font-medium text-slate-500">
                      Pay Period
                    </span>
                    <div className="flex items-center space-x-3">
                      <span className="text-xl font-semibold text-slate-800">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                        }).format(new Date(data.startDate))}
                      </span>
                      <span className="text-xl font-medium text-slate-400">
                        to
                      </span>
                      <span className="text-xl font-semibold text-slate-800">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(data.endDate))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 row-span-3">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm h-full">
              <h3 className="text-xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100 flex items-center">
                <div className="bg-emerald-50 p-2 rounded-lg mr-3">
                  <svg
                    className="w-6 h-6 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                Earnings & Time Details
              </h3>
              <div className="space-y-5">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-500">
                      Basic Pay
                    </span>
                    <span className="text-xl font-semibold text-slate-800">
                      ₱{formatCurrency(data.basicPay)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-500">
                      Overtime Pay
                    </span>
                    <span className="text-xl font-semibold text-emerald-600">
                      ₱{formatCurrency(data.overtime)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-1">
                    <span>Duration</span>
                    <span>{data.overtimeMinutes || 0} minutes</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-500">
                      Night Differential
                    </span>
                    <span className="text-xl font-semibold text-emerald-600">
                      ₱{formatCurrency(data.nightDifferentialPay || 0)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-1">
                    <span>Hours</span>
                    <span>{data.nightDifferentialHours || 0} hours</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-500">
                      Undertime
                    </span>
                    <span className="text-xl font-semibold text-rose-600">
                      -₱{formatCurrency(data.undertimeDeduction || 0)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-1">
                    <span>Duration</span>
                    <span>{data.undertimeMinutes || 0} minutes</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-500">
                      Late Deduction
                    </span>
                    <span className="text-xl font-semibold text-rose-600">
                      -₱{formatCurrency(data.lateDeduction || 0)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-1">
                    <span>Duration</span>
                    <span>{data.lateMinutes || 0} minutes</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-500">
                      Holiday & Leave
                    </span>
                    <div className="text-right">
                      <div className="text-xl font-semibold text-emerald-600">
                        ₱{formatCurrency(data.holidayBonus || 0)}
                      </div>
                      <div className="text-xl font-semibold text-blue-600">
                        ₱{formatCurrency(data.leavePay || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between border-t border-slate-200 pt-1">
                    <span>Type</span>
                    <div className="text-right">
                      <div>{data.dayType || "Regular"}</div>
                      <div>{data.leaveType || "None"}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl mb-4 hover:bg-slate-50 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl mr-4 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-xl font-semibold text-slate-700">
                        Gross Pay
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium text-slate-500 mb-1">
                        Total Earnings
                      </span>
                      <div className="flex items-center bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 hover:scale-[1.02] hover:shadow-sm transition-all duration-200">
                        <span className="text-2xl font-bold text-emerald-600">
                          ₱{formatCurrency(data.grossPay)}
                        </span>
                      </div>
                      <span className="text-sm text-slate-400 mt-2">
                        Daily Rate + Overtime
                      </span>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 row-span-1">
                  <div className="p-4 bg-white rounded-xl mb-4 hover:bg-slate-50 transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-xl mr-4 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </div>
                        <span className="text-xl font-semibold text-slate-700">
                          Total Net Pay
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center mb-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                          <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                            Net Amount
                          </span>
                        </div>
                        <div className="flex items-center bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 hover:scale-[1.02] hover:shadow-sm transition-all duration-200">
                          <span className="text-4xl font-bold text-blue-600">
                            ₱{formatCurrency(data.netPay)}
                          </span>
                        </div>
                        <span className="text-sm text-slate-400 mt-2">
                          Payment Date:{" "}
                          {new Date(data.paymentDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-1 row-span-1">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h3 className="p-4 bg-white rounded-xl mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-2.5 rounded-xl mr-4 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                        />
                      </svg>
                    </div>
                    <span className="text-xl font-semibold text-slate-700">
                      Deductions
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-slate-500 mb-1">
                      Total Deductions
                    </span>
                    <div className="flex items-center bg-rose-50 px-4 py-2 rounded-lg hover:bg-rose-100 hover:scale-[1.02] hover:shadow-sm transition-all duration-200">
                      <span className="text-2xl font-bold text-rose-600">
                        ₱-
                        {formatCurrency(
                          (data.deductions.sss || 0) +
                          (data.deductions.philHealth || 0) +
                          (data.deductions.pagIbig || 0) +
                          (data.deductions.cashAdvanceDeductions || 0) +
                          (data.deductions.shortDeductions || 0) +
                          loanDeduction +
                          (data.deductions.others || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center mb-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                      SSS
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-rose-600">
                    ₱-{formatCurrency(data.deductions.sss)}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center mb-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                      PhilHealth
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-rose-600">
                    ₱-{formatCurrency(data.deductions.philHealth)}
                  </span>
                </div>
                <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center mb-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                    <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                      Pag-IBIG
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-rose-600">
                    ₱-{formatCurrency(data.deductions.pagIbig)}
                  </span>
                </div>
                {data.deductions.cashAdvanceDeductions > 0 && (
                  <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center mb-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                      <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                        Cash Advance
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-rose-600">
                      ₱-{formatCurrency(data.deductions.cashAdvanceDeductions)}
                    </span>
                  </div>
                )}
                {(data.deductions.shortDeductions || 0) > 0 && (
                  <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center mb-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                      <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                        Shorts
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-rose-600">
                      ₱-{formatCurrency(data.deductions.shortDeductions || 0)}
                    </span>
                  </div>
                )}
                {/* Display loan deductions if there are any loan deduction IDs with amounts */}
                {loanDeduction > 0 && (
                  <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center mb-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                      <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                        Loan Deductions
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-rose-600">
                      ₱-{formatCurrency(loanDeduction)}
                    </span>
                  </div>
                )}
                {data.deductions.others > 0 && (
                  <div className="flex flex-col bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center mb-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                      <span className="text-xs uppercase tracking-wider font-medium text-slate-400">
                        Other Deductions
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-rose-600">
                      ₱-{formatCurrency(data.deductions.others)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-1 row-span-1">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <h3 className="p-4 bg-white rounded-xl mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2.5 rounded-xl mr-4 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-xl font-semibold text-slate-700">
                      Verification Checks
                    </span>
                  </div>
                </div>
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full ${Math.abs(
                        data.grossPay -
                        (data.basicPay +
                          data.overtime +
                          (data.holidayBonus || 0) +
                          (data.nightDifferentialPay || 0))
                      ) < 0.01
                        ? "bg-green-500"
                        : "bg-red-500"
                        } mr-2`}
                    ></div>
                    <span className="text-sm font-medium text-slate-600">
                      Gross Pay Calculation
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    Basic + Overtime + Holiday + Night Diff
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full ${Math.abs(
                        data.netPay -
                        (data.grossPay -
                          (data.deductions.sss +
                            data.deductions.philHealth +
                            data.deductions.pagIbig +
                            data.deductions.cashAdvanceDeductions +
                            (data.deductions.shortDeductions || 0) +
                            loanDeduction +
                            (data.lateDeduction || 0) +
                            (data.undertimeDeduction || 0)))
                      ) < 0.01
                        ? "bg-green-500"
                        : "bg-red-500"
                        } mr-2`}
                    ></div>
                    <span className="text-sm font-medium text-slate-600">
                      Net Pay Calculation
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    Gross - (Deductions + Late + Undertime)
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full ${Math.abs(
                        data.basicPay - data.dailyRate * data.daysWorked
                      ) < 0.01
                        ? "bg-green-500"
                        : "bg-red-500"
                        } mr-2`}
                    ></div>
                    <span className="text-sm font-medium text-slate-600">
                      Basic Pay Calculation
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    Daily Rate × Days Worked
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex flex-col space-y-3">
                    {(() => {
                      const discrepancies = getDiscrepancyDetails(data);

                      if (discrepancies.length === 0) {
                        return (
                          <div className="flex items-center">
                            <svg
                              className="w-5 h-5 text-green-500 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="text-sm font-medium text-green-700">
                              All calculations are verified and correct
                            </span>
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="flex items-center">
                            <svg
                              className="w-5 h-5 text-red-500 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            <span className="text-sm font-medium text-red-700">
                              Discrepancies found in calculations:
                            </span>
                          </div>

                          <div className="ml-7 space-y-2">
                            {discrepancies.map((discrepancy, index) => (
                              <div
                                key={index}
                                className="text-sm bg-white p-3 rounded border border-red-100"
                              >
                                <div className="font-medium text-red-800">
                                  {discrepancy.type} Discrepancy:
                                </div>
                                <div className="mt-1 space-y-1 text-red-600">
                                  <div className="bg-red-50 p-2 rounded">
                                    <div className="font-medium mb-1">
                                      Expected Calculation:
                                    </div>
                                    {discrepancy.type === "Gross Pay" && (
                                      <div className="space-y-1 text-sm">
                                        <div>
                                          Basic Pay: ₱
                                          {discrepancy.calculation.basicPay?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          + Overtime: ₱
                                          {discrepancy.calculation.overtime?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          + Holiday Bonus: ₱
                                          {discrepancy.calculation.holidayBonus?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          + Night Differential: ₱
                                          {discrepancy.calculation.nightDifferential?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          + Leave Pay: ₱
                                          {discrepancy.calculation.leavePay?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div className="border-t border-red-200 pt-1 font-medium">
                                          = Expected Total: ₱
                                          {discrepancy.expected.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {discrepancy.type === "Net Pay" && (
                                      <div className="space-y-1 text-sm">
                                        <div>
                                          Gross Pay: ₱
                                          {discrepancy.calculation.grossPay?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          - SSS: ₱
                                          {discrepancy.calculation.deductions?.sss.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          - PhilHealth: ₱
                                          {discrepancy.calculation.deductions?.philHealth.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          - Pag-IBIG: ₱
                                          {discrepancy.calculation.deductions?.pagIbig.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          - Cash Advance: ₱
                                          {discrepancy.calculation.deductions?.cashAdvance.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          - Loan Deductions: ₱
                                          {discrepancy.calculation.deductions?.loanDeductions?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          - Other Deductions: ₱
                                          {discrepancy.calculation.deductions?.others?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div className="text-xs text-red-500 ml-4">
                                          (Includes late and undertime
                                          deductions)
                                        </div>
                                        <div className="border-t border-red-200 pt-1 font-medium">
                                          = Expected Total: ₱
                                          {discrepancy.expected.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {discrepancy.type === "Basic Pay" && (
                                      <div className="space-y-1 text-sm">
                                        <div>
                                          Daily Rate: ₱
                                          {discrepancy.calculation.dailyRate?.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          ) || "0.00"}
                                        </div>
                                        <div>
                                          × Days Worked:{" "}
                                          {discrepancy.calculation.daysWorked ||
                                            0}
                                        </div>
                                        <div className="border-t border-red-200 pt-1 font-medium">
                                          = Expected Total: ₱
                                          {discrepancy.expected.toLocaleString(
                                            "en-PH",
                                            { minimumFractionDigits: 2 }
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    Actual Amount: ₱
                                    {discrepancy.actual.toLocaleString(
                                      "en-PH",
                                      { minimumFractionDigits: 2 }
                                    )}
                                  </div>
                                  <div className="font-medium">
                                    Difference: ₱
                                    {Math.abs(
                                      discrepancy.difference
                                    ).toLocaleString("en-PH", {
                                      minimumFractionDigits: 2,
                                    })}
                                    {discrepancy.difference > 0
                                      ? " (over)"
                                      : " (under)"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
