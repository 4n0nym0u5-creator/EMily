import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SFX_COLORS, SFX_WORDS } from '../lib/aiPresets'
import {
  applyLayout,
  changeLayer,
  duplicateElement,
  fitImageToPanel,
  flipElement,
  largestPanel,
  placeAsset,
  removeElement,
  replacePageElements,
  rotateElement,
  scaleElement,
} from '../lib/elements'
import { fileToDataUrl, measureImage } from '../lib/images'
import { LAYOUTS } from '../lib/layouts'
import { createEmptyPage, duplicatePage } from '../lib/storyFactory'
import { useClipboardImages } from '../hooks/useClipboardImages'
import { useHistory } from '../hooks/useHistory'
import type { AssetDrag, CanvasElement, CharacterAsset, CreatorTool, SceneAsset, Story } from '../types'
import type { GenerateStatus } from '../lib/generateClient'
import { CharacterTray } from './CharacterTray'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'
import { MangaCanvas, type MangaCanvasHandle } from './MangaCanvas'
import { SceneTray } from './SceneTray'
import { ShareActions } from './ShareActions'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'

interface CreatorProps {
  story: Story
  characters: CharacterAsset[]
  scenes: SceneAsset[]
  ai: GenerateStatus & { known: boolean }
  pasteEnabled: boolean
  onSave: (story: Story) => void
  onBack: () => void
  onRead: () => void
  onBackup: () => void
  onCreateCharacter: () => void
  onEditCharacter: (id: string) => void
  onSaveScene: (scene: SceneAsset) => void
  onDeleteScene: (id: string) => void
}

const TOOLS: { id: CreatorTool | 'layouts' | 'picture'; label: string; icon: string }[] = [
  { id: 'select', label: 'Move', icon: 'move' },
  { id: 'layouts', label: 'Frames', icon: 'layout' },
  { id: 'speech', label: 'Speech', icon: 'speech' },
  { id: 'thought', label: 'Thought', icon: 'thought' },
  { id: 'sfx', label: 'Sound', icon: 'sound' },
  { id: 'picture', label: 'Picture', icon: 'image' },
]

export function Creator({
  story,
  characters,
  scenes,
  ai,
  pasteEnabled,
  onSave,
  onBack,
  onRead,
  onBackup,
  onCreateCharacter,
  onEditCharacter,
  onSaveScene,
  onDeleteScene,
}: CreatorProps) {
  const { state: draft, update, undo, redo, reset, canUndo, canRedo } = useHistory(story)
  const [pageIndex, setPageIndex] = useState(0)
  const [tool, setTool] = useState<CreatorTool>('select')
  const [sfxWord, setSfxWord] = useState<string>(SFX_WORDS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'characters' | 'scenes' | 'pages'>('characters')
  const [layoutsOpen, setLayoutsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [ghost, setGhost] = useState<{ src: string; x: number; y: number } | null>(null)
  const [pendingLayout, setPendingLayout] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; action: () => void } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canvasRef = useRef<MangaCanvasHandle>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const storyRef = useRef(story)
  const indexRef = useRef(0)
  const firstSave = useRef(true)

  const safeIndex = Math.min(pageIndex, Math.max(0, draft.pages.length - 1))
  const page = draft.pages[safeIndex]

  useLayoutEffect(() => {
    storyRef.current = story
    indexRef.current = safeIndex
  })

  useEffect(() => {
    const current = storyRef.current
    const raw = sessionStorage.getItem(`emily-page-${current.id}`)
    const nextIndex = raw ? Number(raw) : 0
    setPageIndex(Number.isFinite(nextIndex) && nextIndex >= 0 && nextIndex < current.pages.length ? nextIndex : 0)
    reset(current)
    setSelectedId(null)
    setEditingId(null)
  }, [story.id, reset])

  useEffect(() => {
    sessionStorage.setItem(`emily-page-${draft.id}`, String(safeIndex))
  }, [draft.id, safeIndex])

  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false
      return
    }
    const timer = window.setTimeout(() => {
      onSave(draft)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1200)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [draft, onSave])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        if (typing) return
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        setSelectedId(null)
        setEditingId(null)
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        if (typing) return
        event.preventDefault()
        redo()
        setSelectedId(null)
        return
      }
      if (typing) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId && page) {
        event.preventDefault()
        const index = indexRef.current
        const elements = removeElement(page.elements, selectedId)
        update((current) => replacePageElements(current, index, elements), 'commit')
        setSelectedId(null)
      }
      if (event.key === 'Escape') {
        setSelectedId(null)
        setEditingId(null)
        setTool('select')
        setLayoutsOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, redo, selectedId, undo, update])

  function commitElements(elements: CanvasElement[]) {
    const index = indexRef.current
    update((current) => replacePageElements(current, index, elements), 'commit')
  }

  function liveElements(elements: CanvasElement[]) {
    const index = indexRef.current
    update((current) => replacePageElements(current, index, elements), 'live')
  }

  async function place(
    asset: { src: string; role: 'character' | 'scene' | 'upload'; characterId?: string; poseId?: string },
    point: { x: number; y: number } | null,
  ) {
    const index = indexRef.current
    const selected = page?.elements.find((element) => element.id === selectedId)
    const panelId = selected?.kind === 'panel' ? selected.id : null
    let aspect = 0.75
    if (asset.role !== 'scene') {
      try {
        const size = await measureImage(asset.src)
        aspect = size.width / Math.max(1, size.height)
      } catch {
        aspect = 0.75
      }
    }
    let placedId = ''
    update((current) => {
      const currentPage = current.pages[index]
      if (!currentPage) return current
      const image = placeAsset(currentPage.elements, { ...asset, aspect, point, panelId })
      placedId = image.id
      return replacePageElements(current, index, [...currentPage.elements, image])
    }, 'commit')
    setSelectedId(placedId)
    setTool('select')
    setEditingId(null)
  }

  async function addFile(file: File, point: { x: number; y: number } | null) {
    try {
      const src = await fileToDataUrl(file)
      await place({ src, role: 'upload' }, point)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That picture did not open.')
    }
  }

  useClipboardImages((files) => {
    const file = files[0]
    if (file) void addFile(file, null)
  }, pasteEnabled)

  function applyLayoutNow(layoutId: string) {
    const index = indexRef.current
    update((current) => {
      const currentPage = current.pages[index]
      if (!currentPage) return current
      return replacePageElements(current, index, applyLayout(currentPage.elements, layoutId))
    }, 'commit')
    setTool('select')
    setLayoutsOpen(false)
    setPendingLayout(null)
  }

  function chooseLayout(layoutId: string) {
    if (page?.elements.some((element) => element.kind === 'panel')) setPendingLayout(layoutId)
    else applyLayoutNow(layoutId)
  }

  function patchSelected(recipe: (element: CanvasElement) => CanvasElement) {
    if (!page || !selectedId) return
    commitElements(page.elements.map((element) => (element.id === selectedId ? recipe(element) : element)))
  }

  const selected = page?.elements.find((element) => element.id === selectedId) ?? null
  const canRead = draft.pages.some((item) => item.elements.length > 0)

  const dropAsset = (asset: AssetDrag, x: number, y: number) => {
    setGhost(null)
    const point = canvasRef.current?.clientToCanvas(x, y)
    if (!point) return
    void place(asset, point)
  }

  return (
    <div className="creator">
      <header className="creator-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" /> Library
        </button>
        <input
          className="story-title-input"
          value={draft.title}
          aria-label="Story title"
          onChange={(event) => update((current) => ({ ...current, title: event.target.value }), 'live')}
          onBlur={() => update((current) => current, 'commit')}
        />
        <div className="creator-top-actions">
          <button type="button" className="icon-btn" aria-label="Undo" disabled={!canUndo} onClick={() => { undo(); setSelectedId(null) }}>
            <Icon name="undo" />
          </button>
          <button type="button" className="icon-btn" aria-label="Redo" disabled={!canRedo} onClick={() => { redo(); setSelectedId(null) }}>
            <Icon name="redo" />
          </button>
          <span className={`save-pill ${savedFlash ? 'show' : ''}`}>Saved on this device</span>
          <button type="button" className="btn" onClick={() => setShareOpen((open) => !open)}>
            Save a copy
          </button>
          <button type="button" className="btn btn-primary" disabled={!canRead} onClick={onRead}>
            <Icon name="book" /> Read
          </button>
        </div>
      </header>

      {shareOpen && (
        <div className="share-pop">
          <ShareActions story={draft} />
          <button type="button" className="btn" onClick={onBackup}>
            Backup story file
          </button>
          <p className="asset-help">Pictures and PDF are for sharing or printing. The backup file can be imported later.</p>
        </div>
      )}

      <div className="creator-tools" role="toolbar" aria-label="Page tools">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tool-btn ${tool === item.id || (item.id === 'layouts' && layoutsOpen) ? 'active' : ''}`}
            aria-pressed={tool === item.id}
            onClick={() => {
              if (item.id === 'layouts') {
                setLayoutsOpen(true)
                return
              }
              if (item.id === 'picture') {
                uploadRef.current?.click()
                return
              }
              setTool(item.id)
              setLayoutsOpen(false)
            }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
        <input
          ref={uploadRef}
          hidden
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void addFile(file, null)
            event.target.value = ''
          }}
        />
      </div>

      {tool === 'sfx' && (
        <div className="sfx-row">
          {SFX_WORDS.map((word) => (
            <button key={word} type="button" className={`chip ${sfxWord === word ? 'active' : ''}`} onClick={() => setSfxWord(word)}>
              {word}
            </button>
          ))}
        </div>
      )}

      {tool === 'panel' && <p className="draw-hint">Drag on the page to draw a frame. Tap Move when you are done.</p>}
      {notice && <p className="asset-error">{notice}</p>}

      {selected && page && (
        <div className="selection-bar" role="toolbar" aria-label="Selected item">
          {(selected.kind === 'image' || selected.kind === 'bubble' || selected.kind === 'sfx') && (
            <>
              <button type="button" className="icon-btn" aria-label="Bigger" onClick={() => patchSelected((element) => scaleElement(element, 1.12))}>
                <Icon name="bigger" />
              </button>
              <button type="button" className="icon-btn" aria-label="Smaller" onClick={() => patchSelected((element) => scaleElement(element, 0.9))}>
                <Icon name="smaller" />
              </button>
            </>
          )}
          {(selected.kind === 'image' || selected.kind === 'sfx') && (
            <>
              <button type="button" className="icon-btn" aria-label="Rotate left" onClick={() => patchSelected((element) => rotateElement(element, -15))}>
                <Icon name="rotate" />
              </button>
              <button type="button" className="icon-btn" aria-label="Rotate right" onClick={() => patchSelected((element) => rotateElement(element, 15))}>
                <Icon name="redo" />
              </button>
            </>
          )}
          {selected.kind === 'image' && (
            <button type="button" className="icon-btn" aria-label="Flip" onClick={() => patchSelected((element) => flipElement(element, 'x'))}>
              <Icon name="flip" />
            </button>
          )}
          {selected.kind !== 'panel' && (
            <>
              <button type="button" className="btn btn-small" onClick={() => commitElements(changeLayer(page.elements, selected.id, 'forward'))}>
                Front
              </button>
              <button type="button" className="btn btn-small" onClick={() => commitElements(changeLayer(page.elements, selected.id, 'backward'))}>
                Back
              </button>
            </>
          )}
          {selected.kind === 'image' && largestPanel(page.elements) && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                const panel = largestPanel(page.elements)
                if (!panel || selected.kind !== 'image') return
                patchSelected(() => fitImageToPanel(selected, panel))
              }}
            >
              Fit panel
            </button>
          )}
          {(selected.kind === 'bubble' || selected.kind === 'sfx') && (
            <button type="button" className="btn btn-small" onClick={() => setEditingId(selected.id)}>
              Edit words
            </button>
          )}
          {selected.kind === 'bubble' &&
            (['speech', 'shout', 'thought'] as const).map((style) => (
              <button
                key={style}
                type="button"
                className={`chip ${selected.style === style ? 'active' : ''}`}
                onClick={() => patchSelected((element) => (element.kind === 'bubble' ? { ...element, style } : element))}
              >
                {style === 'speech' ? 'Speech' : style === 'shout' ? 'Shout' : 'Thought'}
              </button>
            ))}
          {selected.kind === 'sfx' &&
            SFX_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="color-dot"
                style={{ background: color }}
                aria-label={`Color ${color}`}
                onClick={() => patchSelected((element) => (element.kind === 'sfx' ? { ...element, color } : element))}
              />
            ))}
          <button type="button" className="btn btn-small" onClick={() => { commitElements(duplicateElement(page.elements, selected.id)); }}>
            Copy
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label="Delete"
            onClick={() => {
              commitElements(removeElement(page.elements, selected.id))
              setSelectedId(null)
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      )}

      <div className="creator-body">
        <aside className="creator-sidebar">
          <div className="sidebar-tabs" role="tablist">
            {([
              ['characters', 'Characters'],
              ['scenes', 'Backgrounds'],
              ['pages', 'Pages'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'characters' && (
            <CharacterTray
              characters={characters}
              onCreate={onCreateCharacter}
              onEdit={onEditCharacter}
              onPlace={(asset) => void place(asset, null)}
              onDragMove={(asset, x, y) => setGhost({ src: asset.src, x, y })}
              onDragEnd={dropAsset}
            />
          )}
          {tab === 'scenes' && (
            <SceneTray
              scenes={scenes}
              ai={ai}
              onSave={onSaveScene}
              onDelete={onDeleteScene}
              onPlace={(asset) => void place(asset, null)}
              onDragMove={(asset, x, y) => setGhost({ src: asset.src, x, y })}
              onDragEnd={dropAsset}
            />
          )}
          {tab === 'pages' && page && (
            <div className="tray">
              <div className="page-list">
                {draft.pages.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`page-thumb ${index === safeIndex ? 'active' : ''}`}
                    onClick={() => {
                      setPageIndex(index)
                      setSelectedId(null)
                    }}
                  >
                    <span>
                      {index + 1}. {item.title}
                    </span>
                    <small>{item.elements.length ? `${item.elements.length} pieces` : 'Empty'}</small>
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Page name</span>
                <input
                  className="text-input"
                  value={page.title}
                  aria-label="Page name"
                  onChange={(event) => {
                    const index = indexRef.current
                    const title = event.target.value
                    update(
                      (current) => ({
                        ...current,
                        pages: current.pages.map((item, itemIndex) => (itemIndex === index ? { ...item, title } : item)),
                      }),
                      'live',
                    )
                  }}
                  onBlur={() => update((current) => current, 'commit')}
                />
              </label>
              <div className="page-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    const added = createEmptyPage(`Page ${draft.pages.length + 1}`)
                    update((current) => ({ ...current, pages: [...current.pages, added] }), 'commit')
                    setPageIndex(draft.pages.length)
                  }}
                >
                  Add page
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => {
                    const copy = duplicatePage(page, `${page.title} copy`)
                    update((current) => {
                      const pages = [...current.pages]
                      pages.splice(indexRef.current + 1, 0, copy)
                      return { ...current, pages }
                    }, 'commit')
                    setPageIndex(safeIndex + 1)
                  }}
                >
                  Copy page
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  disabled={draft.pages.length <= 1}
                  onClick={() =>
                    setConfirm({
                      title: 'Delete this page?',
                      message: 'The other pages stay. You can undo this.',
                      label: 'Delete page',
                      action: () => {
                        const index = indexRef.current
                        update((current) => ({ ...current, pages: current.pages.filter((_, itemIndex) => itemIndex !== index) }), 'commit')
                        setPageIndex(Math.max(0, index - 1))
                        setSelectedId(null)
                      },
                    })
                  }
                >
                  Delete page
                </button>
              </div>
              <p className="sidebar-label">Start with frames</p>
              <div className="layout-grid">
                {LAYOUTS.map((layout) => (
                  <button key={layout.id} type="button" className="layout-card" onClick={() => chooseLayout(layout.id)}>
                    <LayoutIcon rects={layout.rects} />
                    <span>{layout.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="creator-main">
          {page && page.elements.every((element) => element.kind !== 'panel') && tool === 'select' && (
            <div className="layout-suggest">
              <p>Pick a frame layout, or draw your own.</p>
              <div className="layout-grid">
                {LAYOUTS.map((layout) => (
                  <button key={layout.id} type="button" className="layout-card" onClick={() => chooseLayout(layout.id)}>
                    <LayoutIcon rects={layout.rects} />
                    <span>{layout.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {page && (
            <MangaCanvas
              ref={canvasRef}
              elements={page.elements}
              tool={tool}
              sfxWord={sfxWord}
              selectedId={selectedId}
              editingId={editingId}
              onLive={liveElements}
              onCommit={(elements) => {
                commitElements(elements)
              }}
              onSelect={setSelectedId}
              onEdit={setEditingId}
              onDropFile={(src, point) => void place({ src, role: 'upload' }, point)}
              onPlaced={() => setTool('select')}
            />
          )}
        </main>
      </div>

      {layoutsOpen && (
        <div className="sheet" role="dialog" aria-label="Panel layouts">
          <div className="layout-grid">
            {LAYOUTS.map((layout) => (
              <button key={layout.id} type="button" className="layout-card" onClick={() => chooseLayout(layout.id)}>
                <LayoutIcon rects={layout.rects} />
                <span>{layout.name}</span>
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setTool('panel')
                setLayoutsOpen(false)
              }}
            >
              Draw my own frame
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setLayoutsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
          <img src={ghost.src} alt="" />
        </div>
      )}

      {pendingLayout && (
        <ConfirmDialog
          title="Replace the frames?"
          message="Your pictures and words stay on the page."
          confirmLabel="Use this layout"
          onCancel={() => setPendingLayout(null)}
          onConfirm={() => applyLayoutNow(pendingLayout)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            confirm.action()
            setConfirm(null)
          }}
        />
      )}
    </div>
  )
}

function LayoutIcon({ rects }: { rects: { x: number; y: number; width: number; height: number }[] }) {
  return (
    <svg className="layout-icon" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} />
      ))}
    </svg>
  )
}
