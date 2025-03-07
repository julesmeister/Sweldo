'use client';

import React, { useEffect, useState } from 'react';
import { useEmployeeStore } from '@/renderer/stores/employeeStore';
import { Employee, createEmployeeModel } from '@/renderer/model/employee';
import { useSettingsStore } from '@/renderer/stores/settingsStore';


const EmployeeList: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { dbPath } = useSettingsStore();
  const employeeModel = createEmployeeModel(dbPath);
  const { selectedEmployeeId, setSelectedEmployeeId } = useEmployeeStore();

  useEffect(() => {
    const fetchEmployees = async () => {
      const loadedEmployees = await employeeModel.loadActiveEmployees();
      setEmployees(loadedEmployees);
    };

    fetchEmployees();
  }, [employeeModel]);

  const handleRowClick = (employeeId: string) => {
    setSelectedEmployeeId(employeeId === selectedEmployeeId ? null : employeeId);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden hover:has-[.overflow-y-auto]:h-auto group">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Employee List</h2>
        <p className="text-sm font-medium text-gray-500">
          Active Employees Count: <span className="font-bold">{employees.length}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="h-[350px] group-hover:h-auto transition-all duration-300 ease-in-out overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID#
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/3">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Most Recent Payment Period
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr
                  key={employee.id}
                  onClick={() => handleRowClick(employee.id)}
                  className={`cursor-pointer transition-colors duration-150 hover:bg-gray-50 ${
                    selectedEmployeeId === employee.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {employee.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-600">
                          {employee.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {employee.lastPaymentPeriod ? `${employee.lastPaymentPeriod.start} - ${employee.lastPaymentPeriod.end}` : 'No payments made yet'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeList;
