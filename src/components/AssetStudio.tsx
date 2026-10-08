import { useEffect, useState } from 'react'
import {
  fetchGenerateStatus,
  generateCharacterFromReference,
  generateCharacterPose,
  generateScene,
  readFileAsDataUrl,
} from '../lib/generateClient'
import { newId } from '../lib/ids'
import type { CharacterAsset, SceneAsset } from '../types'

const SCENE_PRESETS = [
  'Indoor volleyball gymnasium court with polished wood floor and bright overhead lights',
  'Packed high-school volleyball match stadium, dramatic orange scoreboard glow',
  'School hallway after practice, afternoon sun through windows',
  'Rooftop overlook at sunset, volleyball net silhouette',
]

const POSE_PRESETS = [
  'powerful volleyball spike jump in mid-air',
  'determined close-up ready to receive the ball',
  'celebrating a point with fist pump',
  'standing proud in volleyball jersey, hands on hips',
]

interface AssetStudioProps {
  characters: CharacterAsset[]
  scenes: SceneAsset[]
  onSaveCharacter: (character: CharacterAsset) => void
  onDeleteCharacter: (id: string) => void
  onSaveScene: (scene: SceneAsset) => void
  onDeleteScene: (id: string) => void
  onAddToPage: (src: string, role: 'character' | 'scene') => void
}

export function AssetStudio({
  characters,
  scenes,
  onSaveCharacter,
  onDeleteCharacter,
  onSaveScene,
  onDeleteScene,
  onAddToPage,
}: AssetStudioProps) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [refPreview, setRefPreview] = useState<string | null>(null)
  const [charName, setCharName] = useState('Emily')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scenePrompt, setScenePrompt] = useState(SCENE_PRESETS[0])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    void fetchGenerateStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false))
  }, [])

  const selectedCharacter =
    characters.find((c) => c.id === selectedCharacterId) ?? characters[0] ?? null

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="asset-studio">
      <div className={`api-banner ${configured ? 'ok' : 'warn'}`}>
        {configured === null
          ? 'Checking AI…'
          : configured
            ? 'AI ready — OpenAI key found'
            : 'Add OPENAI_API_KEY to .env (see .env.example), then restart npm run dev'}
      </div>

      <section className="asset-block">
        <h3>1. Emily → Character</h3>
        <p className="asset-help">
          Upload a photo of Emily. AI turns it into her manga character for the story.
        </p>

        <label className="btn btn-small upload-label">
          Upload reference photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const dataUrl = await readFileAsDataUrl(file)
              setRefPreview(dataUrl)
              e.target.value = ''
            }}
          />
        </label>

        <input
          className="text-input"
          value={charName}
          onChange={(e) => setCharName(e.target.value)}
          placeholder="Character name"
          aria-label="Character name"
        />

        {refPreview && (
          <div className="ref-preview">
            <img src={refPreview} alt="Emily reference" />
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={!refPreview || Boolean(busy)}
          onClick={() =>
            void run('character', async () => {
              if (!refPreview) return
              const result = await generateCharacterFromReference(refPreview)
              const character: CharacterAsset = {
                id: newId(),
                name: charName.trim() || 'Emily',
                referenceSrc: refPreview,
                portraitSrc: result.imageDataUrl,
                createdAt: Date.now(),
              }
              onSaveCharacter(character)
              setSelectedCharacterId(character.id)
            })
          }
        >
          {busy === 'character' ? 'Generating…' : 'Make manga character'}
        </button>
      </section>

      <section className="asset-block">
        <h3>Characters</h3>
        {characters.length === 0 ? (
          <p className="asset-help">No characters yet.</p>
        ) : (
          <ul className="asset-grid">
            {characters.map((c) => (
              <li key={c.id} className={c.id === selectedCharacter?.id ? 'active' : ''}>
                <button
                  type="button"
                  className="asset-thumb"
                  onClick={() => setSelectedCharacterId(c.id)}
                >
                  <img src={c.portraitSrc} alt={c.name} />
                  <span>{c.name}</span>
                </button>
                <div className="asset-thumb-actions">
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    onClick={() => onAddToPage(c.portraitSrc, 'character')}
                  >
                    Add to panel
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger"
                    onClick={() => onDeleteCharacter(c.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selectedCharacter && (
          <div className="pose-row">
            <p className="asset-help">Generate a new pose from {selectedCharacter.name}:</p>
            <div className="chip-row">
              {POSE_PRESETS.map((pose) => (
                <button
                  key={pose}
                  type="button"
                  className="chip"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run('pose', async () => {
                      const result = await generateCharacterPose(
                        selectedCharacter.portraitSrc,
                        pose,
                      )
                      onAddToPage(result.imageDataUrl, 'character')
                    })
                  }
                >
                  {busy === 'pose' ? '…' : pose.split(' ').slice(0, 3).join(' ') + '…'}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="asset-block">
        <h3>2. Generate scene</h3>
        <div className="chip-row">
          {SCENE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`chip ${scenePrompt === preset ? 'active' : ''}`}
              onClick={() => setScenePrompt(preset)}
            >
              {preset.split(',')[0]}
            </button>
          ))}
        </div>
        <textarea
          className="text-input scene-prompt"
          value={scenePrompt}
          onChange={(e) => setScenePrompt(e.target.value)}
          rows={3}
        />
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={!scenePrompt.trim() || Boolean(busy)}
          onClick={() =>
            void run('scene', async () => {
              const result = await generateScene(scenePrompt.trim())
              const scene: SceneAsset = {
                id: newId(),
                name: scenePrompt.trim().slice(0, 48),
                prompt: result.prompt,
                src: result.imageDataUrl,
                createdAt: Date.now(),
              }
              onSaveScene(scene)
              onAddToPage(scene.src, 'scene')
            })
          }
        >
          {busy === 'scene' ? 'Generating scene…' : 'Generate & add scene'}
        </button>

        {scenes.length > 0 && (
          <ul className="asset-grid scene-grid">
            {scenes.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="asset-thumb"
                  onClick={() => onAddToPage(s.src, 'scene')}
                >
                  <img src={s.src} alt={s.name} />
                  <span>{s.name}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => onDeleteScene(s.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p className="asset-error">{error}</p>}
      {busy && <p className="asset-busy">Working on it — this can take 15–40 seconds…</p>}
    </div>
  )
}
