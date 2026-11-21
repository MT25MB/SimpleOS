interface NoticeBannerProps {
  tone: 'info' | 'sharing' | 'caregiver'
  message: string
  onDismiss?: () => void
}

/** A calm but unmistakable indicator for actions that affect the user. */
export function NoticeBanner({ tone, message, onDismiss }: NoticeBannerProps) {
  return (
    <div className={`notice notice--${tone}`} role="status">
      <span className="notice__mark" aria-hidden="true">
        {tone === 'sharing' ? '◉' : tone === 'caregiver' ? '◆' : '✓'}
      </span>
      <span className="notice__message">{message}</span>
      {onDismiss && (
        <button type="button" className="notice__dismiss" onClick={onDismiss}>
          Got it
        </button>
      )}
    </div>
  )
}
