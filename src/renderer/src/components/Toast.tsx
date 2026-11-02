import { useEffect } from 'react'
import { AlertIcon, CheckIcon } from './icons'

export type ToastKind = 'success' | 'error'

interface ToastProps {
  kind: ToastKind
  message: string
  onDismiss: () => void
}

export function Toast({ kind, message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4200)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  const error = kind === 'error'

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-6"
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
    >
      <button
        type="button"
        onClick={onDismiss}
        className={`toast pointer-events-auto flex max-w-[min(440px,100%)] items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] shadow-[0_8px_28px_rgba(26,26,25,0.10)] ${
          error ? 'border-[#E8C9C0] bg-[#FBF1EE] text-danger' : 'border-line bg-raised text-ink'
        }`}
      >
        {error ? (
          <AlertIcon className="h-4 w-4 shrink-0" />
        ) : (
          <CheckIcon className="h-4 w-4 shrink-0 text-ok" />
        )}
        <span className="truncate">{message}</span>
      </button>
    </div>
  )
}
