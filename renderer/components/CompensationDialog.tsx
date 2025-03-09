import React, { useEffect, useState, useMemo } from 'react';
import { Compensation } from '@/renderer/model/compensation';
import { AttendanceSettings, EmploymentType, createAttendanceSettingsModel } from '@/renderer/model/settings';
import { Employee } from '@/renderer/model/employee';
import { EmployeeModel } from '@/renderer/model/employee';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { IoClose } from 'react-icons/io5';
import { Switch } from '@headlessui/react';
import { useEmployeeStore } from '@/renderer/stores/employeeStore';

interface CompensationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (compensation: Compensation) => Promise<void>;
  employee: Employee | null;
  compensation: Compensation;
  date: Date;
  position?: {
    top: number;
    left: number;
    showAbove?: boolean;
  } | null;
  timeIn?: string;
  timeOut?: string;
  day?: number;
}

export const CompensationDialog: React.FC<CompensationDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  employee,
  compensation,
  date,
  position,
  timeIn,
  timeOut,
  day
}) => {
  const [formData, setFormData] = useState<Compensation>(compensation);
  const { dbPath } = useSettingsStore();
  const attendanceSettingsModel = createAttendanceSettingsModel(dbPath);
  const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([]);
  const [employmentType, setEmploymentType] = useState<EmploymentType | null>(null);
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  
  useEffect(() => {
    attendanceSettingsModel.loadTimeSettings().then((timeSettings) => {
      console.log('Loaded time settings:', timeSettings);
      setEmploymentTypes(timeSettings);
      const foundType = timeSettings.find(type => type.type === employee?.employmentType);
      setEmploymentType(foundType || null); // Ensure we set null if undefined
    });
    // Load attendance settings
    attendanceSettingsModel.loadAttendanceSettings().then((settings) => {
      console.log('Loaded attendance settings:', settings);
      setAttendanceSettings(settings);
    });
  }, [compensation.employeeId]);

  useEffect(() => {
    setFormData(compensation);
  }, [compensation]);

 const computedValues = useMemo(() => {
   const dailyRate: number = parseFloat((employee?.dailyRate || 0).toString());
   
   // For non-time-tracking employees, only check presence/absence
   if (!employmentType?.requiresTimeTracking) {
     const isPresent = !!(timeIn || timeOut); // If either timeIn or timeOut exists, employee was present
     return {
       lateMinutes: 0,
       undertimeMinutes: 0,
       overtimeMinutes: 0,
       hoursWorked: isPresent ? 8 : 0, // Assume standard 8-hour day if present
       grossPay: isPresent ? dailyRate : 0,
       deductions: 0,
       netPay: isPresent ? dailyRate : 0,
       lateDeduction: 0,
       undertimeDeduction: 0,
       overtimeAddition: 0,
       manualOverride: true // Always set manual override for non-time-tracking employees
     };
   }
   
   if (!timeIn || !timeOut || !attendanceSettings) {
     return {
       lateMinutes: 0,
       undertimeMinutes: 0,
       overtimeMinutes: 0,
       hoursWorked: 0,
       grossPay: 0,
       deductions: 0,
       netPay: 0,
       lateDeduction: 0,
       undertimeDeduction: 0,
       overtimeAddition: 0,
       manualOverride: false
     };
   }
 
   const actualTimeIn = new Date(`1970-01-01T${timeIn}`);
   const actualTimeOut = new Date(`1970-01-01T${timeOut}`);
   const schedTimeIn = new Date(`1970-01-01T${employmentType.timeIn}`);
   const schedTimeOut = new Date(`1970-01-01T${employmentType.timeOut}`);
 
   // Calculate late minutes
   const lateMinutes = actualTimeIn > schedTimeIn 
     ? Math.round((actualTimeIn.getTime() - schedTimeIn.getTime()) / (1000 * 60))
     : 0;
 
   // Calculate undertime minutes
   const undertimeMinutes = actualTimeOut < schedTimeOut
     ? Math.round((schedTimeOut.getTime() - actualTimeOut.getTime()) / (1000 * 60))
     : 0;
 
   // Calculate overtime minutes
   const overtimeMinutes = actualTimeOut > schedTimeOut
     ? Math.round((actualTimeOut.getTime() - schedTimeOut.getTime()) / (1000 * 60))
     : 0;
 
   // Calculate hours worked
   const hoursWorked = Math.round((actualTimeOut.getTime() - actualTimeIn.getTime()) / (1000 * 60 * 60));
  
   // Calculate deductions based on loaded attendance settings
   const lateDeduction = lateMinutes > attendanceSettings.lateGracePeriod
     ? (lateMinutes - attendanceSettings.lateGracePeriod) * attendanceSettings.lateDeductionPerMinute
     : 0;
 
   const undertimeDeduction = undertimeMinutes > attendanceSettings.undertimeGracePeriod
     ? (undertimeMinutes - attendanceSettings.undertimeGracePeriod) * attendanceSettings.undertimeDeductionPerMinute
     : 0;
 
   const overtimeAddition = overtimeMinutes > attendanceSettings.overtimeGracePeriod
     ? (overtimeMinutes - attendanceSettings.overtimeGracePeriod) * attendanceSettings.overtimeAdditionPerMinute
     : 0;
 
   const deductions = lateDeduction + undertimeDeduction;
   const grossPay = dailyRate + overtimeAddition;
   const netPay = grossPay - deductions;
 
   return {
     lateMinutes,
     undertimeMinutes,
     overtimeMinutes,
     lateDeduction,
     undertimeDeduction,
     overtimeAddition,
     hoursWorked,
     grossPay,
     deductions,
     netPay,
     manualOverride: false
   };
 }, [employmentType, timeIn, timeOut, attendanceSettings, employee]);

  useEffect(() => {
    // Update formData whenever computedValues change
    setFormData(prev => ({
      ...prev,
      lateMinutes: computedValues.lateMinutes,
      undertimeMinutes: computedValues.undertimeMinutes,
      overtimeMinutes: computedValues.overtimeMinutes,
      hoursWorked: computedValues.hoursWorked,
      grossPay: computedValues.grossPay,
      deductions: computedValues.deductions,
      netPay: computedValues.netPay,
      overtimeAddition: computedValues.overtimeAddition,
      undertimeDeduction: computedValues.undertimeDeduction,
      lateDeduction: computedValues.lateDeduction,
    }));
  }, [computedValues]);

  const hoursWorked = useMemo(() => {
    if (timeIn && timeOut) {
      const start = new Date(`1970-01-01T${timeIn}`);
      const end = new Date(`1970-01-01T${timeOut}`);
      const diffInMs = end.getTime() - start.getTime();
      return diffInMs > 0 ? Math.round(diffInMs / (1000 * 60 * 60)) : 0;
    }
    return 0;
  }, [timeIn, timeOut]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, hoursWorked }));
  }, [hoursWorked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Pay') || name.includes('Deduction') || name.includes('Hours') || name.includes('Minutes')
        ? parseFloat(value) || 0
        : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="absolute bg-gray-900 rounded-lg shadow-xl border border-gray-700 w-full max-w-7xl overflow-visible"
        style={{
          top: position?.top,
          left: position?.left,
          transform: position?.showAbove ? 'translateY(-100%)' : 'none',
          maxHeight: 'calc(100vh - 100px)',
        }}
      >
        {/* Caret */}
        <div 
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            ...(position?.showAbove 
              ? {
                  bottom: '-8px',
                  borderTop: '8px solid rgb(55, 65, 81)' // matches border-gray-700
                }
              : {
                  top: '-8px',
                  borderBottom: '8px solid rgb(55, 65, 81)', // matches border-gray-700
                })
          }}
        />
        <div 
          className="absolute left-8 w-0 h-0"
          style={{
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            ...(position?.showAbove 
              ? {
                  bottom: '-6px',
                  borderTop: '7px solid rgb(17, 24, 39)' // matches bg-gray-900
                }
              : {
                  top: '-6px',
                  borderBottom: '7px solid rgb(17, 24, 39)' // matches bg-gray-900
                }
            )
          }}
        />

        {/* Dialog content */}
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 rounded-t-lg">
            <h3 className="text-lg font-medium text-gray-100">
              Edit Compensation Details
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 focus:outline-none"
            >
              <IoClose className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-gray-900 rounded-b-lg">
            <div className="grid grid-cols-7 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Day Type</label>
                <select 
                  name="dayType"
                  value={formData.dayType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                >
                  <option value="Regular">Regular</option>
                  <option value="Holiday">Holiday</option>
                  <option value="Rest Day">Rest Day</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Hours Worked</label>
                <input
                  type="text"
                  name="hoursWorked"
                  value={formData.hoursWorked || 0}
                  readOnly
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Leave Type</label>
                <select
                  name="leaveType"
                  value={formData.leaveType || 'None'}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                >
                  <option value="None">None</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Sick">Sick</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Overtime Minutes</label>
                <input
                  type="text"
                  name="overtimeMinutes"
                  value={formData.overtimeMinutes || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Overtime Pay</label>
                <input
                  type="text"
                  name="overtimePay"
                  value={formData.overtimePay || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Undertime Minutes</label>
                <input
                  type="text"
                  name="undertimeMinutes"
                  value={formData.undertimeMinutes || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Undertime Deduction</label>
                <input
                  type="text"
                  name="undertimeDeduction"
                  value={formData.undertimeDeduction || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Late Minutes</label>
                <input
                  type="text"
                  name="lateMinutes"
                  value={formData.lateMinutes || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Late Deduction</label>
                <input
                  type="text"
                  name="lateDeduction"
                  value={formData.lateDeduction || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Holiday Bonus</label>
                <input
                  type="text"
                  name="holidayBonus"
                  value={formData.holidayBonus || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Leave Pay</label>
                <input
                  type="text"
                  name="leavePay"
                  value={formData.leavePay || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Gross Pay</label>
                <input
                  type="text"
                  name="grossPay"
                  value={formData.grossPay || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Deductions</label>
                <input
                  type="text"
                  name="deductions"
                  value={formData.deductions || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Net Pay</label>
                <input
                  type="text"
                  name="netPay"
                  value={formData.netPay || 0}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
              </div>

              <div className="col-span-5">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
                  <Switch
                    checked={formData.manualOverride || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, manualOverride: e }))}
                    className={`${
                      formData.manualOverride ? 'bg-blue-600' : 'bg-gray-700'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  >
                    <span className="sr-only">Manual Override</span>
                    <span
                      className={`${
                        formData.manualOverride ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 rounded-full bg-gray-100 shadow transform transition-transform duration-200 ease-in-out`}
                    />
                  </Switch>
                  <span>Manual Override</span>
                </label>
              </div>

              <div className="col-span-7 flex items-center space-x-3">
                <input
                  type="text"
                  name="notes"
                  placeholder="Notes"
                  value={formData.notes || ''}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md text-gray-100 focus:border-blue-500 focus:ring focus:ring-blue-500/20 transition-all duration-200 hover:border-gray-600"
                />
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
