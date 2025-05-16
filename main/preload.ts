import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

const handler = {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value);
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
};

// File system operations exposed to renderer
const fileSystem = {
  async readFile(filePath: string): Promise<string> {
    return await ipcRenderer.invoke("fs:readFile", filePath);
  },
  async writeFile(filePath: string, content: string): Promise<void> {
    await ipcRenderer.invoke("fs:writeFile", filePath, content);
  },
  async saveFile(filePath: string, content: string): Promise<void> {
    await ipcRenderer.invoke("fs:saveFile", filePath, content);
  },
  async ensureDir(dirPath: string): Promise<void> {
    await ipcRenderer.invoke("fs:ensureDir", dirPath);
  },
  async fileExists(filePath: string): Promise<boolean> {
    return await ipcRenderer.invoke("fs:fileExists", filePath);
  },
  async openFolderDialog(options?: {
    defaultPath?: string;
  }): Promise<string | null> {
    return await ipcRenderer.invoke("dialog:openFolder", options);
  },
  async getFullPath(relativePath: string): Promise<string> {
    return await ipcRenderer.invoke("fs:getFullPath", { relativePath });
  },
  async showOpenDialog(options: {
    properties: string[];
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{ canceled: boolean; filePaths: string[] }> {
    return await ipcRenderer.invoke("dialog:showOpenDialog", options);
  },
  async generatePDF(
    payrollSummaries: any[],
    options: {
      outputPath: string;
      logoPath?: string;
      companyName: string;
      columnColors?: {
        [key: string]: string;
      };
    }
  ): Promise<string> {
    return await ipcRenderer.invoke("pdf:generate", payrollSummaries, options);
  },
  getPath: (name: string) => ipcRenderer.invoke("app:getPath", name),
  openPath: (path: string) => ipcRenderer.invoke("app:openPath", path),
  loadCssPath: (cssName: string) => ipcRenderer.invoke("load:cssPath", cssName),
};

// Expose the APIs to renderer process
contextBridge.exposeInMainWorld("electron", {
  readFile: (filePath: string) => ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeFile", filePath, content),
  appendFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:appendFile", filePath, content),
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:saveFile", filePath, content),
  ensureDir: (dirPath: string) => ipcRenderer.invoke("fs:ensureDir", dirPath),
  fileExists: (filePath: string) =>
    ipcRenderer.invoke("fs:fileExists", filePath),
  openFolderDialog: (options?: { defaultPath?: string }) =>
    ipcRenderer.invoke("dialog:openFolder", options),
  getFullPath: (relativePath: string) =>
    ipcRenderer.invoke("fs:getFullPath", { relativePath }),
  showOpenDialog: (options: {
    properties: string[];
    filters?: { name: string; extensions: string[] }[];
  }) => ipcRenderer.invoke("dialog:showOpenDialog", options),
  openFile: (filePath: string) => ipcRenderer.invoke("fs:openFile", filePath),
  getPath: (name: string) => ipcRenderer.invoke("app:getPath", name),
  openPath: (path: string) => ipcRenderer.invoke("app:openPath", path),
  generatePDF: (
    payrollSummaries: any[],
    options: {
      outputPath: string;
      logoPath?: string;
      companyName: string;
      columnColors?: {
        [key: string]: string;
      };
    }
  ) => ipcRenderer.invoke("pdf:generate", payrollSummaries, options),
  generatePDFLandscape: (
    payrolls: any[],
    options: {
      outputPath: string;
      logoPath?: string;
      companyName: string;
      columnColors?: {
        [key: string]: string;
      };
    }
  ) => ipcRenderer.invoke("pdf:generateLandscape", payrolls, options),
  generateSchedulePdf: (data: any) =>
    ipcRenderer.invoke("generate-schedule-pdf", data),
  readDir: (dirPath: string) => ipcRenderer.invoke("fs:readdir", dirPath),
  loadCssPath: (cssName: string) => ipcRenderer.invoke("load:cssPath", cssName),
});

export type IpcHandler = typeof handler;
export type FileSystem = typeof fileSystem;
