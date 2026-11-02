import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language, Settings, Source } from '../../shared/types'
import { AddDialog } from './components/AddDialog'
import { PauseIcon, PlusIcon, SettingsIcon, ShieldIcon } from './components/icons'
import { SettingsDialog } from './components/SettingsDialog'
import { SourceRow } from './components/SourceRow'
import { Toast, type ToastKind } from './components/Toast'
import { describeError, formatTemplate, t } from './i18n'

const isMac = navigator.userAgent.includes('Macintosh')
const autoStartSupported = true

export default function App() {
  const [sources, setSources] = useState<Source[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<{ sourcePath: string; destination: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; kind: ToastKind; message: string } | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const toastId = useRef(0)
  const freshTimers = useRef(new Map<string, number>())

  const language: Language = settings?.language ?? 'zh'
  const tr = useCallback((key: Parameters<typeof t>[1]) => t(language, key), [language])
  const readError = useCallback(
    (error: unknown) =>
      describeError(language, error instanceof Error ? error.message : String(error)),
    [language],
  )

  useEffect(() => {
    let alive = true

    void Promise.all([window.anshin.listSources(), window.anshin.getSettings()])
      .then(([nextSources, nextSettings]) => {
        if (!alive) return
        setSources(nextSources)
        setSettings(nextSettings)
        setLoaded(true)
      })
      .catch((error: unknown) => {
        if (!alive) return
        setNotice(error instanceof Error ? error.message : String(error))
        setLoaded(true)
      })

    const unsubscribe = window.anshin.onEvent((event) => {
      if (event.type === 'source-updated') {
        setSources((previous) => {
          const index = previous.findIndex((item) => item.id === event.source.id)
          if (index === -1) return [...previous, event.source]
          const next = previous.slice()
          next[index] = event.source
          return next
        })
      } else if (event.type === 'source-removed') {
        setSources((previous) => previous.filter((item) => item.id !== event.sourceId))
      } else if (event.type === 'state') {
        setSettings((previous) => (previous ? { ...previous, paused: event.paused } : previous))
      }
    })

    const unsubscribeSettings = window.anshin.onRequestSettings(() => {
      setSettingsOpen(true)
    })

    return () => {
      alive = false
      unsubscribe()
      unsubscribeSettings()
    }
  }, [])

  useEffect(() => {
    setSelected((previous) => {
      const live = new Set(sources.map((item) => item.id))
      const next = new Set([...previous].filter((id) => live.has(id)))
      return next.size === previous.size ? previous : next
    })
  }, [sources])

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await window.anshin.updateSettings(patch)
    setSettings(next)
  }, [])

  const markBusy = useCallback((ids: string[], value: boolean) => {
    setBusy((previous) => {
      const next = new Set(previous)
      for (const id of ids) {
        if (value) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const showToast = useCallback((kind: ToastKind, message: string) => {
    toastId.current += 1
    setToast({ id: toastId.current, kind, message })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  const flashSources = useCallback((ids: string[]) => {
    setFresh((previous) => {
      const next = new Set(previous)
      for (const id of ids) next.add(id)
      return next
    })

    for (const id of ids) {
      const existing = freshTimers.current.get(id)
      if (existing !== undefined) window.clearTimeout(existing)
      const timer = window.setTimeout(() => {
        freshTimers.current.delete(id)
        setFresh((previous) => {
          if (!previous.has(id)) return previous
          const next = new Set(previous)
          next.delete(id)
          return next
        })
      }, 2800)
      freshTimers.current.set(id, timer)
    }
  }, [])

  useEffect(
    () => () => {
      for (const timer of freshTimers.current.values()) window.clearTimeout(timer)
      freshTimers.current.clear()
    },
    [],
  )

  const handleAdd = useCallback(() => {
    setPending({ sourcePath: '', destination: '' })
  }, [])

  const handlePickSource = useCallback(async () => {
    if (!pending) return
    try {
      const picked = await window.anshin.pickSourceFile()
      if (picked.canceled || !picked.path) return
      setPending({ sourcePath: picked.path, destination: '' })
    } catch (error) {
      setNotice(readError(error))
    }
  }, [pending, readError])

  const handlePickDestination = useCallback(async () => {
    if (!pending?.sourcePath) return
    try {
      const fallback =
        pending.destination || (await window.anshin.suggestDestination(pending.sourcePath))
      const next = await window.anshin.chooseDestinationFile(pending.sourcePath, fallback)
      if (next) setPending({ ...pending, destination: next })
    } catch (error) {
      setNotice(readError(error))
    }
  }, [pending, readError])

  const handleConfirmAdd = useCallback(async () => {
    if (!pending?.sourcePath || !pending.destination) return
    setAdding(true)
    try {
      const source = await window.anshin.addSource(pending.sourcePath, pending.destination)
      setSources((previous) =>
        previous.some((item) => item.id === source.id)
          ? previous.map((item) => (item.id === source.id ? source : item))
          : [...previous, source],
      )
      setPending(null)
      setNotice(null)
    } catch (error) {
      setNotice(readError(error))
    } finally {
      setAdding(false)
    }
  }, [pending, readError])

  const runBackup = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      markBusy(ids, true)
      try {
        const result = await window.anshin.backupMany(ids)
        setNotice(null)

        const ok = result.succeeded.length
        const failed = result.failed.length
        if (ok > 0) flashSources(result.succeeded)

        if (failed === 0) {
          if (ok > 0) {
            showToast(
              'success',
              ok === 1
                ? t(language, 'backupDoneOne')
                : formatTemplate(language, 'backupDone', { n: ok }),
            )
          }
          return
        }

        showToast(
          'error',
          ok > 0
            ? formatTemplate(language, 'backupPartial', { ok, n: failed })
            : failed === 1
              ? t(language, 'backupFailedOne')
              : formatTemplate(language, 'backupFailed', { n: failed }),
        )
      } catch (error) {
        setNotice(readError(error))
      } finally {
        markBusy(ids, false)
      }
    },
    [markBusy, flashSources, showToast, language, readError],
  )

  const handleBackupAll = useCallback(() => {
    void runBackup(sources.map((item) => item.id))
  }, [runBackup, sources])

  const handleBackupSelected = useCallback(() => {
    void runBackup([...selected])
  }, [runBackup, selected])

  const handleChangeDestination = useCallback(
    async (sourceId: string) => {
      try {
        const updated = await window.anshin.updateDestination(sourceId)
        if (updated) {
          setSources((previous) =>
            previous.map((item) => (item.id === updated.id ? updated : item)),
          )
        }
        setNotice(null)
      } catch (error) {
        setNotice(readError(error))
      }
    },
    [readError],
  )

  const handleChangeFolder = useCallback(async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    try {
      const updated = await window.anshin.setDestinations(ids)
      if (updated.length > 0) {
        setSources((previous) =>
          previous.map((item) => updated.find((next) => next.id === item.id) ?? item),
        )
      }
      setNotice(null)
    } catch (error) {
      setNotice(readError(error))
    }
  }, [readError, selected])

  const handleRemove = useCallback(
    async (sourceId: string) => {
      try {
        await window.anshin.removeSource(sourceId)
        setConfirmId(null)
      } catch (error) {
        setNotice(readError(error))
      }
    },
    [readError],
  )

  const handleRemoveSelected = useCallback(async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    try {
      await window.anshin.removeMany(ids)
      setSelected(new Set())
    } catch (error) {
      setNotice(readError(error))
    }
  }, [readError, selected])

  const toggleSelection = useCallback((sourceId: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((previous) =>
      previous.size === sources.length ? new Set() : new Set(sources.map((item) => item.id)),
    )
  }, [sources])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const togglePause = useCallback(async () => {
    if (!settings) return
    await updateSettings({ paused: !settings.paused })
  }, [settings, updateSettings])

  const changeLanguage = useCallback(
    async (nextLanguage: Language) => {
      await updateSettings({ language: nextLanguage })
    },
    [updateSettings],
  )

  const toggleAutoStart = useCallback(async () => {
    if (!settings) return
    await updateSettings({ autoStart: !settings.autoStart })
  }, [settings, updateSettings])

  const moveFocus = useCallback(
    (delta: number) => {
      if (sources.length === 0) return
      const current = focusedId ? sources.findIndex((item) => item.id === focusedId) : -1
      const nextIndex = Math.min(Math.max(current + delta, 0), sources.length - 1)
      const next = sources[nextIndex]
      if (!next) return
      setFocusedId(next.id)
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-source-id="${next.id}"]`)?.focus()
      })
    },
    [focusedId, sources],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false)
          return
        }
        if (pending) {
          event.preventDefault()
          setPending(null)
          return
        }
        setConfirmId(null)
        setSelected(new Set())
        return
      }

      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelected(new Set(sources.map((item) => item.id)))
        return
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        handleBackupAll()
        return
      }

      if (mod && event.key.toLowerCase() === 'l') {
        const target = selected.size === 1 ? [...selected][0] : focusedId
        if (target) {
          event.preventDefault()
          void handleChangeDestination(target)
        }
        return
      }

      if (event.key === 'Enter') {
        if (selected.size > 0) {
          event.preventDefault()
          handleBackupSelected()
        }
        return
      }

      if (event.key === ' ' && focusedId) {
        event.preventDefault()
        toggleSelection(focusedId)
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveFocus(event.key === 'ArrowDown' ? 1 : -1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    settingsOpen,
    pending,
    sources,
    selected,
    focusedId,
    handleBackupAll,
    handleBackupSelected,
    handleChangeDestination,
    moveFocus,
    toggleSelection,
  ])

  const paused = settings?.paused ?? false
  const selectionActive = selected.size > 0

  return (
    <div className="flex h-full flex-col bg-paper">
      <header
        className={`drag-region flex h-14 shrink-0 items-center gap-2 border-b border-line pr-4 ${
          isMac ? 'pl-[100px]' : 'pl-4'
        }`}
      >
        <span className="text-[13px] font-semibold tracking-[0.01em] text-ink">Anshin</span>
        <span className="flex-1" />

        <button
          type="button"
          aria-label={paused ? tr('resume') : tr('runningLabel')}
          title={paused ? tr('resume') : tr('runningLabel')}
          onClick={() => void togglePause()}
          className={`no-drag flex h-7 items-center ${
            paused
              ? 'w-auto gap-1.5 rounded-full bg-[#F3EAD7] px-2.5 text-[12px] text-[#8A6218] hover:bg-[#EFE3CA] hover:text-[#8A6218]'
              : 'w-7 justify-center rounded-[6px] text-ink-2 hover:bg-[#F0F0EC] hover:text-ink'
          }`}
        >
          {paused ? <PauseIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
          {paused ? <span>{tr('pausedLabel')}</span> : null}
        </button>

        <button
          type="button"
          aria-label={tr('addFile')}
          title={tr('addFile')}
          onClick={() => void handleAdd()}
          className="no-drag grid h-7 w-7 place-items-center rounded-[6px] text-ink-2 hover:bg-[#F0F0EC] hover:text-ink"
        >
          <PlusIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label={tr('settings')}
          title={tr('settings')}
          onClick={() => setSettingsOpen(true)}
          className="no-drag grid h-7 w-7 place-items-center rounded-[6px] text-ink-2 hover:bg-[#F0F0EC] hover:text-ink"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
      </header>

      {notice ? (
        <div className="border-b border-line px-7 py-2 text-[12px] text-danger">{notice}</div>
      ) : null}

      {selectionActive ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-7 py-2 text-[12px] text-ink-2">
          <span>{formatTemplate(language, 'selected', { n: selected.size })}</span>
          <button
            type="button"
            onClick={toggleAll}
            className="border-0 bg-transparent p-0 text-[12px] text-ink underline underline-offset-[3px]"
          >
            {tr('selectAll')}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="border-0 bg-transparent p-0 text-[12px] text-ink underline underline-offset-[3px]"
          >
            {tr('clear')}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={handleBackupSelected}
            className="border-0 bg-transparent p-0 text-[12px] text-ink underline underline-offset-[3px]"
          >
            {tr('backupSelected')}
          </button>
          <button
            type="button"
            onClick={() => void handleChangeFolder()}
            className="border-0 bg-transparent p-0 text-[12px] text-ink underline underline-offset-[3px]"
          >
            {tr('changeFolder')}
          </button>
          <button
            type="button"
            onClick={() => void handleRemoveSelected()}
            className="border-0 bg-transparent p-0 text-[12px] text-danger underline underline-offset-[3px]"
          >
            {tr('removeSelected')}
          </button>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {!loaded ? (
          <div>
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-[66px] animate-pulse border-b border-line/60" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="px-7 pt-[68px] pb-[84px]">
            <h2 className="text-[15px] font-medium text-ink">{tr('emptyTitle')}</h2>
            <p className="mt-2 max-w-[40ch] text-[13px] leading-[1.7] text-ink-3">
              {tr('emptyBody')}
            </p>
            <button
              type="button"
              onClick={() => void handleAdd()}
              className="mt-3.5 border-0 bg-transparent p-0 text-[13px] text-ink underline underline-offset-4"
            >
              {tr('emptyCta')}
            </button>
          </div>
        ) : (
          <div role="listbox" aria-multiselectable="true" aria-label={tr('files')}>
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                language={language}
                paused={paused}
                busy={busy.has(source.id)}
                justBackedUp={fresh.has(source.id)}
                selected={selected.has(source.id)}
                confirming={confirmId === source.id}
                onToggleSelection={() => toggleSelection(source.id)}
                onFocus={() => setFocusedId(source.id)}
                onBackup={() => void runBackup([source.id])}
                onRelocate={() => void handleChangeDestination(source.id)}
                onRequestRemove={() => setConfirmId(source.id)}
                onConfirmRemove={() => void handleRemove(source.id)}
                onCancelRemove={() => setConfirmId(null)}
              />
            ))}
          </div>
        )}
      </main>

      {settingsOpen && settings ? (
        <SettingsDialog
          settings={settings}
          language={language}
          autoStartSupported={autoStartSupported}
          onChangeLanguage={(value) => void changeLanguage(value)}
          onToggleAutoStart={() => void toggleAutoStart()}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {pending ? (
        <AddDialog
          language={language}
          sourcePath={pending.sourcePath}
          destination={pending.destination}
          busy={adding}
          onPickSource={() => void handlePickSource()}
          onPickDestination={() => void handlePickDestination()}
          onCancel={() => setPending(null)}
          onConfirm={() => void handleConfirmAdd()}
        />
      ) : null}

      {toast ? (
        <Toast key={toast.id} kind={toast.kind} message={toast.message} onDismiss={dismissToast} />
      ) : null}
    </div>
  )
}
