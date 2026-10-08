import { useRef } from 'react'
import { createStory } from '../lib/storyFactory'
import type { Story } from '../types'

interface HomeProps {
  stories: Story[]
  characterCount: number
  onCreate: (story: Story) => void
  onOpenCreator: (storyId: string) => void
  onOpenReader: (storyId: string) => void
  onDelete: (storyId: string) => void
  onExportAll: () => void
  onImport: (file: File) => Promise<void>
}

export function Home({
  stories,
  characterCount,
  onCreate,
  onOpenCreator,
  onOpenReader,
  onDelete,
  onExportAll,
  onImport,
}: HomeProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    const story = createStory('Court #1')
    onCreate(story)
    onOpenCreator(story.id)
  }

  return (
    <div className="home">
      <div className="home-court-lines" aria-hidden />
      <header className="home-hero">
        <p className="home-kicker">Built with Cursor</p>
        <h1 className="home-brand">
          EMily
          <span className="home-brand-jp">漫画</span>
        </h1>
        <p className="home-tagline">
          Start with panels. Turn Emily into her own anime character. Drop her into
          Haikyuu-energy scenes.
        </p>
        <div className="home-actions">
          <button type="button" className="btn btn-primary btn-hero" onClick={handleCreate}>
            Open Panel Creator
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileRef.current?.click()}
          >
            Import JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExportAll}>
            Export All
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) await onImport(file)
              e.target.value = ''
            }}
          />
        </div>
        <p className="home-stat">
          {characterCount} character{characterCount === 1 ? '' : 's'} ready ·{' '}
          {stories.length} stor{stories.length === 1 ? 'y' : 'ies'}
        </p>
      </header>

      <section className="home-library">
        <h2 className="home-section-title">Your Stories</h2>
        {stories.length === 0 ? (
          <div className="home-empty">
            <p>Panel Creator opens with AI Studio first:</p>
            <p className="home-empty-quote">Upload Emily → make her manga self</p>
          </div>
        ) : (
          <ul className="story-list">
            {stories.map((story) => (
              <li key={story.id} className="story-row">
                <div className="story-meta">
                  <h3>{story.title}</h3>
                  <p>
                    {story.pages.length} page{story.pages.length === 1 ? '' : 's'} ·{' '}
                    {new Date(story.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="story-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() => onOpenCreator(story.id)}
                  >
                    Panels
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onOpenReader(story.id)}
                    disabled={story.pages.every((p) => p.elements.length === 0)}
                  >
                    Read
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => {
                      if (confirm(`Delete “${story.title}”?`)) onDelete(story.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
