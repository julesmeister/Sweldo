"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  IoInformationCircleOutline,
  IoCloudUploadOutline,
  IoCloudDownloadOutline,
} from "react-icons/io5";
import { toast } from "sonner";

interface DatabaseManagementSettingsProps {
  dbPath: string | null;
  setDbPath: (path: string) => Promise<void>; // Assuming setDbPath might be async
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

  const handleBrowseClick = async () => {
    const folderPath = await window.electron.openFolderDialog();
    if (folderPath) {
      try {
        await setDbPath(folderPath);
        setCurrentPath(folderPath);
        // Persist path (consider moving this to the store or parent component)
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
        // Reload only after ensuring persistence
        window.location.reload();
      } catch (error) {
        console.error("Error setting database path:", error);
        toast.error("Failed to set database path. Please try again.");
      }
    }
  };

  // Placeholder sync functions
  const handleUploadToFirestore = () => {
    toast.info("Upload to Firestore functionality not yet implemented.");
    // TODO: Implement upload logic
  };

  const handleDownloadFromFirestore = () => {
    toast.info("Download from Firestore functionality not yet implemented.");
    // TODO: Implement download logic
  };

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

  // Regular view with two columns when dbPath is set
  return (
    <div
      className={`grid grid-cols-1 ${
        window.electron && companyName ? "md:grid-cols-2" : ""
      } gap-6`}
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
              // This specific onChange might not be needed if browse button handles it
              const files = e.target.files;
              if (files && files.length > 0) {
                const file = files[0];
                // Logic to extract directory path from file might be complex/unreliable
                // It's usually better to use the directory picker dialog
                console.log(
                  "Selected file:",
                  file.webkitRelativePath || file.path
                );
                // Consider if setCurrentPath should be called here or rely on browse
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

      {/* Column 2: Cloud Sync - Only render if window.electron exists AND companyName is set*/}
      {window.electron && companyName && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Cloud Sync (Firestore)</h2>
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
                    Ensure you have appropriate Firestore setup and permissions.
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={handleUploadToFirestore}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <IoCloudUploadOutline className="w-5 h-5" />
              Upload to Cloud
            </button>
            <button
              onClick={handleDownloadFromFirestore}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <IoCloudDownloadOutline className="w-5 h-5" />
              Download from Cloud
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagementSettings;
