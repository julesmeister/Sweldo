import { IpcHandler, FileSystem } from '../main/preload'

declare global {
  interface Window {
    ipc: IpcHandler
    electron: FileSystem
  }
}
