import { useState, useEffect, useCallback } from "react";
import { Attendance } from "@/renderer/model/attendance";
import { Compensation } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { TimesheetService } from "@/renderer/services/TimesheetService";
import { toast } from "sonner";
import { useLoadingStore } from "@/renderer/stores/loadingStore";

interface UseTimesheetDataParams {
  dbPath: string;
  companyName: string;
  employeeId: string | null;
  employee: Employee | null;
  year: number;
  month: number;
}

interface UseTimesheetDataResult {
  timesheetEntries: Attendance[];
  compensationEntries: Compensation[];
  isLoading: boolean;
  validEntriesCount: number;
  refreshData: (showToast?: boolean) => Promise<void>;
  hasAttemptedInitialRefresh: boolean;
}

/**
 * Hook for loading and managing timesheet data
 */
export function useTimesheetData({
  dbPath,
  companyName,
  employeeId,
  employee,
  year,
  month,
}: UseTimesheetDataParams): UseTimesheetDataResult {
  const [timesheetEntries, setTimesheetEntries] = useState<Attendance[]>([]);
  const [compensationEntries, setCompensationEntries] = useState<
    Compensation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [validEntriesCount, setValidEntriesCount] = useState<number>(0);
  const [hasAttemptedInitialRefresh, setHasAttemptedInitialRefresh] =
    useState(false);
  const { setLoading } = useLoadingStore();

  // Create a memoized service instance
  const service = new TimesheetService(dbPath, companyName);

  /**
   * Refresh timesheet data
   */
  const refreshData = useCallback(
    async (showToast: boolean = true) => {
      if (!employee || !employeeId) {
        return;
      }

      try {
        setLoading(true);
        console.log("useTimesheetData.refreshData - Starting refresh");

        const timesheetService = new TimesheetService(dbPath, companyName);
        const { attendance: attendanceData, compensation: compensationData } =
          await timesheetService.loadTimesheetData(employeeId, year, month);

        setTimesheetEntries(attendanceData);
        setCompensationEntries(compensationData);
        setValidEntriesCount(
          compensationData.filter((comp) => comp.absence).length
        );

        if (attendanceData.length > 0 || compensationData.length > 0) {
          if (showToast) {
            toast.success("Records refreshed successfully");
          }
        } else if (showToast) {
          toast.error("No timesheet entries found after refresh");
        }

        console.log("useTimesheetData.refreshData - Completed refresh:", {
          attendanceCount: attendanceData.length,
          compensationCount: compensationData.length,
          validEntriesCount: compensationData.filter((comp) => comp.absence)
            .length,
        });
      } catch (error) {
        console.error(
          "useTimesheetData.refreshData - Error refreshing timesheet data:",
          error
        );
        if (showToast) {
          toast.error("Error refreshing records");
        }
      } finally {
        setLoading(false);
      }
    },
    [dbPath, companyName, employee, employeeId, year, month, setLoading]
  );

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      if (!employee || !employeeId) {
        return;
      }

      try {
        setLoading(true);
        setIsLoading(true);
        console.log("useTimesheetData.loadData - Starting initial load");

        const timesheetService = new TimesheetService(dbPath, companyName);
        const { attendance: attendanceData, compensation: compensationData } =
          await timesheetService.loadTimesheetData(employeeId, year, month);

        setTimesheetEntries(attendanceData);
        setCompensationEntries(compensationData);
        setValidEntriesCount(
          compensationData.filter((comp) => comp.absence).length
        );

        if (
          attendanceData.length === 0 &&
          compensationData.length === 0 &&
          !hasAttemptedInitialRefresh
        ) {
          setHasAttemptedInitialRefresh(true);
          await refreshData(true);
        }

        console.log("useTimesheetData.loadData - Completed initial load:", {
          attendanceCount: attendanceData.length,
          compensationCount: compensationData.length,
          validEntriesCount: compensationData.filter((comp) => comp.absence)
            .length,
        });
      } catch (error) {
        console.error(
          "useTimesheetData.loadData - Detailed error loading timesheet data:",
          error
        );
        toast.error("Error loading timesheet data");
      } finally {
        setLoading(false);
        setIsLoading(false);
      }
    };

    loadData();
  }, [
    employee,
    employeeId,
    month,
    year,
    dbPath,
    companyName,
    hasAttemptedInitialRefresh,
    refreshData,
    setLoading,
  ]);

  return {
    timesheetEntries,
    compensationEntries,
    isLoading,
    validEntriesCount,
    refreshData,
    hasAttemptedInitialRefresh,
  };
}
