'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useLoadingStore } from '@/renderer/stores/loadingStore';
import { useEmployeeStore } from '@/renderer/stores/employeeStore';
import { toast } from 'sonner';
import { MissingTimeModel, MissingTimeLog } from '@/renderer/model/missingTime';
import { createEmployeeModel } from '@/renderer/model/employee';
import { createAttendanceModel, Attendance } from '@/renderer/model/attendance';
import { MagicCard } from './magicui/magic-card';
import { TimeEditDialog } from './TimeEditDialog';

export default function MissingTimeLogs() {
  const [missingLogs, setMissingLogs] = useState<MissingTimeLog[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<MissingTimeLog | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [dialogPosition, setDialogPosition] = useState<{
    top: number;
    left: number;
    showAbove?: boolean;
  } | null>(null);
  const { setLoading } = useLoadingStore();
  const { dbPath } = useSettingsStore();
  const [storedMonth, setStoredMonth] = useState<string | null>(null);
  const [storedYear, setStoredYear] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const month = localStorage.getItem("selectedMonth");
      const year = localStorage.getItem("selectedYear");

      setStoredMonth(month);
      setStoredYear(year);
    }
  }, []);

  const storedMonthInt = storedMonth ? parseInt(storedMonth, 10) + 1 : 0;
  let storedYearInt = storedYear ? parseInt(storedYear, 10) : new Date().getFullYear();
  if (!storedYear) {
    const currentYear = new Date().getFullYear().toString();
    if (typeof window !== 'undefined') {
      localStorage.setItem("selectedYear", currentYear);
    }
    storedYearInt = parseInt(currentYear, 10);
  }

  useEffect(() => {
    const loadActiveEmployees = async () => {
      if (!dbPath) {
        console.warn('[MissingTimeLogs] Database path not set');
        return;
      }

      try {
        const employeeModel = createEmployeeModel(dbPath);
        const employees = await employeeModel.loadActiveEmployees();
        setActiveEmployees(employees.map(e => e.id));
      } catch (error) {
        console.error('[MissingTimeLogs] Error loading active employees:', error);
        setActiveEmployees([]);
      }
    };

    loadActiveEmployees();
  }, [dbPath]);

  const loadMissingLogs = async () => {
    if (!dbPath) {
      console.error('[MissingTimeLogs] Database path is not set');
      return;
    }

    setLoading(true);
    try {
      const model = MissingTimeModel.createMissingTimeModel(dbPath);
      const logs = await model.getMissingTimeLogs(storedMonthInt, storedYearInt);
      // Filter logs to only show active employees
      const filteredLogs = logs.filter(log => activeEmployees.includes(log.employeeId));
      setMissingLogs(filteredLogs);
    } catch (error: any) {
      console.error('[MissingTimeLogs] Error loading logs:', error);
      toast.error(`Error loading logs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dbPath) return;
    loadMissingLogs();
  }, [dbPath, setLoading, storedYearInt, storedMonthInt, activeEmployees]);

  useEffect(() => {
    if (selectedLog) {
      loadAttendance(selectedLog).then(setAttendance);
    } else {
      setAttendance(null);
    }
  }, [selectedLog]);

  const handleTimeEdit = async (updates: { timeIn: string | null; timeOut: string | null }) => {
    if (!dbPath || !selectedLog) return;

    try {
      const model = MissingTimeModel.createMissingTimeModel(dbPath);
      const attendanceModel = createAttendanceModel(dbPath);
      
      console.log('[MissingTimeLogs] Current updates:', updates);
      
      // First save to attendance model
      const attendance = await loadAttendance(selectedLog);
      console.log('[MissingTimeLogs] Current attendance:', attendance);

      // Create or update attendance
      const updatedAttendance = attendance ? {
        ...attendance,
        timeIn: updates.timeIn ?? attendance.timeIn,
        timeOut: updates.timeOut ?? attendance.timeOut
      } : {
        employeeId: selectedLog.employeeId,
        day: parseInt(selectedLog.day),
        month: selectedLog.month,
        year: selectedLog.year,
        timeIn: updates.timeIn ?? null,
        timeOut: updates.timeOut ?? null
      };
      
      console.log('[MissingTimeLogs] Saving attendance:', updatedAttendance);
      await attendanceModel.saveOrUpdateAttendances(
        [updatedAttendance],
        storedMonthInt || 0,
        storedYearInt || 0,
        selectedLog.employeeId
      );

      // Verify attendance was saved
      const savedAttendance = await loadAttendance(selectedLog);
      console.log('[MissingTimeLogs] Saved attendance:', savedAttendance);

      // Check if both time in and time out are now present
      const hasBothTimes = updates.timeIn !== null && updates.timeOut !== null;
      
      if (hasBothTimes) {
        // Delete the missing time log if both times are present
        await model.deleteMissingTimeLog(selectedLog.id, storedMonthInt || 0, storedYearInt || 0);
        toast.success('Time updated and missing log removed');
      } else {
        // Otherwise, update the missing time log
        await model.saveMissingTimeLog({
          ...selectedLog,
          ...updates
        }, storedMonthInt || 0, storedYearInt || 0);
        toast.success('Time updated successfully');
      }

      // Refresh the logs
      await loadMissingLogs();
      
      // Close the dialog
      setIsDialogOpen(false);
      setSelectedLog(null);
      setDialogPosition(null);
    } catch (error: any) {
      console.error('Error updating time:', error);
      toast.error(`Error updating time: ${error.message}`);
    }
  };

  const loadAttendance = async (log: MissingTimeLog) => {
    if (!dbPath) return null;
    const attendanceModel = createAttendanceModel(dbPath);
    const attendance = await attendanceModel.loadAttendanceByDay(
      parseInt(log.day),
      log.month,
      log.year,
      log.employeeId
    );
    return attendance;
  };

  return (
    <>
      <MagicCard className='p-0.5 rounded-lg' gradientSize={200} gradientColor="#9E7AFF" gradientOpacity={0.8} gradientFrom="#9E7AFF" gradientTo="#FE8BBB">
        <div className="overflow-hidden bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Missing Time Logs</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Missing</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {missingLogs.length > 0 ? (
                  missingLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedLog(log);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const windowHeight = window.innerHeight;
                        const spaceBelow = windowHeight - rect.bottom;
                        const spaceAbove = rect.top;
                        const dialogHeight = 400; // Approximate height of dialog
                        const spacing = 8; // Space between dialog and row

                        // If there's not enough space below and more space above, show above
                        const showAbove = spaceBelow < dialogHeight && spaceAbove > spaceBelow;
                        
                        setDialogPosition({
                          top: showAbove ? rect.top - spacing : rect.bottom + spacing,
                          left: rect.left,
                          showAbove
                        });
                        setIsDialogOpen(true);
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b border-gray-200">
                        {log.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-200">
                        {log.day}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-200">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          {log.missingType === 'timeIn' ? 'Time In' : 'Time Out'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      No missing time logs found for this month
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </MagicCard>
      <TimeEditDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedLog(null);
          setDialogPosition(null);
        }}
        onSave={handleTimeEdit}
        log={selectedLog || {
          id: '',
          employeeId: '',
          employeeName: '',
          day: '',
          month: storedMonthInt || 0,
          year: storedYearInt || 0,
          missingType: 'timeIn',
          employmentType: '',
          createdAt: new Date().toISOString()
        }}
        position={dialogPosition}
        attendance={attendance}
      />
    </>
  );
}
