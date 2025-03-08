import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const handler = {
  send(channel: string, value: unknown) {
    ipcRenderer.send(channel, value)
  },
  on(channel: string, callback: (...args: unknown[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
}

// File system operations exposed to renderer
const fileSystem = {
  async readFile(filePath: string): Promise<string> {
    return await ipcRenderer.invoke('fs:readFile', filePath)
  },
  async writeFile(filePath: string, content: string): Promise<void> {
    await ipcRenderer.invoke('fs:writeFile', filePath, content)
  },
  async saveFile(filePath: string, content: string): Promise<void> {
    await ipcRenderer.invoke('fs:saveFile', filePath, content)
  },
  async ensureDir(dirPath: string): Promise<void> {
    await ipcRenderer.invoke('fs:ensureDir', dirPath)
  },
  async fileExists(filePath: string): Promise<boolean> {
    return await ipcRenderer.invoke('fs:fileExists', filePath)
  },
  async openFolderDialog(options?: { defaultPath?: string }): Promise<string | null> {
    return await ipcRenderer.invoke('dialog:openFolder', options)
  },
  async getFullPath(relativePath: string): Promise<string> {
    return await ipcRenderer.invoke('fs:getFullPath', { relativePath })
  },
  async showOpenDialog(options: { properties: string[], filters?: { name: string, extensions: string[] }[] }): Promise<{ canceled: boolean, filePaths: string[] }> {
    return await ipcRenderer.invoke('dialog:showOpenDialog', options)
  }
}

// Expose the APIs to renderer process
contextBridge.exposeInMainWorld('ipc', handler)
contextBridge.exposeInMainWorld('electron', fileSystem)

export type IpcHandler = typeof handler
export type FileSystem = typeof fileSystem
