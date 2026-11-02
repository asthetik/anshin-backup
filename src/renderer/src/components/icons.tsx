export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 5.5v13M5.5 12h13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5.5 12.4l4.2 4.1L18.5 7.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.8v5.4M12 16.2v.1"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 自动备份进行中：盾牌带勾，代表文件正被守着 */
export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 3.2 5 6v6.1c0 4.2 2.9 7.3 7 8.7 4.1-1.4 7-4.5 7-8.7V6l-7-2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 12.1l2 2 3.6-3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 已暂停 */
export function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M9.5 5.5v13M14.5 5.5v13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.6-1.2-1.8-3.1-1.9.8a7.7 7.7 0 0 0-2.6-1.5L14.4 3h-3.6l-.3 2.5A7.7 7.7 0 0 0 7.9 7l-1.9-.8L4.2 9.3l1.6 1.2a7.7 7.7 0 0 0 0 3l-1.6 1.2 1.8 3.1 1.9-.8a7.7 7.7 0 0 0 2.6 1.5l.3 2.5h3.6l.3-2.5a7.7 7.7 0 0 0 2.6-1.5l1.9.8 1.8-3.1-1.6-1.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
