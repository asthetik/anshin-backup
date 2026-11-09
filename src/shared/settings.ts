import type { Settings } from './types'

/** 从任意来源（TOML/JSON/IPC patch）挑出已知且类型正确的设置字段 */
export function knownSettingsFields(raw: Record<string, unknown>): Partial<Settings> {
  const clean: Partial<Settings> = {}
  if (raw.language === 'zh' || raw.language === 'en') clean.language = raw.language
  if (typeof raw.autoStart === 'boolean') clean.autoStart = raw.autoStart
  if (typeof raw.paused === 'boolean') clean.paused = raw.paused
  if (typeof raw.hideDockOnClose === 'boolean') clean.hideDockOnClose = raw.hideDockOnClose
  if (typeof raw.closeNoticeAcknowledged === 'boolean') {
    clean.closeNoticeAcknowledged = raw.closeNoticeAcknowledged
  }
  return clean
}
