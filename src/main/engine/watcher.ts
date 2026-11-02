import { type FSWatcher, watch } from 'chokidar'

export interface WatchHandle {
  close(): Promise<void>
}

export interface WatchOptions {
  debounceMs: number
  onChange: () => void
  onError: (error: unknown) => void
}

export function watchSource(path: string, options: WatchOptions): WatchHandle {
  const watcher: FSWatcher = watch(path, {
    ignoreInitial: true,
    persistent: true,
    followSymlinks: true,
    awaitWriteFinish: { stabilityThreshold: 600, pollInterval: 100 },
  })

  let timer: NodeJS.Timeout | undefined

  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      options.onChange()
    }, options.debounceMs)
  }

  watcher.on('change', schedule)
  watcher.on('add', schedule)
  watcher.on('error', options.onError)

  return {
    async close() {
      if (timer) clearTimeout(timer)
      await watcher.close()
    },
  }
}
