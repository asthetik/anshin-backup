/// <reference types="vite/client" />

import type { AnshinApi } from '../../shared/api'

declare global {
  interface Window {
    anshin: AnshinApi
  }
}
