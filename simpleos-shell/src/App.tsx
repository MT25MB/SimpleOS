import { useEffect, useRef, useState } from 'react'
import logoUrl from '../../docs/assets/simpleos-logo.png'
import { CaregiverPanel } from './components/CaregiverPanel'
import { FontScaleControl } from './components/FontScaleControl'
import { NoticeBanner } from './components/NoticeBanner'
import { PinScreen } from './components/PinScreen'
import { RemindersPanel } from './components/RemindersPanel'
import { Tile } from './components/Tile'
import { TILES } from './data/tiles'
import { useFontScale } from './hooks/useFontScale'
import { useReminders } from './hooks/useReminders'
import { friendlyMessage } from './messages'
import type { ErrorCode, LaunchTarget, LauncherTile, SettingsTarget } from './types'

type View = 'home' | 'reminders' | 'caregiver'
type PinMode = 'unlock' | 'create' | 'change'
type Notice = { tone: 'info' | 'sharing' | 'caregiver'; message: string }

/** Full-screen, calm home launcher for SimpleOS. */
export default function App() {
  const { scale, setFontScale } = useFontScale()
  const reminders = useReminders()
  const [view, setView] = useState<View>('home')
  const [pinMode, setPinMode] = useState<PinMode | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [caregiverError, setCaregiverError] = useState<ErrorCode | null>(null)
  const [updateSummary, setUpdateSummary] = useState<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  // Move focus into a newly opened panel so keyboard users are not stranded.
  useEffect(() => {
    if (view !== 'home') mainRef.current?.focus()
  }, [view])

  async function launchApp(target: LaunchTarget, label: string) {
    setNotice(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setNotice({ tone: 'info', message: friendlyMessage('BRIDGE_UNAVAILABLE') })
      return
    }

    const result = await bridge.launchApp(target)
    if (!result.ok) {
      setNotice({ tone: 'info', message: friendlyMessage(result.code) })
      return
    }

    setNotice({
      tone: target === 'rustdesk' ? 'sharing' : 'info',
      message:
        target === 'rustdesk'
          ? 'Screen sharing is starting. RustDesk will open, and you can stop sharing any time.'
          : `${label} is opening.`,
    })
  }

  async function handleSelect(tile: LauncherTile) {
    if (tile.action.kind === 'view') {
      if (tile.action.view === 'caregiver') {
        await openCaregiver()
      } else {
        setView('reminders')
      }
      return
    }

    await launchApp(tile.action.target, tile.title)
  }

  async function openCaregiver() {
    setCaregiverError(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setNotice({ tone: 'info', message: friendlyMessage('BRIDGE_UNAVAILABLE') })
      return
    }
    const result = await bridge.hasPin()
    if (!result.ok) {
      setCaregiverError(result.code)
      setView('caregiver')
      return
    }
    setPinMode(result.value.hasPin ? 'unlock' : 'create')
  }

  function pinSucceeded(message: string): null {
    setPinMode(null)
    setView('caregiver')
    setNotice({ tone: 'caregiver', message })
    return null
  }

  async function handlePinSubmit(currentPin: string, newPin: string): Promise<ErrorCode | null> {
    const bridge = window.simpleOS
    if (!bridge) return 'BRIDGE_UNAVAILABLE'

    if (pinMode === 'create') {
      const result = await bridge.setPin('', newPin)
      return result.ok ? pinSucceeded('Your PIN is saved.') : result.code
    }

    if (pinMode === 'change') {
      const result = await bridge.setPin(currentPin, newPin)
      return result.ok ? pinSucceeded('Your new PIN is saved.') : result.code
    }

    const result = await bridge.unlockWithPin(currentPin)
    return result.ok ? pinSucceeded("You're in Caregiver Settings.") : result.code
  }

  async function handleOpenSettings(target: SettingsTarget) {
    setNotice(null)
    setCaregiverError(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setCaregiverError('BRIDGE_UNAVAILABLE')
      return
    }

    const result = await bridge.openSettings(target)
    if (!result.ok) {
      setCaregiverError(result.code)
      return
    }
    setNotice({
      tone: 'caregiver',
      message:
        target === 'network'
          ? 'Opening Wi-Fi settings.'
          : 'Opening printer settings.',
    })
  }

  async function handleCheckUpdates() {
    setCaregiverError(null)
    setUpdateSummary(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setCaregiverError('BRIDGE_UNAVAILABLE')
      return
    }

    setUpdateSummary('Checking for updates…')
    const result = await bridge.getUpdateStatus()
    if (!result.ok) {
      setUpdateSummary(null)
      setCaregiverError(result.code)
      return
    }
    setUpdateSummary(result.value.summary)
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__brand">
            <img
              className="app__logo"
              src={logoUrl}
              alt="SimpleOS"
              width="512"
              height="512"
            />
          </h1>
          <p className="app__tagline">What can I help you with today?</p>
        </div>
        <FontScaleControl value={scale} onChange={setFontScale} />
      </header>

      {notice && (
        <NoticeBanner tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
      )}

      <main className="app__main" ref={mainRef} tabIndex={-1}>
        {view === 'home' ? (
          <ul className="tiles" aria-label="Main menu">
            {TILES.map((tile) => (
              <li key={tile.id} className="tiles__item">
                <Tile tile={tile} onSelect={handleSelect} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            <button
              type="button"
              className="button button--back"
              onClick={() => setView('home')}
            >
              ← Back to home
            </button>
            {view === 'reminders' ? (
              <RemindersPanel
                store={reminders.store}
                loaded={reminders.loaded}
                error={reminders.error}
                onAdd={reminders.add}
                onToggle={reminders.toggle}
                onRemove={reminders.remove}
                onReset={reminders.reset}
                onDismissError={reminders.clearError}
              />
            ) : (
              <CaregiverPanel
                scale={scale}
                onScaleChange={setFontScale}
                updateSummary={updateSummary}
                onOpenSettings={handleOpenSettings}
                onOpenRemoteHelp={() => void launchApp('rustdesk', 'RustDesk')}
                onCheckUpdates={handleCheckUpdates}
                onChangePin={() => setPinMode('change')}
                error={caregiverError}
                onDismissError={() => setCaregiverError(null)}
              />
            )}
          </>
        )}
      </main>

      <footer className="app__footer">
        <p>SimpleOS · Free and open source</p>
      </footer>

      {pinMode && (
        <PinScreen mode={pinMode} onCancel={() => setPinMode(null)} onSubmit={handlePinSubmit} />
      )}
    </div>
  )
}
