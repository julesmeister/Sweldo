import { useState, useEffect, useCallback } from "react";
import { Attendance, AttendanceModel } from "@/renderer/model/attendance";
import { Compensation, CompensationModel } from "@/renderer/model/compensation";
import { Employee } from "@/renderer/model/employee";
import { toast } from "sonner";

interface UseTimesheetCoreLoaderProps {
  employee: Employee | null;
  month: number;
  year: number;
  dbPath: string | null;
  attendanceModel: AttendanceModel;
  compensationModel: CompensationModel;
  initialLoadAttempted: boolean;
  setInitialLoadAttempted: (value: boolean) => void; // Callback to track initial load
}

interface UseTimesheetCoreLoaderReturn {
  timesheetEntries: Attendance[];
  setTimesheetEntries: React.Dispatch<React.SetStateAction<Attendance[]>>;
  compensationEntries: Compensation[];
  setCompensationEntries: React.Dispatch<React.SetStateAction<Compensation[]>>;
  validEntriesCount: number;
  isLoadingData: boolean;
  refreshTimesheetData: (showToast?: boolean) => Promise<void>;
}

export const useTimesheetCoreLoader = ({
  employee,
  month,
  year,
  dbPath,
  attendanceModel,
  compensationModel,
  initialLoadAttempted,
  setInitialLoadAttempted,
}: UseTimesheetCoreLoaderProps): UseTimesheetCoreLoaderReturn => {
  const [timesheetEntries, setTimesheetEntries] = useState<Attendance[]>([]);
  const [compensationEntries, setCompensationEntries] = useState<
    Compensation[]
  >([]);
  const [validEntriesCount, setValidEntriesCount] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const loadAndSetData = useCallback(
    async (isInitialLoad: boolean) => {
      if (!employee || !dbPath || !employee.id || !month || !year) {
        setTimesheetEntries([]);
        setCompensationEntries([]);
        setValidEntriesCount(0);
        return { attendanceData: [], compensationData: [] }; // Return empty arrays
      }

      setIsLoadingData(true);
      try {
        const [attendanceData, compensationData] = await Promise.all([
          attendanceModel.loadAttendancesById(month, year, employee.id),
          compensationModel.loadRecords(month, year, employee.id),
        ]);

        setTimesheetEntries(attendanceData);
        setCompensationEntries(compensationData);
        setValidEntriesCount(
          compensationData.filter((comp) => comp.absence).length
        );
        return { attendanceData, compensationData }; // Return fetched data
      } catch (error) {
        toast.error("Error loading timesheet data");
        setTimesheetEntries([]);
        setCompensationEntries([]);
        setValidEntriesCount(0);
        return { attendanceData: [], compensationData: [] }; // Return empty on error
      } finally {
        setIsLoadingData(false);
        if (isInitialLoad) {
          setInitialLoadAttempted(true); // Mark initial attempt completed
        }
      }
    },
    [
      employee,
      dbPath,
      month,
      year,
      attendanceModel,
      compensationModel,
      setInitialLoadAttempted,
    ]
  );

  const refreshTimesheetData = useCallback(
    async (showToast: boolean = true) => {
      const { attendanceData, compensationData } = await loadAndSetData(false); // Treat refresh as not the initial load
      if (attendanceData.length > 0 || compensationData.length > 0) {
        if (showToast) toast.success("Records refreshed successfully");
        // Computation should be triggered separately after refresh completes
        return { shouldCompute: true, attendanceData, compensationData };
      } else {
        if (showToast) toast.error("No timesheet entries found after refresh");
        return { shouldCompute: false, attendanceData, compensationData };
      }
    },
    [loadAndSetData]
  );

  // Initial data load effect
  useEffect(() => {
    if (employee && !initialLoadAttempted) {
      console.log("[useTimesheetCoreLoader] Performing initial load...");
      loadAndSetData(true); // Pass true for initial load
    }
  }, [employee, initialLoadAttempted, loadAndSetData]);

  return {
    timesheetEntries,
    setTimesheetEntries,
    compensationEntries,
    setCompensationEntries,
    validEntriesCount,
    isLoadingData,
    refreshTimesheetData,
  };
};
