import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { getCompanyName, isWebEnvironment } from "../lib/firestoreService";

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

// --- Define the list of all potential models this hook can handle ---
// Keep this updated if new models are added/removed from createFirestoreInstances
const ALL_POTENTIAL_MODEL_NAMES = [
  "attendance",
  "employee",
  "compensation",
  "holiday",
  "leave",
  "loan",
  "missing time",
  "payroll",
  "role",
  "settings",
  "shorts", // Requires employeeId
  "statistics", // Requires year
  "cash advance",
];

export function useFirestoreSync({
  // --- Update destructuring ---
  dbPath,
  companyName,
  employeeId,
  year,
}: UseFirestoreSyncProps) {
  const [uploadStatus, setUploadStatus] = useState<SyncStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<SyncStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<string[]>([]);
  const [modelStatuses, setModelStatuses] = useState<
    Record<string, ModelStatus>
  >(() => {
    return {};
  });

  // --- Determine currently *active* models based on provided props ---
  // This filters the potential list based on dependencies like employeeId/year
  // Note: This does NOT run the createFirestoreInstances function here.
  const availableModelNames = useMemo(() => {
    return ALL_POTENTIAL_MODEL_NAMES.filter((name) => {
      if (name === "shorts" && !employeeId) return false;
      if (name === "statistics" && !year) return false;
      return true;
    });
  }, [employeeId, year]);

  const createFirestoreInstances = useCallback((): SyncOperation[] => {
    const operations: SyncOperation[] = [];

    if (!dbPath) {
      return [];
    }

    try {
      const attendanceModel = createAttendanceModel(dbPath);
      operations.push({
        name: "attendance",
        instance: createAttendanceFirestore(attendanceModel),
      });

      const employeeModel = createEmployeeModel(dbPath);
      operations.push({
        name: "employee",
        instance: createEmployeeFirestore(employeeModel),
      });

      const compensationModel = createCompensationModel(dbPath);
      operations.push({
        name: "compensation",
        instance: createCompensationFirestore(compensationModel),
      });

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
    } catch (error) {
      console.error(
        "[useFirestoreSync] Critical error creating model instances:",
        error
      );
      toast.error("Failed to initialize data models for sync. Check console.");
      return [];
    }

    return operations;
  }, [dbPath, employeeId, year]);

  const updateModelStatus = useCallback(
    (modelName: string, status: SyncStatus, message?: string) => {
      setModelStatuses((prev) => {
        if (typeof prev !== "object" || prev === null) {
          console.error(
            "[useFirestoreSync] CRITICAL: modelStatuses state is not an object!",
            prev
          );
          const recoveryState: Record<string, ModelStatus> = {};
          recoveryState[modelName] = {
            status,
            progress: message ? [message] : [],
          };
          return recoveryState;
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
      setProgress: React.Dispatch<React.SetStateAction<string[]>>,
      modelsToFilter?: string[]
    ) => {
      if (!dbPath || !companyName) {
        const errorMsg = `Cannot sync: ${!dbPath ? "Database path" : ""}${
          !dbPath && !companyName ? " and " : ""
        }${!companyName ? "Company name" : ""} required.`;
        toast.error(errorMsg);
        console.error(
          "[useFirestoreSync] Prerequisites missing for sync:",
          errorMsg
        );
        return;
      }

      // Check for appropriate direction based on environment
      const isDesktopEnvironment = !isWebEnvironment();
      if (isDesktopEnvironment && !isUpload) {
        // In desktop, we should be uploading TO web, not downloading FROM web
        const errorMsg =
          "In desktop mode, you can only upload data TO Firestore, not download FROM it.";
        console.warn("[useFirestoreSync] " + errorMsg);
        toast.error("Cannot sync: " + errorMsg);
        setStatus("error");
        return;
      }

      if (!isDesktopEnvironment && isUpload) {
        // In web, we should be downloading FROM web, not uploading TO web
        const errorMsg =
          "In web mode, you can only download data FROM Firestore, not upload TO it.";
        console.warn("[useFirestoreSync] " + errorMsg);
        toast.error("Cannot sync: " + errorMsg);
        setStatus("error");
        return;
      }

      if (!isDesktopEnvironment) {
        try {
          const onlineCompanyName = await getCompanyName();
          if (onlineCompanyName !== companyName) {
            toast.error(
              `Company name mismatch: Local (${companyName}) does not match online (${onlineCompanyName}). Please ensure you're syncing with the correct company.`
            );
            return;
          }
        } catch (error) {
          toast.error("Failed to verify company name. Please try again.");
          console.error(
            "[useFirestoreSync] Error verifying company name for download:",
            error
          );
          return;
        }
      }

      setStatus("running");
      setProgress([]);

      let allOperations = createFirestoreInstances();
      let activeOperations = allOperations;

      if (modelsToFilter && modelsToFilter.length > 0) {
        activeOperations = allOperations.filter((op) =>
          modelsToFilter.includes(op.name)
        );
      }

      if (activeOperations.length === 0) {
        const reason = !dbPath
          ? "missing dbPath"
          : modelsToFilter && modelsToFilter.length > 0
          ? "no selected models matched available operations or instantiation failed"
          : "model instantiation failed or no operations available (check logs for createFirestoreInstances)";
        setStatus("error");
        toast.error(
          `${
            isUpload ? "Upload" : "Download"
          } failed: Could not initialize/filter sync operations. ${reason}.`
        );
        setModelStatuses({});
        return;
      }

      const initialModelStatuses: Record<string, ModelStatus> = {};
      activeOperations.forEach(({ name }) => {
        initialModelStatuses[name] = { status: "idle", progress: [] };
      });
      setModelStatuses(initialModelStatuses);

      try {
        for (const { name, instance } of activeOperations) {
          const operationType = isUpload ? "upload" : "download";
          updateModelStatus(
            name,
            "running",
            `Starting ${name} ${operationType}...`
          );
          await (isUpload
            ? instance.syncToFirestore
            : instance.syncFromFirestore)((msg: string) => {
            updateModelStatus(name, "running", msg);
          });
          updateModelStatus(
            name,
            "success",
            `${name} ${operationType} completed`
          );
        }
        setStatus("success");
        toast.success(
          `${
            isUpload ? "Upload" : "Download"
          } completed successfully for selected models!`
        );
      } catch (error: any) {
        setStatus("error");
        toast.error(
          `${isUpload ? "Upload" : "Download"} failed for selected models: ${
            error.message
          }`
        );
      }
    },
    [dbPath, companyName, createFirestoreInstances, updateModelStatus]
  );

  const handleUpload = useCallback(
    (modelsToFilter?: string[]) =>
      handleSync(true, setUploadStatus, setUploadProgress, modelsToFilter),
    [handleSync]
  );

  const handleDownload = useCallback(
    (modelsToFilter?: string[]) =>
      handleSync(false, setDownloadStatus, setDownloadProgress, modelsToFilter),
    [handleSync]
  );

  return {
    uploadStatus,
    downloadStatus,
    modelStatuses,
    handleUpload,
    handleDownload,
    availableModelNames,
  };
}
