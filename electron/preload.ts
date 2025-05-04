import { contextBridge, ipcRenderer } from "electron";

// --- Define the ElectronAPI type (ensure this matches your full API) ---
// You might already have a type definition elsewhere, adjust accordingly
export interface IElectronAPI {
  // File system (example)
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  // ... other fs functions

  // Dialogs (example)
  showOpenDialog: (options: any) => Promise<Electron.OpenDialogReturnValue>;
  // ... other dialog functions

  // PDF Generation
  generatePayrollPDF: (payrolls: any[], options: any) => Promise<string | null>;
  generatePayrollPDFLandscape: (
    payrolls: any[],
    options: any
  ) => Promise<string | null>;
  generateSchedulePdf: (data: any) => Promise<string | null>;

  // App/Shell
  openPath: (filePath: string) => Promise<void>; // Adjust return type if needed

  // Add other methods you expose...
}

// --- Context Bridge ---
// Ensure this structure matches your existing preload file
// If you have validChannels, add 'generate-schedule-pdf' there
contextBridge.exposeInMainWorld("electron", {
  // ... your existing exposed functions (readFile, writeFile, etc.)

  // Ensure PDF generators are here
  generatePayrollPDF: (payrolls: any, options: any) =>
    ipcRenderer.invoke("generate-payroll-pdf", payrolls, options),
  generatePayrollPDFLandscape: (options: any) =>
    ipcRenderer.invoke("generate-payroll-pdf-landscape", options),
  generateSchedulePdf: (data: any) =>
    ipcRenderer.invoke("generate-schedule-pdf", data),

  // Ensure App/Shell functions are here
  openPath: (filePath: string) => ipcRenderer.invoke("app:openPath", filePath),

  // ... potentially others like on/once ...
});

// --- Optional: Augment Window interface for TypeScript ---
// This helps TypeScript understand window.electron in the renderer
declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
