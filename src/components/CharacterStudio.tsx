import { useCallback, useEffect, useRef, useState } from 'react'
import {
  EXPRESSION_PRESETS,
  FILTERS,
  POSE_PRESETS,
  STYLE_PRESETS,
  presetLabel,
  type ExpressionId,
  type PoseId,
  type StyleId,
} from '../lib/aiPresets'
import { applyLook, type LookResult } from '../lib/filters'
import { generateCharacterLook, PasscodeError, removeBackground } from '../lib/generateClient'
import { fileToDataUrl, imageFilesFromList } from '../lib/images'
import { newId } from '../lib/ids'
import { useClipboardImages } from '../hooks/useClipboardImages'
import type { CharacterAsset, CharacterPose, MangaFilterId, PoseKind } from '../types'
import type { GenerateStatus } from '../lib/generateClient'
import { CameraCapture } from './CameraCapture'
import { Cropper } from './Cropper'
import { Icon } from './Icon'

type Step = 'list' | 'pick' | 'crop' | 'style' | 'sheet'

interface CharacterStudioProps {
  characters: CharacterAsset[]
  editingId: string | null
  fresh: boolean
  ai: GenerateStatus & { known: boolean }
  onClose: () => void
  onSave: (character: CharacterAsset) => void
  onDelete: (id: string) => void
  onEditExisting: (id: string) => void
}

export function CharacterStudio({
  characters,
  editingId,
  fresh,
  ai,
  onClose,
  onSave,
  onDelete,
  onEditExisting,
}: CharacterStudioProps) {
  const existing = editingId ? characters.find((item) => item.id === editingId) ?? null : null
  const [step, setStep] = useState<Step>(existing ? 'sheet' : fresh || characters.length === 0 ? 'pick' : 'list')
  const [character, setCharacter] = useState<CharacterAsset | null>(existing)
  const [rawSrc, setRawSrc] = useState<string | null>(null)
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null)
  const [filter, setFilter] = useState<MangaFilterId>('original')
  const [cutout, setCutout] = useState(false)
  const [preview, setPreview] = useState<LookResult | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [name, setName] = useState(existing?.name ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [camera, setCamera] = useState(false)
  const [over, setOver] = useState(false)
  const [styleId, setStyleId] = useState<StyleId>('haikyuu')
  const [expressionId, setExpressionId] = useState<ExpressionId>('smile')
  const [poseId, setPoseId] = useState<PoseId>('portrait')
  const [note, setNote] = useState('')
  const [seeThrough, setSeeThrough] = useState(true)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step !== 'style' || !croppedSrc) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      setPreviewBusy(true)
      void applyLook(croppedSrc, { filter, cutout, maxEdge: 1100 })
        .then((result) => {
          if (cancelled) return
          setPreview(result)
          setPreviewBusy(false)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setPreviewBusy(false)
          setMessage(error instanceof Error ? error.message : 'That look did not work.')
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [step, croppedSrc, filter, cutout])

  const takeFile = useCallback(async (file: File) => {
    setMessage(null)
    setCamera(false)
    try {
      const url = await fileToDataUrl(file)
      setRawSrc(url)
      setStep('crop')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That picture did not open.')
    }
  }, [])

  useClipboardImages((files) => {
    if (files[0]) void takeFile(files[0])
  }, step === 'pick')

  const beginStyle = (src: string) => {
    setCroppedSrc(src)
    setFilter('original')
    setCutout(false)
    setPreview(null)
    setAiResult(null)
    setMessage(null)
    setStep('style')
  }

  const saveLook = (src: string, kind: PoseKind, label: string, usedFilter?: MangaFilterId, usedCutout?: boolean, source?: string) => {
    const sourceSrc = source || croppedSrc || character?.referenceSrc || src
    if (!name.trim()) {
      setMessage('Give your character a name.')
      return
    }
    const pose: CharacterPose = {
      id: newId(),
      label,
      src,
      sourceSrc,
      kind,
      filter: usedFilter,
      cutout: usedCutout,
      createdAt: Date.now(),
    }
    if (!character) {
      const created: CharacterAsset = {
        id: newId(),
        name: name.trim(),
        bio: bio.trim(),
        referenceSrc: sourceSrc,
        portraitSrc: src,
        mainPoseId: pose.id,
        poses: [pose],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      onSave(created)
      setCharacter(created)
    } else {
      if (character.poses.length >= 24) {
        setMessage('This character has lots of looks already. Delete one to add another.')
        return
      }
      const next: CharacterAsset = {
        ...character,
        name: name.trim(),
        bio: bio.trim(),
        poses: [...character.poses, pose],
        updatedAt: Date.now(),
      }
      onSave(next)
      setCharacter(next)
    }
    setAiResult(null)
    setMessage(null)
    setStep('sheet')
  }

  const settleCutout = async (imageDataUrl: string, localCutout: boolean | undefined) => {
    if (!localCutout) return { src: imageDataUrl, cutout: seeThrough, note: null as string | null }
    const look = await applyLook(imageDataUrl, { filter: 'original', cutout: true, maxEdge: 1200 })
    if (look.cutout === 'applied') {
      return {
        src: look.url,
        cutout: true,
        note: ai.mock
          ? null
          : 'The see-through step ran on this device. If the edges look rough, try Cut out background.',
      }
    }
    return {
      src: imageDataUrl,
      cutout: false,
      note: 'I could not make the background see-through. You can still keep the picture, or use Cut out background on a flatter photo.',
    }
  }

  const drawWithAi = async (reference: string) => {
    if (!ai.configured) return
    setBusy('Drawing… this can take a little while')
    setMessage(null)
    try {
      const result = await generateCharacterLook({
        referenceDataUrl: reference,
        style: styleId,
        expression: expressionId,
        pose: poseId,
        note,
        transparent: seeThrough,
      })
      const settled = await settleCutout(result.imageDataUrl, result.localCutout)
      setAiResult(settled.src)
      if (settled.note) setMessage(settled.note)
    } catch (error) {
      if (error instanceof PasscodeError && error.cancelled) return
      console.error(error)
      const text = error instanceof Error ? error.message : ''
      setMessage(
        text.startsWith("Let's try a different idea") || text.includes('magic word')
          ? text
          : 'That drawing did not work. Your photo is still here. You can use it as-is or try again.',
      )
    } finally {
      setBusy(null)
    }
  }

  const removeLookBackground = async (pose: CharacterPose) => {
    setBusy('Removing the background…')
    setMessage(null)
    try {
      let src = pose.src
      let applied = false
      if (ai.configured) {
        const result = await removeBackground(pose.src)
        if (!result.localCutout) {
          src = result.imageDataUrl
          applied = true
        } else {
          const look = await applyLook(result.imageDataUrl, { filter: 'original', cutout: true, maxEdge: 1200 })
          if (look.cutout === 'applied') {
            src = look.url
            applied = true
          }
        }
      } else {
        const look = await applyLook(pose.src, { filter: 'original', cutout: true, maxEdge: 1200 })
        if (look.cutout === 'applied') {
          src = look.url
          applied = true
        }
      }
      if (!applied) {
        setMessage('I could not find a plain background. The look is still here.')
        return
      }
      saveLook(src, pose.kind === 'photo' ? 'filtered' : pose.kind, `${pose.label} · see-through`, pose.filter, true, pose.sourceSrc)
    } catch (error) {
      if (error instanceof PasscodeError && error.cancelled) return
      const text = error instanceof Error ? error.message : ''
      setMessage(
        text.startsWith("Let's try a different idea") || text.includes('magic word')
          ? text
          : 'That did not work. The look is still here.',
      )
    } finally {
      setBusy(null)
    }
  }

  const saveDetails = () => {
    if (!character) return
    if (!name.trim()) {
      setMessage('Give your character a name.')
      return
    }
    const next = { ...character, name: name.trim(), bio: bio.trim(), updatedAt: Date.now() }
    onSave(next)
    setCharacter(next)
    setMessage('Saved on this device.')
  }

  return (
    <div className="studio">
      <header className="studio-top">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <Icon name="back" /> Back
        </button>
        <h2>{character ? character.name : 'New character'}</h2>
        <p className="privacy-line">Pictures stay on this device unless you tap Draw with AI or Remove background.</p>
      </header>

      <div className="studio-body">
        {message && (
          <p className="asset-error" role="status">
            {message}
          </p>
        )}

        {step === 'list' && (
          <section className="sheet-step">
            <button type="button" className="btn btn-primary" onClick={() => setStep('pick')}>
              <Icon name="plus" /> New character
            </button>
            <ul className="pose-board">
              {characters.map((item) => (
                <li key={item.id}>
                  <button type="button" className="pose-chip" onClick={() => onEditExisting(item.id)}>
                    <img src={item.portraitSrc} alt="" />
                    <span>{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 'pick' && !camera && (
          <section
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setOver(false)
              const file = imageFilesFromList(event.dataTransfer.files)[0]
              if (file) void takeFile(file)
            }}
          >
            <Icon name="image" />
            <h3>Add a photo or drawing</h3>
            <p>Drop it here, paste it, or choose one of these.</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                Photo library
              </button>
              <button type="button" className="btn" onClick={() => setCamera(true)}>
                <Icon name="camera" /> Camera
              </button>
              <button type="button" className="btn" onClick={() => cameraFileRef.current?.click()}>
                Camera app
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void takeFile(file)
                event.target.value = ''
              }}
            />
            <input
              ref={cameraFileRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void takeFile(file)
                event.target.value = ''
              }}
            />
          </section>
        )}

        {step === 'pick' && camera && (
          <CameraCapture
            onClose={() => setCamera(false)}
            onCapture={(dataUrl) => {
              setCamera(false)
              setRawSrc(dataUrl)
              setStep('crop')
            }}
          />
        )}

        {step === 'crop' && rawSrc && (
          <Cropper src={rawSrc} onCancel={() => setStep('pick')} onUseWhole={() => beginStyle(rawSrc)} onCrop={beginStyle} />
        )}

        {step === 'style' && croppedSrc && (
          <section className="style-step">
            <div className="look-preview">
              <img src={preview?.url ?? croppedSrc} alt="Preview of this character" />
              {previewBusy && <p className="asset-busy">Making that look…</p>}
            </div>
            <div className="field">
              <label htmlFor="char-name">Name</label>
              <input
                id="char-name"
                className="text-input"
                maxLength={40}
                value={name}
                placeholder="Emily"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="char-bio">Short bio</label>
              <textarea
                id="char-bio"
                className="text-input"
                maxLength={280}
                rows={3}
                value={bio}
                placeholder="Loves volleyball and never gives up."
                onChange={(event) => setBio(event.target.value)}
              />
            </div>
            <p className="sidebar-label">Manga filters, on this device</p>
            <div className="chip-row">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip ${filter === item.id ? 'active' : ''}`}
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`chip ${cutout ? 'active' : ''}`}
              aria-pressed={cutout}
              onClick={() => setCutout((value) => !value)}
            >
              Cut out background
            </button>
            {preview?.cutout === 'skipped' && (
              <p className="asset-help">I could not find a plain background. The picture is still ready to use.</p>
            )}
            <p className="asset-help">{FILTERS.find((item) => item.id === filter)?.help}</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!preview || previewBusy}
              onClick={() => {
                if (!preview) return
                const label =
                  filter === 'original' && !cutout
                    ? 'Photo'
                    : filter === 'original'
                      ? 'Cutout'
                      : (FILTERS.find((item) => item.id === filter)?.label ?? 'Look')
                saveLook(preview.url, filter === 'original' && !cutout ? 'photo' : 'filtered', label, filter, cutout)
              }}
            >
              Save this look
            </button>

            <AiCard
              ai={ai}
              busy={busy}
              styleId={styleId}
              expressionId={expressionId}
              poseId={poseId}
              note={note}
              seeThrough={seeThrough}
              result={aiResult}
              onStyle={setStyleId}
              onExpression={setExpressionId}
              onPose={setPoseId}
              onNote={setNote}
              onSeeThrough={setSeeThrough}
              onDraw={() => void drawWithAi(croppedSrc)}
              onKeep={() => {
                if (!aiResult) return
                saveLook(
                  aiResult,
                  'ai',
                  `${presetLabel(EXPRESSION_PRESETS, expressionId)} · ${presetLabel(POSE_PRESETS, poseId)}`,
                  undefined,
                  seeThrough,
                  croppedSrc,
                )
              }}
              onClear={() => setAiResult(null)}
            />
            <button type="button" className="btn" onClick={() => setStep('crop')}>
              Back to crop
            </button>
          </section>
        )}

        {step === 'sheet' && character && (
          <section className="sheet-step">
            <div className="field">
              <label htmlFor="sheet-name">Name</label>
              <input id="sheet-name" className="text-input" maxLength={40} value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sheet-bio">Short bio</label>
              <textarea id="sheet-bio" className="text-input" maxLength={280} rows={3} value={bio} onChange={(event) => setBio(event.target.value)} />
            </div>
            <button type="button" className="btn" onClick={saveDetails}>
              Save name and bio
            </button>
            <p className="sidebar-label">Looks</p>
            <p className="asset-help">
              Remove background makes a new see-through copy and keeps the old look.
              {ai.configured && !ai.mock
                ? ' That sends the picture to Venice and can cost a little extra.'
                : ' It tries on this device.'}
            </p>
            <ul className="pose-board">
              {character.poses.map((pose) => (
                <li key={pose.id} className={pose.id === character.mainPoseId ? 'main' : ''}>
                  <img src={pose.src} alt="" />
                  <span>{pose.label}</span>
                  <div className="dialog-actions">
                    <button type="button" className="btn btn-small" onClick={() => makeMain(character, pose, onSave, setCharacter)}>
                      {pose.id === character.mainPoseId ? 'Main look' : 'Make main'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={Boolean(busy)}
                      onClick={() => void removeLookBackground(pose)}
                    >
                      Remove background
                    </button>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => removePose(character, pose.id, onSave, setCharacter, setMessage)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary" onClick={() => setStep('pick')}>
              <Icon name="plus" /> Add another look
            </button>
            <AiCard
              ai={ai}
              busy={busy}
              styleId={styleId}
              expressionId={expressionId}
              poseId={poseId}
              note={note}
              seeThrough={seeThrough}
              result={aiResult}
              onStyle={setStyleId}
              onExpression={setExpressionId}
              onPose={setPoseId}
              onNote={setNote}
              onSeeThrough={setSeeThrough}
              onDraw={() => void drawWithAi(character.referenceSrc)}
              onKeep={() => {
                if (!aiResult) return
                saveLook(
                  aiResult,
                  'ai',
                  `${presetLabel(EXPRESSION_PRESETS, expressionId)} · ${presetLabel(POSE_PRESETS, poseId)}`,
                  undefined,
                  seeThrough,
                  character.referenceSrc,
                )
              }}
              onClear={() => setAiResult(null)}
            />
            {!confirmDelete ? (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete character
              </button>
            ) : (
              <div className="confirm-inline">
                <p>Delete {character.name}? Pages that already use their pictures will keep those pictures.</p>
                <div className="dialog-actions">
                  <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      onDelete(character.id)
                      onClose()
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function makeMain(
  character: CharacterAsset,
  pose: CharacterPose,
  onSave: (character: CharacterAsset) => void,
  setCharacter: (character: CharacterAsset) => void,
) {
  const next = { ...character, mainPoseId: pose.id, portraitSrc: pose.src, updatedAt: Date.now() }
  onSave(next)
  setCharacter(next)
}

function removePose(
  character: CharacterAsset,
  poseId: string,
  onSave: (character: CharacterAsset) => void,
  setCharacter: (character: CharacterAsset) => void,
  setMessage: (message: string | null) => void,
) {
  if (character.poses.length <= 1) {
    setMessage('Keep at least one look, or delete the whole character.')
    return
  }
  const poses = character.poses.filter((pose) => pose.id !== poseId)
  const main = poses.find((pose) => pose.id === character.mainPoseId) ?? poses[0]
  const next = { ...character, poses, mainPoseId: main.id, portraitSrc: main.src, updatedAt: Date.now() }
  onSave(next)
  setCharacter(next)
  setMessage(null)
}

function AiCard({
  ai,
  busy,
  styleId,
  expressionId,
  poseId,
  note,
  seeThrough,
  result,
  onStyle,
  onExpression,
  onPose,
  onNote,
  onSeeThrough,
  onDraw,
  onKeep,
  onClear,
}: {
  ai: GenerateStatus & { known: boolean }
  busy: string | null
  styleId: StyleId
  expressionId: ExpressionId
  poseId: PoseId
  note: string
  seeThrough: boolean
  result: string | null
  onStyle: (id: StyleId) => void
  onExpression: (id: ExpressionId) => void
  onPose: (id: PoseId) => void
  onNote: (note: string) => void
  onSeeThrough: (value: boolean) => void
  onDraw: () => void
  onKeep: () => void
  onClear: () => void
}) {
  return (
    <section className={`ai-card ${ai.configured ? 'on' : 'off'}`}>
      <h3>Draw with AI</h3>
      {!ai.known && <p className="asset-help">Checking whether AI drawing is turned on…</p>}
      {ai.known && !ai.configured && (
        <p>
          AI drawing is not turned on, and that is okay. Your photo, crop, and filters work right here.
          A grown-up can add a Venice key on the computer that runs EMily if you want drawings later.
        </p>
      )}
      {ai.configured && ai.mock && (
        <p>
          Practice mode is on, so this stays on the computer and does not call Venice or spend money. The picture will look like a pretend result.
          {ai.needsPasscode ? ' The first time, ask your grown-up for the magic word.' : ''}
        </p>
      )}
      {ai.configured && !ai.mock && (
        <p>
          This sends the photo to Venice to draw a manga version. It can cost a little money on a grown-up's account. Nothing is sent until you tap the button.
          {ai.needsPasscode ? ' The first time, ask your grown-up for the magic word.' : ''}
        </p>
      )}
      <div className="chip-row">
        {STYLE_PRESETS.map((item) => (
          <button key={item.id} type="button" className={`chip ${styleId === item.id ? 'active' : ''}`} disabled={!ai.configured || Boolean(busy)} onClick={() => onStyle(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="chip-row">
        {EXPRESSION_PRESETS.map((item) => (
          <button key={item.id} type="button" className={`chip ${expressionId === item.id ? 'active' : ''}`} disabled={!ai.configured || Boolean(busy)} onClick={() => onExpression(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="chip-row">
        {POSE_PRESETS.map((item) => (
          <button key={item.id} type="button" className={`chip ${poseId === item.id ? 'active' : ''}`} disabled={!ai.configured || Boolean(busy)} onClick={() => onPose(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Anything to add?</span>
        <input className="text-input" maxLength={180} value={note} placeholder="Jersey number, glasses, team colors" disabled={!ai.configured} onChange={(event) => onNote(event.target.value)} />
      </label>
      <button
        type="button"
        className={`chip ${seeThrough ? 'active' : ''}`}
        aria-pressed={seeThrough}
        disabled={!ai.configured || Boolean(busy)}
        onClick={() => onSeeThrough(!seeThrough)}
      >
        See-through background
      </button>
      {ai.configured && (
        <p className="asset-help">
          {seeThrough
            ? ai.mock
              ? 'See-through background is on. Practice mode cuts the background out on this device.'
              : 'See-through background is on. After the drawing, Venice removes the background too. That is a small extra charge. Turn this off to keep the background.'
            : 'See-through background is off, so the drawing keeps its background.'}
        </p>
      )}
      <button type="button" className="btn btn-primary" disabled={!ai.configured || Boolean(busy)} onClick={onDraw}>
        {busy ?? 'Draw with AI'}
      </button>
      {result && (
        <div className={`look-preview ${seeThrough ? 'checker' : ''}`}>
          <img src={result} alt="AI drawing preview" />
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" onClick={onKeep}>
              Keep this drawing
            </button>
            <button type="button" className="btn" onClick={onClear}>
              Try again
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
