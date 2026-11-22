import type { VoiceAction } from './types'

/**
 * Local phrase matching. Nothing here calls a service: a transcript from the
 * offline recognizer is matched against fixed phrases, and only the resulting
 * action name is allowed to reach the rest of the app.
 */
const PHRASES: Readonly<Record<VoiceAction, readonly RegExp[]>> = Object.freeze({
  openVideoCall: Object.freeze([/video call/i, /call (?:the )?family/i, /start a call/i]),
  openInternet: Object.freeze([/open (?:the )?internet/i, /web browser/i, /open (?:the )?web/i]),
  readReminders: Object.freeze([/read (?:my )?reminders/i, /what are my reminders/i, /reminders/i]),
  askForHelp: Object.freeze([/ask for help/i, /get help/i, /call (?:my )?caregiver/i]),
  goHome: Object.freeze([/go home/i, /home screen/i, /main menu/i]),
})

export const VOICE_ACTION_LABELS: Readonly<Record<VoiceAction, string>> = Object.freeze({
  openVideoCall: 'Open Video Call',
  openInternet: 'Open Internet',
  readReminders: 'Read Reminders',
  askForHelp: 'Ask for Help',
  goHome: 'Go Home',
})

export const VOICE_ACTIONS = Object.keys(VOICE_ACTION_LABELS) as VoiceAction[]

/** Return only an allowlisted action, never the raw transcript. */
export function matchVoiceAction(transcript: string): VoiceAction | null {
  const clean = transcript.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (!clean || clean.length > 200) return null
  for (const action of VOICE_ACTIONS) {
    if (PHRASES[action].some((pattern) => pattern.test(clean))) return action
  }
  return null
}
