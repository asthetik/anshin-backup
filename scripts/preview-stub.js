// 预览用的 mock preload API：让真实构建产物在浏览器里能跑起来。
// 只存在于 design/preview-app/，不进应用打包。
;(() => {
  const HOME = '/Users/lin'
  const now = Date.now()
  const hour = 3600000

  let sources = [
    {
      id: 'p1',
      path: HOME + '/Desktop/合同夹/2026租房合同.docx',
      destination: '/Volumes/Kingston/重要备份/2026租房合同.docx',
      createdAt: now - 86400000 * 30,
      lastBackupAt: now - hour * 2,
      lastError: null,
    },
    {
      id: 'p2',
      path: HOME + '/Documents/账目/家庭记账本.xlsx',
      destination: HOME + '/Nutstore/自动备份/家庭记账本.xlsx',
      createdAt: now - 86400000 * 21,
      lastBackupAt: now - hour * 6,
      lastError: null,
    },
    {
      id: 'p3',
      path: HOME + '/Pictures/2026婚礼/婚礼现场照片.raw',
      destination: '/Volumes/Backup/影像/婚礼现场照片.raw',
      createdAt: now - 86400000 * 9,
      lastBackupAt: now - hour * 17,
      lastError: null,
    },
    {
      id: 'p4',
      path: HOME + '/Documents/论文/论文初稿.md',
      destination: HOME + '/Desktop/备份/论文初稿.md',
      createdAt: now - hour * 3,
      lastBackupAt: null,
      lastError: null,
    },
    {
      id: 'p5',
      path: HOME + '/Documents/商务/项目报价单.xlsx',
      destination: '/Volumes/Kingston/重要备份/项目报价单.xlsx',
      createdAt: now - 86400000 * 5,
      lastBackupAt: now - hour * 21,
      lastError: '未检测到移动硬盘「金士顿」',
    },
  ]

  let settings = { language: 'zh', autoStart: true, paused: false }
  const listeners = new Set()

  const emit = (event) => {
    for (const listener of listeners) listener(event)
  }

  const clone = (value) => JSON.parse(JSON.stringify(value))

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  window.anshin = {
    listSources: async () => clone(sources),
    getSettings: async () => clone(settings),
    updateSettings: async (patch) => {
      settings = { ...settings, ...patch }
      if (patch.paused !== undefined) emit({ type: 'state', paused: settings.paused })
      return clone(settings)
    },
    onEvent: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onRequestSettings: () => () => {},

    pickSourceFile: async () => ({
      canceled: false,
      path: HOME + '/Documents/报告/季度总结.docx',
    }),
    suggestDestination: async (sourcePath) => {
      const parts = sourcePath.split('/')
      parts.pop()
      return parts.join('/') + '/' + parts[parts.length - 1]
    },
    chooseDestinationFolder: async (sourcePath) => {
      const name = sourcePath.split('/').pop()
      return HOME + '/Desktop/备份/' + name
    },
    chooseDestinationFile: async (sourcePath) => {
      const name = sourcePath.split('/').pop()
      return HOME + '/Desktop/备份/' + name
    },
    addSource: async (sourcePath, destination) => {
      const source = {
        id: 'p' + Date.now(),
        path: sourcePath,
        destination,
        createdAt: Date.now(),
        lastBackupAt: Date.now(),
        lastError: null,
      }
      sources = [...sources, source]
      emit({ type: 'source-updated', source: clone(source) })
      return clone(source)
    },
    removeSource: async (sourceId) => {
      sources = sources.filter((item) => item.id !== sourceId)
      emit({ type: 'source-removed', sourceId })
    },
    removeMany: async (sourceIds) => {
      for (const id of sourceIds) {
        sources = sources.filter((item) => item.id !== id)
        emit({ type: 'source-removed', sourceId: id })
      }
    },
    backupNow: async (sourceId) => {
      await wait(450)
      const source = sources.find((item) => item.id === sourceId)
      if (!source) return
      source.lastBackupAt = Date.now()
      source.lastError = null
      emit({ type: 'source-updated', source: clone(source) })
    },
    backupMany: async (sourceIds) => {
      await wait(450)
      const succeeded = []
      const failed = []
      for (const id of sourceIds) {
        const source = sources.find((item) => item.id === id)
        if (!source) {
          failed.push(id)
          continue
        }
        // 预览里让 p5 保持“移动硬盘未连接”，用来看部分失败的 toast
        if (source.id === 'p5') {
          failed.push(id)
          continue
        }
        source.lastBackupAt = Date.now()
        source.lastError = null
        succeeded.push(id)
        emit({ type: 'source-updated', source: clone(source) })
      }
      return { succeeded, failed }
    },
    setDestinations: async (sourceIds) => {
      const updated = []
      for (const id of sourceIds) {
        const source = sources.find((item) => item.id === id)
        if (!source) continue
        source.destination = HOME + '/Desktop/批量备份/' + source.path.split('/').pop()
        updated.push(clone(source))
        emit({ type: 'source-updated', source: clone(source) })
      }
      return updated
    },
    updateDestination: async (sourceId) => {
      const source = sources.find((item) => item.id === sourceId)
      if (!source) return null
      source.destination = HOME + '/Desktop/新位置/' + source.path.split('/').pop()
      emit({ type: 'source-updated', source: clone(source) })
      return clone(source)
    },
  }
})()
