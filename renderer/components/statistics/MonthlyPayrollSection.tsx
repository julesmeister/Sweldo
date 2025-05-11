import React from 'react';
import { IoRefreshOutline, IoWalletOutline, IoCalendarOutline } from 'react-icons/io5';
import { StatCard } from './StatCard'; // Assuming StatCard is in the same directory or path is adjusted
import type { Statistics } from '../../model/statistics'; // Adjust path as necessary

interface MonthlyPayrollSectionProps {
    monthlyPayrolls: Statistics['monthlyPayrolls'] | undefined;
    onOpenRefreshDialog: (month: string) => void;
}

export const MonthlyPayrollSection: React.FC<MonthlyPayrollSectionProps> = ({
    monthlyPayrolls,
    onOpenRefreshDialog,
}) => {
    const yearlyTotal = monthlyPayrolls?.reduce((sum, item) => sum + item.amount, 0) || 0;
    const monthlyAverage = yearlyTotal / (monthlyPayrolls?.length || 1);

    return (
        <div>
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 w-1 h-6 rounded-full mr-3"></span>
                Monthly Payroll Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <StatCard
                    title="Yearly Total"
                    value={new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                    }).format(yearlyTotal)}
                    icon={<IoWalletOutline className="w-6 h-6" />}
                />
                <StatCard
                    title="Monthly Average"
                    value={new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                    }).format(monthlyAverage)}
                    icon={<IoCalendarOutline className="w-6 h-6" />}
                />
            </div>
            <div className="mt-6">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">
                            Monthly Payroll Details
                        </h3>
                    </div>
                    <div className="overflow-x-auto relative">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Days</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absences</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {!monthlyPayrolls || monthlyPayrolls.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                                            No payroll data available for this year
                                        </td>
                                    </tr>
                                ) : (
                                    monthlyPayrolls.map((item, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.month}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                                                ₱{item.amount.toLocaleString()}
                                                <button
                                                    onClick={() => onOpenRefreshDialog(item.month)}
                                                    className="ml-2 text-gray-400 hover:text-blue-500 transition-colors"
                                                    title={`Refresh data for ${item.month}`}
                                                >
                                                    <IoRefreshOutline className="w-4 h-4" />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.days}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employees}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.absences}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}; 