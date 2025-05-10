"use client";
import React, { useState, useCallback } from "react";
import { migrateAttendanceAlternatives } from "@/renderer/model/attendance_old";
import {
  migrateCsvToJson as migrateAttendanceCsvToJson,
  migrateBackupCsvToJson as migrateAttendanceBackupCsvToJson,
} from "@/renderer/model/attendance";
import {
  migrateCsvToJson as migrateCompensationCsvToJson,
  migrateBackupCsvToJson as migrateCompensationBackupCsvToJson,
} from "@/renderer/model/compensation";
import { migrateCsvToJson as migrateEmployeeCsvToJson } from "@/renderer/model/employee";
import { migrateCsvToJson as migrateHolidayCsvToJson } from "@/renderer/model/holiday";
import { migrateCsvToJson as migrateLeaveCsvToJson } from "@/renderer/model/leave";
import { migrateCsvToJson as migrateLoanCsvToJson } from "@/renderer/model/loan";
import { migrateCsvToJson as migrateCashAdvanceCsvToJson } from "@/renderer/model/cashAdvance";
import { MissingTimeModel } from "@/renderer/model/missingTime";
import { Payroll } from "@/renderer/model/payroll";
import { RoleModelImpl } from "@/renderer/model/role";
import { AttendanceSettingsModel } from "@/renderer/model/settings";
import { ShortModel } from "@/renderer/model/shorts";
import { toast } from "sonner";
import {
  IoSyncOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoSwapHorizontalOutline,
  IoServerOutline,
  IoPeopleOutline,
  IoCloudUploadOutline,
  IoTrashOutline,
  IoCalendarOutline,
  IoCheckmarkDoneOutline,
  IoWalletOutline,
  IoWarningOutline,
  IoDocumentTextOutline,
  IoKeyOutline,
  IoSettingsOutline,
  IoRemoveCircleOutline,
} from "react-icons/io5";

interface DataMigrationSettingsProps {
  dbPath: string;
}

type MigrationStatus = "idle" | "running" | "success" | "error";

// Reusable Migration Button Component
interface MigrationButtonProps {
  onClick: () => void;
  isRunning: boolean;
  icon: React.ReactNode;
  label: string;
  runningLabel: string;
  colorClass: string;
  ringColorClass: string;
  className?: string;
}

const MigrationButton: React.FC<MigrationButtonProps> = ({
  onClick,
  isRunning,
  icon,
  label,
  runningLabel,
  colorClass,
  ringColorClass,
  className = "mb-3",
}) => (
  <button
    onClick={onClick}
    disabled={isRunning}
    className={`inline-flex items-center justify-center gap-2 px-6 py-3 w-full border border-transparent rounded-lg text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${ringColorClass} shadow ${className}
      ${isRunning ? "bg-gray-400 cursor-not-allowed" : `${colorClass}`}
    `}
  >
    {isRunning ? (
      <>
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        {runningLabel}
      </>
    ) : (
      <>
        {icon}
        {label}
      </>
    )}
  </button>
);

// Log Display Component
interface MigrationLogProps {
  title: string;
  messages: string[];
  status: MigrationStatus;
  errorDetails?: string | null;
  onClear?: () => void;
}

const MigrationLogSection: React.FC<MigrationLogProps> = ({
  title,
  messages,
  status,
  errorDetails,
  onClear,
}) => (
  <>
    <div className="flex justify-between items-center mb-2">
      <h4 className="font-medium text-gray-700">{title}</h4>
      {onClear && (
        <button
          onClick={onClear}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
          title="Clear log"
        >
          <IoTrashOutline className="w-4 h-4" />
        </button>
      )}
    </div>
    <ul className="space-y-1 text-xs text-gray-600">
      {messages.map((msg, index) => (
        <li key={index} className="font-mono">
          {msg}
        </li>
      ))}
    </ul>
    {status === "success" && (
      <div className="mt-3 flex items-center gap-2 text-green-600">
        <IoCheckmarkCircleOutline className="w-5 h-5" />
        <span className="font-medium">
          {title.replace(" Log:", "")} Successful
        </span>
      </div>
    )}
    {status === "error" && errorDetails && (
      <div className="mt-3 flex items-center gap-2 text-red-600">
        <IoAlertCircleOutline className="w-5 h-5" />
        <span className="font-medium">
          {title.replace(" Log:", "")} Failed: {errorDetails}
        </span>
      </div>
    )}
  </>
);

const DataMigrationSettings: React.FC<DataMigrationSettingsProps> = ({
  dbPath,
}) => {
  const [status, setStatus] = useState<MigrationStatus>("idle");
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const [jsonMigrationStatus, setJsonMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [jsonProgressMessages, setJsonProgressMessages] = useState<string[]>(
    []
  );
  const [jsonErrorDetails, setJsonErrorDetails] = useState<string | null>(null);

  const [compensationMigrationStatus, setCompensationMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [compensationProgressMessages, setCompensationProgressMessages] =
    useState<string[]>([]);
  const [compensationErrorDetails, setCompensationErrorDetails] = useState<
    string | null
  >(null);

  const [employeeMigrationStatus, setEmployeeMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [employeeProgressMessages, setEmployeeProgressMessages] = useState<
    string[]
  >([]);
  const [employeeErrorDetails, setEmployeeErrorDetails] = useState<
    string | null
  >(null);

  const [holidayMigrationStatus, setHolidayMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [holidayProgressMessages, setHolidayProgressMessages] = useState<
    string[]
  >([]);
  const [holidayErrorDetails, setHolidayErrorDetails] = useState<string | null>(
    null
  );

  const [leaveMigrationStatus, setLeaveMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [leaveProgressMessages, setLeaveProgressMessages] = useState<string[]>(
    []
  );
  const [leaveErrorDetails, setLeaveErrorDetails] = useState<string | null>(
    null
  );

  const [loanMigrationStatus, setLoanMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [loanProgressMessages, setLoanProgressMessages] = useState<string[]>(
    []
  );
  const [loanErrorDetails, setLoanErrorDetails] = useState<string | null>(null);

  const [missingTimeMigrationStatus, setMissingTimeMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [missingTimeProgressMessages, setMissingTimeProgressMessages] =
    useState<string[]>([]);
  const [missingTimeErrorDetails, setMissingTimeErrorDetails] = useState<
    string | null
  >(null);

  const [payrollMigrationStatus, setPayrollMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [payrollProgressMessages, setPayrollProgressMessages] = useState<
    string[]
  >([]);
  const [payrollErrorDetails, setPayrollErrorDetails] = useState<string | null>(
    null
  );

  const [roleMigrationStatus, setRoleMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [roleProgressMessages, setRoleProgressMessages] = useState<string[]>(
    []
  );
  const [roleErrorDetails, setRoleErrorDetails] = useState<string | null>(null);

  const [settingsMigrationStatus, setSettingsMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [settingsProgressMessages, setSettingsProgressMessages] = useState<
    string[]
  >([]);
  const [settingsErrorDetails, setSettingsErrorDetails] = useState<
    string | null
  >(null);

  const [shortsMigrationStatus, setShortsMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [shortsProgressMessages, setShortsProgressMessages] = useState<
    string[]
  >([]);
  const [shortsErrorDetails, setShortsErrorDetails] = useState<string | null>(
    null
  );

  const [cashAdvanceMigrationStatus, setCashAdvanceMigrationStatus] =
    useState<MigrationStatus>("idle");
  const [cashAdvanceProgressMessages, setCashAdvanceProgressMessages] = useState<
    string[]
  >([]);
  const [cashAdvanceErrorDetails, setCashAdvanceErrorDetails] = useState<
    string | null
  >(null);

  const handleMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (status === "running") {
      toast.info("Migration is already in progress.");
      return;
    }

    setStatus("running");
    setProgressMessages(["Starting migration..."]);
    setErrorDetails(null);

    try {
      await migrateAttendanceAlternatives(dbPath, (message) => {
        setProgressMessages((prev) => [...prev, message]);
      });
      setStatus("success");
      toast.success(
        "Attendance alternatives migration completed successfully!"
      );
      setProgressMessages((prev) => [
        ...prev,
        "Migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("error");
      setErrorDetails(message);
      toast.error(`Migration failed: ${message}`);
      setProgressMessages((prev) => [...prev, `Migration failed: ${message}`]);
    }
  }, [dbPath, status]);

  const handleCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (jsonMigrationStatus === "running") {
      toast.info("CSV to JSON migration is already in progress.");
      return;
    }

    setJsonMigrationStatus("running");
    setJsonProgressMessages(["Starting CSV to JSON migration..."]);
    setJsonErrorDetails(null);

    try {
      // Step 1: Migrate regular attendance files
      await migrateAttendanceCsvToJson(dbPath, (message) => {
        setJsonProgressMessages((prev) => [...prev, message]);
      });

      // Step 2: Now also migrate backup files
      setJsonProgressMessages((prev) => [
        ...prev,
        "Starting backup files migration...",
      ]);

      await migrateAttendanceBackupCsvToJson(dbPath, (message) => {
        setJsonProgressMessages((prev) => [...prev, message]);
      });

      // Success for both
      setJsonMigrationStatus("success");
      toast.success("CSV to JSON migration completed successfully!");
      setJsonProgressMessages((prev) => [
        ...prev,
        "CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setJsonMigrationStatus("error");
      setJsonErrorDetails(message);
      toast.error(`CSV to JSON migration failed: ${message}`);
      setJsonProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, jsonMigrationStatus]);

  const handleCompensationCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (compensationMigrationStatus === "running") {
      toast.info("Compensation CSV to JSON migration is already in progress.");
      return;
    }

    setCompensationMigrationStatus("running");
    setCompensationProgressMessages([
      "Starting compensation CSV to JSON migration...",
    ]);
    setCompensationErrorDetails(null);

    try {
      // Step 1: Migrate regular compensation files
      await migrateCompensationCsvToJson(dbPath, (message) => {
        setCompensationProgressMessages((prev) => [...prev, message]);
      });

      // Step 2: Now also migrate backup files
      setCompensationProgressMessages((prev) => [
        ...prev,
        "Starting compensation backup files migration...",
      ]);

      await migrateCompensationBackupCsvToJson(dbPath, (message) => {
        setCompensationProgressMessages((prev) => [...prev, message]);
      });

      setCompensationMigrationStatus("success");
      toast.success(
        "Compensation CSV to JSON migration completed successfully!"
      );
      setCompensationProgressMessages((prev) => [
        ...prev,
        "Compensation CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCompensationMigrationStatus("error");
      setCompensationErrorDetails(message);
      toast.error(`Compensation CSV to JSON migration failed: ${message}`);
      setCompensationProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, compensationMigrationStatus]);

  const handleEmployeeCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (employeeMigrationStatus === "running") {
      toast.info("Employee CSV to JSON migration is already in progress.");
      return;
    }

    setEmployeeMigrationStatus("running");
    setEmployeeProgressMessages(["Starting employee CSV to JSON migration..."]);
    setEmployeeErrorDetails(null);

    try {
      await migrateEmployeeCsvToJson(dbPath, (message) => {
        setEmployeeProgressMessages((prev) => [...prev, message]);
      });
      setEmployeeMigrationStatus("success");
      toast.success("Employee CSV to JSON migration completed successfully!");
      setEmployeeProgressMessages((prev) => [
        ...prev,
        "Employee CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEmployeeMigrationStatus("error");
      setEmployeeErrorDetails(message);
      toast.error(`Employee CSV to JSON migration failed: ${message}`);
      setEmployeeProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, employeeMigrationStatus]);

  const handleHolidayCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (holidayMigrationStatus === "running") {
      toast.info("Holiday CSV to JSON migration is already in progress.");
      return;
    }

    setHolidayMigrationStatus("running");
    setHolidayProgressMessages(["Starting holiday CSV to JSON migration..."]);
    setHolidayErrorDetails(null);

    try {
      await migrateHolidayCsvToJson(dbPath, (message) => {
        setHolidayProgressMessages((prev) => [...prev, message]);
      });
      setHolidayMigrationStatus("success");
      toast.success("Holiday CSV to JSON migration completed successfully!");
      setHolidayProgressMessages((prev) => [
        ...prev,
        "Holiday CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHolidayMigrationStatus("error");
      setHolidayErrorDetails(message);
      toast.error(`Holiday CSV to JSON migration failed: ${message}`);
      setHolidayProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, holidayMigrationStatus]);

  const handleLeaveCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (leaveMigrationStatus === "running") {
      toast.info("Leave CSV to JSON migration is already in progress.");
      return;
    }

    setLeaveMigrationStatus("running");
    setLeaveProgressMessages(["Starting leave CSV to JSON migration..."]);
    setLeaveErrorDetails(null);

    try {
      await migrateLeaveCsvToJson(dbPath, (message) => {
        setLeaveProgressMessages((prev) => [...prev, message]);
      });
      setLeaveMigrationStatus("success");
      toast.success("Leave CSV to JSON migration completed successfully!");
      setLeaveProgressMessages((prev) => [
        ...prev,
        "Leave CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLeaveMigrationStatus("error");
      setLeaveErrorDetails(message);
      toast.error(`Leave CSV to JSON migration failed: ${message}`);
      setLeaveProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, leaveMigrationStatus]);

  const handleLoanCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (loanMigrationStatus === "running") {
      toast.info("Loan CSV to JSON migration is already in progress.");
      return;
    }

    setLoanMigrationStatus("running");
    setLoanProgressMessages(["Starting loan CSV to JSON migration..."]);
    setLoanErrorDetails(null);

    try {
      await migrateLoanCsvToJson(dbPath, (message) => {
        setLoanProgressMessages((prev) => [...prev, message]);
      });
      setLoanMigrationStatus("success");
      toast.success("Loan CSV to JSON migration completed successfully!");
      setLoanProgressMessages((prev) => [
        ...prev,
        "Loan CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoanMigrationStatus("error");
      setLoanErrorDetails(message);
      toast.error(`Loan CSV to JSON migration failed: ${message}`);
      setLoanProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, loanMigrationStatus]);

  const handleMissingTimeCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (missingTimeMigrationStatus === "running") {
      toast.info(
        "Missing Time Logs CSV to JSON migration is already in progress."
      );
      return;
    }

    setMissingTimeMigrationStatus("running");
    setMissingTimeProgressMessages([
      "Starting Missing Time Logs CSV to JSON migration...",
    ]);
    setMissingTimeErrorDetails(null);

    try {
      await MissingTimeModel.migrateCsvToJson(dbPath, (message: string) => {
        setMissingTimeProgressMessages((prev) => [...prev, message]);
      });
      setMissingTimeMigrationStatus("success");
      toast.success(
        "Missing Time Logs CSV to JSON migration completed successfully!"
      );
      setMissingTimeProgressMessages((prev) => [
        ...prev,
        "Missing Time Logs CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMissingTimeMigrationStatus("error");
      setMissingTimeErrorDetails(message);
      toast.error(`Missing Time Logs CSV to JSON migration failed: ${message}`);
      setMissingTimeProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, missingTimeMigrationStatus]);

  const handlePayrollCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (payrollMigrationStatus === "running") {
      toast.info(
        "Payroll Summary CSV to JSON migration is already in progress."
      );
      return;
    }

    setPayrollMigrationStatus("running");
    setPayrollProgressMessages([
      "Starting Payroll Summary CSV to JSON migration...",
    ]);
    setPayrollErrorDetails(null);

    try {
      await Payroll.migrateCsvToJson(dbPath, (message: string) => {
        setPayrollProgressMessages((prev) => [...prev, message]);
      });
      setPayrollMigrationStatus("success");
      toast.success(
        "Payroll Summary CSV to JSON migration completed successfully!"
      );
      setPayrollProgressMessages((prev) => [
        ...prev,
        "Payroll Summary CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPayrollMigrationStatus("error");
      setPayrollErrorDetails(message);
      toast.error(`Payroll Summary CSV to JSON migration failed: ${message}`);
      setPayrollProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, payrollMigrationStatus]);

  const handleRoleCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (roleMigrationStatus === "running") {
      toast.info("Roles CSV to JSON migration is already in progress.");
      return;
    }

    setRoleMigrationStatus("running");
    setRoleProgressMessages(["Starting Roles CSV to JSON migration..."]);
    setRoleErrorDetails(null);

    try {
      await RoleModelImpl.migrateCsvToJson(dbPath, (message: string) => {
        setRoleProgressMessages((prev) => [...prev, message]);
      });
      setRoleMigrationStatus("success");
      toast.success("Roles CSV to JSON migration completed successfully!");
      setRoleProgressMessages((prev) => [
        ...prev,
        "Roles CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRoleMigrationStatus("error");
      setRoleErrorDetails(message);
      toast.error(`Roles CSV to JSON migration failed: ${message}`);
      setRoleProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, roleMigrationStatus]);

  const handleSettingsCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (settingsMigrationStatus === "running") {
      toast.info("Settings CSV to JSON migration is already in progress.");
      return;
    }

    setSettingsMigrationStatus("running");
    setSettingsProgressMessages(["Starting Settings CSV to JSON migration..."]);
    setSettingsErrorDetails(null);

    try {
      await AttendanceSettingsModel.migrateCsvToJson(
        dbPath,
        (message: string) => {
          setSettingsProgressMessages((prev) => [...prev, message]);
        }
      );
      setSettingsMigrationStatus("success");
      toast.success("Settings CSV to JSON migration completed successfully!");
      setSettingsProgressMessages((prev) => [
        ...prev,
        "Settings CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSettingsMigrationStatus("error");
      setSettingsErrorDetails(message);
      toast.error(`Settings CSV to JSON migration failed: ${message}`);
      setSettingsProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, settingsMigrationStatus]);

  const handleShortsCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (shortsMigrationStatus === "running") {
      toast.info("Shorts CSV to JSON migration is already in progress.");
      return;
    }

    setShortsMigrationStatus("running");
    setShortsProgressMessages(["Starting Shorts CSV to JSON migration..."]);
    setShortsErrorDetails(null);

    try {
      await ShortModel.migrateCsvToJson(dbPath, (message: string) => {
        setShortsProgressMessages((prev) => [...prev, message]);
      });
      setShortsMigrationStatus("success");
      toast.success("Shorts CSV to JSON migration completed successfully!");
      setShortsProgressMessages((prev) => [
        ...prev,
        "Shorts CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setShortsMigrationStatus("error");
      setShortsErrorDetails(message);
      toast.error(`Shorts CSV to JSON migration failed: ${message}`);
      setShortsProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, shortsMigrationStatus]);

  const handleCashAdvanceCsvToJsonMigration = useCallback(async () => {
    if (!dbPath) {
      toast.error("Database path is not set. Please configure it first.");
      return;
    }
    if (cashAdvanceMigrationStatus === "running") {
      toast.info("Cash Advance CSV to JSON migration is already in progress.");
      return;
    }

    setCashAdvanceMigrationStatus("running");
    setCashAdvanceProgressMessages(["Starting Cash Advance CSV to JSON migration..."]);
    setCashAdvanceErrorDetails(null);

    try {
      await migrateCashAdvanceCsvToJson(dbPath, (message) => {
        setCashAdvanceProgressMessages((prev) => [...prev, message]);
      });
      setCashAdvanceMigrationStatus("success");
      toast.success("Cash Advance CSV to JSON migration completed successfully!");
      setCashAdvanceProgressMessages((prev) => [
        ...prev,
        "Cash Advance CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCashAdvanceMigrationStatus("error");
      setCashAdvanceErrorDetails(message);
      toast.error(`Cash Advance CSV to JSON migration failed: ${message}`);
      setCashAdvanceProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, cashAdvanceMigrationStatus]);

  const clearAlternativesProgressMessages = useCallback(() => {
    setProgressMessages([]);
  }, []);

  const clearJsonProgressMessages = useCallback(() => {
    setJsonProgressMessages([]);
  }, []);

  const clearCompensationProgressMessages = useCallback(() => {
    setCompensationProgressMessages([]);
  }, []);

  const clearEmployeeProgressMessages = useCallback(() => {
    setEmployeeProgressMessages([]);
  }, []);

  const clearHolidayProgressMessages = useCallback(() => {
    setHolidayProgressMessages([]);
  }, []);

  const clearLeaveProgressMessages = useCallback(() => {
    setLeaveProgressMessages([]);
  }, []);

  const clearLoanProgressMessages = useCallback(() => {
    setLoanProgressMessages([]);
  }, []);

  const clearMissingTimeProgressMessages = useCallback(() => {
    setMissingTimeProgressMessages([]);
  }, []);

  const clearPayrollProgressMessages = useCallback(() => {
    setPayrollProgressMessages([]);
  }, []);

  const clearRoleProgressMessages = useCallback(() => {
    setRoleProgressMessages([]);
  }, []);

  const clearSettingsProgressMessages = useCallback(() => {
    setSettingsProgressMessages([]);
  }, []);

  const clearShortsProgressMessages = useCallback(() => {
    setShortsProgressMessages([]);
  }, []);

  const clearCashAdvanceProgressMessages = useCallback(() => {
    setCashAdvanceProgressMessages([]);
  }, []);

  // Function to check if any migration logs should be shown
  const shouldShowMigrationLogs = () =>
    jsonMigrationStatus !== "idle" ||
    compensationMigrationStatus !== "idle" ||
    holidayMigrationStatus !== "idle" ||
    employeeMigrationStatus !== "idle" ||
    leaveMigrationStatus !== "idle" ||
    loanMigrationStatus !== "idle" ||
    cashAdvanceMigrationStatus !== "idle" ||
    missingTimeMigrationStatus !== "idle" ||
    payrollMigrationStatus !== "idle" ||
    roleMigrationStatus !== "idle" ||
    settingsMigrationStatus !== "idle" ||
    shortsMigrationStatus !== "idle" ||
    jsonProgressMessages.length > 0 ||
    compensationProgressMessages.length > 0 ||
    holidayProgressMessages.length > 0 ||
    employeeProgressMessages.length > 0 ||
    leaveProgressMessages.length > 0 ||
    loanProgressMessages.length > 0 ||
    cashAdvanceProgressMessages.length > 0 ||
    missingTimeProgressMessages.length > 0 ||
    payrollProgressMessages.length > 0 ||
    roleProgressMessages.length > 0 ||
    settingsProgressMessages.length > 0 ||
    shortsProgressMessages.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column - Attendance Alternatives Migration */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <IoSyncOutline className="w-5 h-5 text-blue-600" />
          Attendance Data Migration
        </h3>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 text-sm text-yellow-800">
          <p>
            <span className="font-medium">Warning:</span> This process will
            migrate alternative time data from old CSV columns (if they exist)
            to a central `alternatives.json` file for each employee and then
            remove the old columns from the CSV files. It's recommended to back
            up your database folder before running this migration.
          </p>
          <p className="mt-2">
            This migration only needs to be run{" "}
            <span className="font-bold">once</span> per database.
          </p>
        </div>

        <button
          onClick={handleMigration}
          disabled={status === "running"}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow
                ${status === "running"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
            }
              `}
        >
          {status === "running" ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Migrating...
            </>
          ) : (
            <>
              <IoSyncOutline className="w-5 h-5" />
              Run Attendance Alternatives Migration
            </>
          )}
        </button>

        {(status === "running" ||
          status === "success" ||
          status === "error") && (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50 max-h-60 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-gray-700">Migration Log:</h4>
                <button
                  onClick={clearAlternativesProgressMessages}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                  title="Clear log"
                >
                  <IoTrashOutline className="w-4 h-4" />
                </button>
              </div>
              <ul className="space-y-1 text-xs text-gray-600">
                {progressMessages.map((msg, index) => (
                  <li key={index} className="font-mono">
                    {msg}
                  </li>
                ))}
              </ul>
              {status === "success" && (
                <div className="mt-3 flex items-center gap-2 text-green-600">
                  <IoCheckmarkCircleOutline className="w-5 h-5" />
                  <span className="font-medium">Migration Successful</span>
                </div>
              )}
              {status === "error" && errorDetails && (
                <div className="mt-3 flex items-center gap-2 text-red-600">
                  <IoAlertCircleOutline className="w-5 h-5" />
                  <span className="font-medium">
                    Migration Failed: {errorDetails}
                  </span>
                </div>
              )}
            </div>
          )}
      </div>

      {/* Right Column - CSV to JSON Migrations */}
      <div className="space-y-6">
        {/* CSV to JSON Migration Section */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <IoSwapHorizontalOutline className="w-5 h-5 text-indigo-600" />
            CSV to JSON Migration
          </h3>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-sm text-blue-800">
            <p>
              <span className="font-medium">Information:</span> This process
              will convert your data CSV files to the new JSON format,
              optimizing data storage and preparing for Firebase integration.
              Both formats will be maintained during the transition.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Attendance CSV to JSON Button */}
            <MigrationButton
              onClick={handleCsvToJsonMigration}
              isRunning={jsonMigrationStatus === "running"}
              icon={<IoSwapHorizontalOutline className="w-5 h-5" />}
              label="Convert Attendance CSV to JSON"
              runningLabel="Converting Attendance to JSON..."
              colorClass="bg-indigo-600 hover:bg-indigo-700"
              ringColorClass="focus:ring-indigo-500"
              className=""
            />

            {/* Compensation CSV to JSON Button */}
            <MigrationButton
              onClick={handleCompensationCsvToJsonMigration}
              isRunning={compensationMigrationStatus === "running"}
              icon={<IoServerOutline className="w-5 h-5" />}
              label="Convert Compensation CSV to JSON"
              runningLabel="Converting Compensation to JSON..."
              colorClass="bg-purple-600 hover:bg-purple-700"
              ringColorClass="focus:ring-purple-500"
              className=""
            />

            {/* Holiday CSV to JSON Button */}
            <MigrationButton
              onClick={handleHolidayCsvToJsonMigration}
              isRunning={holidayMigrationStatus === "running"}
              icon={<IoCalendarOutline className="w-5 h-5" />}
              label="Convert Holiday CSV to JSON"
              runningLabel="Converting Holidays to JSON..."
              colorClass="bg-yellow-600 hover:bg-yellow-700"
              ringColorClass="focus:ring-yellow-500"
              className=""
            />

            {/* Leave CSV to JSON Button */}
            <MigrationButton
              onClick={handleLeaveCsvToJsonMigration}
              isRunning={leaveMigrationStatus === "running"}
              icon={<IoSwapHorizontalOutline className="w-5 h-5" />}
              label="Convert Leave CSV to JSON"
              runningLabel="Converting Leaves to JSON..."
              colorClass="bg-blue-600 hover:bg-blue-700"
              ringColorClass="focus:ring-blue-500"
              className=""
            />

            {/* Employee CSV to JSON Button */}
            <MigrationButton
              onClick={handleEmployeeCsvToJsonMigration}
              isRunning={employeeMigrationStatus === "running"}
              icon={<IoPeopleOutline className="w-5 h-5" />}
              label="Convert Employee CSV to JSON"
              runningLabel="Converting Employees to JSON..."
              colorClass="bg-green-600 hover:bg-green-700"
              ringColorClass="focus:ring-green-500"
              className=""
            />

            {/* Loan CSV to JSON Button */}
            <MigrationButton
              onClick={handleLoanCsvToJsonMigration}
              isRunning={loanMigrationStatus === "running"}
              icon={<IoWalletOutline className="w-5 h-5" />}
              label="Convert Loan CSV to JSON"
              runningLabel="Converting Loans to JSON..."
              colorClass="bg-purple-500 hover:bg-purple-600"
              ringColorClass="focus:ring-purple-400"
              className=""
            />

            {/* Missing Time Logs CSV to JSON Button */}
            <MigrationButton
              onClick={handleMissingTimeCsvToJsonMigration}
              isRunning={missingTimeMigrationStatus === "running"}
              icon={<IoWarningOutline className="w-5 h-5" />}
              label="Convert Missing Time CSV to JSON"
              runningLabel="Converting Missing Time Logs..."
              colorClass="bg-orange-500 hover:bg-orange-600"
              ringColorClass="focus:ring-orange-400"
              className=""
            />

            {/* Payroll Summary CSV to JSON Button */}
            <MigrationButton
              onClick={handlePayrollCsvToJsonMigration}
              isRunning={payrollMigrationStatus === "running"}
              icon={<IoDocumentTextOutline className="w-5 h-5" />}
              label="Convert Payroll CSV to JSON"
              runningLabel="Converting Payroll Summaries..."
              colorClass="bg-teal-600 hover:bg-teal-700"
              ringColorClass="focus:ring-teal-500"
              className=""
            />

            {/* Roles CSV to JSON Button */}
            <MigrationButton
              onClick={handleRoleCsvToJsonMigration}
              isRunning={roleMigrationStatus === "running"}
              icon={<IoKeyOutline className="w-5 h-5" />}
              label="Convert Roles CSV to JSON"
              runningLabel="Converting Roles..."
              colorClass="bg-lime-600 hover:bg-lime-700"
              ringColorClass="focus:ring-lime-500"
              className=""
            />

            {/* Settings CSV to JSON Button */}
            <MigrationButton
              onClick={handleSettingsCsvToJsonMigration}
              isRunning={settingsMigrationStatus === "running"}
              icon={<IoSettingsOutline className="w-5 h-5" />}
              label="Convert Settings CSV to JSON"
              runningLabel="Converting Settings..."
              colorClass="bg-gray-600 hover:bg-gray-700"
              ringColorClass="focus:ring-gray-500"
              className=""
            />

            {/* Shorts CSV to JSON Button */}
            <MigrationButton
              onClick={handleShortsCsvToJsonMigration}
              isRunning={shortsMigrationStatus === "running"}
              icon={<IoRemoveCircleOutline className="w-5 h-5" />}
              label="Convert Shorts CSV to JSON"
              runningLabel="Converting Shorts..."
              colorClass="bg-pink-600 hover:bg-pink-700"
              ringColorClass="focus:ring-pink-500"
              className=""
            />

            {/* Cash Advance CSV to JSON Button */}
            <MigrationButton
              onClick={handleCashAdvanceCsvToJsonMigration}
              isRunning={cashAdvanceMigrationStatus === "running"}
              icon={<IoWalletOutline className="w-5 h-5" />}
              label="Convert Cash Advance CSV to JSON"
              runningLabel="Converting Cash Advances to JSON..."
              colorClass="bg-rose-600 hover:bg-rose-700"
              ringColorClass="focus:ring-rose-500"
              className=""
            />
          </div>

          {/* JSON Migration Logs */}
          {shouldShowMigrationLogs() && (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
              {/* Attendance JSON Migration Log */}
              {(jsonMigrationStatus !== "idle" ||
                jsonProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Attendance JSON Migration Log:"
                    messages={jsonProgressMessages}
                    status={jsonMigrationStatus}
                    errorDetails={jsonErrorDetails}
                    onClear={clearJsonProgressMessages}
                  />
                )}

              {/* Compensation JSON Migration Log */}
              {(compensationMigrationStatus !== "idle" ||
                compensationProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Compensation JSON Migration Log:"
                    messages={compensationProgressMessages}
                    status={compensationMigrationStatus}
                    errorDetails={compensationErrorDetails}
                    onClear={clearCompensationProgressMessages}
                  />
                )}

              {/* Holiday JSON Migration Log */}
              {(holidayMigrationStatus !== "idle" ||
                holidayProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Holiday JSON Migration Log:"
                    messages={holidayProgressMessages}
                    status={holidayMigrationStatus}
                    errorDetails={holidayErrorDetails}
                    onClear={clearHolidayProgressMessages}
                  />
                )}

              {/* Employee JSON Migration Log */}
              {(employeeMigrationStatus !== "idle" ||
                employeeProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Employee JSON Migration Log:"
                    messages={employeeProgressMessages}
                    status={employeeMigrationStatus}
                    errorDetails={employeeErrorDetails}
                    onClear={clearEmployeeProgressMessages}
                  />
                )}

              {/* Leave JSON Migration Log */}
              {(leaveMigrationStatus !== "idle" ||
                leaveProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Leave JSON Migration Log:"
                    messages={leaveProgressMessages}
                    status={leaveMigrationStatus}
                    errorDetails={leaveErrorDetails}
                    onClear={clearLeaveProgressMessages}
                  />
                )}

              {/* Loan JSON Migration Log */}
              {(loanMigrationStatus !== "idle" ||
                loanProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Loan JSON Migration Log:"
                    messages={loanProgressMessages}
                    status={loanMigrationStatus}
                    errorDetails={loanErrorDetails}
                    onClear={clearLoanProgressMessages}
                  />
                )}

              {/* Missing Time JSON Migration Log */}
              {(missingTimeMigrationStatus !== "idle" ||
                missingTimeProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Missing Time JSON Migration Log:"
                    messages={missingTimeProgressMessages}
                    status={missingTimeMigrationStatus}
                    errorDetails={missingTimeErrorDetails}
                    onClear={clearMissingTimeProgressMessages}
                  />
                )}

              {/* Payroll Summary JSON Migration Log */}
              {(payrollMigrationStatus !== "idle" ||
                payrollProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Payroll Summary JSON Migration Log:"
                    messages={payrollProgressMessages}
                    status={payrollMigrationStatus}
                    errorDetails={payrollErrorDetails}
                    onClear={clearPayrollProgressMessages}
                  />
                )}

              {/* Role JSON Migration Log */}
              {(roleMigrationStatus !== "idle" ||
                roleProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Role JSON Migration Log:"
                    messages={roleProgressMessages}
                    status={roleMigrationStatus}
                    errorDetails={roleErrorDetails}
                    onClear={clearRoleProgressMessages}
                  />
                )}

              {/* Settings JSON Migration Log */}
              {(settingsMigrationStatus !== "idle" ||
                settingsProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Settings JSON Migration Log:"
                    messages={settingsProgressMessages}
                    status={settingsMigrationStatus}
                    errorDetails={settingsErrorDetails}
                    onClear={clearSettingsProgressMessages}
                  />
                )}

              {/* Shorts JSON Migration Log */}
              {(shortsMigrationStatus !== "idle" ||
                shortsProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Shorts JSON Migration Log:"
                    messages={shortsProgressMessages}
                    status={shortsMigrationStatus}
                    errorDetails={shortsErrorDetails}
                    onClear={clearShortsProgressMessages}
                  />
                )}

              {/* Cash Advance JSON Migration Log */}
              {(cashAdvanceMigrationStatus !== "idle" ||
                cashAdvanceProgressMessages.length > 0) && (
                  <MigrationLogSection
                    title="Cash Advance JSON Migration Log:"
                    messages={cashAdvanceProgressMessages}
                    status={cashAdvanceMigrationStatus}
                    errorDetails={cashAdvanceErrorDetails}
                    onClear={clearCashAdvanceProgressMessages}
                  />
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataMigrationSettings;
