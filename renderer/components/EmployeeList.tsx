"use client";

import React, { useEffect, useState } from "react";
import { useEmployeeStore } from "@/renderer/stores/employeeStore";
import { Employee, createEmployeeModel } from "@/renderer/model/employee";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { MagicCard } from "./magicui/magic-card";

const EmployeeList: React.FC<{ height?: string }> = ({ height }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { dbPath } = useSettingsStore();
  const employeeModel = createEmployeeModel(dbPath);
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!dbPath) {
        console.warn("Database path not set");
        return;
      }

      try {
        const loadedEmployees = await employeeModel.loadActiveEmployees();
        console.log(
          "[EmployeeList] Loaded employees:",
          loadedEmployees.map((emp) => ({
            id: emp.id,
            lastPaymentPeriod: emp.lastPaymentPeriod,
            rawLastPaymentPeriod: JSON.stringify(emp.lastPaymentPeriod),
          }))
        );
        setEmployees(loadedEmployees);
      } catch (error) {
        console.error("Error loading employees:", error);
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, [dbPath]); // Only re-run when dbPath changes

  useEffect(() => {
    if (!dbPath) {
      setEmployees([]);
    }
  }, [dbPath]); // Reset employees when dbPath changes

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
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Employee List</h2>
          <p className="text-sm font-medium text-gray-500">
            Active Employees Count:{" "}
            <span className="font-bold">{employees.length}</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <div
            className={`${
              selectedEmployeeId && !height
                ? "group-hover:h-auto"
                : height
                ? `h-[${height}]`
                : `h-[350px] ${
                    employees.length > 0
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
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="space-y-4">
                        {dbPath ? (
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
                              Please set up your database path in the Settings
                              tab
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => (
                    <tr
                      key={employee.id}
                      onClick={() => handleRowClick(employee.id)}
                      className={`cursor-pointer transition-colors duration-150 hover:bg-gray-50 ${
                        selectedEmployeeId === employee.id ? "bg-indigo-50" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {employee.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
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
                        {(() => {
                          try {
                            const paymentPeriod =
                              typeof employee.lastPaymentPeriod === "string" &&
                              employee.lastPaymentPeriod
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MagicCard>
  );
};

export default EmployeeList;
