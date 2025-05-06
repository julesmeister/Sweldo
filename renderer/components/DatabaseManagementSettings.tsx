"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  IoInformationCircleOutline,
  IoCloudUploadOutline,
  IoCloudDownloadOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { toast } from "sonner";
import { useFirestoreSync } from "../hooks/useFirestoreSync";

interface DatabaseManagementSettingsProps {
  dbPath: string | null;
  setDbPath: (path: string) => Promise<void>;
  currentPath: string | null;
  setCurrentPath: (path: string | null) => void;
  companyName: string | null;
}

const DatabaseManagementSettings: React.FC<DatabaseManagementSettingsProps> = ({
  dbPath,
  setDbPath,
  currentPath,
  setCurrentPath,
  companyName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Log initial prop status for critical items - simplified
  useEffect(() => {
    console.log(
      "[DatabaseManagementSettings] Initial props for sync readiness:",
      {
        dbPathProvided: !!dbPath,
        companyNameProvided: !!companyName,
      }
    );
  }, [dbPath, companyName]);

  const {
    uploadStatus,
    downloadStatus,
    handleUpload,
    handleDownload,
    modelStatuses,
  } = useFirestoreSync({
    // Pass only required identifiers to the hook
    dbPath: dbPath || "",
    companyName: companyName || "",
    // employeeId and year are optional in the hook, not needed here for this component's general sync
  });

  // Log modelStatuses whenever it changes or component re-renders
  useEffect(() => {
    console.log(
      "[DatabaseManagementSettings] modelStatuses updated or component re-rendered:",
      JSON.stringify(modelStatuses)
    );
  }, [modelStatuses]);

  // Log when uploadStatus changes
  useEffect(() => {
    console.log(
      "[DatabaseManagementSettings] uploadStatus changed:",
      uploadStatus
    );
  }, [uploadStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <IoCheckmarkCircleOutline className="w-5 h-5 text-green-500" />;
      case "error":
        return <IoAlertCircleOutline className="w-5 h-5 text-red-500" />;
      case "running":
        return <IoTimeOutline className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <IoTimeOutline className="w-5 h-5 text-gray-400" />;
    }
  };

  const handleBrowseClick = async () => {
    const folderPath = await window.electron.openFolderDialog();
    if (folderPath) {
      try {
        await setDbPath(folderPath);
        setCurrentPath(folderPath);
        const persistedState = localStorage.getItem("settings-storage");
        if (persistedState) {
          const parsed = JSON.parse(persistedState);
          parsed.state.dbPath = folderPath;
          localStorage.setItem("settings-storage", JSON.stringify(parsed));
        } else {
          localStorage.setItem(
            "settings-storage",
            JSON.stringify({
              state: { dbPath: folderPath, logoPath: "" },
              version: 0,
            })
          );
        }
        window.location.reload();
      } catch (error) {
        console.error("Error setting database path:", error);
        toast.error("Failed to set database path. Please try again.");
      }
    }
  };

  // Simplify handlers - remove internal model checks
  const handleUploadToFirestore = () => {
    // const placeholder for removed check
    handleUpload();
  };

  const handleDownloadFromFirestore = () => {
    // const placeholder for removed check
    handleDownload();
  };

  const areSyncPrerequisitesMet = !!dbPath && !!companyName;
  // Remove areModelsAvailableForSync check
  // const areModelsAvailableForSync = !!internalAttendanceModel && !!internalCashAdvanceModel;

  if (!dbPath) {
    // Initial setup view - remains full width
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Initial Database Setup</h2>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 flex items-center gap-2 border border-yellow-300">
          <IoInformationCircleOutline className="w-6 h-6 text-yellow-900" />
          <p className="text-sm text-gray-800 font-light">
            Welcome to Sweldo! Before you can start using the application,
            please select a directory where your database files will be stored.
            A folder named 'SweldoDB' will be created in this location.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={currentPath || ""}
            readOnly
            className="flex-1 p-2 border rounded-md bg-gray-50"
            placeholder="Select database directory..."
          />
          <button
            onClick={handleBrowseClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Browse
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 ${
        window.electron && companyName ? "md:grid-cols-2" : ""
      }
gap-6`}
    >
      {/* Column 1: Database Location */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Database Location</h2>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Important Note:</span> Select the
                directory where your database (CSV/JSON) files will be stored.
                <br />
                <span className="text-xs italic">
                  A folder named 'SweldoDB' will be created here if it doesn't
                  already exist and will contain data files and folders.
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={currentPath || ""}
            readOnly
            className="flex-1 p-2 border rounded-md bg-gray-50"
            placeholder="Select database directory..."
          />
          <input
            ref={fileInputRef}
            type="file"
            {...({ webkitdirectory: "true" } as any)}
            style={{ display: "none" }}
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                const file = files[0];
                console.log(
                  "Selected file:",
                  file.webkitRelativePath || file.path
                );
              }
            }}
          />
          <button
            onClick={handleBrowseClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Change Location
          </button>
        </div>
      </div>

      {/* Column 2: Cloud Sync */}
      {/* Render based only on dbPath and companyName being available */}
      {window.electron && areSyncPrerequisitesMet && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Cloud Sync (Firestore)</h2>
          {!companyName ? (
            // Show message if companyName is missing
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <span className="font-medium">Company Name Required:</span>{" "}
                    To use cloud sync features, please set up your company name
                    in the Company Settings first.
                    <br />
                    <span className="text-xs italic">
                      This ensures your data is properly organized in Firestore.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Company name is present, show the main sync UI
            <>
              {/* Backup & Sync info message */}
              <div className="bg-purple-50 border-l-4 border-purple-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-purple-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-purple-700">
                      <span className="font-medium">Backup & Sync:</span> Upload
                      your local database to Firestore for backup or download to
                      sync data across devices.
                      <br />
                      <span className="text-xs italic">
                        Ensure you have appropriate Firestore setup and
                        permissions.
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Sync Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={handleUploadToFirestore}
                  disabled={uploadStatus === "running"}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 ${
                    uploadStatus === "running"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  } text-white rounded-md transition-colors`}
                >
                  <IoCloudUploadOutline className="w-5 h-5" />
                  {uploadStatus === "running"
                    ? "Uploading..."
                    : "Upload to Cloud"}
                </button>
                <button
                  onClick={handleDownloadFromFirestore}
                  disabled={downloadStatus === "running"}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 ${
                    downloadStatus === "running"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  } text-white rounded-md transition-colors`}
                >
                  <IoCloudDownloadOutline className="w-5 h-5" />
                  {downloadStatus === "running"
                    ? "Downloading..."
                    : "Download from Cloud"}
                </button>
              </div>

              {/* Checklist Progress Display */}
              {(uploadStatus === "running" ||
                downloadStatus === "running" ||
                uploadStatus === "success" ||
                downloadStatus === "success" ||
                uploadStatus === "error" ||
                downloadStatus === "error") && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">
                    {uploadStatus === "running"
                      ? "Uploading to Cloud..."
                      : downloadStatus === "running"
                      ? "Downloading from Cloud..."
                      : uploadStatus === "success" ||
                        downloadStatus === "success"
                      ? "Sync Complete"
                      : "Sync Error"}
                  </div>
                  {Object.keys(modelStatuses).length > 0 ? (
                    <ul className="space-y-3">
                      {Object.entries(modelStatuses).map(
                        ([modelName, status]) => (
                          <li
                            key={modelName}
                            className="flex items-center gap-3"
                          >
                            {getStatusIcon(status.status)}
                            <span className="capitalize font-medium">
                              {modelName}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({status.status})
                            </span>
                            {status.progress.length > 0 && (
                              <span className="ml-2 text-xs text-gray-400">
                                {status.progress[status.progress.length - 1]}
                              </span>
                            )}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    (uploadStatus === "success" ||
                      downloadStatus === "success" ||
                      uploadStatus === "error" ||
                      downloadStatus === "error") && (
                      <p className="text-sm text-gray-600 mt-2">
                        {uploadStatus === "error" || downloadStatus === "error"
                          ? "Sync failed to process model data. Check console logs in useFirestoreSync for errors."
                          : "Sync initiated, but no specific model data was processed. This might happen if models could not be initialized (check logs) or no changes were detected."}
                      </p>
                    )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DatabaseManagementSettings;
