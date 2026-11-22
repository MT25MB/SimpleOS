import { useEffect, useRef, useState } from 'react'
import logoUrl from '../../docs/assets/simpleos-logo.png'
import { CaregiverPanel } from './components/CaregiverPanel'
import { FamilyPanel } from './components/FamilyPanel'
import { FontScaleControl } from './components/FontScaleControl'
import { HardwareControls } from './components/HardwareControls'
import { NoticeBanner } from './components/NoticeBanner'
import { PhotoFrame } from './components/PhotoFrame'
import { PinScreen } from './components/PinScreen'
import { RemindersPanel } from './components/RemindersPanel'
import { Tile } from './components/Tile'
import { VoiceControls } from './components/VoiceControls'
import { TILES } from './data/tiles'
import { useFontScale } from './hooks/useFontScale'
import { useHardwareStatus } from './hooks/useHardwareStatus'
import { useIdleFrame } from './hooks/useIdleFrame'
import { useReadAloud } from './hooks/useReadAloud'
import { useReminders } from './hooks/useReminders'
import { useVoiceNavigation } from './hooks/useVoiceNavigation'
import { friendlyMessage } from './messages'
import type {
  BrightnessAction,
  Contact,
  ContactsFile,
  ErrorCode,
  FrameDelay,
  HealthStatus,
  LaunchTarget,
  LauncherTile,
  RecoveryAction,
  SettingsTarget,
  VoiceAction,
  VolumeAction,
} from './types'

type View = 'home' | 'reminders' | 'caregiver' | 'family'
type PinMode = 'unlock' | 'create' | 'change'
type Notice = { tone: 'info' | 'sharing' | 'caregiver'; message: string }
const FRAME_KEY = 'simpleos.frameDelay'

function initialFrameDelay(): FrameDelay {
  try {
    const value = Number(window.localStorage.getItem(FRAME_KEY))
    if ([0, 2, 5, 10, 15].includes(value)) return value as FrameDelay
  } catch {
    // localStorage may be unavailable; keep the calm default.
  }
  return 0
}

/** Full-screen, calm home launcher for SimpleOS. */
export default function App() {
  const { scale, setFontScale } = useFontScale()
  const { status: hardware, refresh: refreshHardware } = useHardwareStatus()
  const readAloud = useReadAloud()
  const reminders = useReminders()
  const voice = useVoiceNavigation(handleVoiceAction)
  const [view, setView] = useState<View>('home')
  const [pinMode, setPinMode] = useState<PinMode | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [caregiverError, setCaregiverError] = useState<ErrorCode | null>(null)
  const [updateSummary, setUpdateSummary] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [frameDelay, setFrameDelayState] = useState<FrameDelay>(initialFrameDelay)
  const [framePhotos, setFramePhotos] = useState<string[]>([])
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const frame = useIdleFrame(frameDelay)
  const mainRef = useRef<HTMLElement>(null)
  const updateCheckedRef = useRef(false)

  // Fill the quick-check system row the first time Caregiver Settings opens.
  useEffect(() => {
    if (view === 'caregiver' && !updateCheckedRef.current) {
      updateCheckedRef.current = true
      void handleCheckUpdates()
    }
  }, [view])

  // Move focus into a newly opened panel so keyboard users are not stranded.
  useEffect(() => {
    if (view !== 'home') mainRef.current?.focus()
  }, [view])

  // Family cards must be ready for the everyday user, not only for caregivers.
  useEffect(() => {
    const bridge = window.simpleOS
    if (!bridge) return
    void bridge.loadContacts().then((result) => {
      if (result.ok) setContacts(result.value.contacts)
    })
  }, [])

  // Load only local photos when the calm frame actually opens.
  useEffect(() => {
    if (!frame.active) return
    const bridge = window.simpleOS
    if (!bridge) return
    void bridge.getFramePhotos().then((result) => {
      if (result.ok) setFramePhotos(result.value.photos)
    })
  }, [frame.active])

  // Read the screen people have just moved to, using only local speech.
  useEffect(() => {
    if (view === 'home') {
      readAloud.speak(
        'Home screen. Six buttons: Video Call Family, Web and Email, Photo Album, Daily Reminders, Ask for Help, Caregiver Settings.',
      )
    } else if (view === 'caregiver') {
      readAloud.speak('Caregiver Settings. Quick check, Text size, Computer settings, Remote help, Caregiver PIN.')
    }
  }, [view, readAloud.enabled, readAloud.speak])

  useEffect(() => {
    if (view !== 'reminders' || !reminders.loaded) return
    const items = reminders.store.items
    readAloud.speak(
      items.length === 0
        ? 'Daily Reminders. Nothing here yet.'
        : `Daily Reminders. ${items
            .map((item) => `${item.text}, ${item.done ? 'done' : 'not done'}`)
            .join('. ')}`,
    )
  }, [view, reminders.loaded, reminders.store.items, readAloud.speak])

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
      } else if (tile.action.view === 'family') {
        setView('family')
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
    const loaded = await bridge.loadContacts()
    if (loaded.ok) setContacts(loaded.value.contacts)
    const status = await bridge.getHealthStatus()
    if (status.ok) setHealth(status.value)
    setRecoveryMessage(null)
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

  async function handleCopyHealth(summary: string) {
    try {
      await navigator.clipboard.writeText(summary)
      setRecoveryMessage('Health summary copied. You can paste it into a message.')
    } catch {
      setRecoveryMessage('Copying is not available here. Ask someone to help you share this.')
    }
  }

  async function handleRecovery(action: RecoveryAction): Promise<string> {
    setRecoveryMessage(null)
    const bridge = window.simpleOS
    if (!bridge) {
      const message = friendlyMessage('BRIDGE_UNAVAILABLE')
      setRecoveryMessage(message)
      return message
    }
    const result = await bridge.runRecovery(action)
    const message = result.ok ? result.value.summary : friendlyMessage(result.code)
    setRecoveryMessage(message)
    if (result.ok && action === 'checkUpdates') {
      const refreshed = await bridge.getHealthStatus()
      if (refreshed.ok) setHealth(refreshed.value)
    }
    return message
  }

  async function handleSaveContacts(file: ContactsFile): Promise<string | null> {
    const bridge = window.simpleOS
    if (!bridge) return friendlyMessage('BRIDGE_UNAVAILABLE')
    const result = await bridge.saveContacts(file)
    if (!result.ok) return friendlyMessage(result.code)
    setContacts(file.contacts)
    setNotice({ tone: 'caregiver', message: 'Family cards are saved.' })
    return null
  }

  async function handleCallContact(contact: Contact) {
    setNotice(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setNotice({ tone: 'info', message: friendlyMessage('BRIDGE_UNAVAILABLE') })
      return
    }
    const result = await bridge.callContact(contact.roomUrl)
    setNotice({
      tone: 'info',
      message: result.ok
        ? `Opening the video room for ${contact.name}.`
        : friendlyMessage(result.code),
    })
  }

  function setFrameDelay(value: FrameDelay) {
    setFrameDelayState(value)
    try {
      window.localStorage.setItem(FRAME_KEY, String(value))
    } catch {
      // Best effort only.
    }
  }

  function handleVoiceAction(action: VoiceAction) {
    setNotice(null)
    switch (action) {
      case 'openVideoCall':
        void launchApp('jitsi', 'Video Call Family')
        break
      case 'openInternet':
        void launchApp('firefox', 'Web and Email')
        break
      case 'readReminders':
        setView('reminders')
        break
      case 'askForHelp':
        void launchApp('rustdesk', 'RustDesk')
        break
      case 'goHome':
        setView('home')
        break
    }
  }

  async function handleAdjustVolume(action: VolumeAction) {
    setNotice(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setNotice({ tone: 'info', message: friendlyMessage('BRIDGE_UNAVAILABLE') })
      return
    }
    const result = await bridge.adjustVolume(action)
    if (!result.ok) setNotice({ tone: 'info', message: friendlyMessage(result.code) })
  }

  async function handleAdjustBrightness(action: BrightnessAction) {
    setNotice(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setNotice({ tone: 'info', message: friendlyMessage('BRIDGE_UNAVAILABLE') })
      return
    }
    const result = await bridge.adjustBrightness(action)
    if (!result.ok) setNotice({ tone: 'info', message: friendlyMessage(result.code) })
  }

  async function handleOpenWifiSettings() {
    setNotice(null)
    const bridge = window.simpleOS
    if (!bridge) {
      setNotice({ tone: 'info', message: friendlyMessage('BRIDGE_UNAVAILABLE') })
      return
    }
    const result = await bridge.runAction('networkSettings')
    setNotice({
      tone: 'info',
      message: result.ok ? 'Opening Wi-Fi settings.' : friendlyMessage(result.code),
    })
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main menu
      </a>
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
        <HardwareControls
          status={hardware}
          onOpenWifiSettings={() => void handleOpenWifiSettings()}
          onAdjustVolume={(action) => void handleAdjustVolume(action)}
          onAdjustBrightness={(action) => void handleAdjustBrightness(action)}
        />
        <VoiceControls
          readAloudEnabled={readAloud.enabled}
          speaking={readAloud.speaking}
          readAloudMessage={readAloud.message}
          onToggleReadAloud={() => readAloud.setEnabled(!readAloud.enabled)}
          onStopReading={readAloud.stop}
          voiceAvailable={voice.available}
          voiceStatus={voice.status}
          transcript={voice.transcript}
          actionLabel={voice.actionLabel}
          voiceMessage={voice.message}
          onStartListening={() => void voice.start()}
          onFinishListening={voice.finish}
          onConfirmVoice={voice.confirm}
          onCancelVoice={voice.cancel}
        />
      </header>

      {notice && (
        <NoticeBanner tone={notice.tone} message={notice.message} onDismiss={() => setNotice(null)} />
      )}

      <main className="app__main" id="main-content" ref={mainRef} tabIndex={-1}>
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
                notice={reminders.notice}
                onAdd={reminders.add}
                onToggle={reminders.toggle}
                onRemove={reminders.remove}
                onReset={reminders.reset}
                onDismissError={reminders.clearError}
                onDismissNotice={reminders.clearNotice}
              />
            ) : view === 'family' ? (
              <FamilyPanel
                contacts={contacts}
                onCall={(contact) => void handleCallContact(contact)}
                onFallback={() => void launchApp('jitsi', 'Video Call Family')}
              />
            ) : (
              <CaregiverPanel
                scale={scale}
                onScaleChange={setFontScale}
                hardware={hardware}
                onRefreshHardware={() => void refreshHardware()}
                contacts={contacts}
                onSaveContacts={handleSaveContacts}
                frameDelay={frameDelay}
                onFrameDelayChange={setFrameDelay}
                health={health}
                onCopyHealth={(summary) => void handleCopyHealth(summary)}
                onRecovery={handleRecovery}
                recoveryMessage={recoveryMessage}
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

      {frame.active && <PhotoFrame photos={framePhotos} onDismiss={frame.dismiss} />}
    </div>
  )
}
