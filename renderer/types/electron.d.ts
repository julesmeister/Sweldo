export interface IElectronAPI {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  saveFile(filePath: string, content: string): Promise<void>;
  ensureDir(dirPath: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  openFolderDialog(options?: { defaultPath?: string }): Promise<string | null>;
  getFullPath(relativePath: string): Promise<string>;
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
