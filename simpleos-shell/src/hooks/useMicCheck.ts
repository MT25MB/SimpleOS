import { useCallback, useRef, useState } from 'react'
import { friendlyMessage } from '../messages'

export type MicCheckState = 'idle' | 'listening' | 'checking' | 'ready' | 'unavailable'

/** Convert a short recording to base64 without any network access. */
export function recordingToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

const RECORD_MS = 3_000

/**
 * A short, local microphone check for setup. Speech is transcribed by the same
 * offline Vosk path used by Hold to Speak; nothing is uploaded.
 */
export function useMicCheck() {
  const [state, setState] = useState<MicCheckState>('idle')
  const [message, setMessage] = useState('')
  const [heard, setHeard] = useState('')
  const stopRef = useRef<(() => void) | null>(null)

  const available =
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)

  const start = useCallback(async () => {
    if (!available) {
      setState('unavailable')
      setMessage('A microphone check is not available in this preview. On the computer, use the Hold to Speak button instead.')
      return
    }
    const bridge = window.simpleOS
    if (!bridge) {
      setState('unavailable')
      setMessage(friendlyMessage('BRIDGE_UNAVAILABLE'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      const finished = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
      })
      const stop = () => {
        if (recorder.state !== 'inactive') recorder.stop()
      }
      stopRef.current = stop
      setState('listening')
      recorder.start()
      const timer = window.setTimeout(stop, RECORD_MS)
      await finished
      window.clearTimeout(timer)
      stopRef.current = null
      stream.getTracks().forEach((track) => track.stop())

      setState('checking')
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      const base64 = await recordingToBase64(blob)
      const result = await bridge.transcribeAudio(base64)
      if (!result.ok) {
        setState('unavailable')
        setMessage(friendlyMessage(result.code))
        return
      }
      const text = result.value.text.trim()
      setHeard(text)
      setState('ready')
      setMessage(text ? `We heard: “${text}”` : 'Your microphone is ready.')
    } catch {
      setState('unavailable')
      setMessage('Microphone access was not granted. A caregiver can check it again later.')
    }
  }, [available])

  const stop = useCallback(() => {
    stopRef.current?.()
  }, [])

  return { state, message, heard, available, start, stop }
}
