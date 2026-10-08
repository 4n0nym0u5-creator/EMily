import { useRef, useState } from 'react'
import { FILTERS } from '../lib/aiPresets'
import { applyLook } from '../lib/filters'
import { generateSceneImage } from '../lib/generateClient'
import { fileToDataUrl, imageFilesFromList } from '../lib/images'
import { newId } from '../lib/ids'
import { trackPointerDrag } from '../lib/pointer'
import type { AssetDrag, MangaFilterId, SceneAsset } from '../types'
import type { GenerateStatus } from '../lib/generateClient'

const SCENE_PRESETS = [
  'Indoor volleyball gym with a polished wood floor and bright lights',
  'School hallway after practice, sun through the windows',
  'Rooftop at sunset with a volleyball net',
  'Quiet classroom with desks and a big window',
]

interface SceneTrayProps {
  scenes: SceneAsset[]
  ai: GenerateStatus & { known: boolean }
  onSave: (scene: SceneAsset) => void
  onDelete: (id: string) => void
  onPlace: (asset: AssetDrag) => void
  onDragMove: (asset: AssetDrag, x: number, y: number) => void
  onDragEnd: (asset: AssetDrag, x: number, y: number) => void
}

export function SceneTray({ scenes, ai, onSave, onDelete, onPlace, onDragMove, onDragEnd }: SceneTrayProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const dragged = useRef(false)
  const [incoming, setIncoming] = useState<string | null>(null)
  const [name, setName] = useState('My background')
  const [filter, setFilter] = useState<MangaFilterId>('original')
  const [prompt, setPrompt] = useState(SCENE_PRESETS[0])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const takeFile = async (file: File) => {
    setMessage(null)
    try {
      setIncoming(await fileToDataUrl(file))
      setName('My background')
      setFilter('original')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That picture did not open.')
    }
  }

  const saveIncoming = async () => {
    if (!incoming) return
    setBusy('Preparing…')
    setMessage(null)
    try {
      const look = await applyLook(incoming, { filter, cutout: false, maxEdge: 1400 })
      const scene: SceneAsset = {
        id: newId(),
        name: name.trim() || 'My background',
        prompt: '',
        src: look.url,
        source: 'upload',
        createdAt: Date.now(),
      }
      onSave(scene)
      onPlace({ src: scene.src, role: 'scene', label: scene.name })
      setIncoming(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That background did not save.')
    } finally {
      setBusy(null)
    }
  }

  const drawScene = async (reference?: string) => {
    if (!ai.configured || !prompt.trim()) return
    setBusy('Drawing…')
    setMessage(null)
    try {
      const result = await generateSceneImage({ prompt: prompt.trim(), referenceDataUrl: reference })
      const scene: SceneAsset = {
        id: newId(),
        name: prompt.trim().slice(0, 42),
        prompt: result.prompt,
        src: result.imageDataUrl,
        source: 'ai',
        createdAt: Date.now(),
      }
      onSave(scene)
      onPlace({ src: scene.src, role: 'scene', label: scene.name })
      setIncoming(null)
    } catch (error) {
      console.error(error)
      setMessage('That background did not draw. You can still use your own picture.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="tray"
      onDragOver={(event) => {
        if ([...event.dataTransfer.types].includes('Files')) {
          event.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        const file = imageFilesFromList(event.dataTransfer.files)[0]
        if (file) void takeFile(file)
      }}
    >
      <button type="button" className="btn btn-primary tray-create" onClick={() => fileRef.current?.click()}>
        Add a background photo
      </button>
      <input
        ref={fileRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void takeFile(file)
          event.target.value = ''
        }}
      />
      <p className={`asset-help ${over ? 'over-note' : ''}`}>Or drop a picture here. It stays on this device.</p>
      {incoming && (
        <div className="incoming-scene">
          <img src={incoming} alt="" />
          <label className="field">
            <span>Name</span>
            <input className="text-input" maxLength={48} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="chip-row">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" className={`chip ${filter === item.id ? 'active' : ''}`} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void saveIncoming()}>
              {busy === 'Preparing…' ? 'Preparing…' : 'Use this background'}
            </button>
            <button type="button" className="btn" onClick={() => setIncoming(null)}>
              Cancel
            </button>
          </div>
          {ai.configured && (
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void drawScene(incoming)}>
              {ai.mock ? 'Practice a manga background' : 'Draw a manga version of this photo'}
            </button>
          )}
        </div>
      )}

      {scenes.length === 0 && !incoming ? (
        <div className="tray-empty">
          <p>No backgrounds yet.</p>
          <p>A photo of a room, a drawing, or an AI gym all work.</p>
        </div>
      ) : (
        <div className="pose-row">
          {scenes.map((scene) => {
            const asset: AssetDrag = { src: scene.src, role: 'scene', label: scene.name }
            return (
              <div key={scene.id} className="scene-chip-wrap">
                <button
                  type="button"
                  className="pose-chip scene-chip"
                  onClick={() => {
                    if (dragged.current) {
                      dragged.current = false
                      return
                    }
                    onPlace(asset)
                  }}
                  onPointerDown={(event) => {
                    trackPointerDrag(event, {
                      onMove: (x, y) => {
                        dragged.current = true
                        onDragMove(asset, x, y)
                      },
                      onDrop: (x, y) => {
                        dragged.current = true
                        onDragEnd(asset, x, y)
                        window.setTimeout(() => {
                          dragged.current = false
                        }, 80)
                      },
                    })
                  }}
                >
                  <img src={scene.src} alt="" draggable={false} />
                  <span>{scene.name}</span>
                </button>
                <button type="button" className="btn btn-small btn-danger" onClick={() => onDelete(scene.id)}>
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      )}

      <section className={`ai-card ${ai.configured ? 'on' : 'off'}`}>
        <h3>Draw a background</h3>
        {ai.known && !ai.configured && (
          <p>AI drawing is not turned on. You can still add your own photos and drawings.</p>
        )}
        {ai.configured && !ai.mock && (
          <p>Tapping the button sends the description{incoming ? ' and this photo' : ''} to OpenAI. It can cost a little money.</p>
        )}
        {ai.configured && ai.mock && <p>Practice mode is on, so this does not call OpenAI.</p>}
        <div className="chip-row">
          {SCENE_PRESETS.map((preset) => (
            <button key={preset} type="button" className={`chip ${prompt === preset ? 'active' : ''}`} onClick={() => setPrompt(preset)}>
              {preset.split(',')[0]}
            </button>
          ))}
        </div>
        <textarea className="text-input" rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Background description" />
        <button type="button" className="btn btn-primary" disabled={!ai.configured || Boolean(busy) || !prompt.trim()} onClick={() => void drawScene(incoming ?? undefined)}>
          {busy === 'Drawing…' ? 'Drawing…' : 'Draw background'}
        </button>
      </section>
      {message && <p className="asset-error">{message}</p>}
    </div>
  )
}
