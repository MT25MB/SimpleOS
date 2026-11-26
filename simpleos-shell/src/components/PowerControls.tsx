interface PowerControlsProps {
  onRestart: () => void
  onShutDown: () => void
}

/** Two clearly labelled power actions with a calm confirmation step. */
export function PowerControls({ onRestart, onShutDown }: PowerControlsProps) {
  return (
    <div className="power" role="group" aria-label="Computer power">
      <button type="button" className="button button--small" onClick={onRestart}>
        Restart computer
      </button>
      <button type="button" className="button button--small button--secondary" onClick={onShutDown}>
        Shut down
      </button>
    </div>
  )
}
