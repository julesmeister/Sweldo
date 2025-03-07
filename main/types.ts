export interface FileSystemAPI {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  saveFile(filePath: string, content: string): Promise<void>;
  ensureDir(dirPath: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
}
