import { dirname } from 'node:path'
import { type BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { IPC } from '../shared/ipc'
import type { PickedSource, Settings } from '../shared/types'
import type { BackupEngine } from './engine'

export interface IpcContext {
  engine: BackupEngine
  getWindow(): BrowserWindow | null
  getSettings(): Settings
  updateSettings(patch: Partial<Settings>): Promise<Settings>
}

async function pickFile(context: IpcContext) {
  const options: OpenDialogOptions = { properties: ['openFile'] }
  const window = context.getWindow()
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)
}

async function pickFolder(context: IpcContext, defaultPath?: string) {
  const options: OpenDialogOptions = {
    properties: ['openDirectory', 'createDirectory'],
  }
  if (defaultPath) options.defaultPath = defaultPath

  const window = context.getWindow()
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)
}

async function pickSavePath(context: IpcContext, defaultPath: string) {
  const window = context.getWindow()
  return window
    ? dialog.showSaveDialog(window, { defaultPath })
    : dialog.showSaveDialog({ defaultPath })
}

export function registerIpc(context: IpcContext): void {
  ipcMain.handle(IPC.listSources, () => context.engine.listSources())

  ipcMain.handle(IPC.pickSourceFile, async (): Promise<PickedSource> => {
    const picked = await pickFile(context)
    const [sourcePath] = picked.filePaths
    if (picked.canceled || !sourcePath) return { canceled: true, path: null }
    return { canceled: false, path: sourcePath }
  })

  ipcMain.handle(IPC.suggestDestination, (_event, sourcePath: string) =>
    context.engine.suggestDestination(sourcePath),
  )

  ipcMain.handle(
    IPC.chooseDestinationFolder,
    async (_event, sourcePath: string, currentDestination: string) => {
      const picked = await pickFolder(context, dirname(currentDestination))
      const [folder] = picked.filePaths
      if (picked.canceled || !folder) return null
      return context.engine.destinationInFolder(sourcePath, folder)
    },
  )

  ipcMain.handle(
    IPC.chooseDestinationFile,
    async (_event, sourcePath: string, currentDestination: string) => {
      const picked = await pickSavePath(context, currentDestination)
      if (picked.canceled || !picked.filePath) return null
      return context.engine.normalizeDestination(sourcePath, picked.filePath)
    },
  )

  ipcMain.handle(IPC.addSource, async (_event, sourcePath: string, destination: string) => {
    return context.engine.addSource(sourcePath, destination)
  })

  ipcMain.handle(IPC.removeSource, async (_event, sourceId: string) => {
    await context.engine.removeSource(sourceId)
  })

  ipcMain.handle(IPC.backupNow, async (_event, sourceId: string) => {
    await context.engine.backupNow(sourceId)
  })

  ipcMain.handle(IPC.updateDestination, async (_event, sourceId: string) => {
    const current = context.engine.getSource(sourceId)
    if (!current) throw new Error(`Unknown source: ${sourceId}`)

    const picked = await pickSavePath(context, current.destination)
    if (picked.canceled || !picked.filePath) return null

    return context.engine.setDestination(sourceId, picked.filePath)
  })

  ipcMain.handle(IPC.backupMany, (_event, sourceIds: string[]) =>
    context.engine.backupMany(sourceIds),
  )

  ipcMain.handle(IPC.removeMany, async (_event, sourceIds: string[]) => {
    await context.engine.removeMany(sourceIds)
  })

  ipcMain.handle(IPC.setDestinations, async (_event, sourceIds: string[]) => {
    const first = sourceIds.length > 0 ? context.engine.getSource(sourceIds[0] ?? '') : null
    const picked = await pickFolder(context, first ? dirname(first.path) : undefined)

    const [directory] = picked.filePaths
    if (picked.canceled || !directory) return []

    return context.engine.setDestinations(sourceIds, directory)
  })

  ipcMain.handle(IPC.getSettings, () => context.getSettings())

  ipcMain.handle(IPC.updateSettings, (_event, patch: Partial<Settings>) =>
    context.updateSettings(patch),
  )
}
