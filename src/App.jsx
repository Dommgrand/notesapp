// src/App.jsx
import { useState, useEffect } from 'react'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

// Amplify Data + Storage
import { generateClient } from 'aws-amplify/api'
import { uploadData, getUrl, remove } from 'aws-amplify/storage'

// Amplify UI (Auth)
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'

// 1) Configure Amplify with the generated client configuration
Amplify.configure(outputs)

// 2) Generate a data client for your models (e.g., Note)
const client = generateClient()

export default function App() {
  // 3) Use the Authenticator component to scaffold the full auth flow
  return (
    <Authenticator>
      {({ user, signOut }) => (
        <NotesApp user={user} signOut={signOut} />
      )}
    </Authenticator>
  )
}

/**
 * NotesApp implements:
 * - fetchNotes: list Notes items (resolve signed URL when an image is present)
 * - createNote: create record, optionally upload a file, then associate its storage path
 * - deleteNote: remove associated file (if any) and delete the record
 */
function NotesApp({ user, signOut }) {
  const [notes, setNotes] = useState([])
  const [formData, setFormData] = useState({ title: '', content: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  // Fetch notes after sign-in
  useEffect(() => {
    if (user) fetchNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ----- fetchNotes -----
  async function fetchNotes() {
    try {
      setBusy(true)
      const resp = await client.models.Note.list()
      const items = resp?.data ?? []

      const withUrls = await Promise.all(
        items.map(async (n) => {
          if (n.imagePath) {
            const { url } = await getUrl({ path: n.imagePath })
            return { ...n, imageUrl: url }
          }
          return n
        })
      )

      setNotes(withUrls)
    } catch (err) {
      console.error('Error fetching notes:', err)
      alert('Error fetching notes. Check console for details.')
    } finally {
      setBusy(false)
    }
  }

  // ----- createNote -----
  async function createNote() {
    if (!formData.title || !formData.content) {
      alert('Please provide a title and content')
      return
    }

    try {
      setBusy(true)
      // 1) Create the record
      const created = await client.models.Note.create({
        title: formData.title,
        content: formData.content,
      })
      let newNote = created.data

      // 2) Optional image upload, then associate path with the note
      if (file && newNote) {
        const result = await uploadData({
          path: `images/${newNote.id}-${file.name}`,
          data: file,
          options: { contentType: file.type },
        }).result

        const updated = await client.models.Note.update({
          id: newNote.id,
          imagePath: result.path,
        })
        newNote = updated.data
      }

      // 3) Refresh UI
      setNotes((prev) => [...prev, newNote])
      setFormData({ title: '', content: '' })
      setFile(null)
    } catch (err) {
      console.error('Error creating note:', err)
      alert('Error creating note. Check console for details.')
    } finally {
      setBusy(false)
    }
  }

  // ----- deleteNote -----
  async function deleteNote(note) {
    if (!confirm('Delete this note?')) return
    try {
      setBusy(true)
      if (note.imagePath) {
        await remove({ path: note.imagePath })
      }
      await client.models.Note.delete({ id: note.id })
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    } catch (err) {
      console.error('Error deleting note:', err)
      alert('Error deleting note. Check console for details.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ padding: '1rem', maxWidth: 840, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Notes</h1>
          <small>Signed in as <strong>{user?.username}</strong></small>
        </div>
        <button onClick={signOut}>Sign Out</button>
      </header>

      <section style={{ marginTop: 24, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Create a Note</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <input
            placeholder="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <textarea
            placeholder="Content"
            rows={4}
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            accept="image/*"
          />
         <div style={{ display: 'flex', gap: 8 }}>
  <button type="button" onClick={createNote} disabled={busy}>Save Note</button>
  <button
    type="button"
    onClick={() => { setFormData({ title: '', content: '' }); setFile(null) }}
    disabled={busy}
  >
    Clear
  </button>
</div>

        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Your Notes</h2>
          <button onClick={fetchNotes} disabled={busy}>Refresh</button>
        </div>

        {notes.length === 0 && <p style={{ opacity: 0.7 }}>No notes yet.</p>}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
          marginTop: 12
        }}>
          {notes.map((n) => (
            <article key={n.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              <h3 style={{ margin: '0 0 8px' }}>{n.title}</h3>
              <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{n.content}</p>
              {n.imageUrl && (
                <img
                  src={n.imageUrl}
                  alt=""
                  style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
                />
              )}
              <button onClick={() => deleteNote(n)} disabled={busy}>Delete</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}



