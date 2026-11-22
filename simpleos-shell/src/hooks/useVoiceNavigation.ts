import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyMessage } from '../messages'
import type { ErrorCode, VoiceAction } from '../types'
import { VOICE_ACTION_LABELS, matchVoiceAction } from '../voiceActions'

export type VoiceStatus = 'idle' | 'listening' | 'transcribing' | 'heard'

const MAX_RECORDING_MS = 6_000

function toBase64(blob: Blob, done: (value: string) => void) {
  const reader = new FileReader()
  reader.onload = () => {
    const result = reader.result
    done(typeof result === 'string' ? result.split(',')[1] ?? '' : '')
  }
  reader.onerror = () => done('')
  reader.readAsDataURL(blob)
}

/**
 * Push-to-talk navigation. Audio is recorded locally, handed to the main
 * process through one fixed IPC channel, transcribed by an offline model, and
 * reduced to an allowlisted action name. Nothing is uploaded.
 */
export function useVoiceNavigation(onAction: (action: VoiceAction) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [action, setAction] = useState<VoiceAction | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const stopTimer = useRef<number | null>(null)

  const available =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'

  const reset = useCallback(() => {
    setStatus('idle')
    setTranscript('')
    setAction(null)
    setMessage(null)
  }, [])

  const finish = useCallback(() => {
    if (stopTimer.current !== null) {
      window.clearTimeout(stopTimer.current)
      stopTimer.current = null
    }
    const active = recorder.current
    if (active && active.state !== 'inactive') active.stop()
    else if (active) active.onstop?.(new Event('stop') as Event)
  }, [])

  const start = useCallback(async () => {
    if (!available) {
      setMessage(friendlyMessage('VOICE_UNAVAILABLE'))
      return
    }
    try {
      reset()
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      chunks.current = []
      const rec = new MediaRecorder(media)
      recorder.current = rec
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }
      rec.onstop = () => {
        media.getTracks().forEach((track) => track.stop())
        stream.current = null
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        chunks.current = []
        recorder.current = null
        setStatus('transcribing')
        toBase64(blob, (base64) => {
          const bridge = window.simpleOS
          if (!bridge || !base64) {
            setMessage(friendlyMessage('VOICE_UNAVAILABLE'))
            setStatus('idle')
            return
          }
          void bridge.transcribeAudio(base64).then((result) => {
            if (!result.ok) {
              setMessage(friendlyMessage(result.code as ErrorCode))
              setStatus('idle')
              return
            }
            const heard = result.value.text.trim()
            setTranscript(heard)
            const matched = matchVoiceAction(heard)
            if (matched) {
              setAction(matched)
              setStatus('heard')
            } else {
              setMessage("I heard that, but it isn't one of the five voice commands.")
              setStatus('idle')
            }
          })
        })
      }
      rec.start()
      setStatus('listening')
      stopTimer.current = window.setTimeout(() => finish(), MAX_RECORDING_MS)
    } catch {
      setMessage(friendlyMessage('VOICE_UNAVAILABLE'))
      setStatus('idle')
    }
  }, [available, finish, reset])

  const confirm = useCallback(() => {
    if (!action) return
    onAction(action)
    reset()
  }, [action, onAction, reset])

  useEffect(
    () => () => {
      if (stopTimer.current !== null) window.clearTimeout(stopTimer.current)
      recorder.current?.stop()
      stream.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  return {
    available,
    status,
    transcript,
    action,
    actionLabel: action ? VOICE_ACTION_LABELS[action] : null,
    message,
    start,
    finish,
    confirm,
    cancel: reset,
  }
}
