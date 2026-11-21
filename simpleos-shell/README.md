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

Reminders are stored as a JSON file in Electron's `userData` directory through a
narrow IPC API. When running the Vite web preview (no Electron bridge), they
fall back to `localStorage` so UI work still works.

- Add a reminder with an optional time, shown in plain English ("at 5:00 PM").
- **Mark Done** toggles a reminder; a new day clears done marks automatically
  and keeps the list.
- **Start a new day** resets all done marks immediately.
- Reminders and errors use calm, actionable language — never terminal output.

## Caregiver settings

- On first use the caregiver is prompted to **set a PIN**. There is no default
  or hardcoded PIN.
- The PIN is hashed with scrypt and a random salt in the main process and saved
  with owner-only permissions. Only the hash lives on disk; the renderer never
  sees it. `timingSafeEqual` is used for verification.
- Caregiver Settings offers large, plain-language buttons for **Wi-Fi & Network**,
  **Printers**, **Open RustDesk**, and **Check for updates**. Update status is
  translated into a short sentence such as "Your system is up to date. Version
  41." — raw `rpm-ostree` output is never displayed.
- The `senior` account created at first boot is never added to `wheel`/`sudo`.

## Safety and status messages

- IPC handlers return only `{ ok, code? }`. The renderer maps codes to messages
  from `src/messages.ts`, so stack traces and terminal jargon cannot reach the
  screen.
- Actions that matter — especially screen sharing — show a clear, dismissible
  banner with a distinct visual indicator.

## Development

```sh
npm install
npm run dev          # Vite web preview (http://localhost:5173)
```

In a second terminal, run the real Electron shell against that preview:

```sh
VITE_DEV_SERVER_URL=http://localhost:5173 npm run dev:electron
```

In the web preview, features that need the desktop (PIN, settings, app launch)
show a plain-English "works in the SimpleOS desktop app" message. Reminders
still work via the browser fallback.

## Build and package

```sh
npm run build          # type-checks Electron + renderer, Vite bundle, compile main/preload
npm run build:electron # build, then produce a Linux AppImage in release/
npm run package        # package an existing dist/ without rebuilding
```

The Electron entry points are TypeScript sources in `electron/main.ts` and
`electron/preload.ts`. `npm run compile:electron` bundles them (with esbuild) to
standalone CommonJS files in `electron/dist/`, which is what Electron actually
loads. This keeps the sandbox-compatible preload as a single file while sharing
IPC types with the renderer.

## Security boundary

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The preload exposes a fixed set of methods. Main-process allowlists map
  renderer keys to fixed commands; renderer input is never used as a command,
  argument, or URL.

## Configuration

`SIMPLEOS_OZONE_PLATFORM` — set to `x11` to debug on a non-Wayland host. The
default is `wayland`. There is no PIN environment variable by design: the PIN
is set through the app and stored as a salted hash.
