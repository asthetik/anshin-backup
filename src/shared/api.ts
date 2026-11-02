import type { BackupResult, EngineEvent, PickedSource, Settings, Source } from './types'

export interface AnshinApi {
  listSources(): Promise<Source[]>
  pickSourceFile(): Promise<PickedSource>
  suggestDestination(sourcePath: string): Promise<string>
  chooseDestinationFolder(sourcePath: string, currentDestination: string): Promise<string | null>
  chooseDestinationFile(sourcePath: string, currentDestination: string): Promise<string | null>
  addSource(sourcePath: string, destination: string): Promise<Source>
  removeSource(sourceId: string): Promise<void>
  backupNow(sourceId: string): Promise<void>
  backupMany(sourceIds: string[]): Promise<BackupResult>
  removeMany(sourceIds: string[]): Promise<void>
  setDestinations(sourceIds: string[]): Promise<Source[]>
  updateDestination(sourceId: string): Promise<Source | null>
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  onEvent(listener: (event: EngineEvent) => void): () => void
  onRequestSettings(listener: () => void): () => void
}
