import { contextBridge, ipcRenderer } from 'electron'
import type { AnshinApi } from '../shared/api'
import { IPC } from '../shared/ipc'
import type { EngineEvent, Settings } from '../shared/types'

const api: AnshinApi = {
  listSources: () => ipcRenderer.invoke(IPC.listSources),
  pickSourceFile: () => ipcRenderer.invoke(IPC.pickSourceFile),
  suggestDestination: (sourcePath: string) =>
    ipcRenderer.invoke(IPC.suggestDestination, sourcePath),
  chooseDestinationFolder: (sourcePath: string, currentDestination: string) =>
    ipcRenderer.invoke(IPC.chooseDestinationFolder, sourcePath, currentDestination),
  chooseDestinationFile: (sourcePath: string, currentDestination: string) =>
    ipcRenderer.invoke(IPC.chooseDestinationFile, sourcePath, currentDestination),
  addSource: (sourcePath: string, destination: string) =>
    ipcRenderer.invoke(IPC.addSource, sourcePath, destination),
  removeSource: (sourceId: string) => ipcRenderer.invoke(IPC.removeSource, sourceId),
  backupNow: (sourceId: string) => ipcRenderer.invoke(IPC.backupNow, sourceId),
  backupMany: (sourceIds: string[]) => ipcRenderer.invoke(IPC.backupMany, sourceIds),
  removeMany: (sourceIds: string[]) => ipcRenderer.invoke(IPC.removeMany, sourceIds),
  setDestinations: (sourceIds: string[]) => ipcRenderer.invoke(IPC.setDestinations, sourceIds),
  updateDestination: (sourceId: string) => ipcRenderer.invoke(IPC.updateDestination, sourceId),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch: Partial<Settings>) => ipcRenderer.invoke(IPC.updateSettings, patch),
  onEvent: (listener: (event: EngineEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: EngineEvent): void => {
      listener(payload)
    }
    ipcRenderer.on(IPC.engineEvent, handler)
    return () => {
      ipcRenderer.removeListener(IPC.engineEvent, handler)
    }
  },
  onRequestSettings: (listener: () => void) => {
    const handler = (): void => {
      listener()
    }
    ipcRenderer.on(IPC.requestSettings, handler)
    return () => {
      ipcRenderer.removeListener(IPC.requestSettings, handler)
    }
  },
}

contextBridge.exposeInMainWorld('anshin', api)
