import { IpcHandler, FileSystem } from "../main/preload";

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

interface IpcRenderer {
  send(channel: string, ...args: any[]): void;
  on(channel: string, func: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    electron: {
      [x: string]: any;
      readFile(filePath: string): Promise<string>;
      writeFile(filePath: string, content: string): Promise<void>;
      saveFile(filePath: string, content: string): Promise<void>;
      ensureDir(dirPath: string): Promise<void>;
      fileExists(filePath: string): Promise<boolean>;
      openFolderDialog(options?: {
        defaultPath?: string;
      }): Promise<string | null>;
      getFullPath(relativePath: string): Promise<string>;
      showOpenDialog(options: {
        properties: string[];
        filters?: { name: string; extensions: string[] }[];
      }): Promise<{ canceled: boolean; filePaths: string[] }>;
      generatePDF(
        payrollSummaries: PayrollSummary[],
        options: PDFGeneratorOptions
      ): Promise<string>;
    };
    ipc: IpcRenderer;
  }
}
