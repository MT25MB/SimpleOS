import { useEffect, useState } from 'react'
import type { Contact } from '../types'

interface FamilyPanelProps {
  contacts: Contact[]
  onCall: (contact: Contact) => void
  onFallback: () => void
}

/** Large, high-contrast cards; one obvious action for each person. */
export function FamilyPanel({ contacts, onCall, onFallback }: FamilyPanelProps) {
  const [avatars, setAvatars] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    const bridge = window.simpleOS
    if (!bridge) return
    void Promise.all(
      contacts
        .filter((contact) => contact.avatarFile)
        .map(async (contact) => {
          const result = await bridge.getAvatar(contact.avatarFile as string)
          return result.ok ? ([contact.id, result.value.dataUrl] as const) : null
        }),
    ).then((entries) => {
      if (!active) return
      const next: Record<string, string> = {}
      for (const entry of entries) if (entry) next[entry[0]] = entry[1]
      setAvatars(next)
    })
    return () => {
      active = false
    }
  }, [contacts])

  return (
    <section className="panel" aria-labelledby="family-title">
      <h2 id="family-title">Video Call Family</h2>
      <p className="panel__intro">Choose someone to call.</p>

      {contacts.length === 0 ? (
        <>
          <p className="panel__empty">No family cards have been set up yet.</p>
          <button type="button" className="button" onClick={onFallback}>
            Open a video call
          </button>
        </>
      ) : (
        <ul className="family__cards">
          {contacts.map((contact) => (
            <li className="family__card" key={contact.id}>
              {avatars[contact.id] ? (
                <img className="family__avatar" src={avatars[contact.id]} alt="" />
              ) : (
                <span className="family__initial" aria-hidden="true">
                  {contact.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
              )}
              <div className="family__text">
                <p className="family__name">{contact.name}</p>
                {contact.relationship && (
                  <p className="family__relation">{contact.relationship}</p>
                )}
              </div>
              <button
                type="button"
                className="button family__call"
                aria-label={`Call Now for ${contact.name}`}
                onClick={() => onCall(contact)}
              >
                Call Now
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
