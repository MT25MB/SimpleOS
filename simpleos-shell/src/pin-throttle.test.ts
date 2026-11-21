import { describe, it, expect } from 'vitest'
import {
  PIN_COOLDOWN_MS,
  PIN_MAX_ATTEMPTS,
  createPinThrottle,
} from '../electron/pin-throttle'

describe('PIN attempt cooldown', () => {
  it('allows attempts until the limit is reached', () => {
    let clock = 1_000
    const throttle = createPinThrottle(() => clock)
    for (let i = 0; i < PIN_MAX_ATTEMPTS - 1; i += 1) {
      throttle.recordFailure()
      expect(throttle.allowed()).toBe(true)
    }
  })

  it('locks out after the configured number of failures', () => {
    let clock = 1_000
    const throttle = createPinThrottle(() => clock)
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i += 1) throttle.recordFailure()
    expect(throttle.allowed()).toBe(false)
  })

  it('stays locked until the full cooldown has passed', () => {
    let clock = 1_000
    const throttle = createPinThrottle(() => clock)
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i += 1) throttle.recordFailure()

    clock += PIN_COOLDOWN_MS - 1
    expect(throttle.allowed()).toBe(false)
    clock += 1
    expect(throttle.allowed()).toBe(true)
  })

  it('recovers after a successful unlock', () => {
    let clock = 1_000
    const throttle = createPinThrottle(() => clock)
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i += 1) throttle.recordFailure()
    expect(throttle.allowed()).toBe(false)

    throttle.reset()
    expect(throttle.allowed()).toBe(true)
  })

  it('starts a fresh cooldown after the lock expires and fails again', () => {
    let clock = 1_000
    const throttle = createPinThrottle(() => clock)
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i += 1) throttle.recordFailure()
    clock += PIN_COOLDOWN_MS
    expect(throttle.allowed()).toBe(true)

    throttle.recordFailure()
    expect(throttle.allowed()).toBe(true)
  })
})
