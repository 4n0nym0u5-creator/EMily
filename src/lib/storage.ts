import { newId } from './ids'
import { createEmptyPage } from './storyFactory'
import type {
  BubbleElement,
  CanvasElement,
  CharacterAsset,
  CharacterPose,
  ImageElement,
  Library,
  MangaFilterId,
  Page,
  PanelElement,
  PoseKind,
  SceneAsset,
  SfxElement,
  Story,
} from '../types'
import { LEGACY_STORAGE_KEY } from '../types'

const DB_NAME = 'emily-manga'
const DB_VERSION = 1
const STORE = 'kv'
const LIBRARY_KEY = 'library'

const emptyLibrary = (): Library => ({
  version: 3,
  stories: [],
  characters: [],
  scenes: [],
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeElement(raw: unknown): CanvasElement | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.kind !== 'string') return null
  const rect = {
    x: num(raw.x),
    y: num(raw.y),
    width: Math.max(8, num(raw.width, 40)),
    height: Math.max(8, num(raw.height, 40)),
  }
  const zIndex = num(raw.zIndex, 1)

  if (raw.kind === 'panel') {
    const panel: PanelElement = { id: raw.id, kind: 'panel', zIndex, ...rect }
    return panel
  }

  if (raw.kind === 'image') {
    if (typeof raw.src !== 'string' || !raw.src) return null
    const role = raw.role === 'character' || raw.role === 'scene' || raw.role === 'upload' ? raw.role : 'upload'
    const image: ImageElement = {
      id: raw.id,
      kind: 'image',
      src: raw.src,
      panelId: typeof raw.panelId === 'string' ? raw.panelId : null,
      zIndex,
      rotation: num(raw.rotation),
      flipX: raw.flipX === true,
      flipY: raw.flipY === true,
      role,
      ...rect,
    }
    if (typeof raw.characterId === 'string') image.characterId = raw.characterId
    if (typeof raw.poseId === 'string') image.poseId = raw.poseId
    return image
  }

  if (raw.kind === 'bubble') {
    const style = raw.style === 'shout' || raw.style === 'thought' || raw.style === 'speech' ? raw.style : 'speech'
    const bubble: BubbleElement = {
      id: raw.id,
      kind: 'bubble',
      text: text(raw.text, '…'),
      style,
      zIndex,
      ...rect,
    }
    return bubble
  }

  if (raw.kind === 'sfx') {
    const sfx: SfxElement = {
      id: raw.id,
      kind: 'sfx',
      text: text(raw.text, 'WHOOSH'),
      color: text(raw.color, '#ff5a1f'),
      rotation: num(raw.rotation, -8),
      zIndex,
      ...rect,
    }
    return sfx
  }

  return null
}

function normalizePage(raw: unknown, index: number): Page | null {
  if (!isRecord(raw)) return null
  const elements = Array.isArray(raw.elements)
    ? raw.elements.map(normalizeElement).filter((element): element is CanvasElement => element !== null)
    : []
  return {
    id: text(raw.id, newId()),
    title: text(raw.title, `Page ${index + 1}`),
    elements,
    updatedAt: num(raw.updatedAt, Date.now()),
  }
}

export function normalizeStory(raw: unknown): Story | null {
  if (!isRecord(raw)) return null
  const pages = Array.isArray(raw.pages)
    ? raw.pages.map(normalizePage).filter((page): page is Page => page !== null)
    : []
  if (!pages.length && !text(raw.title) && !text(raw.id)) return null
  return {
    id: text(raw.id, newId()),
    title: text(raw.title, 'My Haikyuu Story'),
    pages: pages.length ? pages : [createEmptyPage('Page 1')],
    createdAt: num(raw.createdAt, Date.now()),
    updatedAt: num(raw.updatedAt, Date.now()),
    readDirection: raw.readDirection === 'rtl' ? 'rtl' : 'ltr',
  }
}

function normalizePose(raw: unknown, fallbackSrc: string): CharacterPose | null {
  if (!isRecord(raw) || typeof raw.src !== 'string' || !raw.src) return null
  const kind: PoseKind = raw.kind === 'ai' || raw.kind === 'filtered' || raw.kind === 'photo' ? raw.kind : 'photo'
  const filter = isFilter(raw.filter) ? raw.filter : undefined
  return {
    id: text(raw.id, newId()),
    label: text(raw.label, 'Look'),
    src: raw.src,
    sourceSrc: text(raw.sourceSrc, fallbackSrc || raw.src),
    kind,
    filter,
    cutout: raw.cutout === true,
    createdAt: num(raw.createdAt, Date.now()),
  }
}

function isFilter(value: unknown): value is MangaFilterId {
  return value === 'original' || value === 'grey' || value === 'contrast' || value === 'ink' || value === 'screentone'
}

export function normalizeCharacter(raw: unknown): CharacterAsset | null {
  if (!isRecord(raw)) return null
  const portraitSrc = text(raw.portraitSrc) || text(raw.referenceSrc)
  if (!portraitSrc) return null
  const referenceSrc = text(raw.referenceSrc, portraitSrc)
  const posesFromRaw = Array.isArray(raw.poses)
    ? raw.poses.map((pose) => normalizePose(pose, referenceSrc)).filter((pose): pose is CharacterPose => pose !== null)
    : []
  const poses = posesFromRaw.length
    ? posesFromRaw
    : [
        {
          id: newId(),
          label: referenceSrc !== portraitSrc ? 'Manga look' : 'Main look',
          src: portraitSrc,
          sourceSrc: referenceSrc,
          kind: referenceSrc !== portraitSrc ? 'ai' as const : 'photo' as const,
          createdAt: num(raw.createdAt, Date.now()),
        },
      ]
  const mainPoseId = poses.some((pose) => pose.id === raw.mainPoseId) ? text(raw.mainPoseId) : poses[0].id
  const main = poses.find((pose) => pose.id === mainPoseId) ?? poses[0]
  return {
    id: text(raw.id, newId()),
    name: text(raw.name, 'Character'),
    bio: text(raw.bio),
    referenceSrc,
    portraitSrc: main.src,
    mainPoseId,
    poses,
    createdAt: num(raw.createdAt, Date.now()),
    updatedAt: num(raw.updatedAt, num(raw.createdAt, Date.now())),
  }
}

export function normalizeScene(raw: unknown): SceneAsset | null {
  if (!isRecord(raw) || typeof raw.src !== 'string' || !raw.src) return null
  return {
    id: text(raw.id, newId()),
    name: text(raw.name, 'Background'),
    prompt: text(raw.prompt),
    src: raw.src,
    source: raw.source === 'ai' || text(raw.prompt) ? (raw.source === 'upload' ? 'upload' : 'ai') : 'upload',
    createdAt: num(raw.createdAt, Date.now()),
  }
}

export function migrateLibrary(raw: unknown): Library {
  if (!isRecord(raw)) return emptyLibrary()
  return {
    version: 3,
    stories: Array.isArray(raw.stories)
      ? raw.stories.map(normalizeStory).filter((story): story is Story => story !== null)
      : [],
    characters: Array.isArray(raw.characters)
      ? raw.characters.map(normalizeCharacter).filter((character): character is CharacterAsset => character !== null)
      : [],
    scenes: Array.isArray(raw.scenes)
      ? raw.scenes.map(normalizeScene).filter((scene): scene is SceneAsset => scene !== null)
      : [],
  }
}

export type ImportResult =
  | { type: 'library'; library: Library }
  | { type: 'story'; story: Story }

export function parseImportJson(raw: unknown): ImportResult {
  if (!isRecord(raw)) throw new Error('That file is not an EMily backup.')
  if (Array.isArray(raw.stories)) return { type: 'library', library: migrateLibrary(raw) }
  if (Array.isArray(raw.pages)) {
    const story = normalizeStory(raw)
    if (!story) throw new Error('That story file could not be read.')
    return { type: 'story', story }
  }
  throw new Error('That file is not an EMily backup.')
}

export async function parseImportFile(file: File): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('That file could not be read. Choose an EMily backup.')
  }
  return parseImportJson(parsed)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open storage'))
  })
}

async function idbGet(): Promise<unknown> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(LIBRARY_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function idbSet(library: Library): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not save'))
      tx.objectStore(STORE).put(library, LIBRARY_KEY)
    })
  } finally {
    db.close()
  }
}

function readLegacy(): Library | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    return migrateLibrary(JSON.parse(raw))
  } catch {
    return null
  }
}

export interface LoadedLibrary {
  library: Library
  persisted: boolean
  migrated: boolean
  warning: string | null
}

export async function loadLibrary(): Promise<LoadedLibrary> {
  let idbOk = true
  try {
    const stored = await idbGet()
    if (stored) {
      const library = migrateLibrary(stored)
      const storedVersion = isRecord(stored) ? stored.version : 0
      if (storedVersion !== 3) await idbSet(library)
      if (localStorage.getItem(LEGACY_STORAGE_KEY)) localStorage.removeItem(LEGACY_STORAGE_KEY)
      return { library, persisted: true, migrated: storedVersion !== 3, warning: null }
    }
  } catch {
    idbOk = false
  }

  const legacy = readLegacy()
  if (legacy) {
    if (idbOk) {
      try {
        await idbSet(legacy)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        return { library: legacy, persisted: true, migrated: true, warning: null }
      } catch {
        idbOk = false
      }
    }
    return {
      library: legacy,
      persisted: false,
      migrated: true,
      warning: 'Pictures could not be moved into safer storage. Export a backup before you leave.',
    }
  }

  if (!idbOk) {
    return {
      library: emptyLibrary(),
      persisted: false,
      migrated: false,
      warning: 'This browser will not keep saves. Export a backup before you leave.',
    }
  }

  return { library: emptyLibrary(), persisted: true, migrated: false, warning: null }
}

let latest: Library | null = null
let writing = false
let timer: ReturnType<typeof setTimeout> | null = null
let lastError: string | null = null
const listeners = new Set<(error: string | null) => void>()

function notify() {
  for (const listener of listeners) listener(lastError)
}

export function subscribeSaveErrors(listener: (error: string | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function writeLatest() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!latest || writing) return
  writing = true
  const snapshot = latest
  try {
    await idbSet(snapshot)
    if (latest === snapshot) latest = null
    if (lastError) {
      lastError = null
      notify()
    }
  } catch {
    lastError = 'The save did not finish. Try exporting a backup so nothing is lost.'
    notify()
  } finally {
    writing = false
    if (latest && latest !== snapshot) void writeLatest()
  }
}

export function scheduleSave(library: Library) {
  latest = library
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void writeLatest()
  }, 250)
}

export function flushSave() {
  void writeLatest()
}

export function upsertStory(library: Library, story: Story): Library {
  const index = library.stories.findIndex((item) => item.id === story.id)
  const stories =
    index === -1 ? [story, ...library.stories] : library.stories.map((item, i) => (i === index ? story : item))
  return { ...library, stories }
}

export function deleteStory(library: Library, storyId: string): Library {
  return { ...library, stories: library.stories.filter((story) => story.id !== storyId) }
}

export function upsertCharacter(library: Library, character: CharacterAsset): Library {
  const index = library.characters.findIndex((item) => item.id === character.id)
  const characters =
    index === -1
      ? [character, ...library.characters]
      : library.characters.map((item, i) => (i === index ? character : item))
  return { ...library, characters }
}

export function deleteCharacter(library: Library, characterId: string): Library {
  return { ...library, characters: library.characters.filter((character) => character.id !== characterId) }
}

export function upsertScene(library: Library, scene: SceneAsset): Library {
  const index = library.scenes.findIndex((item) => item.id === scene.id)
  const scenes = index === -1 ? [scene, ...library.scenes] : library.scenes.map((item, i) => (i === index ? scene : item))
  return { ...library, scenes }
}

export function deleteScene(library: Library, sceneId: string): Library {
  return { ...library, scenes: library.scenes.filter((scene) => scene.id !== sceneId) }
}
