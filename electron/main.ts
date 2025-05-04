import { generatePayrollPDF } from "../main/services/pdfGenerator";
import { generatePayrollPDFLandscape } from "../main/services/pdfGeneratorLandscape";
import { generateSchedulePdf } from "./services/schedulePdfGenerator";
import { BrowserWindow, ipcMain, dialog } from "electron";

// Ensure handlers are registered early, ideally before the app is fully ready
// or window creation if they don't depend on the window directly

ipcMain.handle("generate-payroll-pdf", async (_, options) => {
  // Consider adding error handling like in schedule handler
  return generatePayrollPDF(options.payrolls, options);
});

ipcMain.handle("generate-payroll-pdf-landscape", async (_, options) => {
  // Consider adding error handling like in schedule handler
  return generatePayrollPDFLandscape(options.payrolls, options);
});

// --- Ensure this handler is present and correctly placed ---
ipcMain.handle("generate-schedule-pdf", async (event, data) => {
  console.log("[IPC Main] Received generate-schedule-pdf request."); // Added log
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  if (!mainWindow) {
    console.error(
      "[IPC Main] generate-schedule-pdf: Could not find source window."
    );
    throw new Error("Source window not found for PDF generation.");
  }
  try {
    console.log("[IPC Main] Calling generateSchedulePdf service..."); // Added log
    // The service function now handles the save dialog itself
    const filePath = await generateSchedulePdf(data, mainWindow);
    console.log(`[IPC Main] generateSchedulePdf service returned: ${filePath}`); // Added log
    return filePath; // Return null if cancelled, or filePath if saved
  } catch (error) {
    console.error("[IPC Main] Failed to generate schedule PDF:", error);
    // Optionally, show an error dialog to the user
    dialog.showErrorBox(
      "PDF Generation Error",
      "Could not generate the schedule PDF. Please check logs."
    );
    throw error; // Re-throw error to be caught by the renderer's .catch()
  }
});

// --- Make sure other IPC handlers from background.ts are also here if needed ---
// For example:
// ipcMain.handle('app:openPath', async (_, path) => {
//   return shell.openPath(path);
// });

// ... potentially other handlers ...
