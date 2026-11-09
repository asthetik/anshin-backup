import type { Language, Settings } from '../../../shared/types'
import { t } from '../i18n'

interface SettingsDialogProps {
  settings: Settings
  language: Language
  autoStartSupported: boolean
  hideDockSupported: boolean
  onChangeLanguage: (language: Language) => void
  onToggleAutoStart: () => void
  onToggleHideDock: () => void
  onClose: () => void
}

/** 设置以弹窗形式出现，不切换主视图。 */
export function SettingsDialog({
  settings,
  language,
  autoStartSupported,
  hideDockSupported,
  onChangeLanguage,
  onToggleAutoStart,
  onToggleHideDock,
  onClose,
}: SettingsDialogProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(26,26,25,0.28)] px-6">
      <button
        type="button"
        aria-label={t(language, 'cancel')}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(language, 'settings')}
        className="relative w-full max-w-[400px] overflow-hidden rounded-[10px] bg-raised shadow-[0_24px_50px_-14px_rgba(0,0,0,0.4)]"
      >
        <h2 className="px-6 pt-5 text-[15px] font-semibold text-ink">{t(language, 'settings')}</h2>

        <div className="px-6 pt-3 pb-1">
          <div className="flex items-center justify-between gap-6 border-b border-line py-3.5">
            <div className="min-w-0">
              <p className="text-[13.5px] text-ink">{t(language, 'autoStart')}</p>
              <p className="mt-[3px] text-[12px] text-ink-3">{t(language, 'autoStartDesc')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoStart}
              aria-label={t(language, 'autoStart')}
              disabled={!autoStartSupported}
              onClick={onToggleAutoStart}
              className={`relative h-[21px] w-[38px] shrink-0 rounded-full border-0 transition-colors disabled:opacity-40 ${
                settings.autoStart ? 'bg-ok' : 'bg-[#DCDCD6]'
              }`}
            >
              <span
                className={`absolute top-[2px] left-[2px] h-[17px] w-[17px] rounded-full bg-white transition-transform ${
                  settings.autoStart ? 'translate-x-[17px]' : ''
                }`}
              />
            </button>
          </div>

          {hideDockSupported && (
            <div className="flex items-center justify-between gap-6 border-b border-line py-3.5">
              <div className="min-w-0">
                <p className="text-[13.5px] text-ink">{t(language, 'hideDock')}</p>
                <p className="mt-[3px] text-[12px] text-ink-3">{t(language, 'hideDockDesc')}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.hideDockOnClose}
                aria-label={t(language, 'hideDock')}
                onClick={onToggleHideDock}
                className={`relative h-[21px] w-[38px] shrink-0 rounded-full border-0 transition-colors ${
                  settings.hideDockOnClose ? 'bg-ok' : 'bg-[#DCDCD6]'
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] h-[17px] w-[17px] rounded-full bg-white transition-transform ${
                    settings.hideDockOnClose ? 'translate-x-[17px]' : ''
                  }`}
                />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-6 border-b border-line py-3.5">
            <div className="min-w-0">
              <p className="text-[13.5px] text-ink">{t(language, 'language')}</p>
              <p className="mt-[3px] text-[12px] text-ink-3">{t(language, 'languageDesc')}</p>
            </div>
            <div className="flex shrink-0 gap-3.5">
              {(['zh', 'en'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChangeLanguage(value)}
                  aria-pressed={settings.language === value}
                  className={`border-0 border-b-[1.5px] bg-transparent px-0 pb-[2px] text-[13px] ${
                    settings.language === value
                      ? 'border-ink text-ink'
                      : 'border-transparent text-ink-3 hover:text-ink'
                  }`}
                >
                  {value === 'zh' ? '中文' : 'English'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-ink bg-ink px-3 py-[5px] text-[13px] text-white hover:bg-[#333333]"
          >
            {t(language, 'done')}
          </button>
        </div>
      </div>
    </div>
  )
}
