import type { KeyboardEvent } from 'react'
import type { VoiceStatus } from '../hooks/useVoiceNavigation'

interface VoiceControlsProps {
  readAloudEnabled: boolean
  speaking: boolean
  readAloudMessage: string | null
  onToggleReadAloud: () => void
  onStopReading: () => void
  voiceAvailable: boolean
  voiceStatus: VoiceStatus
  transcript: string
  actionLabel: string | null
  voiceMessage: string | null
  onStartListening: () => void
  onFinishListening: () => void
  onConfirmVoice: () => void
  onCancelVoice: () => void
}

function speakKey(event: KeyboardEvent<HTMLButtonElement>, start: boolean, action: () => void) {
  if ((event.key === ' ' || event.key === 'Enter') && (!start || !event.repeat)) {
    event.preventDefault()
    action()
  }
}

/** Header controls for local read-aloud and push-to-talk navigation. */
export function VoiceControls({
  readAloudEnabled,
  speaking,
  readAloudMessage,
  onToggleReadAloud,
  onStopReading,
  voiceAvailable,
  voiceStatus,
  transcript,
  actionLabel,
  voiceMessage,
  onStartListening,
  onFinishListening,
  onConfirmVoice,
  onCancelVoice,
}: VoiceControlsProps) {
  return (
    <section className="voice" aria-label="Read aloud and voice commands">
      <button
        type="button"
        className="button voice__button"
        aria-pressed={readAloudEnabled}
        onClick={speaking ? onStopReading : onToggleReadAloud}
      >
        {speaking ? 'Stop Reading' : readAloudEnabled ? 'Read Aloud: On' : 'Read Aloud: Off'}
      </button>

      {voiceAvailable ? (
        <button
          type="button"
          className="button voice__button"
          onPointerDown={onStartListening}
          onPointerUp={onFinishListening}
          onPointerLeave={onFinishListening}
          onKeyDown={(event) => speakKey(event, true, onStartListening)}
          onKeyUp={(event) => speakKey(event, false, onFinishListening)}
        >
          {voiceStatus === 'listening' ? 'Listening…' : 'Hold to Speak'}
        </button>
      ) : (
        <p className="voice__note">Voice commands are not set up on this computer.</p>
      )}

      {voiceStatus === 'transcribing' && (
        <p className="voice__status" role="status">
          Checking what you said…
        </p>
      )}

      {voiceStatus === 'heard' && (
        <div className="voice__heard" role="status">
          <p className="voice__status">
            I heard: “{transcript}” — {actionLabel}
          </p>
          <button type="button" className="button button--small" onClick={onConfirmVoice}>
            Confirm
          </button>
          <button
            type="button"
            className="button button--small button--secondary"
            onClick={onCancelVoice}
          >
            Cancel
          </button>
        </div>
      )}

      {(voiceMessage || readAloudMessage) && (
        <p className="voice__status" role="alert">
          {voiceMessage ?? readAloudMessage}
        </p>
      )}
    </section>
  )
}
