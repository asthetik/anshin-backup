import { type KeyboardEvent, useEffect, useRef } from 'react'
import type { Language } from '../../../shared/types'
import { t } from '../i18n'

interface CloseConfirmDialogProps {
  language: Language
  onBackground: () => void
  onQuit: () => void
  onCancel: () => void
}

/** Windows 首次关窗的确认弹窗；样式与「添加备份/设置」弹窗一致。
 *  打开即聚焦主按钮（Enter 直接选「在后台运行」），Tab 在两个回答按钮间循环 */
export function CloseConfirmDialog({
  language,
  onBackground,
  onQuit,
  onCancel,
}: CloseConfirmDialogProps) {
  const backgroundRef = useRef<HTMLButtonElement>(null)
  const quitRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    backgroundRef.current?.focus()
  }, [])

  // 焦点圈只在两个真实按钮之间循环：全屏遮罩没有 focus 样式，若把它纳入
  // 键盘循环，Chromium 的默认 :focus-visible 光圈会框住整个窗口。遮罩只
  // 响应鼠标点击，键盘用户走 Esc 取消
  const focusOtherButton = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    const other = event.currentTarget === backgroundRef.current ? quitRef : backgroundRef
    other.current?.focus()
  }

  return (
    <div
      data-close-choice
      className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(26,26,25,0.28)] px-6"
    >
      <button
        type="button"
        aria-label={t(language, 'cancel')}
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(language, 'closeAskTitle')}
        className="relative w-full max-w-[420px] overflow-hidden rounded-[10px] bg-raised shadow-[0_24px_50px_-14px_rgba(0,0,0,0.4)]"
      >
        <h2 className="px-[22px] pt-5 text-[15px] font-semibold text-ink">
          {t(language, 'closeAskTitle')}
        </h2>
        <p className="px-[22px] pt-2 text-[13px] leading-[1.7] text-ink-2">
          {t(language, 'closeAskBody')}
        </p>

        <div className="flex items-center justify-end gap-2 px-[22px] py-4">
          <button
            ref={quitRef}
            type="button"
            onClick={onQuit}
            onKeyDown={focusOtherButton}
            className="rounded-[6px] border border-transparent px-3 py-[5px] text-[13px] text-ink-2 hover:bg-[#F4F4F0]"
          >
            {t(language, 'closeAskQuit')}
          </button>
          <button
            ref={backgroundRef}
            type="button"
            onClick={onBackground}
            onKeyDown={focusOtherButton}
            className="rounded-[6px] border border-ink bg-ink px-3 py-[5px] text-[13px] text-white hover:bg-[#333333]"
          >
            {t(language, 'closeAskBackground')}
          </button>
        </div>
      </div>
    </div>
  )
}
