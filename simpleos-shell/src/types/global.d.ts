import type { SimpleOSBridge } from '../types'

export {}

declare global {
  interface Window {
    simpleOS?: SimpleOSBridge
  }
}
