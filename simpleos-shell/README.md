# SimpleOS Shell

The full-screen home launcher shown when the `senior` session starts. It is a
React + TypeScript + Vite renderer inside a locked-down Electron window.

## Accessibility

- Root text is at least **18px** and scales with the **Normal / Large / Extra
  Large** control in the header (1.0x / 1.15x / 1.35x). The choice is saved
  locally.
- High-contrast slate palette with a bright yellow focus ring.
- Every tile and control is a native, keyboard-accessible element with a target
  of at least 48px, and tiles are much larger than that.
- `prefers-reduced-motion` is respected.

## Daily reminders

Reminders are stored as `~/.config/simpleos/reminders.json` (or
`$XDG_CONFIG_HOME/simpleos/reminders.json`) through a narrow IPC API. Only the
main process touches the filesystem. When running the Vite web preview (no
Electron bridge), reminders fall back to `localStorage` so UI work still works.

- Add a reminder with an optional time, shown in plain English ("at 5:00 PM").
- **Mark Done** toggles a reminder; a new day clears done marks automatically
  and keeps the list.
- **Start a new day** resets all done marks immediately.
- Reminders and errors use calm, actionable language — never terminal output.

## Caregiver settings

- On first use the caregiver is prompted to **set a PIN**. There is no default
  or hardcoded PIN.
- PIN entry is a dedicated full-screen component (`PinScreen`). The PIN exists
  only in the transient input fields, is sent straight to IPC for verification,
  and is cleared from component state immediately afterwards. It is never
  stored in `localStorage` or any other renderer-side storage.
- The PIN is hashed with `scryptSync` and a random salt in the main process and
  saved with owner-only permissions. Only the hash lives on disk; the renderer
  never sees it. `timingSafeEqual` is used for verification.
- Caregiver Settings offers large, plain-language buttons for **Wi-Fi & Network**,
  **Printers**, **Open RustDesk**, and **Check for updates**. Update status is
  translated into a short sentence such as "Your system is up to date. Version
  41." — raw `rpm-ostree` output is never displayed.
- The `senior` account created at first boot is never added to `wheel`/`sudo`.

## App launcher

Tiles call `window.simpleOS.launchApp(target)` with one of a small set of fixed
target names. The main process maps each name to a fixed flatpak command; a
renderer-supplied string is only ever used as a lookup key.

| Target | Tile | Command |
| --- | --- | --- |
| `jitsi` | Video Call Family | Firefox → `https://meet.jit.si` |
| `firefox` | Web & Email | `org.mozilla.firefox` |
| `photos` | Photo Album | `org.gnome.Loupe` |
| `rustdesk` | Ask for Help | `com.rustdesk.RustDesk` |

## Safety and status messages

- IPC handlers return only `{ ok, code? }`. The renderer maps codes to messages
  from `src/messages.ts`, so stack traces and terminal jargon cannot reach the
  screen.
- Actions that matter — especially screen sharing — show a clear, dismissible
  banner with a distinct visual indicator.

## Development

```sh
npm install
npm run dev
```

`npm run dev` runs Vite and Electron **concurrently**: Vite serves the renderer
on http://localhost:5173, `wait-on` holds Electron until that server is ready,
then Electron opens in a full-screen kiosk window against it.

For a browser-only preview without Electron:

```sh
npm run dev:vite
```

In the browser preview, features that need the desktop (PIN, settings, app
launch) show a plain-English "works in the SimpleOS desktop app" message.
Reminders still work via the browser fallback.

## Build and package

```sh
npm run build          # type-checks Electron + renderer, Vite bundle, compile main/preload
npm run build:electron # build, then package to an unpacked Linux directory
npm run package        # package an existing build without rebuilding
```

The Electron entry points are TypeScript sources in `electron/main.ts` and
`electron/preload.ts`. `npm run compile:electron` bundles them (with esbuild) to
standalone CommonJS files in `dist-electron/` (`main.js` and `preload.js`),
which is what Electron actually loads. This keeps the sandbox-compatible
preload as a single file while sharing IPC types with the renderer.
`electron-builder.yml` packages Linux as a `dir` in `release/`.

Electron uses `--ozone-platform-hint=auto`, so it selects the native Wayland
backend whenever a Wayland session is detected.

## Security boundary

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The preload exposes a fixed set of methods. Main-process allowlists map
  renderer keys to fixed commands; renderer input is never used as a command,
  argument, or URL.

## Configuration

`SIMPLEOS_OZONE_PLATFORM` — set to `x11` to debug on a non-Wayland host. The
default is `wayland`. There is no PIN environment variable by design: the PIN
is set through the app and stored as a salted hash.
