import { useState, type FormEvent } from 'react'
import { friendlyMessage } from '../messages'
import type { ErrorCode, RemindersFile } from '../types'

interface RemindersPanelProps {
  store: RemindersFile
  loaded: boolean
  error: ErrorCode | null
  notice: string | null
  onAdd: (text: string, time: string) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onReset: () => void
  onDismissError: () => void
  onDismissNotice: () => void
}

function formatTime(value: string): string {
  if (!value) return 'Any time'
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 'Any time'
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return `at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

/** A short, local list for the day with large, obvious controls. */
export function RemindersPanel({
  store,
  loaded,
  error,
  notice,
  onAdd,
  onToggle,
  onRemove,
  onReset,
  onDismissError,
  onDismissNotice,
}: RemindersPanelProps) {
  const [text, setText] = useState('')
  const [time, setTime] = useState('')

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!text.trim()) return
    onAdd(text, time)
    setText('')
    setTime('')
  }

  const doneCount = store.items.filter((item) => item.done).length

  return (
    <section className="panel" aria-labelledby="reminders-title">
      <h2 id="reminders-title">Daily Reminders</h2>
      <p className="panel__intro">A few things to remember today.</p>

      {error && (
        <p className="status status--error" role="alert">
          {friendlyMessage(error)}{' '}
          <button type="button" className="status__dismiss" onClick={onDismissError}>
            Got it
          </button>
        </p>
      )}

      {notice && (
        <p className="status status--info" role="status">
          {notice}{' '}
          <button type="button" className="status__dismiss" onClick={onDismissNotice}>
            Got it
          </button>
        </p>
      )}

      {!loaded ? (
        <p className="panel__empty" role="status">Opening your reminders…</p>
      ) : (
        <>
          <form className="reminders__form" onSubmit={handleAdd}>
            <label htmlFor="reminder-input">New reminder</label>
            <div className="reminders__row">
              <input
                id="reminder-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Call Anna"
                maxLength={200}
              />
              <label className="reminders__time" htmlFor="reminder-time">
                Time <span>(optional)</span>
                <input
                  id="reminder-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
              <button type="submit" className="button">Add reminder</button>
            </div>
          </form>

          <div className="reminders__toolbar">
            <p className="reminders__summary">
              {store.items.length === 0
                ? 'Nothing here yet.'
                : `${doneCount} of ${store.items.length} done today.`}
            </p>
            <button
              type="button"
              className="button button--secondary"
              onClick={onReset}
              disabled={store.items.length === 0}
            >
              Start a new day
            </button>
          </div>

          {store.items.length === 0 ? (
            <p className="panel__empty" role="status">
              Add one above, and it will be here tomorrow too.
            </p>
          ) : (
            <ul className="reminders__list">
              {store.items.map((item) => (
                <li
                  key={item.id}
                  className={`reminders__item${item.done ? ' reminders__item--done' : ''}`}
                >
                  <div className="reminders__text">
                    <span className="reminders__label">{item.text}</span>
                    <span className="reminders__time-label">{formatTime(item.time)}</span>
                  </div>
                  <div className="reminders__actions">
                    <button
                      type="button"
                      className={`button${item.done ? ' button--secondary' : ''}`}
                      aria-pressed={item.done}
                      aria-label={`${item.done ? 'Mark not done' : 'Mark done'}: ${item.text}`}
                      onClick={() => onToggle(item.id)}
                    >
                      {item.done ? 'Done ✓' : 'Mark Done'}
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      aria-label={`Remove: ${item.text}`}
                      onClick={() => onRemove(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
