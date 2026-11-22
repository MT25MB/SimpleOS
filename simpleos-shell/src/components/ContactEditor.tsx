import { useState, type ChangeEvent } from 'react'
import { isAllowedVideoRoom } from '../../electron/allowlists'
import type { Contact, ContactsFile } from '../types'

interface ContactEditorProps {
  contacts: Contact[]
  onSave: (file: ContactsFile) => Promise<string | null>
}

const MAX_CONTACTS = 4

function newContact(): Contact {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 24)
      : Math.random().toString(36).slice(2, 22)
  return { id, name: '', relationship: '', avatarFile: null, roomUrl: '' }
}

/** Caregiver-only editor for the large family call cards. */
export function ContactEditor({ contacts, onSave }: ContactEditorProps) {
  const [draft, setDraft] = useState<Contact[]>(contacts)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update(id: string, patch: Partial<Contact>) {
    setDraft((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  async function chooseAvatar(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || file.size > 4 * 1024 * 1024) {
      setError('Please choose a photo smaller than 4 MB.')
      return
    }
    const bridge = window.simpleOS
    if (!bridge) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(file)
    })
    const base64 = dataUrl.split(',')[1] ?? ''
    const result = await bridge.saveAvatar(id, base64)
    if (!result.ok) {
      setError("That photo couldn't be saved. Try a smaller one.")
      return
    }
    update(id, { avatarFile: result.value.fileName })
    setError(null)
  }

  async function save() {
    setError(null)
    if (draft.some((item) => !item.name.trim())) {
      setError('Give each person a name.')
      return
    }
    if (draft.some((item) => !isAllowedVideoRoom(item.roomUrl))) {
      setError('Use an https video room on an approved video site.')
      return
    }
    setBusy(true)
    try {
      const message = await onSave({ contacts: draft })
      if (message) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="contacts">
      <h3 className="panel__subheading">Family call cards</h3>
      <p className="panel__note">
        Add up to four people. Each person gets one big Call Now button on the home screen.
      </p>

      {draft.map((contact, index) => (
        <div className="contacts__item" key={contact.id}>
          <p className="contacts__heading">Person {index + 1}</p>
          <label htmlFor={`contact-name-${contact.id}`}>Name</label>
          <input
            id={`contact-name-${contact.id}`}
            value={contact.name}
            maxLength={60}
            onChange={(event) => update(contact.id, { name: event.target.value })}
          />
          <label htmlFor={`contact-relation-${contact.id}`}>Relationship</label>
          <input
            id={`contact-relation-${contact.id}`}
            value={contact.relationship}
            maxLength={40}
            placeholder="Daughter, son, friend…"
            onChange={(event) => update(contact.id, { relationship: event.target.value })}
          />
          <label htmlFor={`contact-room-${contact.id}`}>Video room link</label>
          <input
            id={`contact-room-${contact.id}`}
            value={contact.roomUrl}
            maxLength={500}
            placeholder="https://meet.jit.si/our-family"
            onChange={(event) => update(contact.id, { roomUrl: event.target.value })}
          />
          <label htmlFor={`contact-photo-${contact.id}`}>Photo (optional)</label>
          <input
            id={`contact-photo-${contact.id}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => void chooseAvatar(contact.id, event)}
          />
          <button
            type="button"
            className="button button--small button--secondary"
            onClick={() => setDraft((current) => current.filter((item) => item.id !== contact.id))}
          >
            Remove {contact.name || 'person'}
          </button>
        </div>
      ))}

      {draft.length < MAX_CONTACTS && (
        <button
          type="button"
          className="button button--small button--secondary"
          onClick={() => setDraft((current) => [...current, newContact()])}
        >
          Add a person
        </button>
      )}

      <button type="button" className="button" disabled={busy} onClick={() => void save()}>
        Save family cards
      </button>
      {error && (
        <p className="status status--error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
