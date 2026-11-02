import { describe, expect, it } from 'vitest'
import { pickTrayIconSize } from '../src/main/trayIcon'

describe('pickTrayIconSize', () => {
  it('covers the taskbar icon size at every common display scale', () => {
    expect(pickTrayIconSize(1)).toBe(16)
    expect(pickTrayIconSize(1.25)).toBe(20)
    expect(pickTrayIconSize(1.5)).toBe(24)
    expect(pickTrayIconSize(2)).toBe(32)
  })

  it('never hands Electron an icon smaller than the taskbar asks for', () => {
    expect(pickTrayIconSize(1.75)).toBe(32)
    expect(pickTrayIconSize(3)).toBe(32)
    expect(pickTrayIconSize(0.5)).toBe(16)
  })
})
