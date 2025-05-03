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
} from "react-icons/io5";

interface DataMigrationSettingsProps {
  dbPath: string;
}

type MigrationStatus = "idle" | "running" | "success" | "error";

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
                ${
                  status === "running"
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
        {/* Attendance CSV to JSON */}
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

          {/* Attendance CSV to JSON Button */}
          <button
            onClick={handleCsvToJsonMigration}
            disabled={jsonMigrationStatus === "running"}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 mb-3 w-full border border-transparent rounded-lg text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow
                  ${
                    jsonMigrationStatus === "running"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }
                `}
          >
            {jsonMigrationStatus === "running" ? (
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
                Converting Attendance to JSON...
              </>
            ) : (
              <>
                <IoSwapHorizontalOutline className="w-5 h-5" />
                Convert Attendance CSV to JSON
              </>
            )}
          </button>

          {/* Compensation CSV to JSON Button */}
          <button
            onClick={handleCompensationCsvToJsonMigration}
            disabled={compensationMigrationStatus === "running"}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 w-full border border-transparent rounded-lg text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow mb-3
                  ${
                    compensationMigrationStatus === "running"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-700"
                  }
                `}
          >
            {compensationMigrationStatus === "running" ? (
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
                Converting Compensation to JSON...
              </>
            ) : (
              <>
                <IoServerOutline className="w-5 h-5" />
                Convert Compensation CSV to JSON
              </>
            )}
          </button>

          {/* Employee CSV to JSON Button */}
          <button
            onClick={handleEmployeeCsvToJsonMigration}
            disabled={employeeMigrationStatus === "running"}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 w-full border border-transparent rounded-lg text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow
                  ${
                    employeeMigrationStatus === "running"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }
                `}
          >
            {employeeMigrationStatus === "running" ? (
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
                Converting Employees to JSON...
              </>
            ) : (
              <>
                <IoPeopleOutline className="w-5 h-5" />
                Convert Employee CSV to JSON
              </>
            )}
          </button>

          {/* JSON Migration Logs */}
          {(jsonMigrationStatus === "running" ||
            jsonMigrationStatus === "success" ||
            jsonMigrationStatus === "error" ||
            compensationMigrationStatus === "running" ||
            compensationMigrationStatus === "success" ||
            compensationMigrationStatus === "error" ||
            employeeMigrationStatus === "running" ||
            employeeMigrationStatus === "success" ||
            employeeMigrationStatus === "error") && (
            <div className="mt-6 p-4 border rounded-lg bg-gray-50 max-h-60 overflow-y-auto">
              {/* Attendance JSON Migration Log */}
              {(jsonMigrationStatus === "running" ||
                jsonMigrationStatus === "success" ||
                jsonMigrationStatus === "error") && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-700">
                      Attendance JSON Migration Log:
                    </h4>
                    <button
                      onClick={clearJsonProgressMessages}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Clear log"
                    >
                      <IoTrashOutline className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-xs text-gray-600 mb-3">
                    {jsonProgressMessages.map((msg, index) => (
                      <li key={index} className="font-mono">
                        {msg}
                      </li>
                    ))}
                  </ul>
                  {jsonMigrationStatus === "success" && (
                    <div className="mb-4 flex items-center gap-2 text-green-600">
                      <IoCheckmarkCircleOutline className="w-5 h-5" />
                      <span className="font-medium">
                        Attendance JSON Migration Successful
                      </span>
                    </div>
                  )}
                  {jsonMigrationStatus === "error" && jsonErrorDetails && (
                    <div className="mb-4 flex items-center gap-2 text-red-600">
                      <IoAlertCircleOutline className="w-5 h-5" />
                      <span className="font-medium">
                        Attendance JSON Migration Failed: {jsonErrorDetails}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Compensation JSON Migration Log */}
              {(compensationMigrationStatus === "running" ||
                compensationMigrationStatus === "success" ||
                compensationMigrationStatus === "error") && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-700">
                      Compensation JSON Migration Log:
                    </h4>
                    <button
                      onClick={clearCompensationProgressMessages}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Clear log"
                    >
                      <IoTrashOutline className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {compensationProgressMessages.map((msg, index) => (
                      <li key={index} className="font-mono">
                        {msg}
                      </li>
                    ))}
                  </ul>
                  {compensationMigrationStatus === "success" && (
                    <div className="mt-3 flex items-center gap-2 text-green-600">
                      <IoCheckmarkCircleOutline className="w-5 h-5" />
                      <span className="font-medium">
                        Compensation JSON Migration Successful
                      </span>
                    </div>
                  )}
                  {compensationMigrationStatus === "error" &&
                    compensationErrorDetails && (
                      <div className="mt-3 flex items-center gap-2 text-red-600">
                        <IoAlertCircleOutline className="w-5 h-5" />
                        <span className="font-medium">
                          Compensation JSON Migration Failed:{" "}
                          {compensationErrorDetails}
                        </span>
                      </div>
                    )}
                </>
              )}

              {/* Employee JSON Migration Log */}
              {(employeeMigrationStatus === "running" ||
                employeeMigrationStatus === "success" ||
                employeeMigrationStatus === "error") && (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-gray-700">
                      Employee JSON Migration Log:
                    </h4>
                    <button
                      onClick={clearEmployeeProgressMessages}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Clear log"
                    >
                      <IoTrashOutline className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {employeeProgressMessages.map((msg, index) => (
                      <li key={index} className="font-mono">
                        {msg}
                      </li>
                    ))}
                  </ul>
                  {employeeMigrationStatus === "success" && (
                    <div className="mt-3 flex items-center gap-2 text-green-600">
                      <IoCheckmarkCircleOutline className="w-5 h-5" />
                      <span className="font-medium">
                        Employee JSON Migration Successful
                      </span>
                    </div>
                  )}
                  {employeeMigrationStatus === "error" &&
                    employeeErrorDetails && (
                      <div className="mt-3 flex items-center gap-2 text-red-600">
                        <IoAlertCircleOutline className="w-5 h-5" />
                        <span className="font-medium">
                          Employee JSON Migration Failed: {employeeErrorDetails}
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataMigrationSettings;
