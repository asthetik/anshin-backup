export const IPC = {
  listSources: 'sources:list',
  pickSourceFile: 'sources:pick-file',
  suggestDestination: 'sources:suggest-destination',
  chooseDestinationFolder: 'sources:choose-folder',
  chooseDestinationFile: 'sources:choose-file',
  addSource: 'sources:add',
  removeSource: 'sources:remove',
  backupNow: 'sources:backup-now',
  backupMany: 'sources:backup-many',
  removeMany: 'sources:remove-many',
  setDestinations: 'sources:set-destinations',
  updateDestination: 'sources:update-destination',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  engineEvent: 'engine:event',
  requestSettings: 'ui:request-settings',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
