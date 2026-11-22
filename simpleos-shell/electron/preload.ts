/*
 * Preload bridge (TypeScript source). With sandbox: true only a small Electron
 * subset of `require` is available in the compiled file: contextBridge and
 * ipcRenderer.
 *
 * The renderer receives a fixed set of methods. Every main-process handler
 * returns a plain { ok, code? } result, so no stack trace or terminal output
 * can cross this boundary.
 *
 * Compiled to dist-electron/preload.js by `npm run compile:electron`.
 *
 * No Node.js APIs, ipcRenderer instance, or arbitrary channel names are exposed
 * to the renderer — only these fixed, allowlisted functions.
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
  // Single allowlisted dispatcher for caregiver/help actions. The main process
  // validates the action name; no shell strings ever cross this boundary.
  runAction: (action) => ipcRenderer.invoke('simpleos:run-action', action),
  // Hardware controls are fixed keys; the main process never accepts a
  // command, percentage, device path or network name from this side.
  getHardwareStatus: () => ipcRenderer.invoke('simpleos:hardware:status'),
  adjustVolume: (action) => ipcRenderer.invoke('simpleos:hardware:volume', action),
  adjustBrightness: (action) => ipcRenderer.invoke('simpleos:hardware:brightness', action),
  // Local-only voice: text/audio go to fixed handlers on this machine, never
  // to a network service. The renderer only sees a result object.
  speakLocally: (text) => ipcRenderer.invoke('simpleos:voice:speak', text),
  stopLocalSpeech: () => ipcRenderer.invoke('simpleos:voice:stop'),
  transcribeAudio: (audioBase64) => ipcRenderer.invoke('simpleos:voice:transcribe', audioBase64),
  // Family cards and the photo frame only read/write fixed local paths.
  loadContacts: () => ipcRenderer.invoke('simpleos:contacts:load'),
  saveContacts: (payload) => ipcRenderer.invoke('simpleos:contacts:save', payload),
  saveAvatar: (contactId, imageBase64) =>
    ipcRenderer.invoke('simpleos:contacts:avatar', contactId, imageBase64),
  getAvatar: (fileName) => ipcRenderer.invoke('simpleos:contacts:avatar:get', fileName),
  callContact: (roomUrl) => ipcRenderer.invoke('simpleos:contacts:call', roomUrl),
  getFramePhotos: () => ipcRenderer.invoke('simpleos:photos:frame'),
  getHealthStatus: () => ipcRenderer.invoke('simpleos:health'),
  runRecovery: (action) => ipcRenderer.invoke('simpleos:recovery', action),
}

contextBridge.exposeInMainWorld('simpleOS', bridge)
