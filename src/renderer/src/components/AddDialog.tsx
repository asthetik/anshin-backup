import type { Language } from '../../../shared/types'
import { t } from '../i18n'

interface AddDialogProps {
  language: Language
  sourcePath: string
  destination: string
  busy: boolean
  onPickSource: () => void
  onPickDestination: () => void
  onCancel: () => void
  onConfirm: () => void
}

export function AddDialog({
  language,
  sourcePath,
  destination,
  busy,
  onPickSource,
  onPickDestination,
  onCancel,
  onConfirm,
}: AddDialogProps) {
  const ready = sourcePath.length > 0 && destination.length > 0

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(26,26,25,0.28)] px-6">
      <button
        type="button"
        aria-label={t(language, 'cancel')}
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(language, 'addTitle')}
        className="relative w-full max-w-[420px] overflow-hidden rounded-[10px] bg-raised shadow-[0_24px_50px_-14px_rgba(0,0,0,0.4)]"
      >
        <h2 className="px-[22px] pt-5 text-[15px] font-semibold text-ink">
          {t(language, 'addTitle')}
        </h2>

        <div className="px-[22px] pb-1 pt-4">
          <div className="flex items-center justify-between gap-3 border-b border-line py-[11px]">
            <span className="text-[12.5px] text-ink-2">{t(language, 'sourceFile')}</span>
            <span
              className={`min-w-0 flex-1 truncate text-right font-mono text-[12.5px] ${
                sourcePath ? 'text-ink' : 'text-ink-3'
              }`}
              title={sourcePath || undefined}
            >
              {sourcePath || t(language, 'notSelected')}
            </span>
            <button
              type="button"
              onClick={onPickSource}
              className="shrink-0 rounded-[5px] border border-line px-2.5 py-[3px] text-[12px] text-ink hover:bg-[#F4F4F0]"
            >
              {t(language, 'choose')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-line py-[11px]">
            <span className="text-[12.5px] text-ink-2">{t(language, 'destFile')}</span>
            <span
              className={`min-w-0 flex-1 truncate text-right font-mono text-[12.5px] ${
                destination ? 'text-ink' : 'text-ink-3'
              }`}
              title={destination || undefined}
            >
              {destination || t(language, 'notSelected')}
            </span>
            <button
              type="button"
              onClick={onPickDestination}
              disabled={sourcePath.length === 0}
              className="shrink-0 rounded-[5px] border border-line px-2.5 py-[3px] text-[12px] text-ink hover:bg-[#F4F4F0] disabled:opacity-40"
            >
              {t(language, 'choose')}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-[22px] py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border border-transparent px-3 py-[5px] text-[13px] text-ink-2 hover:bg-[#F4F4F0]"
          >
            {t(language, 'cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready || busy}
            className="rounded-[6px] border border-ink bg-ink px-3 py-[5px] text-[13px] text-white hover:bg-[#333333] disabled:opacity-40"
          >
            {t(language, 'add')}
          </button>
        </div>
      </div>
    </div>
  )
}
