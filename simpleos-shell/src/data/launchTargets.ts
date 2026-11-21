import type { LaunchTarget } from '../types'

/**
 * Single source of truth for the renderer's launch targets.
 * The Electron main process keeps its own fixed allowlist; these values must
 * stay in sync with it (verified by tests and by the shared LaunchTarget type).
 */
export const ALLOWED_LAUNCH_TARGETS: readonly LaunchTarget[] = [
  'firefox',
  'jitsi',
  'photos',
  'rustdesk',
] as const
