import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getCompanyName } from "../lib/firestoreService";

// Import model factory functions and Firestore instance creators
import { createAttendanceModel, AttendanceModel } from "../model/attendance";
import { createAttendanceFirestore } from "../model/attendance_firestore";

import { createEmployeeModel, EmployeeModel } from "../model/employee";
import { createEmployeeFirestore } from "../model/employee_firestore";

import {
  createCompensationModel,
  CompensationModel,
} from "../model/compensation";
import { createCompensationFirestore } from "../model/compensation_firestore";

import { createHolidayModel, HolidayModel } from "../model/holiday";
import { createHolidayFirestoreInstance } from "../model/holiday_firestore";

import { createLeaveModel, LeaveModel } from "../model/leave";
import { createLeaveFirestoreInstance } from "../model/leave_firestore";

import { createLoanModel, LoanModel } from "../model/loan";
import { createLoanFirestoreInstance } from "../model/loan_firestore";

import { MissingTimeModel } from "../model/missingTime";
import { createMissingTimeFirestoreInstance } from "../model/missingTime_firestore";

import { Payroll } from "../model/payroll";
import { createPayrollFirestoreInstance } from "../model/payroll_firestore";

import { createRoleModel, RoleModel } from "../model/role";
import { createRoleFirestoreInstance } from "../model/role_firestore";

import {
  createAttendanceSettingsModel as createSettingsModel, // Alias for clarity if needed
  AttendanceSettingsModel,
} from "../model/settings";
import { createSettingsFirestoreInstance } from "../model/settings_firestore";

import { createShortModel, ShortModel } from "../model/shorts";
import { createShortsFirestoreInstance } from "../model/shorts_firestore";

import { createStatisticsModel, StatisticsModel } from "../model/statistics";
import { createStatisticsFirestoreInstance } from "../model/statistics_firestore";

import { createCashAdvanceModel, CashAdvanceModel } from "../model/cashAdvance";
import { createCashAdvanceFirestoreInstance } from "../model/cashAdvance_firestore";

type SyncStatus = "idle" | "running" | "success" | "error";

interface ModelStatus {
  status: SyncStatus;
  progress: string[];
}

// --- Updated Props: Remove models, keep identifiers ---
interface UseFirestoreSyncProps {
  dbPath: string; // Required to instantiate models
  companyName: string; // Required for Firestore pathing
  employeeId?: string; // Needed for ShortsModel
  year?: number; // Needed for StatisticsModel
}

interface FirestoreInstance {
  syncToFirestore: (progressCallback: (msg: string) => void) => Promise<void>;
  syncFromFirestore: (progressCallback: (msg: string) => void) => Promise<void>;
}

interface SyncOperation {
  name: string;
  instance: FirestoreInstance;
}

export function useFirestoreSync({
  // --- Update destructuring ---
  dbPath,
  companyName,
  employeeId,
  year,
}: UseFirestoreSyncProps) {
  console.log("[useFirestoreSync] Hook called with props:", {
    dbPathExists: !!dbPath,
    companyNameExists: !!companyName,
    employeeIdProvided: !!employeeId,
    yearProvided: !!year,
  });
  const [uploadStatus, setUploadStatus] = useState<SyncStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<SyncStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<string[]>([]);
  const [modelStatuses, setModelStatuses] = useState<
    Record<string, ModelStatus>
  >(() => {
    console.log("Initializing modelStatuses state");
    return {};
  });

  // --- Updated createFirestoreInstances ---
  const createFirestoreInstances = useCallback((): SyncOperation[] => {
    console.log(
      "[useFirestoreSync] createFirestoreInstances called. Required props:",
      {
        dbPath,
        employeeId, // For shorts
        year, // For statistics
      }
    );
    const operations: SyncOperation[] = [];

    // Check if dbPath is available, needed for most model instantiations
    if (!dbPath) {
      console.warn(
        "[useFirestoreSync] dbPath is missing. Cannot create model instances or sync operations."
      );
      return []; // Cannot proceed without dbPath
    }

    try {
      // Instantiate models directly inside this function
      const attendanceModel = createAttendanceModel(dbPath);
      operations.push({
        name: "attendance",
        instance: createAttendanceFirestore(attendanceModel),
      });
      console.log("[useFirestoreSync] Added ATTENDANCE model to operations.");

      const employeeModel = createEmployeeModel(dbPath);
      operations.push({
        name: "employee",
        instance: createEmployeeFirestore(employeeModel),
      });
      console.log("[useFirestoreSync] Added EMPLOYEE model to operations.");

      // TODO: Re-enable other models for full sync
      /*
      const compensationModel = createCompensationModel(dbPath);
      operations.push({
        name: "compensation",
        instance: createCompensationFirestore(compensationModel),
      });
      console.log("[useFirestoreSync] Added COMPENSATION model to operations.");

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const holidayModel = createHolidayModel(
        dbPath,
        currentMonth,
        currentYear
      );
      operations.push({
        name: "holiday",
        instance: createHolidayFirestoreInstance(holidayModel),
      });
      console.log("[useFirestoreSync] Added HOLIDAY model to operations.");

      const placeholderEmployeeId = "__SYNC_ALL__";
      const leaveModel = createLeaveModel(dbPath, placeholderEmployeeId);
      operations.push({
        name: "leave",
        instance: createLeaveFirestoreInstance(leaveModel),
      });
      console.log("[useFirestoreSync] Added LEAVE model to operations.");

      const loanModel = createLoanModel(dbPath, placeholderEmployeeId);
      operations.push({
        name: "loan",
        instance: createLoanFirestoreInstance(loanModel),
      });
      console.log("[useFirestoreSync] Added LOAN model to operations.");

      const missingTimeModel = new MissingTimeModel(dbPath);
      operations.push({
        name: "missing time",
        instance: createMissingTimeFirestoreInstance(missingTimeModel),
      });
      console.log("[useFirestoreSync] Added MISSING TIME model to operations.");

      const payrollModel = new Payroll([], "placeholder", dbPath);
      operations.push({
        name: "payroll",
        instance: createPayrollFirestoreInstance(payrollModel, dbPath),
      });
      console.log("[useFirestoreSync] Added PAYROLL model to operations.");

      const roleModel = createRoleModel(dbPath);
      operations.push({
        name: "role",
        instance: createRoleFirestoreInstance(roleModel),
      });
      console.log("[useFirestoreSync] Added ROLE model to operations.");

      const settingsModel = createSettingsModel(dbPath);
      operations.push({
        name: "settings",
        instance: createSettingsFirestoreInstance(settingsModel),
      });
      console.log("[useFirestoreSync] Added SETTINGS model to operations.");

      if (employeeId) {
        const shortsModel = createShortModel(dbPath, employeeId);
        operations.push({
          name: "shorts",
          instance: createShortsFirestoreInstance(shortsModel, employeeId),
        });
        console.log(
          "[useFirestoreSync] Added SHORTS model to operations (for employeeId:",
          employeeId,
          ")."
        );
      } else {
        console.log(
          "[useFirestoreSync] Skipping SHORTS model: employeeId not provided."
        );
      }

      if (year) {
        const statisticsModel = createStatisticsModel(dbPath, year);
        operations.push({
          name: "statistics",
          instance: createStatisticsFirestoreInstance(statisticsModel, year),
        });
        console.log(
          "[useFirestoreSync] Added STATISTICS model to operations (for year:",
          year,
          ")."
        );
      } else {
        console.log(
          "[useFirestoreSync] Skipping STATISTICS model: year not provided."
        );
      }

      const cashAdvanceModel = createCashAdvanceModel(
        dbPath,
        placeholderEmployeeId
      );
      operations.push({
        name: "cash advance",
        instance: createCashAdvanceFirestoreInstance(cashAdvanceModel),
      });
      console.log("[useFirestoreSync] Added CASH ADVANCE model to operations.");
      */
    } catch (error) {
      console.error(
        "[useFirestoreSync] Error creating model instances:",
        error
      );
      toast.error("Failed to initialize data models for sync. Check console.");
      return []; // Return empty if instantiation fails
    }

    console.log(
      "[useFirestoreSync] createFirestoreInstances returning operations count:",
      operations.length
    );
    return operations;
    // --- Update dependencies ---
  }, [dbPath, employeeId, year]); // Only depend on identifiers needed for instantiation

  const updateModelStatus = useCallback(
    (modelName: string, status: SyncStatus, message?: string) => {
      console.log(`Updating model status for ${modelName}:`, status, message);
      setModelStatuses((prev) => {
        if (typeof prev !== "object" || prev === null) {
          throw new Error("modelStatuses state is not an object!");
        }
        const currentProgress = prev[modelName]?.progress || [];
        return {
          ...prev,
          [modelName]: {
            status,
            progress: message ? [...currentProgress, message] : currentProgress,
          },
        };
      });
    },
    []
  );

  const handleSync = useCallback(
    async (
      isUpload: boolean,
      setStatus: (status: SyncStatus) => void,
      setProgress: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
      console.log("[useFirestoreSync] handleSync called", {
        isUpload,
        dbPath,
        companyName,
      });
      // Check dbPath and companyName FIRST, as they are essential
      if (!dbPath || !companyName) {
        const errorMsg = `Cannot sync: ${!dbPath ? "Database path" : ""}${
          !dbPath && !companyName ? " and " : ""
        }${!companyName ? "Company name" : ""} required.`;
        toast.error(errorMsg);
        console.error("[useFirestoreSync]", errorMsg);
        // Set status to error maybe? Or just prevent execution.
        // setStatus("error");
        return; // Stop if prerequisites are missing
      }

      // For download operations, verify company name match
      if (!isUpload) {
        try {
          const onlineCompanyName = await getCompanyName();
          if (onlineCompanyName !== companyName) {
            toast.error(
              `Company name mismatch: Local (${companyName}) does not match online (${onlineCompanyName}). Please ensure you're syncing with the correct company.`
            );
            // Don't throw here, just prevent sync
            return;
          }
        } catch (error) {
          toast.error("Failed to verify company name. Please try again.");
          console.error(
            "[useFirestoreSync] Error verifying company name:",
            error
          );
          return; // Stop if verification fails
        }
      }

      setStatus("running");
      setProgress([]);

      // Create instances - this now happens inside createFirestoreInstances
      // It will return empty if dbPath was missing or instantiation failed
      const operations = createFirestoreInstances();

      console.log(
        "[useFirestoreSync] handleSync: Operations count from createFirestoreInstances:",
        operations.length
      );

      // Handle case where no operations could be created (due to missing dbPath or instantiation error)
      if (operations.length === 0) {
        const reason = !dbPath
          ? "missing dbPath"
          : "model instantiation failed (check logs)";
        console.warn(
          `[useFirestoreSync] NO OPERATIONS TO PERFORM. Checklist will be empty. Reason: ${reason}.`
        );
        setStatus("error"); // Set to error because prerequisites weren't met or models failed
        toast.error(
          `${
            isUpload ? "Upload" : "Download"
          } failed: Could not initialize sync operations (${reason}).`
        );
        setModelStatuses({}); // Ensure modelStatuses is empty
        return;
      }

      // Initialize model statuses for the valid operations
      const initialModelStatuses: Record<string, ModelStatus> = {};
      operations.forEach(({ name }) => {
        initialModelStatuses[name] = { status: "idle", progress: [] };
      });
      console.log("Setting initial modelStatuses:", initialModelStatuses);
      setModelStatuses(initialModelStatuses);

      try {
        for (const { name, instance } of operations) {
          const operationType = isUpload ? "upload" : "download";

          // Update model status to running
          updateModelStatus(
            name,
            "running",
            `Starting ${name} ${operationType}...`
          );

          await (isUpload
            ? instance.syncToFirestore
            : instance.syncFromFirestore)((msg: string) => {
            setProgress((prev) => [...prev, msg]);
            updateModelStatus(name, "running", msg);
          });

          // Update model status to success
          updateModelStatus(
            name,
            "success",
            `${name} ${operationType} completed`
          );
        }

        setStatus("success");
        toast.success(
          `${isUpload ? "Upload" : "Download"} completed successfully!`
        );
      } catch (error: any) {
        setStatus("error");
        toast.error(
          `${isUpload ? "Upload" : "Download"} failed: ${error.message}`
        );
        // Optionally re-throw if needed by caller, but hook usually handles state
        // throw error;
      }
      console.log("[useFirestoreSync] Sync process finished.");
    },
    // Ensure companyName is in dependency array for handleSync
    [dbPath, companyName, createFirestoreInstances, updateModelStatus]
  );

  const handleUpload = useCallback(
    () => handleSync(true, setUploadStatus, setUploadProgress),
    [handleSync]
  );

  const handleDownload = useCallback(
    () => handleSync(false, setDownloadStatus, setDownloadProgress),
    [handleSync]
  );

  return {
    uploadStatus,
    downloadStatus,
    uploadProgress,
    downloadProgress,
    handleUpload,
    handleDownload,
    modelStatuses,
  };
}
