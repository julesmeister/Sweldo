// Utility functions for payroll calculations, including formula evaluation.

import { CalculationSettings } from "../stores/settingsStore";

interface PayrollVariables {
  basicPay: number;
  overtime: number;
  holidayBonus: number;
  undertimeDeduction: number;
  lateDeduction: number;
  nightDifferentialPay: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  shorts: number;
  loanDeductions: number;
  others: number;
  // Add other potential variables used in formulas
}

interface CalculatedPays {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

/**
 * Evaluates payroll formulas based on provided variables and settings.
 * Includes fallback logic if formulas are invalid or not present.
 * WARNING: Uses Function constructor which can have security implications if formulas are user-generated without sanitization.
 * @param variables - Object containing values for formula variables.
 * @param calculationSettings - Settings object containing formula strings.
 * @returns Calculated gross pay, total deductions, and net pay.
 */
export function evaluatePayrollFormulas(
  variables: PayrollVariables,
  calculationSettings: CalculationSettings | null
): CalculatedPays {
  let grossPay = variables.basicPay; // Default/fallback
  let totalDeduction = 0; // Default/fallback
  let netPay = 0; // Default/fallback

  // Fallback gross pay calculation (adjust as needed for your exact base logic)
  const fallbackGrossPay =
    variables.basicPay +
    variables.overtime +
    variables.holidayBonus +
    variables.nightDifferentialPay -
    variables.undertimeDeduction -
    variables.lateDeduction;

  // Fallback total deductions calculation (adjust as needed)
  const fallbackTotalDeductions =
    variables.sss +
    variables.philHealth +
    variables.pagIbig +
    variables.cashAdvanceDeductions +
    variables.shorts +
    variables.loanDeductions +
    variables.others; // Consider if late/undertime should be here too

  try {
    // Evaluate Gross Pay Formula
    if (calculationSettings?.grossPay?.formula) {
      // eslint-disable-next-line no-new-func
      const grossPayFn = new Function(
        ...Object.keys(variables),
        `return ${calculationSettings.grossPay.formula}`
      );
      grossPay = grossPayFn(...Object.values(variables));
    } else {
      grossPay = fallbackGrossPay;
    }

    // Evaluate Total Deductions Formula
    if (calculationSettings?.totalDeductions?.formula) {
      // Create a specific set of variables available for deduction formula
      const deductionVariables = {
        sss: variables.sss,
        philHealth: variables.philHealth,
        pagIbig: variables.pagIbig,
        cashAdvanceDeductions: variables.cashAdvanceDeductions,
        shorts: variables.shorts,
        loanDeductions: variables.loanDeductions,
        others: variables.others,
        lateDeduction: variables.lateDeduction, // Make available if needed
        undertimeDeduction: variables.undertimeDeduction, // Make available if needed
        // Add other variables if necessary for deduction formulas
      };
      // eslint-disable-next-line no-new-func
      const totalDeductionsFn = new Function(
        ...Object.keys(deductionVariables),
        `return ${calculationSettings.totalDeductions.formula}`
      );
      totalDeduction = totalDeductionsFn(...Object.values(deductionVariables));
    } else {
      totalDeduction = fallbackTotalDeductions;
    }

    // Evaluate Net Pay Formula
    if (calculationSettings?.netPay?.formula) {
      // Make calculated grossPay and totalDeductions available
      const netPayVariables = {
        ...variables,
        grossPay,
        totalDeductions: totalDeduction,
      };
      // eslint-disable-next-line no-new-func
      const netPayFn = new Function(
        ...Object.keys(netPayVariables),
        `return ${calculationSettings.netPay.formula}`
      );
      netPay = netPayFn(...Object.values(netPayVariables));
    } else {
      // Fallback net pay calculation
      netPay = grossPay - totalDeduction;
    }
  } catch (error) {
    console.error("Error evaluating payroll formula:", error);
    // Fallback to basic calculations on any error
    grossPay = fallbackGrossPay;
    totalDeduction = fallbackTotalDeductions;
    netPay = grossPay - totalDeduction;
  }

  return {
    grossPay: Number(grossPay) || 0,
    totalDeductions: Number(totalDeduction) || 0,
    netPay: Number(netPay) || 0,
  };
}
