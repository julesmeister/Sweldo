import path from "path";
import { app, ipcMain, dialog, protocol, shell } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { ensureDir } from "fs-extra";
import PDFDocument from "pdfkit";
import { generatePayrollPDF } from "./services/pdfGenerator";
import { generatePayrollPDFLandscape } from "./services/pdfGeneratorLandscape";

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

(async () => {
  await app.whenReady();

  // Register protocol for loading local files
  protocol.registerFileProtocol("local-file", (request, callback) => {
    const filePath = request.url.replace("local-file://", "");
    callback({ path: decodeURIComponent(filePath) });
  });

  const mainWindow = createWindow("main", {
    width: 1600,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isProd) {
    await mainWindow.loadURL("app://.");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/`);
    mainWindow.webContents.openDevTools();
  }
})();

app.on("window-all-closed", () => {
  app.quit();
});

// File system operations with security validation
const validatePath = (filePath: string): boolean => {
  // Add path validation logic here if needed
  return true;
};

// File system operations
ipcMain.handle("fs:readFile", async (_event, filePath: string) => {
  try {
    if (!validatePath(filePath)) {
      throw new Error("Invalid file path");
    }
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error("Error reading file:", error);
    throw error;
  }
});

ipcMain.handle(
  "fs:writeFile",
  async (_event, filePath: string, content: string) => {
    try {
      if (!validatePath(filePath)) {
        throw new Error("Invalid file path");
      }
      await fs.writeFile(filePath, content, "utf-8");
    } catch (error) {
      console.error("Error writing file:", error);
      throw error;
    }
  }
);

ipcMain.handle("fs:ensureDir", async (_event, dirPath: string) => {
  try {
    if (!validatePath(dirPath)) {
      throw new Error("Invalid directory path");
    }
    await ensureDir(dirPath);
  } catch (error) {
    console.error("Error ensuring directory exists:", error);
    throw error;
  }
});

ipcMain.handle("fs:fileExists", async (_event, filePath: string) => {
  try {
    if (!validatePath(filePath)) {
      throw new Error("Invalid file path");
    }
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Dialog operations
ipcMain.handle("dialog:openFolder", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  } catch (error) {
    console.error("Error opening folder dialog:", error);
    throw error;
  }
});

ipcMain.handle("dialog:showOpenDialog", async (_event, options) => {
  try {
    const result = await dialog.showOpenDialog(options);
    return result;
  } catch (error) {
    console.error("Error showing open dialog:", error);
    throw error;
  }
});

// Path resolution
ipcMain.handle("fs:getFullPath", async (_event, { relativePath }) => {
  try {
    if (!relativePath) {
      throw new Error("Relative path is required");
    }
    // Get the app's root directory
    const appRoot = app.getAppPath();
    // Resolve the full path
    const fullPath = path.resolve(appRoot, relativePath);
    // Validate the resolved path
    if (!validatePath(fullPath)) {
      throw new Error("Invalid path resolution");
    }
    return fullPath;
  } catch (error) {
    console.error("Error resolving full path:", error);
    throw error;
  }
});

ipcMain.on("message", async (event, arg) => {
  event.reply("message", `${arg} World!`);
});

// Add type definitions
interface PayrollDeductions {
  sss: number;
  philHealth: number;
  pagIbig: number;
  cashAdvanceDeductions: number;
  others: number;
  sssLoan?: number;
  pagibigLoan?: number;
  ca?: number;
  partial?: number;
  totalDeduction: number;
}

interface PayrollSummary {
  employeeName: string;
  startDate: string;
  endDate: string;
  daysWorked: number;
  basicPay: number;
  undertimeDeduction?: number;
  holidayBonus?: number;
  overtime: number;
  grossPay: number;
  netPay: number;
  dailyRate: number;
  deductions: PayrollDeductions;
}

interface PDFGeneratorOptions {
  outputPath: string;
  logoPath?: string;
  companyName: string;
}

// PDF Generation
ipcMain.handle(
  "pdf:generate",
  async (_, payrolls: PayrollSummary[], options: PDFGeneratorOptions) => {
    try {
      const outputPath = await generatePayrollPDF(payrolls, options);
      return outputPath;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    }
  }
);

// Add landscape PDF generation handler
ipcMain.handle(
  "pdf:generateLandscape",
  async (_, payrolls: PayrollSummary[], options: PDFGeneratorOptions) => {
    try {
      const outputPath = await generatePayrollPDFLandscape(payrolls, options);
      return outputPath;
    } catch (error) {
      console.error("Error generating landscape PDF:", error);
      throw error;
    }
  }
);

// App path handlers
ipcMain.handle("app:getPath", (_, name) => {
  return app.getPath(name);
});

ipcMain.handle("app:openPath", async (_, path) => {
  return shell.openPath(path);
});
