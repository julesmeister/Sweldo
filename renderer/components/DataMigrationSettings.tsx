"use client";
import React, { useState, useCallback } from "react";
import { migrateAttendanceAlternatives } from "@/renderer/model/attendance_old";
import { migrateCsvToJson } from "@/renderer/model/migration";
import { toast } from "sonner";
import {
  IoSyncOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoSwapHorizontalOutline,
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
        console.log("Migration Progress:", message);
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
      console.error("Migration failed:", error);
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
      await migrateCsvToJson(dbPath, (message) => {
        console.log("CSV to JSON Migration Progress:", message);
        setJsonProgressMessages((prev) => [...prev, message]);
      });
      setJsonMigrationStatus("success");
      toast.success("CSV to JSON migration completed successfully!");
      setJsonProgressMessages((prev) => [
        ...prev,
        "CSV to JSON migration completed successfully!",
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("CSV to JSON migration failed:", error);
      setJsonMigrationStatus("error");
      setJsonErrorDetails(message);
      toast.error(`CSV to JSON migration failed: ${message}`);
      setJsonProgressMessages((prev) => [
        ...prev,
        `Migration failed: ${message}`,
      ]);
    }
  }, [dbPath, jsonMigrationStatus]);

  return (
    <div className="space-y-6">
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
            <h4 className="font-medium text-gray-700 mb-2">Migration Log:</h4>
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

      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <IoSwapHorizontalOutline className="w-5 h-5 text-indigo-600" />
          CSV to JSON Migration
        </h3>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-sm text-blue-800">
          <p>
            <span className="font-medium">Information:</span> This process will
            convert your attendance CSV files to the new JSON format, optimizing
            data storage and preparing for Firebase integration. Both formats
            will be maintained during the transition.
          </p>
          <p className="mt-2">
            <span className="font-bold">Important:</span> Make sure to backup
            your database before proceeding. This migration will create new JSON
            files alongside your existing CSV files.
          </p>
        </div>

        <button
          onClick={handleCsvToJsonMigration}
          disabled={jsonMigrationStatus === "running"}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow
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
              Converting to JSON...
            </>
          ) : (
            <>
              <IoSwapHorizontalOutline className="w-5 h-5" />
              Convert Attendance CSV to JSON
            </>
          )}
        </button>

        {(jsonMigrationStatus === "running" ||
          jsonMigrationStatus === "success" ||
          jsonMigrationStatus === "error") && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50 max-h-60 overflow-y-auto">
            <h4 className="font-medium text-gray-700 mb-2">
              JSON Migration Log:
            </h4>
            <ul className="space-y-1 text-xs text-gray-600">
              {jsonProgressMessages.map((msg, index) => (
                <li key={index} className="font-mono">
                  {msg}
                </li>
              ))}
            </ul>
            {jsonMigrationStatus === "success" && (
              <div className="mt-3 flex items-center gap-2 text-green-600">
                <IoCheckmarkCircleOutline className="w-5 h-5" />
                <span className="font-medium">JSON Migration Successful</span>
              </div>
            )}
            {jsonMigrationStatus === "error" && jsonErrorDetails && (
              <div className="mt-3 flex items-center gap-2 text-red-600">
                <IoAlertCircleOutline className="w-5 h-5" />
                <span className="font-medium">
                  JSON Migration Failed: {jsonErrorDetails}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataMigrationSettings;
