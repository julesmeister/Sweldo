"use client"; // Ensure this is at the top if not already
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { IoRefreshOutline, IoListOutline, IoWarningOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { PayrollSummaryModel } from '../../model/payroll'; // Assuming path is correct
import { Employee, createEmployeeModel } from '../../model/employee'; // Assuming path
import { loadEmployeesFirestore } from '../../model/employee_firestore'; // Assuming path
import { Payroll } from '../../model/payroll'; // For Payroll.loadPayrollSummaries
import { isWebEnvironment } from '../../lib/firestoreService'; // Assuming path
import { toast } from 'sonner';

interface RefreshMonthDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedPayrollIds: string[]) => void;
    monthName: string; // For display, e.g., "January"
    selectedYear: number;
    selectedMonth: number; // 0-indexed month
    dbPath: string | null;
    companyName: string | null;
}

export const RefreshMonthDialog: React.FC<RefreshMonthDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    monthName,
    selectedYear,
    selectedMonth,
    dbPath,
    companyName,
}) => {
    const [payrollsToDisplay, setPayrollsToDisplay] = useState<PayrollSummaryModel[]>([]);
    const [selectedPayrollMap, setSelectedPayrollMap] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [allEmployeesForMonth, setAllEmployeesForMonth] = useState<Employee[]>([]);
    const [selectAll, setSelectAll] = useState(false);

    const fetchPayrollsForMonth = useCallback(async () => {
        if (!isOpen) return;
        if (isWebEnvironment() && !companyName) {
            setError("Company name is not available. Cannot fetch payrolls.");
            return;
        }
        if (!isWebEnvironment() && !dbPath) {
            setError("Database path is not available. Cannot fetch payrolls.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setPayrollsToDisplay([]);
        setSelectedPayrollMap({});
        setAllEmployeesForMonth([]);
        setSelectAll(false);

        try {
            let fetchedEmployees: Employee[] = [];
            if (isWebEnvironment()) {
                fetchedEmployees = await loadEmployeesFirestore(companyName!);
            } else {
                const employeeModel = createEmployeeModel(dbPath!);
                fetchedEmployees = await employeeModel.loadEmployees();
            }
            setAllEmployeesForMonth(fetchedEmployees);

            if (!fetchedEmployees || fetchedEmployees.length === 0) {
                setError("No employees found to fetch payrolls for.");
                setIsLoading(false);
                return;
            }

            const payrollPromises = fetchedEmployees.map(employee =>
                Payroll.loadPayrollSummaries(
                    isWebEnvironment() ? companyName! : dbPath!,
                    employee.id,
                    selectedYear,
                    selectedMonth + 1 // loadPayrollSummaries expects 1-indexed month
                )
            );

            const results = await Promise.allSettled(payrollPromises);
            const successfullyFetchedPayrolls: PayrollSummaryModel[] = [];
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    successfullyFetchedPayrolls.push(...result.value);
                } else if (result.status === 'rejected') {
                    console.warn("Failed to load some payrolls:", result.reason);
                }
            });

            // Filter out duplicates by payroll ID if any employee has multiple entries processed somehow
            const uniquePayrolls = Array.from(new Map(successfullyFetchedPayrolls.map(p => [p.id, p])).values());

            // Sort by employee name, then by start date
            uniquePayrolls.sort((a, b) => {
                const nameA = fetchedEmployees.find(e => e.id === a.employeeId)?.name.toLowerCase() || '';
                const nameB = fetchedEmployees.find(e => e.id === b.employeeId)?.name.toLowerCase() || '';
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            });

            setPayrollsToDisplay(uniquePayrolls);
            if (uniquePayrolls.length === 0) {
                setError(`No payroll records found for ${monthName} ${selectedYear}.`);
            }

        } catch (err) {
            console.error("Error fetching payrolls for dialog:", err);
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(`Failed to fetch payrolls: ${message}`);
            toast.error(`Failed to fetch payrolls: ${message}`);
        } finally {
            setIsLoading(false);
        }
    }, [isOpen, selectedYear, selectedMonth, dbPath, companyName, monthName]);

    useEffect(() => {
        if (isOpen) {
            fetchPayrollsForMonth();
        } else {
            // Reset state when dialog is closed
            setPayrollsToDisplay([]);
            setSelectedPayrollMap({});
            setSelectAll(false);
            setIsLoading(false);
            setError(null);
        }
    }, [isOpen, fetchPayrollsForMonth]);

    // Handle individual selection
    const handleSelectionChange = (payrollId: string) => {
        setSelectedPayrollMap(prev => {
            const updated = {
                ...prev,
                [payrollId]: !prev[payrollId],
            };

            // Check if all are selected after this change
            const allSelected = payrollsToDisplay.every(p => updated[p.id]);
            setSelectAll(allSelected);

            return updated;
        });
    };

    // Handle select all
    const handleSelectAllChange = () => {
        const newSelectAll = !selectAll;
        setSelectAll(newSelectAll);

        // Update all checkboxes based on selectAll state
        const newSelectedMap: Record<string, boolean> = {};
        payrollsToDisplay.forEach(payroll => {
            newSelectedMap[payroll.id] = newSelectAll;
        });
        setSelectedPayrollMap(newSelectedMap);
    };

    const handleConfirmClick = () => {
        const selectedIds = Object.entries(selectedPayrollMap)
            .filter(([, isSelected]) => isSelected)
            .map(([id]) => id);
        onConfirm(selectedIds);
    };

    const getEmployeeName = useCallback((employeeId: string): string => {
        const employee = allEmployeesForMonth.find(e => e.id === employeeId);
        return employee ? employee.name : employeeId;
    }, [allEmployeesForMonth]);

    const numSelected = Object.values(selectedPayrollMap).filter(Boolean).length;

    const totalSelectedNetPay = useMemo(() => {
        return payrollsToDisplay
            .filter(p => selectedPayrollMap[p.id])
            .reduce((sum, p) => sum + (p.netPay || 0), 0);
    }, [payrollsToDisplay, selectedPayrollMap]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="relative w-full max-w-2xl transform overflow-hidden rounded-lg bg-white shadow-xl">
                    {/* Header */}
                    <div className="bg-white px-4 py-2 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex-shrink-0">
                                    <div className="h-6 w-6 flex items-center justify-center rounded-full bg-blue-100">
                                        <IoListOutline className="h-3.5 w-3.5 text-blue-600" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        {monthName} {selectedYear} Payrolls
                                    </h3>
                                    <p className="mt-0 text-xs text-gray-500">
                                        Select records to include in statistics.
                                    </p>
                                </div>
                            </div>

                            {!isLoading && payrollsToDisplay.length > 0 && (
                                <div className="text-xs text-gray-500">
                                    <span className="font-medium">{numSelected}</span> / {payrollsToDisplay.length} selected
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content - Loading */}
                    {isLoading && (
                        <div className="p-4 text-center">
                            <IoRefreshOutline className="h-7 w-7 text-blue-500 animate-spin mx-auto mb-1.5" />
                            <p className="text-xs text-gray-500">Loading payroll records...</p>
                        </div>
                    )}

                    {/* Content - Error */}
                    {!isLoading && error && (
                        <div className="p-3 bg-red-50 border-l-4 border-red-400">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <IoWarningOutline className="h-4 w-4 text-red-400" />
                                </div>
                                <div className="ml-2">
                                    <p className="text-xs text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content - Payroll List */}
                    {!isLoading && !error && payrollsToDisplay.length > 0 && (
                        <div className="max-h-[30vh] overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200 table-fixed">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th scope="col" className="w-8 px-2 py-1.5">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectAll}
                                                    onChange={handleSelectAllChange}
                                                />
                                            </div>
                                        </th>
                                        <th scope="col" className="px-2 py-1.5 text-left text-xs font-normal text-gray-500">
                                            Employee
                                        </th>
                                        <th scope="col" className="px-2 py-1.5 text-left text-xs font-normal text-gray-500">
                                            Period
                                        </th>
                                        <th scope="col" className="px-2 py-1.5 text-right text-xs font-normal text-gray-500">
                                            Net Pay
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {payrollsToDisplay.map((payroll) => (
                                        <tr key={payroll.id}
                                            className={`${selectedPayrollMap[payroll.id] ? 'bg-blue-50' : ''} hover:bg-gray-50 cursor-pointer`}
                                            onClick={() => handleSelectionChange(payroll.id)}>
                                            <td className="w-8 px-2 py-1.5 whitespace-nowrap">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        type="checkbox"
                                                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        checked={!!selectedPayrollMap[payroll.id]}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectionChange(payroll.id);
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-2 py-1.5 text-xs font-medium text-gray-700 truncate">
                                                {getEmployeeName(payroll.employeeId)}
                                            </td>
                                            <td className="px-2 py-1.5 text-xs text-gray-500 whitespace-nowrap">
                                                {new Date(payroll.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(payroll.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                                                ₱{payroll.netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Content - No Payrolls */}
                    {!isLoading && !error && payrollsToDisplay.length === 0 && !error && (
                        <div className="py-3 px-4 text-center">
                            <IoListOutline className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">No payroll records found for {monthName} {selectedYear}.</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-t border-gray-200">
                        <div className="text-xs text-gray-600 flex items-center">
                            {!isLoading && payrollsToDisplay.length > 0 &&
                                <span className="mr-2">{numSelected} of {payrollsToDisplay.length} selected.</span>}
                            {numSelected > 0 && (
                                <span className="font-medium text-emerald-700">
                                    Total: ₱{totalSelectedNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center gap-1"
                                onClick={handleConfirmClick}
                                disabled={isLoading || numSelected === 0}
                            >
                                <IoCheckmarkCircleOutline className="h-3.5 w-3.5" />
                                <span>Add Selected</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}; 