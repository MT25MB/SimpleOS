import { describe, it, expect } from 'vitest'
import { TILES } from './tiles'
import { ALLOWED_LAUNCH_TARGETS } from './launchTargets'

describe('home tiles', () => {
  it('has exactly the six expected tiles in order', () => {
    expect(TILES.map((tile) => tile.title)).toEqual([
      'Video Call Family',
      'Web & Email',
      'Photo Album',
      'Daily Reminders',
      'Ask for Help',
      'Caregiver Settings',
    ])
  })

  it('uses unique ids', () => {
    const ids = TILES.map((tile) => tile.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only launches allowlisted targets', () => {
    for (const tile of TILES) {
      if (tile.action.kind === 'launch') {
        expect(ALLOWED_LAUNCH_TARGETS).toContain(tile.action.target)
      }
    }
  })
})
