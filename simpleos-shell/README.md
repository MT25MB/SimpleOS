# SimpleOS Shell

The full-screen home launcher that appears when the `senior` session starts. It is a React and TypeScript renderer inside a locked-down Electron window.

## Accessibility

Text starts at 18px and never goes smaller. The Normal, Large, and Extra Large control in the header scales the whole interface, and your choice is saved on the computer.

The palette is high-contrast slate with a bright yellow focus ring. Every control is a real HTML element you can reach with a keyboard, and every target is at least 48px across. Tiles are much bigger than that. Reduced motion is respected.

## Daily reminders

Reminders live in `~/.config/simpleos/reminders.json`, or under `$XDG_CONFIG_HOME` if your system sets it. Only the main process reads and writes the file. In the Vite browser preview there is no Electron bridge, so reminders use `localStorage` instead.

You can add a reminder with an optional time, mark it done, remove it, or start a new day. A fresh day clears the done marks but keeps the list. Errors and confirmations are written in plain language, never as terminal output.

## Caregiver settings

The first time you open Settings you are asked to choose a PIN. There is no default PIN anywhere in the code.

The PIN is entered on its own full-screen page. It stays in the input fields just long enough to be sent to the main process, then those fields are cleared. It is never written to `localStorage` or any other browser storage. The main process hashes it with scrypt and a random salt, saves only the hash with owner-only permissions, and verifies it with a constant-time comparison.

Inside Settings there are large buttons for Wi-Fi and network, printers, RustDesk, and checking for updates. Update results are turned into a short sentence like "Your system is up to date. Version 41." Raw `rpm-ostree` output never reaches the screen. The `senior` account created during first boot is never added to `wheel` or `sudo`.

## How apps open

Each tile calls `window.simpleOS.launchApp(target)` with a fixed name. The main process looks that name up in an allowlist and runs a fixed flatpak command. Text from the renderer is only ever used as a lookup key, never as a command, argument, or URL.

| Name | Tile | Command |
| --- | --- | --- |
| `jitsi` | Video Call Family | Firefox at `https://meet.jit.si` |
| `firefox` | Web & Email | `org.mozilla.firefox` |
| `photos` | Photo Album | `org.gnome.Loupe` |
| `rustdesk` | Ask for Help | `com.rustdesk.RustDesk` |

Caregiver actions use a second allowlist through `window.simpleOS.runAction(action)`. The accepted names are `screenShare`, `networkSettings`, `printerSettings`, `checkUpdates`, and `triggerUpdate`.

## Messages

IPC handlers return only `{ ok, code? }`. The renderer turns those codes into the calm messages in `src/messages.ts`, so a stack trace or terminal error can never appear on screen. Actions that matter, especially screen sharing, show a banner you can dismiss.

## Tests

```sh
npm run test        # run once
npm run test:watch  # keep running while you edit
```

The suite covers reminders in both Electron and the browser, text scaling, the PIN screen, tile-to-IPC wiring, and contracts for the Electron settings and system configs. CI runs it before the shell build.

## Development

```sh
npm install
npm run dev
```

That starts Vite and Electron together. Vite serves the renderer on http://localhost:5173, `wait-on` waits until it is ready, and Electron then opens a full-screen kiosk window against it.

For a browser-only preview, run `npm run dev:vite`. Features that need the desktop show a plain "works in the SimpleOS desktop app" message there. Reminders still work.

## Build and package

```sh
npm run build          # type-check, bundle, compile Electron files
npm run build:electron # build, then package as an unpacked Linux directory
npm run package        # package an existing build
```

The Electron entry points are TypeScript files in `electron/main.ts` and `electron/preload.ts`. `npm run compile:electron` bundles them into `dist-electron/main.js` and `dist-electron/preload.js`, which are the files Electron actually loads. `electron-builder.yml` produces a directory in `release/`.

Electron starts with `--ozone-platform-hint=auto`, so it picks the native Wayland backend when it finds a Wayland session.

## Security

Context isolation is on, Node integration is off, and the sandbox is on. The preload exposes a fixed set of methods. Main-process allowlists map each name to a fixed command, and nothing typed in the renderer becomes a shell string.

## Configuration

Set `SIMPLEOS_OZONE_PLATFORM=x11` only when debugging on a machine without Wayland. There is no PIN environment variable by design. The PIN is chosen in the app and stored as a salted hash.
