import path from "path";
import { app, ipcMain, dialog, protocol, shell, BrowserWindow } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
import fs from "fs/promises";
import { createWriteStream, existsSync, copyFileSync, mkdirSync } from "fs";
import { ensureDir, pathExists, copy } from "fs-extra";
import PDFDocument from "pdfkit";
import { generatePayrollPDF } from "./services/pdfGenerator";
import { generatePayrollPDFLandscape } from "./services/pdfGeneratorLandscape";
import { generateSchedulePdf } from "./services/schedulePdfGenerator";

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

// Function to ensure CSS files are available in production
async function ensureCssAvailable() {
  if (!isProd) return; // Only needed in production

  console.log("Starting CSS file verification for production build...");

  const cssFiles = ["tailwind-web.css", "globals.css"];
  const targetDirs = [
    path.join(app.getAppPath(), "app", "static", "css"),
    path.join(app.getAppPath(), "app", "styles"),
    path.join(app.getAppPath(), "resources", "css"),
  ];

  console.log("App path:", app.getAppPath());
  console.log("Target directories:", targetDirs);

  for (const cssFileName of cssFiles) {
    // Check source files that might contain our CSS
    const possibleSources = [
      path.join(app.getAppPath(), "renderer", "public", "styles", cssFileName),
      path.join(app.getAppPath(), "renderer", "styles", cssFileName),
      path.join(app.getAppPath(), "resources", "css", cssFileName),
      path.join(app.getAppPath(), "app", "static", "css", cssFileName),
      path.join(app.getAppPath(), "app", "styles", cssFileName), // Add this explicit path
    ];

    console.log(
      `Checking possible sources for ${cssFileName}:`,
      possibleSources
    );

    // Find first available source
    let sourceCssPath = null;
    for (const source of possibleSources) {
      try {
        if (await pathExists(source)) {
          sourceCssPath = source;
          console.log(`Found CSS source at: ${sourceCssPath}`);
          break;
        }
      } catch (err) {
        console.error(`Error checking path ${source}:`, err);
      }
    }

    if (!sourceCssPath) {
      console.error(`No CSS source file found for ${cssFileName}!`);
      continue;
    }

    // Copy to all target directories
    for (const dir of targetDirs) {
      try {
        if (!(await pathExists(dir))) {
          await ensureDir(dir);
          console.log(`Created directory: ${dir}`);
        }
        const targetPath = path.join(dir, cssFileName);
        await copy(sourceCssPath, targetPath, { overwrite: true });
        console.log(`Copied CSS to: ${targetPath}`);
      } catch (err) {
        console.error(`Failed to copy CSS to ${dir}:`, err);
      }
    }
  }

  console.log("CSS verification and copying completed.");
}

(async () => {
  await app.whenReady();

  // Ensure CSS files are available
  await ensureCssAvailable();

  // Register protocol for loading local files
  protocol.registerFileProtocol("local-file", (request, callback) => {
    const filePath = request.url.replace("local-file://", "");
    callback({ path: decodeURIComponent(filePath) });
  });

  // Register additional protocol for style resources
  protocol.registerFileProtocol("app-resource", (request, callback) => {
    const url = request.url.replace("app-resource://", "");
    const filePath = path.join(app.getAppPath(), url);
    callback({ path: filePath });
  });

  const mainWindow = createWindow("main", {
    width: 1600,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Once ready-to-show, show the window
  mainWindow.once("ready-to-show", () => {
    console.log("[Main] Window ready to show");
    mainWindow.show();
  });

  // Register CSS loading IPC handler
  ipcMain.handle("load:cssPath", async (_event, cssName) => {
    console.log(`[CSS Loader] Attempting to load CSS file: ${cssName}`);

    const possiblePaths = [
      path.join(app.getAppPath(), "app", "static", "css", cssName),
      path.join(app.getAppPath(), "app", "styles", cssName),
      path.join(app.getAppPath(), "resources", "css", cssName),
      path.join(app.getAppPath(), "renderer", "public", "styles", cssName),
      path.join(app.getAppPath(), "renderer", "styles", cssName),
      path.join(
        app.getAppPath(),
        "renderer",
        "public",
        "static",
        "css",
        cssName
      ),
      path.join(app.getAppPath(), "static", "css", cssName),
      path.join(app.getAppPath(), "styles", cssName),
    ];

    console.log(
      `[CSS Loader] Checking ${possiblePaths.length} possible paths for ${cssName}:`
    );

    for (const cssPath of possiblePaths) {
      try {
        console.log(`[CSS Loader] Checking path: ${cssPath}`);
        const exists = await pathExists(cssPath);
        if (exists) {
          console.log(`[CSS Loader] CSS file found at: ${cssPath}`);
          return `app-resource://${path.relative(app.getAppPath(), cssPath)}`;
        }
      } catch (error) {
        console.error(
          `[CSS Loader] Error checking CSS path ${cssPath}:`,
          error
        );
      }
    }

    console.error(
      `[CSS Loader] CSS file '${cssName}' not found in any location!`
    );

    // Emergency CSS copy as last resort
    if (isProd) {
      try {
        console.log(
          `[CSS Loader] Attempting emergency CSS recovery for ${cssName}...`
        );
        // Try to find any source
        const sourceDirs = [
          path.join(app.getAppPath(), "resources", "css"),
          path.join(app.getAppPath(), "renderer", "public", "styles"),
          path.join(app.getAppPath(), "renderer", "styles"),
        ];

        // Target is app/static/css which is commonly used
        const targetDir = path.join(app.getAppPath(), "app", "static", "css");
        await ensureDir(targetDir);

        for (const sourceDir of sourceDirs) {
          const sourcePath = path.join(sourceDir, cssName);
          if (await pathExists(sourcePath)) {
            console.log(`[CSS Loader] Found emergency source at ${sourcePath}`);
            const targetPath = path.join(targetDir, cssName);
            await copy(sourcePath, targetPath, { overwrite: true });
            console.log(
              `[CSS Loader] Emergency copied ${cssName} to ${targetPath}`
            );
            return `app-resource://app/static/css/${cssName}`;
          }
        }
      } catch (err) {
        console.error(`[CSS Loader] Emergency CSS recovery failed:`, err);
      }
    }

    return null;
  });

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

  ipcMain.handle(
    "fs:appendFile",
    async (_event, filePath: string, content: string) => {
      try {
        if (!validatePath(filePath)) {
          throw new Error("Invalid file path");
        }
        // Ensure the directory exists before appending.
        // If ensureDir itself throws, the error will be caught and propagated.
        await ensureDir(path.dirname(filePath));
        await fs.appendFile(filePath, content, "utf-8");
      } catch (error) {
        console.error("Error appending file:", error);
        throw error; // Re-throw the error to be caught by the renderer process
      }
    }
  );

  ipcMain.handle("fs:readdir", async (_event, dirPath: string) => {
    try {
      if (!validatePath(dirPath)) {
        throw new Error("Invalid directory path");
      }
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      // Return entries suitable for the renderer (e.g., names and type)
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
    } catch (error) {
      console.error("Error reading directory:", error);
      throw error; // Re-throw the error
    }
  });

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

  // Add Schedule PDF Handler HERE in background.ts
  ipcMain.handle("generate-schedule-pdf", async (event, data) => {
    console.log("[IPC Background] Received generate-schedule-pdf request."); // Log specific to this file
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    if (!sourceWindow) {
      console.error(
        "[IPC Background] generate-schedule-pdf: Could not find source window."
      );
      throw new Error("Source window not found for PDF generation.");
    }
    try {
      console.log("[IPC Background] Calling generateSchedulePdf service...");
      const filePath = await generateSchedulePdf(data, sourceWindow);
      console.log(
        `[IPC Background] generateSchedulePdf service returned: ${filePath}`
      );
      return filePath;
    } catch (error) {
      console.error("[IPC Background] Failed to generate schedule PDF:", error);
      dialog.showErrorBox(
        "PDF Generation Error",
        "Could not generate the schedule PDF. Please check logs."
      );
      throw error;
    }
  });

  // Load the URL *after* potentially registering handlers
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
  loanDeductions?: number;
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
  dbPath: string; // Path to the database directory
  columnColors?: {
    [key: string]: string; // Key is column id, value is hex color code
  };
  calculationSettings?: {
    grossPay?: {
      formula: string;
      description: string;
    };
    others?: {
      formula: string;
      description: string;
    };
    totalDeductions?: {
      formula: string;
      description: string;
    };
    netPay?: {
      formula: string;
      description: string;
    };
  };
}
