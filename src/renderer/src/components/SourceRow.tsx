import type { Language, Source } from '../../../shared/types'
import { describeError, formatTemplate, formatTime, t } from '../i18n'
import { displayName, humanLocation } from '../lib/paths'
import { CheckIcon } from './icons'

interface SourceRowProps {
  source: Source
  language: Language
  paused: boolean
  busy: boolean
  justBackedUp: boolean
  selected: boolean
  confirming: boolean
  onToggleSelection: () => void
  onFocus: () => void
  onBackup: () => void
  onRelocate: () => void
  onRequestRemove: () => void
  onConfirmRemove: () => void
  onCancelRemove: () => void
}

export function SourceRow({
  source,
  language,
  paused,
  busy,
  justBackedUp,
  selected,
  confirming,
  onToggleSelection,
  onFocus,
  onBackup,
  onRelocate,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
}: SourceRowProps) {
  const name = displayName(source.path)
  const { source: from, target: to } = humanLocation(source.path, source.destination, language)
  const rawPaths = `${source.path}\n${source.destination}`

  const dotState = source.lastError
    ? 'fault'
    : source.lastBackupAt === null
      ? 'pending'
      : paused
        ? 'paused'
        : 'ok'

  return (
    <div
      data-source-id={source.id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={onToggleSelection}
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          onToggleSelection()
        }
      }}
      data-selected={selected}
      className="row grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-b border-line px-7 py-3.5 outline-none"
    >
      <span
        aria-hidden="true"
        data-state={dotState}
        className={`mt-1.5 h-[7px] w-[7px] justify-self-center rounded-full ${
          dotState === 'ok'
            ? 'bg-ok'
            : dotState === 'fault'
              ? 'bg-danger'
              : dotState === 'paused'
                ? 'box-[inset_0_0_0_1.5px_var(--color-warn)]'
                : 'box-[inset_0_0_0_1.5px_var(--color-ink-3)]'
        }`}
      />

      <div className="min-w-0">
        <h3 className="truncate text-[14.5px] leading-[1.35] font-medium text-ink">{name}</h3>
        {from || to ? (
          <p className="mt-[3px] truncate text-[12px] leading-[1.4] text-ink-3" title={rawPaths}>
            {from}
            <span className="mx-[5px]">→</span>
            <span className="text-ink-2">{to}</span>
          </p>
        ) : null}

        {source.lastError ? (
          <p className="mt-1.5 text-[12px] leading-[1.5] text-danger">
            {formatTemplate(language, 'errorLine', {
              why: describeError(language, source.lastError),
            })}
            <span className="whitespace-nowrap text-ink-3"> · {t(language, 'safeCopy')}</span>
          </p>
        ) : null}

        {confirming ? (
          <div className="mt-2 flex items-center gap-2.5 text-[12.5px] text-ink-2">
            <span>{t(language, 'stopAsk')}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onConfirmRemove()
              }}
              className="rounded-[5px] border border-danger px-2 py-[3px] text-[12px] text-danger"
            >
              {t(language, 'yesRemove')}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onCancelRemove()
              }}
              className="rounded-[5px] border border-line px-2 py-[3px] text-[12px] text-ink"
            >
              {t(language, 'cancel')}
            </button>
          </div>
        ) : null}
      </div>

      <span className="pt-[2px] font-mono text-[11.5px] tabular-nums whitespace-nowrap text-ink-3">
        {busy ? (
          <span className="font-sans">{t(language, 'backingUp')}</span>
        ) : justBackedUp ? (
          <span className="inline-flex items-center gap-1 font-sans text-ok">
            <CheckIcon className="h-3 w-3" />
            {t(language, 'backedUp')}
          </span>
        ) : (
          formatTime(language, source.lastBackupAt)
        )}
      </span>

      {!confirming ? (
        <div className="row-actions">
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation()
              onBackup()
            }}
            className="rounded-[5px] px-2 py-1 text-[12px] text-ink-2 hover:bg-[#ECECE7] hover:text-ink disabled:opacity-40"
          >
            {t(language, 'backup')}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRelocate()
            }}
            className="rounded-[5px] px-2 py-1 text-[12px] text-ink-2 hover:bg-[#ECECE7] hover:text-ink"
          >
            {t(language, 'relocate')}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRequestRemove()
            }}
            className="rounded-[5px] px-2 py-1 text-[12px] text-ink-3 hover:bg-[#ECECE7] hover:text-danger"
          >
            {t(language, 'remove')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
