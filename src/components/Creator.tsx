import { useEffect, useMemo, useState } from 'react'
import { createImageElement } from '../lib/canvasImages'
import { createEmptyPage } from '../lib/storyFactory'
import type {
  CharacterAsset,
  CreatorTool,
  PanelElement,
  SceneAsset,
  Story,
} from '../types'
import { AssetStudio } from './AssetStudio'
import { MangaCanvas } from './MangaCanvas'

interface CreatorProps {
  story: Story
  characters: CharacterAsset[]
  scenes: SceneAsset[]
  onSave: (story: Story) => void
  onSaveCharacter: (character: CharacterAsset) => void
  onDeleteCharacter: (id: string) => void
  onSaveScene: (scene: SceneAsset) => void
  onDeleteScene: (id: string) => void
  onBack: () => void
  onRead: () => void
  onExport: () => void
}

const TOOLS: { id: CreatorTool; label: string; hint: string }[] = [
  { id: 'panel', label: 'Panel', hint: 'Start here — draw manga frames' },
  { id: 'select', label: 'Select', hint: 'Move & resize' },
  { id: 'bubble', label: 'Bubble', hint: 'Click to place · double-click edit' },
  { id: 'sfx', label: 'SFX', hint: 'BA-DOOM energy' },
]

export function Creator({
  story,
  characters,
  scenes,
  onSave,
  onSaveCharacter,
  onDeleteCharacter,
  onSaveScene,
  onDeleteScene,
  onBack,
  onRead,
  onExport,
}: CreatorProps) {
  const [draft, setDraft] = useState(story)
  const [pageIndex, setPageIndex] = useState(0)
  const [tool, setTool] = useState<CreatorTool>('panel')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'build' | 'ai'>('ai')

  useEffect(() => {
    setDraft(story)
    setPageIndex(0)
    setSelectedId(null)
  }, [story.id])

  const page = draft.pages[pageIndex]

  const canRead = useMemo(
    () => draft.pages.some((p) => p.elements.length > 0),
    [draft.pages],
  )

  const persist = (next: Story) => {
    setDraft(next)
    onSave(next)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1200)
  }

  const updatePageElements = (elements: typeof page.elements) => {
    const pages = draft.pages.map((p, i) =>
      i === pageIndex ? { ...p, elements, updatedAt: Date.now() } : p,
    )
    persist({ ...draft, pages, updatedAt: Date.now() })
  }

  const renameStory = (title: string) => {
    persist({ ...draft, title, updatedAt: Date.now() })
  }

  const addPage = () => {
    const pages = [
      ...draft.pages,
      createEmptyPage(`Page ${draft.pages.length + 1}`),
    ]
    const next = { ...draft, pages, updatedAt: Date.now() }
    persist(next)
    setPageIndex(pages.length - 1)
    setSelectedId(null)
  }

  const removePage = () => {
    if (draft.pages.length <= 1) return
    if (!confirm('Delete this page?')) return
    const pages = draft.pages.filter((_, i) => i !== pageIndex)
    persist({ ...draft, pages, updatedAt: Date.now() })
    setPageIndex(Math.max(0, pageIndex - 1))
    setSelectedId(null)
  }

  const addAssetToPage = (src: string, role: 'character' | 'scene') => {
    const selected = page.elements.find((el) => el.id === selectedId)
    const targetPanel =
      selected?.kind === 'panel'
        ? selected
        : page.elements.filter((el): el is PanelElement => el.kind === 'panel').at(-1)

    const image = createImageElement(
      page.elements,
      src,
      role,
      role === 'character' ? targetPanel : null,
    )
    updatePageElements([...page.elements, image])
    setSelectedId(image.id)
    setTool('select')
    setSidebarTab('build')
  }

  return (
    <div className="creator">
      <header className="creator-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Library
        </button>
        <input
          className="story-title-input"
          value={draft.title}
          onChange={(e) => renameStory(e.target.value)}
          aria-label="Story title"
        />
        <div className="creator-top-actions">
          <span className={`save-pill ${savedFlash ? 'show' : ''}`}>Saved</span>
          <button type="button" className="btn btn-ghost" onClick={onExport}>
            Export
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRead}
            disabled={!canRead}
          >
            Reader Mode
          </button>
        </div>
      </header>

      <div className="creator-body">
        <aside className="creator-sidebar">
          <div className="sidebar-tabs">
            <button
              type="button"
              className={sidebarTab === 'ai' ? 'active' : ''}
              onClick={() => setSidebarTab('ai')}
            >
              AI Studio
            </button>
            <button
              type="button"
              className={sidebarTab === 'build' ? 'active' : ''}
              onClick={() => setSidebarTab('build')}
            >
              Panels
            </button>
          </div>

          {sidebarTab === 'ai' ? (
            <AssetStudio
              characters={characters}
              scenes={scenes}
              onSaveCharacter={onSaveCharacter}
              onDeleteCharacter={onDeleteCharacter}
              onSaveScene={onSaveScene}
              onDeleteScene={onDeleteScene}
              onAddToPage={addAssetToPage}
            />
          ) : (
            <>
              <p className="sidebar-label">Tools</p>
              <div className="tool-list">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tool-btn ${tool === t.id ? 'active' : ''}`}
                    onClick={() => setTool(t.id)}
                  >
                    <span>{t.label}</span>
                    <small>{t.hint}</small>
                  </button>
                ))}
              </div>

              <p className="sidebar-label">Pages</p>
              <div className="page-list">
                {draft.pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`page-thumb ${i === pageIndex ? 'active' : ''}`}
                    onClick={() => {
                      setPageIndex(i)
                      setSelectedId(null)
                    }}
                  >
                    {i + 1}. {p.title}
                  </button>
                ))}
              </div>
              <div className="page-actions">
                <button type="button" className="btn btn-small" onClick={addPage}>
                  + Page
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={removePage}
                  disabled={draft.pages.length <= 1}
                >
                  Delete Page
                </button>
              </div>

              <div className="whoa-card">
                <p className="whoa-title">Panel-first flow</p>
                <ol>
                  <li>Draw panels on the page</li>
                  <li>AI Studio → Emily photo → character</li>
                  <li>Add character into a panel</li>
                  <li>Generate a gym scene</li>
                  <li>Bubbles + SFX → Reader</li>
                </ol>
              </div>
            </>
          )}
        </aside>

        <main className="creator-main">
          {page && (
            <MangaCanvas
              elements={page.elements}
              tool={tool}
              selectedId={selectedId}
              onChange={updatePageElements}
              onSelect={setSelectedId}
            />
          )}
        </main>
      </div>
    </div>
  )
}
