import path from "path";
import { app, ipcMain, dialog, protocol } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { ensureDir } from "fs-extra";
import PDFDocument from "pdfkit";

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
  deductions: PayrollDeductions;
}

interface PDFGeneratorOptions {
  outputPath: string;
  logoPath?: string;
}

// PDF Generation
ipcMain.handle(
  "pdf:generate",
  async (
    _event,
    {
      payrollSummaries,
      options,
    }: { payrollSummaries: PayrollSummary[]; options: PDFGeneratorOptions }
  ) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const outputFileName = `payroll_summaries_${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    const outputFilePath = path.join(options.outputPath, outputFileName);

    // Helper functions
    const formatCurrency = (amount: number) => `Php ${amount.toFixed(2)}`;
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Create write stream
    await ensureDir(options.outputPath);
    const writeStream = createWriteStream(outputFilePath);

    return new Promise<string>((resolve, reject) => {
      // Pipe the PDF to the write stream
      doc.pipe(writeStream);

      // Process each payroll summary
      payrollSummaries.forEach((summary: PayrollSummary, i: number) => {
        // Add a new page for each payroll except the first one
        if (i > 0) {
          doc.addPage();
        }

        // Add logo if provided
        if (options.logoPath) {
          try {
            doc.image(options.logoPath, 50, 45, { width: 50 });
          } catch (error) {
            console.error("Error loading logo:", error);
          }
        }

        // Company header
        doc
          .fontSize(16)
          .text("Pure Care Marketing, Inc.", 110, 50, { align: "left" })
          .fontSize(12)
          .text("Pay Slip", 110, 70)
          .text(
            `${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`,
            110,
            90
          );

        // Employee information
        doc
          .fontSize(10)
          .text("Name Employee:", 50, 120)
          .text(summary.employeeName, 150, 120)
          .text("SSS:", 50, 140);

        // Deductions section
        doc
          .text("Ultime/Tar", 50, 160)
          .text(
            `Php ${summary.undertimeDeduction?.toFixed(2) || "0.00"}`,
            120,
            160
          )
          .text("No. of Days", 200, 160)
          .text(`${summary.daysWorked}`, 270, 160);

        doc
          .text("SSS", 50, 180)
          .text(`Php ${summary.deductions.sss.toFixed(2)}`, 120, 180)
          .text("Rates", 200, 180)
          .text(formatCurrency(summary.basicPay), 270, 180);

        // ... Rest of the PDF generation code ...

        // Total section
        const totalDeductions =
          summary.deductions.sss +
          summary.deductions.philHealth +
          summary.deductions.pagIbig +
          summary.deductions.cashAdvanceDeductions +
          summary.deductions.others;

        doc
          .text("Total Deduction", 50, 340)
          .text(formatCurrency(totalDeductions), 120, 340)
          .text("Gross Amount", 200, 340)
          .text(formatCurrency(summary.grossPay), 270, 340);

        doc
          .text("Net Pay", 200, 360)
          .text(formatCurrency(summary.netPay), 270, 360);

        // Signature section
        doc
          .text("Prepared by:", 50, 400)
          .text("Penelope Sarah Tan", 50, 420)
          .text("Approved by:", 270, 400)
          .text("Ruth Sy Lee", 270, 420);
      });

      // Handle events
      writeStream.on("finish", () => {
        resolve(outputFilePath);
      });

      writeStream.on("error", (error) => {
        reject(error);
      });

      // Finalize the PDF
      doc.end();
    });
  }
);
