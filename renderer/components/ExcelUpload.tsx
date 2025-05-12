"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { ShineBorder } from "@/renderer/components/magicui/shine-border";
import * as XLSX from "xlsx-js-style";
import { Payroll } from "@/renderer/model/payroll";
import { useExcelStore } from "@/renderer/stores/excelStore";
import { toast } from "sonner";
import { useSettingsStore } from "@/renderer/stores/settingsStore";
import { MagicCard } from "@/renderer/components/magicui/magic-card";
import { isWebEnvironment } from "@/renderer/lib/firestoreService";
import DecryptedText from "../styles/DecryptedText/DecryptedText";
type SheetRow = (string | number | null)[];

export function ExcelUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>("");
  const [detailMessage, setDetailMessage] = useState<string>("");
  const [operationComplete, setOperationComplete] = useState(false);
  const [showSuccessState, setShowSuccessState] = useState(false);
  const [missingTimeCount, setMissingTimeCount] = useState({ current: 0, total: 0 });
  const [processedEmployees, setProcessedEmployees] = useState<Set<string>>(new Set());
  const [totalEmployees, setTotalEmployees] = useState<Set<string>>(new Set());
  const { setExcelData } = useExcelStore();
  const { dbPath, companyName } = useSettingsStore();
  const isWeb = isWebEnvironment();

  // Use refs to track the state
  const logsActivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const firebaseLogsActive = useRef<boolean>(false);
  const resetComponentTimeout = useRef<NodeJS.Timeout | null>(null);
  const missingTimeEntryIds = useRef<Set<string>>(new Set());
  const processingStartTime = useRef<number>(0);
  const hasShownCompleteMessage = useRef(false);
  const processingComplete = useRef(false);
  const lastProcessedTime = useRef(Date.now());
  const forceCompletionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Reset the component state completely
  const resetComponent = useCallback(() => {
    setIsProcessing(false);
    setIsUploading(false);
    setUploadProgress(0);
    setProcessingStage("");
    setDetailMessage("");
    setOperationComplete(false);
    setShowSuccessState(false);
    setMissingTimeCount({ current: 0, total: 0 });
    setProcessedEmployees(new Set());
    setTotalEmployees(new Set());
    missingTimeEntryIds.current = new Set();
    processingStartTime.current = 0;
    hasShownCompleteMessage.current = false;
    processingComplete.current = false;
    lastProcessedTime.current = Date.now();
    if (forceCompletionTimeout.current) {
      clearTimeout(forceCompletionTimeout.current);
      forceCompletionTimeout.current = null;
    }
  }, []);

  // Generate an estimated time remaining message
  const getTimeEstimate = useCallback(() => {
    if (processingStartTime.current === 0 || missingTimeCount.current === 0 || missingTimeCount.total === 0) {
      return "";
    }

    const elapsedSeconds = (Date.now() - processingStartTime.current) / 1000;
    const entriesPerSecond = missingTimeCount.current / elapsedSeconds;
    const remainingEntries = missingTimeCount.total - missingTimeCount.current;

    if (entriesPerSecond <= 0 || isNaN(entriesPerSecond)) return "";

    const remainingSeconds = remainingEntries / entriesPerSecond;

    if (remainingSeconds < 10) {
      return "Almost done...";
    } else if (remainingSeconds < 60) {
      return `About ${Math.ceil(remainingSeconds)} seconds remaining`;
    } else {
      const minutes = Math.ceil(remainingSeconds / 60);
      return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
    }
  }, [missingTimeCount]);

  // This useEffect watches console logs by patching the console.log function
  useEffect(() => {
    if (!isWeb || !isProcessing || hasShownCompleteMessage.current) return;

    const originalConsoleLog = console.log;
    let lastEmployeeId = "";
    let lastMissingTimeId = "";
    let consecutiveInactiveCount = 0;
    let noActivityTimer: NodeJS.Timeout | null = null;

    // Start tracking processing time
    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    // Replace console.log to detect Firebase activity and extract detailed info
    console.log = function (...args) {
      if (hasShownCompleteMessage.current) {
        originalConsoleLog.apply(console, args);
        return;
      }

      const message = args.join(' ');

      // Update the last activity timestamp on any log
      lastProcessedTime.current = Date.now();

      // Extract employee data for detailed messages
      const employeeIdMatch = message.match(/employee (\d+)/i);
      const employeeNameMatch = message.match(/employeeName: ['"]([^'"]+)['"]/);

      // Look for initial scan message to detect total employees
      if (message.includes('[Payroll]') && !message.includes('No new attendance')) {
        totalEmployees.forEach(empId => {
          if (!processedEmployees.has(empId)) {
            setTotalEmployees(prev => new Set(prev));
          }
        });
      }

      // Look for mentions of employee processing
      if (employeeIdMatch && employeeIdMatch[1]) {
        const employeeId = employeeIdMatch[1];
        setTotalEmployees(prev => {
          const updated = new Set(prev);
          updated.add(employeeId);
          return updated;
        });

        // Track processed employees (if we've seen their data in the logs)
        if (message.includes('No new attendance entries') || message.includes('existing data preserved')) {
          setProcessedEmployees(prev => {
            const updated = new Set(prev);
            updated.add(employeeId);
            return updated;
          });
        }
      }

      // Extract missing time log entry details
      const missingTimeMatch = message.includes('Missing time log');
      const missingTimeIdMatch = message.match(/missing_time_(\w+)/);
      const isSkipping = message.includes('skipping');

      if (missingTimeMatch && missingTimeIdMatch && missingTimeIdMatch[1]) {
        const missingId = missingTimeIdMatch[1];

        // Only count unique missing time logs
        if (!missingTimeEntryIds.current.has(missingId)) {
          missingTimeEntryIds.current.add(missingId);

          // Count all entries for the total
          setMissingTimeCount(prev => ({
            ...prev,
            total: missingTimeEntryIds.current.size
          }));

          // For entries being skipped, count them immediately as "processed"
          if (isSkipping) {
            setMissingTimeCount(prev => ({
              ...prev,
              current: Math.min(prev.total, prev.current + 1)
            }));
          }
        }

        // If we're processing this entry now (not skipping), update detail message differently
        if (missingId !== lastMissingTimeId) {
          lastMissingTimeId = missingId;

          // Only count non-skipped entries separately
          if (!isSkipping) {
            setMissingTimeCount(prev => ({
              ...prev,
              current: Math.min(prev.total, prev.current + 1)
            }));
          }
        }
      }

      // Activity detected?
      let isMeaningfulActivity = false;
      if (message.includes('Saving') || message.includes('Updating') || (missingTimeMatch && !isSkipping)) {
        isMeaningfulActivity = true;
      }
      if (employeeIdMatch && !message.includes('No new attendance entries') && !message.includes('existing data preserved') && !missingTimeMatch) {
        isMeaningfulActivity = true;
      }

      // Successfully saved documents is also a meaningful activity
      if (message.includes('Successfully saved document') || message.includes('Successfully saved')) {
        isMeaningfulActivity = true;
      }

      if (isMeaningfulActivity) {
        firebaseLogsActive.current = true;
        consecutiveInactiveCount = 0;

        // Update detail message with employee info
        if (employeeIdMatch && employeeIdMatch[1]) {
          const employeeId = employeeIdMatch[1];
          if (employeeId !== lastEmployeeId) {
            lastEmployeeId = employeeId;
            const employeeName = employeeNameMatch ? employeeNameMatch[1] : "";
            const displayName = employeeName ? ` (${employeeName})` : "";

            if (processedEmployees.size > 0 && totalEmployees.size > 0) {
              setDetailMessage(`Processing employee ${employeeId}${displayName}... (${processedEmployees.size}/${totalEmployees.size})`);
            } else {
              setDetailMessage(`Processing data for employee ${employeeId}${displayName}...`);
            }

            if (operationComplete) {
              // If we thought we were done but found more activity
              setOperationComplete(false);
              setIsUploading(true);
              setUploadProgress(95);
            }
          }
        } else if (missingTimeMatch && !isSkipping) {
          if (missingTimeCount.total > 0) {
            if (message.includes('skipping')) {
              setDetailMessage(`Skipping existing time entry ${missingTimeCount.current}/${missingTimeCount.total}`);
            } else {
              setDetailMessage(`Processing missing time entry ${missingTimeCount.current}/${missingTimeCount.total}`);
            }
          } else {
            setDetailMessage("Handling missing time log entries...");
          }
        }

        // Clear any existing timeouts
        if (logsActivityTimeout.current) {
          clearTimeout(logsActivityTimeout.current);
        }
        if (resetComponentTimeout.current) {
          clearTimeout(resetComponentTimeout.current);
        }
        if (noActivityTimer) {
          clearTimeout(noActivityTimer);
          noActivityTimer = null;
        }

        // Set a new timeout to detect when processing is complete
        logsActivityTimeout.current = setTimeout(() => {
          consecutiveInactiveCount++;

          // Check if all missing time entries have been processed
          const allMissingTimeEntriesProcessed =
            missingTimeCount.current >= missingTimeCount.total &&
            missingTimeCount.total > 0;

          // If all entries are processed or we've checked multiple times with no activity
          if (allMissingTimeEntriesProcessed || consecutiveInactiveCount >= 2) {
            // After 2 consecutive inactivity checks (3 seconds total) or all entries processed
            if (!hasShownCompleteMessage.current) {
              console.log(`[ExcelUpload] ${allMissingTimeEntriesProcessed ? 'All missing time entries processed' : 'No Firebase activity for 3 seconds'}, completing upload`);
              console.log(`[ExcelUpload] Processed ${missingTimeCount.current}/${missingTimeCount.total} missing time entries`);
              console.log(`[ExcelUpload] Processed ${processedEmployees.size}/${totalEmployees.size} employees`);

              hasShownCompleteMessage.current = true;
              firebaseLogsActive.current = false;

              // Show a summary message about what was processed
              let completionMessage = "Upload complete!";
              if (missingTimeCount.total > 0) {
                completionMessage += ` Processed ${missingTimeCount.current} missing time entries.`;
              }
              if (processedEmployees.size > 0) {
                completionMessage += ` Updated ${processedEmployees.size} employees.`;
              }

              setDetailMessage(completionMessage);
              setProcessingStage("All data has been processed successfully");
              setOperationComplete(true);
              setUploadProgress(100);
              setShowSuccessState(true);

              // No longer auto-reset - wait for user confirmation
              if (resetComponentTimeout.current) {
                clearTimeout(resetComponentTimeout.current);
              }
            }
          } else {
            // Check again in 2 seconds
            if (logsActivityTimeout.current) {
              clearTimeout(logsActivityTimeout.current);
            }
            logsActivityTimeout.current = setTimeout(() => {
              console.log(`[ExcelUpload] Inactivity check #${consecutiveInactiveCount + 1}`);
            }, 2000);
          }
        }, 3000);
      } else if (employeeIdMatch && (message.includes('No new attendance entries') || message.includes('existing data preserved'))) {
        // This is an informational log about an employee being done/skipped, update counts but don't reset inactivity for it
        // The processedEmployees set is already updated above for these messages.
        // We can update the detail message to reflect the employee count if it changed.
        if (totalEmployees.size > 0) {
          const employeeName = employeeNameMatch ? ` (${employeeNameMatch[1]})` : "";
          const currentEmpId = employeeIdMatch[1];
          setDetailMessage(`Checking employee ${currentEmpId}${employeeName}... (${processedEmployees.size}/${totalEmployees.size})`);
        }

        // Even though these are not meaningful activities, they indicate we're making progress
        // Set up a shorter no-activity timer to detect completion when we're only seeing these logs
        if (noActivityTimer) clearTimeout(noActivityTimer);
        noActivityTimer = setTimeout(() => {
          // If we've been only seeing "no changes" type logs for a while, we should check if we're done
          if (processedEmployees.size > 0 && totalEmployees.size > 0 &&
            processedEmployees.size >= totalEmployees.size &&
            !hasShownCompleteMessage.current) {
            console.log('[ExcelUpload] All employees have been processed, mostly with no changes needed');

            hasShownCompleteMessage.current = true;
            firebaseLogsActive.current = false;

            let completionMessage = "Upload complete!";
            if (missingTimeCount.total > 0) {
              completionMessage += ` Processed ${missingTimeCount.current} missing time entries.`;
            }
            if (processedEmployees.size > 0) {
              completionMessage += ` Checked ${processedEmployees.size} employees.`;
            }

            setDetailMessage(completionMessage);
            setProcessingStage("All data has been processed successfully");
            setOperationComplete(true);
            setUploadProgress(100);
            setShowSuccessState(true);

            if (logsActivityTimeout.current) clearTimeout(logsActivityTimeout.current);
          }
        }, 5000); // 5 second timeout for only "no changes" type logs

      } else if (missingTimeMatch && isSkipping) {
        if (missingTimeCount.total > 0) {
          setDetailMessage(`Skipping existing time entry ${missingTimeCount.current}/${missingTimeCount.total}`);
        }
      }

      // Always clear and reset the main logsActivityTimeout if there was *any* log that the console override picked up
      // (unless hasShownCompleteMessage is true, handled at the top of console.log)
      if (logsActivityTimeout.current) clearTimeout(logsActivityTimeout.current);
      if (resetComponentTimeout.current) clearTimeout(resetComponentTimeout.current);

      logsActivityTimeout.current = setTimeout(() => {
        if (hasShownCompleteMessage.current) return;

        if (!isMeaningfulActivity) {
          consecutiveInactiveCount++;
        } else {
          consecutiveInactiveCount = 0;
        }

        const allEmployeesProcessed = totalEmployees.size > 0 && processedEmployees.size >= totalEmployees.size;
        const allMissingTimeProcessed = missingTimeCount.total === 0 || missingTimeCount.current >= missingTimeCount.total;

        if ((allEmployeesProcessed && allMissingTimeProcessed) || consecutiveInactiveCount >= 2) {
          if (!hasShownCompleteMessage.current) {
            console.log(`[ExcelUpload] Conditions met for completion: AllEmployees: ${allEmployeesProcessed}, AllMissingTime: ${allMissingTimeProcessed}, InactiveChecks: ${consecutiveInactiveCount}`);
            hasShownCompleteMessage.current = true;
            firebaseLogsActive.current = false;

            let completionMessage = "Upload complete!";
            if (missingTimeCount.total > 0) completionMessage += ` Processed ${missingTimeCount.current} missing time entries.`;
            if (totalEmployees.size > 0) completionMessage += ` Checked ${totalEmployees.size} employees.`;

            setDetailMessage(completionMessage);
            setProcessingStage("All data has been processed successfully");
            setOperationComplete(true);
            setUploadProgress(100);
            setShowSuccessState(true);

            if (logsActivityTimeout.current) clearTimeout(logsActivityTimeout.current);
          }
        } else {
          if (logsActivityTimeout.current) clearTimeout(logsActivityTimeout.current);
          console.log(`[ExcelUpload] Inactivity check #${consecutiveInactiveCount + 1}. AllEmployees: ${allEmployeesProcessed}, AllMissingTime: ${allMissingTimeProcessed}`);
        }
      }, 3000);

      originalConsoleLog.apply(console, args);
    };

    // Restore original console.log when component unmounts or isProcessing changes
    return () => {
      console.log = originalConsoleLog;
      if (logsActivityTimeout.current) {
        clearTimeout(logsActivityTimeout.current);
      }
      if (resetComponentTimeout.current) {
        clearTimeout(resetComponentTimeout.current);
      }
      if (noActivityTimer) {
        clearTimeout(noActivityTimer);
      }
    };
  }, [isProcessing, isWeb, operationComplete, resetComponent, missingTimeCount, processedEmployees, totalEmployees]);

  // Simulated progress effect for web mode
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isUploading && isWeb && !operationComplete) {
      // Start from current progress or reset if needed
      const startingProgress = uploadProgress > 0 && uploadProgress < 95 ? uploadProgress : 0;
      setUploadProgress(startingProgress);

      interval = setInterval(() => {
        setUploadProgress(prev => {
          // If we've reached 95% or operation is complete, stop there
          if (prev >= 95 || operationComplete) {
            return prev;
          }

          // Slow down as we get closer to 95%
          const increment = prev < 50 ? (1 + Math.random() * 2) : // Faster at first
            prev < 80 ? (0.5 + Math.random() * 1) : // Medium in the middle
              (0.1 + Math.random() * 0.4); // Very slow near the end

          const newProgress = prev + increment;
          return newProgress >= 95 ? 95 : newProgress;
        });
      }, 300);
    }

    // If the operation is complete and we're still showing uploading, finish up
    if (operationComplete && isUploading && uploadProgress < 100) {
      setUploadProgress(100);

      // Don't reset uploading state here - let the 3s timer in the console monitor handle it
      // so users can see the completion message
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isUploading, isWeb, operationComplete, uploadProgress]);

  // Add a useEffect to force completion if stuck at 100% progress
  useEffect(() => {
    // If we're at the last employee but not completing...
    if (isProcessing && isWeb && processedEmployees.size > 0 &&
      totalEmployees.size > 0 && processedEmployees.size >= totalEmployees.size &&
      !hasShownCompleteMessage.current) {

      // Set a timer to force completion after a reasonable delay
      if (!forceCompletionTimeout.current) {
        console.log("[ExcelUpload] Setting force completion timer - all employees processed");
        forceCompletionTimeout.current = setTimeout(() => {
          const elapsedSinceLastLog = Date.now() - lastProcessedTime.current;
          console.log(`[ExcelUpload] Force completion check - ${elapsedSinceLastLog}ms since last activity`);

          // Only force if we haven't already completed and some time has passed
          if (!hasShownCompleteMessage.current && elapsedSinceLastLog > 5000) {
            console.log("[ExcelUpload] Forcing completion after employee count reached target");
            hasShownCompleteMessage.current = true;

            let completionMessage = "Upload complete!";
            if (missingTimeCount.total > 0) {
              completionMessage += ` Processed ${missingTimeCount.current} missing time entries.`;
            }
            if (totalEmployees.size > 0) {
              completionMessage += ` Processed ${processedEmployees.size} employees.`;
            }

            setDetailMessage(completionMessage);
            setProcessingStage("All data has been processed successfully");
            setOperationComplete(true);
            setUploadProgress(100);
            setShowSuccessState(true);
          }
        }, 10000); // Force completion 10 seconds after all employees are processed
      }
    } else if (forceCompletionTimeout.current &&
      (!isProcessing || hasShownCompleteMessage.current)) {
      // Clear the timeout if no longer needed
      clearTimeout(forceCompletionTimeout.current);
      forceCompletionTimeout.current = null;
    }

    return () => {
      if (forceCompletionTimeout.current) {
        clearTimeout(forceCompletionTimeout.current);
        forceCompletionTimeout.current = null;
      }
    };
  }, [isProcessing, isWeb, processedEmployees.size, totalEmployees.size, missingTimeCount.current,
    missingTimeCount.total, hasShownCompleteMessage]);

  const processExcelFile = async (file: File) => {
    try {
      // Reset component state
      resetComponent();

      // Start processing
      setIsProcessing(true);
      setError(null);
      setProcessingStage("Reading Excel file...");
      setDetailMessage("Preparing to extract timesheet data");
      processingStartTime.current = Date.now();

      const buffer = await file.arrayBuffer();

      if (buffer.byteLength > 10 * 1024 * 1024) {
        throw new Error(
          "File size too large. Please upload a file smaller than 10MB."
        );
      }

      setProcessingStage("Parsing Excel data...");
      setDetailMessage("Converting Excel format to JSON");
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
        cellNF: false,
        cellText: false,
      });

      const targetSheet = workbook.SheetNames.find((name) => {
        const sheet = workbook.Sheets[name];
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

        if (range.e.r > 10000 || range.e.c > 100) {
          throw new Error("Excel file too complex. Please simplify the data.");
        }

        const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
          header: 1,
          range: 0,
          defval: null,
        });

        const firstRow = rows[0] || [];
        const secondRow = rows[1] || [];

        return (
          (firstRow[0]?.toString() || "").includes(
            "Attendance Record Report"
          ) ||
          (secondRow[0]?.toString() || "").includes("Attendance Record Report")
        );
      });

      if (!targetSheet) {
        throw new Error("No valid attendance record sheet found");
      }

      setProcessingStage("Extracting attendance data...");
      setDetailMessage("Reading employee time entries");
      const sheet = workbook.Sheets[targetSheet];
      const data = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
        header: 1,
        raw: false,
        dateNF: "yyyy-mm-dd",
        defval: null,
      });

      const payroll = new Payroll(
        data,
        file.name.split(".").pop() || "xlsx",
        dbPath
      );

      if (isWeb) {
        setProcessingStage("Uploading to Firestore...");
        setDetailMessage("Starting cloud synchronization");
        setIsUploading(true);
        setUploadProgress(0);

        // Web mode gets data, then we track Firestore logs to determine completion
        const excelData = payroll.getData();
        setExcelData(excelData);

        // Safety timeout
        // This timeout structure is simplified; the main completion is handled by log monitoring
        const safetyTimeoutId = setTimeout(() => {
          if (isUploading && !operationComplete && !hasShownCompleteMessage.current) {
            console.log("[ExcelUpload] Safety timeout reached, attempting to finalize.");
            hasShownCompleteMessage.current = true; // Mark as complete to prevent log monitor interference
            firebaseLogsActive.current = false;
            let completionMessage = "Upload may have finished with some pending operations.";
            if (missingTimeCount.total > 0) completionMessage += ` Processed at least ${missingTimeCount.current} missing time entries.`;
            if (totalEmployees.size > 0) completionMessage += ` Checked at least ${processedEmployees.size} employees.`;
            setDetailMessage(completionMessage);
            setProcessingStage("Processing timed out or completed");
            setOperationComplete(true);
            setUploadProgress(100);
            setShowSuccessState(true);
          }
        }, 120000); // 2 minutes max upload time (increased)
        // Ensure this timeout is also cleared if component unmounts or process completes sooner
        // This is implicitly handled by hasShownCompleteMessage.current check in useEffect cleanup or success path.
      } else {
        // Desktop mode - just get the data
        setProcessingStage("Processing complete!");
        setDetailMessage("Finalizing employee records");
        const excelData = payroll.getData();
        setExcelData(excelData);

        // In desktop mode, we can complete right away
        toast.success("Excel file processed successfully!");

        // Small delay to show completion state before resetting
        setTimeout(() => {
          resetComponent();
        }, 2000);
      }
    } catch (error) {
      console.error("Error processing Excel file:", error);
      const message =
        error instanceof Error ? error.message : "Failed to process Excel file";
      setError(message);
      toast.error("Error processing Excel file: " + message);

      // Reset after error
      setTimeout(() => {
        resetComponent();
      }, 3000);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      await processExcelFile(file);
    },
    [processExcelFile, resetComponent]
  );

  // Show success message when upload is complete
  useEffect(() => {
    if (operationComplete && showSuccessState && !error && isWeb) {
      toast.success("Excel file processed and uploaded successfully!");
    }
  }, [operationComplete, showSuccessState, error, isWeb]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    multiple: false,
    disabled: isProcessing || isUploading,
  });

  // Function to handle the confirmation button click
  const handleConfirmation = useCallback(() => {
    resetComponent();
  }, [resetComponent]);

  return (
    <MagicCard
      className="p-0.5 rounded-lg"
      gradientSize={200}
      gradientColor="#9E7AFF"
      gradientOpacity={0.8}
      gradientFrom="#9E7AFF"
      gradientTo="#FE8BBB"
    >
      <div className="bg-white rounded-lg shadow p-6 relative overflow-hidden">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">
            <DecryptedText text="Upload Timesheet" animateOn="view" revealDirection='start' speed={50} sequential={true} />
          </h2>
          <p className="text-sm text-gray-600">
            Upload your Excel timesheet to process attendance records
            {isWeb && " (Web mode will upload to cloud storage)"}
          </p>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div
            {...getRootProps()}
            className={`
            relative border-2 border-dashed rounded-lg p-8
            ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"}
            ${(isProcessing || isUploading) ? "opacity-90 cursor-not-allowed" : "cursor-pointer"}
            transition-all duration-200
          `}
          >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center justify-center h-full space-y-4">
              {isProcessing || isUploading ? (
                <div className="flex flex-col items-center space-y-6">
                  {/* Pulsating Animation or Success Icon */}
                  <div className="relative w-24 h-24">
                    {showSuccessState ? (
                      <div className="flex items-center justify-center w-full h-full">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-green-100 to-blue-50 rounded-full opacity-30"></div>
                        <svg
                          className="w-16 h-16 text-green-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute aspect-square w-[8rem] rounded-full border-2 border-blue-400 opacity-0 animate-ping-slow-1"></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute aspect-square w-[12rem] rounded-full border-2 border-blue-300 opacity-0 animate-ping-slow-2"></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute aspect-square w-[16rem] rounded-full border border-blue-200 opacity-0 animate-ping-slow-3"></div>
                        </div>

                        <div className="relative z-10 bg-white bg-opacity-70 rounded-full p-4 border border-gray-100 flex items-center justify-center w-full h-full">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-full opacity-50"></div>

                          <svg
                            className="animate-spin h-10 w-10 text-blue-600"
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
                        </div>
                      </>
                    )}
                  </div>

                  {/* Processing Stage Display */}
                  <div className="text-center">
                    <p className="font-medium text-gray-700 mb-1">{processingStage}</p>

                    {isUploading && !showSuccessState && (
                      <div className="w-64 bg-gray-200 rounded-full h-2.5 mt-2 mb-4">
                        <div
                          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    <p className="text-sm text-gray-600">
                      {detailMessage || (isUploading
                        ? "Uploading attendance records to cloud storage..."
                        : "Processing file... This may take a moment.")}
                    </p>

                    {/* Confirmation Button */}
                    {showSuccessState && (
                      <button
                        onClick={handleConfirmation}
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                      >
                        Close
                      </button>
                    )}

                    {isUploading && !detailMessage.includes("complete") && !detailMessage.includes("missing time entry") && !showSuccessState && (
                      <p className="text-xs text-gray-400 mt-2 italic">
                        This may take a while based on file size
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <div className="flex flex-col items-center space-y-2">
                    <span className="text-gray-600">
                      Drag and drop your Excel file here
                    </span>
                    <span className="text-sm text-gray-500">or</span>
                    <span className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                      Browse Files
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MagicCard>
  );
}
