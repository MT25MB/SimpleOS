import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyMessage } from '../messages'
import type { ErrorCode } from '../types'

const STORAGE_KEY = 'simpleos.readAloud'

type Speech = {
  speak(utterance: SpeechSynthesisUtterance): void
  cancel(): void
  getVoices(): Array<{ localService: boolean; name: string }>
}

function browserSpeech(): Speech | null {
  if (typeof window === 'undefined') return null
  const synth = (window as unknown as { speechSynthesis?: Speech }).speechSynthesis
  return synth ?? null
}

function hasLocalVoice(synth: Speech | null): boolean {
  if (!synth) return false
  try {
    return synth.getVoices().some((voice) => voice.localService)
  } catch {
    return false
  }
}

/**
 * Reads the current screen aloud using a local browser voice when one exists,
 * otherwise a fixed espeak-ng command in the main process. No audio or text is
 * sent anywhere off the machine. Escape and the header button both stop it.
 */
export function useReadAloud() {
  const [enabled, setEnabledState] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      return false
    }
  })
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    browserSpeech()?.cancel()
    void window.simpleOS?.stopLocalSpeech()
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return
      stop()
      setError(null)
      const synth = browserSpeech()
      if (synth && hasLocalVoice(synth) && typeof SpeechSynthesisUtterance !== 'undefined') {
        const utterance = new SpeechSynthesisUtterance(text)
        const local = synth.getVoices().find((voice) => voice.localService)
        if (local) utterance.voice = local as SpeechSynthesisVoice
        utterance.rate = 0.95
        utterance.onstart = () => setSpeaking(true)
        utterance.onend = () => setSpeaking(false)
        utterance.onerror = () => setSpeaking(false)
        synth.speak(utterance)
        setSpeaking(true)
        return
      }

      const bridge = window.simpleOS
      if (!bridge) {
        setError('BRIDGE_UNAVAILABLE')
        return
      }
      void bridge.speakLocally(text).then((result) => {
        if (!result.ok) {
          setError(result.code)
          return
        }
        setSpeaking(true)
        // espeak has no completion event; estimate from word count, then reset.
        const words = text.split(/\s+/).length
        timer.current = window.setTimeout(() => {
          timer.current = null
          setSpeaking(false)
        }, Math.min(30_000, 1_500 + words * 250))
      })
    },
    [enabled, stop],
  )

  const setEnabled = useCallback(
    (next: boolean) => {
      if (!next) stop()
      setEnabledState(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        // Persistence is best effort only.
      }
    },
    [stop],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && speaking) {
        stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [speaking, stop])

  useEffect(() => () => stop(), [stop])

  return { enabled, setEnabled, speaking, speak, stop, error, message: error ? friendlyMessage(error) : null }
}
