import { useRef } from 'react'
import type { Story } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { PageFrame } from './PageFrame'

interface HomeProps {
  stories: Story[]
  characterCount: number
  sceneCount: number
  onCreate: () => void
  onOpenCreator: (storyId: string) => void
  onOpenReader: (storyId: string) => void
  onDelete: (story: Story) => void
  onExportAll: () => void
  onImport: (file: File) => void
  onCharacters: () => void
  onHelp: () => void
}

export function Home({
  stories,
  characterCount,
  sceneCount,
  onCreate,
  onOpenCreator,
  onOpenReader,
  onDelete,
  onExportAll,
  onImport,
  onCharacters,
  onHelp,
}: HomeProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const ordered = [...stories].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="home">
      <div className="home-court-lines" aria-hidden="true" />
      <header className="home-hero">
        <p className="home-kicker">Your manga studio</p>
        <h1 className="home-brand">
          EMily
          <span className="home-brand-jp">漫画</span>
        </h1>
        <p className="home-tagline">
          Make your own manga. Turn a photo or a drawing into a character, then tell the story.
        </p>
        <div className="home-actions">
          <button type="button" className="btn btn-primary btn-hero" onClick={onCreate}>
            New story
          </button>
          <button type="button" className="btn" onClick={onCharacters}>
            My characters
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHelp}>
            How this works
          </button>
        </div>
        <p className="home-stat">
          {characterCount} character{characterCount === 1 ? '' : 's'} · {sceneCount} background
          {sceneCount === 1 ? '' : 's'} · {stories.length} stor{stories.length === 1 ? 'y' : 'ies'}
        </p>
      </header>

      <section className="home-library" aria-labelledby="stories-heading">
        <h2 id="stories-heading" className="home-section-title">
          Your stories
        </h2>
        {ordered.length === 0 ? (
          <div className="home-empty">
            <div className="empty-page" aria-hidden="true" />
            <p>Your shelf is empty. Start a story, then add a character from a photo.</p>
            <p className="home-empty-quote">My Haikyuu Story</p>
          </div>
        ) : (
          <ul className="story-list">
            {ordered.map((story) => {
              const cover = story.pages.find((page) => page.elements.length > 0) ?? story.pages[0]
              const readable = story.pages.some((page) => page.elements.length > 0)
              return (
                <li key={story.id} className="story-row">
                  <div className="story-preview" aria-hidden="true">
                    <div className="story-preview-frame" style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}>
                      <div className="manga-paper" />
                      {cover && <PageFrame elements={cover.elements} />}
                    </div>
                  </div>
                  <div className="story-meta">
                    <h3>{story.title}</h3>
                    <p>
                      {story.pages.length} page{story.pages.length === 1 ? '' : 's'} ·{' '}
                      {new Date(story.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="story-actions">
                    <button type="button" className="btn btn-small btn-primary" onClick={() => onOpenCreator(story.id)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-small" disabled={!readable} onClick={() => onOpenReader(story.id)}>
                      Read
                    </button>
                    <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(story)}>
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <footer className="home-footer">
        <div className="home-actions">
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExportAll}>
            Export backup
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onImport(file)
              event.target.value = ''
            }}
          />
        </div>
        <p className="privacy-line">
          Stories and photos stay in this browser on this device. There is no account and no tracking. Export a backup if you want a copy.
        </p>
      </footer>
    </div>
  )
}
