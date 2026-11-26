import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecoveryPanel } from './components/RecoveryPanel'
import type { HealthStatus, RecoveryAction } from './types'

const health: HealthStatus = {
  internet: 'Connected to the internet.',
  audio: 'Sound output is ready.',
  microphone: 'Microphone is ready.',
  disk: 'Disk space is healthy: 20 GB free',
  imageVersion: 'SimpleOS 0.3.0',
  lastUpdateCheck: 'Last checked today',
  summary: 'SimpleOS health summary\nInternet: Connected to the internet.',
}

function renderPanel(onAction = vi.fn().mockResolvedValue('Done.'), onCopy = vi.fn()) {
  render(
    <RecoveryPanel health={health} onCopySummary={onCopy} onAction={onAction} message={null} />,
  )
  return { onAction, onCopy }
}

describe('system health panel', () => {
  it('shows six plain-English status lines and a privacy-safe summary button', async () => {
    const user = userEvent.setup()
    const { onCopy } = renderPanel()
    for (const value of [
      health.internet,
      health.audio,
      health.microphone,
      health.disk,
      health.imageVersion,
      health.lastUpdateCheck,
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Copy Health Summary' }))
    expect(onCopy).toHaveBeenCalledWith(health.summary)
    expect(health.summary).not.toMatch(/\/home\/|\.config|PIN|password/i)
  })
})

describe('guarded recovery actions', () => {
  it.each<[string, RecoveryAction]>([
    ['Restart Launcher', 'restartLauncher'],
    ['Roll Back Last OS Update', 'rollBack'],
  ])('%s requires confirmation before running', async (label) => {
    const user = userEvent.setup()
    const { onAction } = renderPanel()
    await user.click(screen.getByRole('button', { name: label }))
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('runs only the confirmed rollback action', async () => {
    const user = userEvent.setup()
    const { onAction } = renderPanel()
    await user.click(screen.getByRole('button', { name: 'Roll Back Last OS Update' }))
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onAction).toHaveBeenCalledWith('rollBack')
  })
})
