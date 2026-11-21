/*
 * Preload bridge (TypeScript source). With sandbox: true only a small Electron
 * subset of `require` is available in the compiled file: contextBridge and
 * ipcRenderer.
 *
 * The renderer receives a fixed set of methods. Every main-process handler
 * returns a plain { ok, code? } result, so no stack trace or terminal output
 * can cross this boundary.
 *
 * Compiled to electron/dist/preload.cjs by `npm run compile:electron`.
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { SimpleOSBridge } from '../src/types'

const bridge: SimpleOSBridge = {
  launchApp: (target) => ipcRenderer.invoke('simpleos:launch-app', target),
  loadReminders: () => ipcRenderer.invoke('simpleos:reminders:load'),
  saveReminders: (payload) => ipcRenderer.invoke('simpleos:reminders:save', payload),
  hasPin: () => ipcRenderer.invoke('simpleos:pin:has'),
  unlockWithPin: (pin) => ipcRenderer.invoke('simpleos:pin:unlock', pin),
  setPin: (currentPin, newPin) =>
    ipcRenderer.invoke('simpleos:pin:set', currentPin, newPin),
  openSettings: (target) => ipcRenderer.invoke('simpleos:open-settings', target),
  getUpdateStatus: () => ipcRenderer.invoke('simpleos:update-status'),
}

contextBridge.exposeInMainWorld('simpleOS', bridge)
