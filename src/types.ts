export type AppMode = 'home' | 'creator' | 'reader'
export type CreatorTool = 'select' | 'bubble' | 'sfx' | 'panel'

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
  role?: 'character' | 'scene' | 'upload'
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

export type CanvasElement =
  | ImageElement
  | BubbleElement
  | SfxElement
  | PanelElement

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
}

export interface CharacterAsset {
  id: string
  name: string
  referenceSrc: string
  portraitSrc: string
  createdAt: number
}

export interface SceneAsset {
  id: string
  name: string
  prompt: string
  src: string
  createdAt: number
}

export interface Library {
  version: 2
  stories: Story[]
  characters: CharacterAsset[]
  scenes: SceneAsset[]
}

export const CANVAS_WIDTH = 720
export const CANVAS_HEIGHT = 1020
export const STORAGE_KEY = 'emily-manga-library-v1'
