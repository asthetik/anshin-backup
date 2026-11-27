/** 渲染进程关窗弹窗回答的分类结果；ignore 含「取消」与一切未识别的 IPC 值 */
export type CloseOutcome = 'ignore' | 'quit' | 'acknowledge'

/**
 * 渲染进程传来的回答不可全信：未识别的值一律按「取消」处理，
 * 绝不能落到最重的「退出」。「退出」是一次性动作，不代表以后关窗的去向，
 * 不落档，下次启动首次关窗会再问一次。
 */
export function classifyCloseChoice(choice: unknown): CloseOutcome {
  if (choice === 'background') return 'acknowledge'
  if (choice === 'quit') return 'quit'
  return 'ignore'
}

export interface CloseChoiceDeps {
  /** 设置写档 closeNoticeAcknowledged = true；写盘失败（占用/磁盘满）会抛出 */
  acknowledge: () => void
  /** isQuitting = true 并退出应用 */
  quit: () => void
  /** 窗口仍在时收进托盘 */
  hide: () => void
  /** 写档失败的日志出口 */
  onError: (error: unknown) => void
}

/** 「在后台运行」分支的裁决：写档失败不能吞掉回答，照常驻留 */
export function applyCloseChoice(choice: unknown, deps: CloseChoiceDeps): void {
  const outcome = classifyCloseChoice(choice)
  if (outcome === 'quit') {
    deps.quit()
    return
  }
  if (outcome === 'acknowledge') {
    try {
      deps.acknowledge()
    } catch (error) {
      deps.onError(error)
    }
    deps.hide()
  }
}

export interface CloseChoiceGate {
  /** darwin 原生弹框（首关询问 / 崩溃兜底）正在等待回答 */
  nativeOpened(): void
  nativeSettled(): void
  /** 原生弹框同步抛出：就地复位，关窗按钮与托盘设置入口不能卡死 */
  nativeOpenFailed(): void
  /** 界面内弹窗的问题已发出、尚未回答 */
  requestSent(): void
  /** 渲染进程已交回回答（含取消） */
  requestAnswered(): void
  /** 渲染进程重载或崩溃：界面内弹窗状态随之丢失，旗标一并作废 */
  rendererRecovered(): void
  isNativePending(): boolean
  isRequestOutstanding(): boolean
  /** 托盘设置入口在问题悬着时先让路，避免两个弹窗叠在一起 */
  isSettingsEntryBlocked(): boolean
}

export function createCloseChoiceGate(): CloseChoiceGate {
  let nativePending = false
  let requestOutstanding = false

  return {
    nativeOpened: () => {
      nativePending = true
    },
    nativeSettled: () => {
      nativePending = false
    },
    nativeOpenFailed: () => {
      nativePending = false
    },
    requestSent: () => {
      requestOutstanding = true
    },
    requestAnswered: () => {
      requestOutstanding = false
    },
    rendererRecovered: () => {
      requestOutstanding = false
    },
    isNativePending: () => nativePending,
    isRequestOutstanding: () => requestOutstanding,
    isSettingsEntryBlocked: () => requestOutstanding || nativePending,
  }
}
