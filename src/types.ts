export type AppMode = 'home' | 'creator' | 'reader'
export type CreatorTool = 'select' | 'speech' | 'thought' | 'sfx' | 'panel'
export type ReadDirection = 'ltr' | 'rtl'
export type MangaFilterId = 'original' | 'grey' | 'contrast' | 'ink' | 'screentone'
export type PoseKind = 'photo' | 'filtered' | 'ai'
export type ImageRole = 'character' | 'scene' | 'upload'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageElement extends Rect {
  id: string
  kind: 'image'
  src: string
  panelId: string | null
  zIndex: number
  rotation: number
  flipX: boolean
  flipY: boolean
  role: ImageRole
  characterId?: string
  poseId?: string
}

export interface BubbleElement extends Rect {
  id: string
  kind: 'bubble'
  text: string
  style: 'speech' | 'shout' | 'thought'
  zIndex: number
}

export interface SfxElement extends Rect {
  id: string
  kind: 'sfx'
  text: string
  color: string
  rotation: number
  zIndex: number
}

export interface PanelElement extends Rect {
  id: string
  kind: 'panel'
  zIndex: number
}

export type CanvasElement = ImageElement | BubbleElement | SfxElement | PanelElement

export interface Page {
  id: string
  title: string
  elements: CanvasElement[]
  updatedAt: number
}

export interface Story {
  id: string
  title: string
  pages: Page[]
  createdAt: number
  updatedAt: number
  readDirection: ReadDirection
}

export interface CharacterPose {
  id: string
  label: string
  src: string
  sourceSrc: string
  kind: PoseKind
  filter?: MangaFilterId
  cutout?: boolean
  createdAt: number
}

export interface CharacterAsset {
  id: string
  name: string
  bio: string
  referenceSrc: string
  portraitSrc: string
  mainPoseId: string
  poses: CharacterPose[]
  createdAt: number
  updatedAt: number
}

export interface SceneAsset {
  id: string
  name: string
  prompt: string
  src: string
  source: 'upload' | 'ai'
  createdAt: number
}

export interface Library {
  version: 3
  stories: Story[]
  characters: CharacterAsset[]
  scenes: SceneAsset[]
}

export interface AssetDrag {
  src: string
  role: 'character' | 'scene'
  label: string
  characterId?: string
  poseId?: string
}

export const CANVAS_WIDTH = 720
export const CANVAS_HEIGHT = 1020
export const LIBRARY_VERSION = 3
export const LEGACY_STORAGE_KEY = 'emily-manga-library-v1'
