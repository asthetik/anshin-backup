import type { EngineErrorCode } from '../../shared/types'

/**
 * 引擎的业务性错误。message 以错误码开头：
 * IPC 只保留 message，界面靠前缀里的码把错误翻译成人话。
 */
export class EngineError extends Error {
  readonly code: EngineErrorCode

  constructor(code: EngineErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'EngineError'
    this.code = code
  }
}
