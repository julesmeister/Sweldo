import { PayrollSummary, PDFGeneratorOptions } from "./payroll";

export interface ElectronAPI {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  saveFile(filePath: string, content: string): Promise<string>;
  ensureDir(dirPath: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  openFolderDialog(options?: { defaultPath?: string }): Promise<string | null>;
  getFullPath(relativePath: string): Promise<string>;
  showOpenDialog(options: {
    properties: string[];
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
  openFile(options: {
    properties: string[];
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
  getPath(name: string): Promise<string>;
  openPath(path: string): Promise<void>;
  generatePDF(
    payrollSummaries: PayrollSummary[],
    options: PDFGeneratorOptions
  ): Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    ipc: {
      send(channel: string, ...args: any[]): void;
      on(channel: string, func: (...args: any[]) => void): void;
    };
  }
}
