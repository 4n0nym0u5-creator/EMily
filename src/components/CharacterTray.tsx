import { useRef } from 'react'
import { trackPointerDrag } from '../lib/pointer'
import type { AssetDrag, CharacterAsset } from '../types'
import { Icon } from './Icon'

interface CharacterTrayProps {
  characters: CharacterAsset[]
  onCreate: () => void
  onEdit: (id: string) => void
  onPlace: (asset: AssetDrag) => void
  onDragMove: (asset: AssetDrag, x: number, y: number) => void
  onDragEnd: (asset: AssetDrag, x: number, y: number) => void
}

export function CharacterTray({ characters, onCreate, onEdit, onPlace, onDragMove, onDragEnd }: CharacterTrayProps) {
  const dragged = useRef(false)

  return (
    <div className="tray">
      <button type="button" className="btn btn-primary tray-create" onClick={onCreate}>
        <Icon name="plus" /> New character
      </button>
      {characters.length === 0 ? (
        <div className="tray-empty">
          <p>No characters yet.</p>
          <p>Add a photo of yourself, a friend, or a drawing.</p>
        </div>
      ) : (
        characters.map((character) => (
          <article key={character.id} className="tray-card">
            <header>
              <h3>{character.name}</h3>
              <button type="button" className="btn btn-small" onClick={() => onEdit(character.id)}>
                Edit
              </button>
            </header>
            {character.bio && <p>{character.bio}</p>}
            <div className="pose-row">
              {character.poses.map((pose) => {
                const asset: AssetDrag = {
                  src: pose.src,
                  role: 'character',
                  label: `${character.name}, ${pose.label}`,
                  characterId: character.id,
                  poseId: pose.id,
                }
                return (
                  <button
                    key={pose.id}
                    type="button"
                    className={`pose-chip ${pose.id === character.mainPoseId ? 'main' : ''}`}
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
                    <img src={pose.src} alt="" draggable={false} />
                    <span>{pose.label}</span>
                  </button>
                )
              })}
            </div>
          </article>
        ))
      )}
      <p className="asset-help">Tap a look to drop it on the page. You can also drag it.</p>
    </div>
  )
}
