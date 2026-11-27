import { describe, expect, it, vi } from 'vitest'
import {
  applyCloseChoice,
  classifyCloseChoice,
  createCloseChoiceGate,
} from '../src/main/closeChoice'

describe('classifyCloseChoice', () => {
  it('maps the three dialog answers to their outcomes', () => {
    expect(classifyCloseChoice('background')).toBe('acknowledge')
    expect(classifyCloseChoice('quit')).toBe('quit')
    expect(classifyCloseChoice('cancel')).toBe('ignore')
  })

  it('treats unrecognized IPC values as cancel, never quit', () => {
    for (const hostile of ['', 'Quit', 'background ', null, undefined, 1, true, {}, []]) {
      expect(classifyCloseChoice(hostile)).toBe('ignore')
    }
  })
})

describe('applyCloseChoice', () => {
  const baseDeps = () => ({
    acknowledge: vi.fn(),
    quit: vi.fn(),
    hide: vi.fn(),
    onError: vi.fn(),
  })

  it('quits without acknowledging: quitting is one-shot, not a stored preference', () => {
    const deps = baseDeps()
    applyCloseChoice('quit', deps)
    expect(deps.quit).toHaveBeenCalledOnce()
    expect(deps.acknowledge).not.toHaveBeenCalled()
    expect(deps.hide).not.toHaveBeenCalled()
  })

  it('acknowledges and hides on background', () => {
    const deps = baseDeps()
    applyCloseChoice('background', deps)
    expect(deps.acknowledge).toHaveBeenCalledOnce()
    expect(deps.hide).toHaveBeenCalledOnce()
    expect(deps.quit).not.toHaveBeenCalled()
  })

  it('still hides when the settings write fails, and reports the error', () => {
    const deps = baseDeps()
    deps.acknowledge.mockImplementation(() => {
      throw new Error('EBUSY')
    })
    applyCloseChoice('background', deps)
    expect(deps.acknowledge).toHaveBeenCalledOnce()
    expect(deps.onError).toHaveBeenCalledOnce()
    expect(deps.hide).toHaveBeenCalledOnce()
  })

  it('ignores unknown values without touching any dependency', () => {
    const deps = baseDeps()
    for (const hostile of [undefined, 'cancel', 42]) {
      applyCloseChoice(hostile, deps)
    }
    expect(deps.quit).not.toHaveBeenCalled()
    expect(deps.acknowledge).not.toHaveBeenCalled()
    expect(deps.hide).not.toHaveBeenCalled()
    expect(deps.onError).not.toHaveBeenCalled()
  })
})

describe('createCloseChoiceGate', () => {
  it('blocks the tray settings entry while any question is pending', () => {
    const gate = createCloseChoiceGate()
    expect(gate.isSettingsEntryBlocked()).toBe(false)

    gate.requestSent()
    expect(gate.isSettingsEntryBlocked()).toBe(true)
    gate.requestAnswered()
    expect(gate.isSettingsEntryBlocked()).toBe(false)

    gate.nativeOpened()
    expect(gate.isSettingsEntryBlocked()).toBe(true)
    gate.nativeSettled()
    expect(gate.isSettingsEntryBlocked()).toBe(false)
  })

  it('clears the stale request flag when the renderer reloads or crashes', () => {
    const gate = createCloseChoiceGate()
    gate.requestSent()
    gate.rendererRecovered()
    expect(gate.isRequestOutstanding()).toBe(false)
    expect(gate.isSettingsEntryBlocked()).toBe(false)

    gate.requestSent()
    gate.nativeOpened()
    // 渲染进程恢复只作废界面弹窗的旗标，原生弹框仍在等待
    gate.rendererRecovered()
    expect(gate.isRequestOutstanding()).toBe(false)
    expect(gate.isNativePending()).toBe(true)
    expect(gate.isSettingsEntryBlocked()).toBe(true)
  })

  it('lets the close button proceed again after a native dialog settles or fails', () => {
    const gate = createCloseChoiceGate()
    gate.nativeOpened()
    gate.nativeSettled()
    expect(gate.isNativePending()).toBe(false)

    gate.nativeOpened()
    gate.nativeOpenFailed()
    expect(gate.isNativePending()).toBe(false)
  })
})
