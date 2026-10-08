import { newId } from './ids'
import type { Page, Story } from '../types'

export function createEmptyPage(title = 'Page 1'): Page {
  return {
    id: newId(),
    title,
    elements: [],
    updatedAt: Date.now(),
  }
}

export function createStory(title = 'My Haikyuu Story'): Story {
  const now = Date.now()
  return {
    id: newId(),
    title,
    pages: [createEmptyPage('Page 1')],
    createdAt: now,
    updatedAt: now,
  }
}
