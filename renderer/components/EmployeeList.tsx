"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { MagicCard } from "./magicui/magic-card";
import { PaymentHistoryDialog } from "./PaymentHistoryDialog";
import { IoTimeOutline, IoReloadOutline, IoSearchOutline } from "react-icons/io5";
import { Payroll, PayrollSummaryModel } from "@/renderer/model/payroll";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import { loadActiveEmployeesFirestore } from "@/renderer/model/employee_firestore";
import { clearEmployeeCache } from "@/renderer/lib/db";
import { toast } from "sonner";
import DecryptedText from "../styles/DecryptedText/DecryptedText";

interface LastPaymentPeriod {
  start: string;
  end: string;
  totalPay: number;
  dateProcessed?: string;
}

const EmployeeList: React.FC<{ height?: string }> = ({ height }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { dbPath, companyName } = useSettingsStore();
  const employeeModel = createEmployeeModel(dbPath);
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PayrollSummaryModel[]>(
    []
  );

  const loadPaymentHistory = async (employee: Employee) => {
    if ((!dbPath && !isWebEnvironment()) || !employee.id) return;

    try {
      // Load last 6 months of payroll history
      const now = new Date();
      const payrollPromises = [];

      for (let i = 0; i < 6; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        payrollPromises.push(
          Payroll.loadPayrollSummaries(
            dbPath,
            employee.id,
            targetDate.getFullYear(),
            targetDate.getMonth() + 1
          )
        );
      }

      const results = await Promise.all(payrollPromises);
      const allPayrolls = results.flat();

      // Sort by payment date, most recent first
      const sortedPayrolls = allPayrolls.sort(
        (a, b) =>
          new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      );

      setPaymentHistory(sortedPayrolls);

      // Update employee's lastPaymentPeriod with the most recent payroll
      if (sortedPayrolls.length > 0) {
        const mostRecent = sortedPayrolls[0];
        const updatedEmployee = {
          ...employee,
          lastPaymentPeriod: {
            startDate: mostRecent.startDate.toISOString(),
            endDate: mostRecent.endDate.toISOString(),
            start: mostRecent.startDate.toISOString(),
            end: mostRecent.endDate.toISOString(),
          },
        };

        // Update in database
        await employeeModel.updateEmployeeDetails(updatedEmployee);

        // Update in state
        setEmployees((prevEmployees) =>
          prevEmployees.map((emp) =>
            emp.id === employee.id ? updatedEmployee : emp
          )
        );
      }
    } catch (error) {
      console.error("[EmployeeList] Error loading payment history:", error);
      setPaymentHistory([]);
    }
  };

  // Fetch employees with optional cache bypass
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      if (isWebEnvironment()) {
        if (!companyName) {
          console.warn("[EmployeeList] Company name not set in web mode");
          setEmployees([]);
          return;
        }
        // Loading employees in web mode
        const firestoreEmployees = await loadActiveEmployeesFirestore(companyName);
        const sortedEmployees = firestoreEmployees.sort((a, b) => {
          const idA = parseInt(a.id) || a.id;
          const idB = parseInt(b.id) || b.id;
          if (typeof idA === 'number' && typeof idB === 'number') {
            return idA - idB;
          }
          return String(a.id).localeCompare(String(b.id));
        });
        setEmployees(sortedEmployees);
      } else {
        if (!dbPath) {
          console.warn("[EmployeeList] Database path not set in desktop mode");
          setEmployees([]);
          return;
        }
        // Loading employees in desktop mode
        const loadedEmployees = await employeeModel.loadActiveEmployees();
        const sortedEmployees = loadedEmployees.sort((a, b) => {
          const idA = parseInt(a.id) || a.id;
          const idB = parseInt(b.id) || b.id;
          if (typeof idA === 'number' && typeof idB === 'number') {
            return idA - idB;
          }
          return String(a.id).localeCompare(String(b.id));
        });
        setEmployees(sortedEmployees);
      }
    } catch (error) {
      console.error("[EmployeeList] Error loading employees:", error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [dbPath, companyName]); // Re-run when dbPath or companyName changes

  useEffect(() => {
    if (!isWebEnvironment() && !dbPath) {
      setEmployees([]);
    } else if (isWebEnvironment() && !companyName) {
      setEmployees([]);
    }
  }, [dbPath, companyName]); // Reset employees when path changes

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    
    const query = searchQuery.toLowerCase().trim();
    return employees.filter(employee => 
      employee.name.toLowerCase().includes(query) ||
      employee.id.toLowerCase().includes(query) ||
      (employee.position && employee.position.toLowerCase().includes(query))
    );
  }, [employees, searchQuery]);

  const handleRowClick = (employeeId: string) => {
    setSelectedEmployeeId(
      employeeId === selectedEmployeeId ? null : employeeId
    );
  };

  return (
    <MagicCard
      className="p-0.5 rounded-lg"
      gradientSize={200}
      gradientColor="#9E7AFF"
      gradientOpacity={0.8}
      gradientFrom="#9E7AFF"
      gradientTo="#FE8BBB"
    >
      <div className="bg-white rounded-lg shadow overflow-hidden hover:has-[.overflow-y-auto]:h-auto group">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-semibold text-gray-800">
                <DecryptedText text={isWebEnvironment() && companyName ? `${companyName} Employees` : "Employee List"} animateOn="view" revealDirection='start' speed={50} sequential={true}/>
              </h2>
              {isWebEnvironment() && (
                <button
                  type="button"
                  onClick={async () => {
                    toast('Reloading employees...', { icon: '🔄' });
                    if (companyName) {
                      await clearEmployeeCache(companyName);
                    }
                    await fetchEmployees();
                    toast.success('Employees reloaded');
                  }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <IoReloadOutline className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-sm font-medium text-gray-500">
              {searchQuery ? (
                <>
                  Showing <span className="font-bold">{filteredEmployees.length}</span> of <span className="font-bold">{employees.length}</span>
                </>
              ) : (
                <>
                  Active Employees Count: <span className="font-bold">{employees.length}</span>
                </>
              )}
            </p>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <IoSearchOutline className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, ID, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white text-sm transition-colors duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div
            className={`${selectedEmployeeId && !height
              ? "group-hover:h-auto"
              : height
                ? `h-[${height}]`
                : `h-[350px] ${filteredEmployees.length > 0
                  ? "group-hover:h-auto transition-all duration-300 ease-in-out"
                  : ""
                }`
              } overflow-y-auto`}
            style={height ? { height } : undefined}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    ID#
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/3"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Most Recent Payment Period
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <p className="text-sm">Loading employees...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="space-y-4">
                        {searchQuery ? (
                          <div className="text-gray-500">
                            <p className="text-sm">No employees match your search "{searchQuery}"</p>
                            <p className="text-xs text-gray-400">
                              Try adjusting your search terms
                            </p>
                          </div>
                        ) : isWebEnvironment() ? (
                          companyName ? (
                            <div className="text-gray-500">
                              <p className="text-sm">No employees found for {companyName}</p>
                              <p className="text-xs text-gray-400">
                                Add new employees in the Employee Management tab
                              </p>
                            </div>
                          ) : (
                            <div className="text-gray-500">
                              <p className="text-sm">Company not selected</p>
                              <p className="text-xs text-gray-400">
                                Please select a company at login
                              </p>
                            </div>
                          )
                        ) : dbPath ? (
                          <div className="text-gray-500">
                            <p className="text-sm">No employees found</p>
                            <p className="text-xs text-gray-400">
                              Add new employees in the Employee Management tab
                            </p>
                          </div>
                        ) : (
                          <div className="text-gray-500">
                            <p className="text-sm">Database not configured</p>
                            <p className="text-xs text-gray-400">
                              Please set up your database path in the Settings tab
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      onClick={() => handleRowClick(employee.id)}
                      className={`cursor-pointer transition-colors duration-150 hover:bg-gray-50 ${selectedEmployeeId === employee.id ? "bg-indigo-50" : ""
                        }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {(() => {
                                const nameParts = employee.name.split(" ").filter(part => part.length > 0);
                                if (nameParts.length === 0) return "";
                                if (nameParts.length === 1) return nameParts[0][0];
                                return nameParts[0][0] + nameParts[nameParts.length - 1][0];
                              })()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {employee.position && employee.employmentType
                                ? `${employee.position} • ${employee.employmentType}`
                                : employee.position ||
                                employee.employmentType ||
                                ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <span>
                            {(() => {
                              try {
                                const paymentPeriod =
                                  typeof employee.lastPaymentPeriod ===
                                    "string" && employee.lastPaymentPeriod
                                    ? JSON.parse(employee.lastPaymentPeriod)
                                    : employee.lastPaymentPeriod;

                                return paymentPeriod?.start
                                  ? `${new Date(
                                    paymentPeriod.start
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })} - ${new Date(
                                    paymentPeriod.end
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}`
                                  : "No payments made yet";
                              } catch (error) {
                                console.error(
                                  "[EmployeeList] Error parsing payment period:",
                                  error
                                );
                                return "No payments made yet";
                              }
                            })()}
                          </span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSelectedEmployee(employee);
                              setShowPaymentHistory(true);
                              await loadPaymentHistory(employee);
                            }}
                            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          >
                            <IoTimeOutline className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedEmployee && (
        <PaymentHistoryDialog
          isOpen={showPaymentHistory}
          onClose={() => {
            setShowPaymentHistory(false);
            setSelectedEmployee(null);
            setPaymentHistory([]);
          }}
          employeeName={selectedEmployee.name}
          paymentHistory={paymentHistory.map((payroll) => ({
            start: payroll.startDate.toISOString(),
            end: payroll.endDate.toISOString(),
            totalPay: payroll.netPay,
            dateProcessed: payroll.paymentDate,
          }))}
        />
      )}
    </MagicCard>
  );
};

export default EmployeeList;
