import type { LauncherTile } from '../types'

/** The six calm, fixed tiles of the SimpleOS home screen. */
export const TILES: readonly LauncherTile[] = [
  {
    id: 'video-calls',
    title: 'Video Call Family',
    subtitle: 'See and talk to family',
    icon: 'video',
    action: { kind: 'view', view: 'family' },
  },
  {
    id: 'web-email',
    title: 'Web & Email',
    subtitle: 'Websites, email and messages',
    icon: 'web',
    action: { kind: 'launch', target: 'firefox' },
  },
  {
    id: 'photo-album',
    title: 'Photo Album',
    subtitle: 'Look at your photos',
    icon: 'photos',
    action: { kind: 'launch', target: 'photos' },
  },
  {
    id: 'daily-reminders',
    title: 'Daily Reminders',
    subtitle: 'Your list for today',
    icon: 'reminders',
    action: { kind: 'view', view: 'reminders' },
  },
  {
    id: 'ask-for-help',
    title: 'Ask for Help',
    subtitle: 'Share your screen so someone can help',
    icon: 'help',
    action: { kind: 'launch', target: 'rustdesk' },
  },
  {
    id: 'caregiver-settings',
    title: 'Caregiver Settings',
    subtitle: 'For caregivers only',
    icon: 'settings',
    action: { kind: 'view', view: 'caregiver' },
  },
] as const
