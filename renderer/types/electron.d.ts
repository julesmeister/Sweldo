import { PayrollSummary } from "@/renderer/types/payroll";
import { PDFOptions as PDFGeneratorOptions } from "@/renderer/utils/pdfGenerator";

export interface IElectronAPI {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  saveFile(filePath: string, content: string): Promise<void>;
  ensureDir(dirPath: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  openFolderDialog(options?: { defaultPath?: string }): Promise<string | null>;
  getFullPath(relativePath: string): Promise<string>;
  showOpenDialog(options: {
    properties: string[];
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
  openFile(filePath: string): Promise<void>;
  getPath(name: string): Promise<string>;
  openPath(path: string): Promise<void>;
  generatePDF(
    payrollSummaries: PayrollSummary[],
    options: PDFGeneratorOptions
  ): Promise<string>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
    ipc: {
      send(channel: string, ...args: any[]): void;
      on(channel: string, func: (...args: any[]) => void): void;
    };
  }
}
