# Loan Deductions Flow Documentation

This document outlines the critical flow of loan deduction data between components in the payroll system. This is an area that has been prone to breakage during refactoring.

## Key Components and Their Responsibilities

### 1. DeductionsDialog.tsx
- **Purpose**: Allows user to select loans and specify deduction amounts
- **Key Data Structure**: Creates `loanDeductionIds` array containing detailed deduction records:
  ```typescript
  loanDeductionIds: [
    {
      loanId: string,      // The ID of the loan being deducted
      deductionId: string, // A unique UUID for this specific deduction
      amount: number       // The amount being deducted
    }
  ]
  ```
- **Output Format**: When calling `onConfirm()`, passes an object with:
  ```typescript
  {
    sss: number,
    philHealth: number,
    pagIbig: number,
    cashAdvanceDeductions: number,
    shortDeductions: number,
    loanDeductions: number,         // Total sum of all loan deductions
    enableSss: boolean,
    enablePhilHealth: boolean,
    enablePagIbig: boolean,
    shortIDs: string[],
    cashAdvanceIDs: string[],
    loanDeductionIds: Array<{loanId, deductionId, amount}>  // Detailed records
  }
  ```

### 2. payroll.tsx (PayrollPage)
- **Purpose**: Handles dialog output and calls payroll generation
- **Critical Implementation**: Must pass both `loanDeductions` (total) AND `loanDeductionIds` (details) to `generatePayrollSummary`
- **Common Bug**: Forgetting to pass `loanDeductionIds` to the payroll generation function

### 3. payroll.ts (generatePayrollSummary)
- **Purpose**: Generate payroll summary with all deductions
- **Data Structure Transformation**:
  - Receives `loanDeductionIds` array and `loanDeductions` total
  - **IMPORTANT**: Stores `loanDeductionIds` at the root level of `PayrollSummaryModel`, not in the `deductions` object
  - The `loanDeductions` value is stored in `deductions.loanDeductions`

```typescript
// PayrollSummaryModel structure
{
  // ...payroll data
  deductions: {
    sss: number,
    philHealth: number,
    pagIbig: number,
    cashAdvanceDeductions: number,
    shortDeductions: number,
    loanDeductions: number,  // Total loan deduction amount
    others: number
  },
  loanDeductionIds: [        // Stored at root level, not in deductions
    {
      loanId: string,
      deductionId: string,
      amount: number
    }
  ]
}
```

### 4. PayrollSummary.tsx
- **Purpose**: Displays payroll summary including all deductions
- **Critical Implementation**: Must calculate loan deduction total from `loanDeductionIds` array, not from `deductions.loanDeductions`
- **Solution Pattern**:
```typescript
// Extract loan deduction total from loanDeductionIds
const loanDeduction = Array.isArray(data.loanDeductionIds) 
  ? data.loanDeductionIds.reduce((total, loan) => total + (loan.amount || 0), 0)
  : 0;

// Use this calculated amount in the UI and calculations, NOT data.deductions.loanDeductions
```

## Common Issues and Solutions

### Issue 1: Loan deductions not appearing in PayrollSummary
- **Cause**: `PayrollSummary.tsx` looks for `data.deductions.loanDeductions` but should calculate from `data.loanDeductionIds`
- **Solution**: Add calculation for total loan deduction from `loanDeductionIds` as shown above

### Issue 2: Loan deductions not being passed to payroll generation
- **Cause**: Missing parameters in the `generatePayrollSummary` call in payroll page
- **Solution**: Ensure both `loanDeductions` and `loanDeductionIds` are included in the call:
```typescript
const summary = await payroll.generatePayrollSummary(
  selectedEmployeeId!,
  startDate,
  endDate,
  {
    sss: deductions.sss,
    philHealth: deductions.philHealth,
    pagIbig: deductions.pagIbig,
    cashAdvanceDeductions: deductions.cashAdvanceDeductions,
    shortDeductions: deductions.shortDeductions,
    loanDeductions: deductions.loanDeductions,     // Don't forget this
    loanDeductionIds: deductions.loanDeductionIds, // Don't forget this
  }
);
```

### Issue 3: Loan balance not updating after payroll
- **Cause**: `loanDeductionIds` not being included or processed in `generatePayrollSummary`
- **Solution**: Verify loan deduction processing logic in `generatePayrollSummary` that uses the `loanDeductionIds` array

## Testing Loan Deductions

When testing loan deductions, check:
1. Selecting loans in DeductionsDialog adds them to `selectedLoans` set
2. Setting loan amounts in DeductionsDialog updates `loanDeductionAmounts` object
3. On submit, `loanDeductionIds` array contains entries for each selected loan
4. In `PayrollSummary`, loan deductions appear in the UI with correct amount
5. Total deductions includes the loan deduction amount
6. Net pay correctly reflects loan deduction amount

## Debugging Tips

Add these logging statements to troubleshoot loan deduction issues:

1. In DeductionsDialog.tsx (submission):
```typescript
console.log("[DeductionsDialog] Complete loanDeductionIds data:", JSON.stringify(loanDeductionIds, null, 2));
```

2. In payroll.tsx (when calling generatePayrollSummary):
```typescript
console.log("[PayrollPage] Passing deductions to generatePayrollSummary:", JSON.stringify(deductions, null, 2));
```

3. In PayrollSummary.tsx (calculating total):
```typescript
console.log("[PayrollSummary] Loan deduction calculation:", {
  hasLoanDeductionIds: Array.isArray(data.loanDeductionIds),
  loanDeductionIdsLength: Array.isArray(data.loanDeductionIds) ? data.loanDeductionIds.length : 0,
  calculatedTotal: loanDeduction
});
``` 