import type { CharacterAsset, Library, SceneAsset, Story } from '../types'
import { STORAGE_KEY } from '../types'

const emptyLibrary = (): Library => ({
  version: 2,
  stories: [],
  characters: [],
  scenes: [],
})

function migrate(raw: unknown): Library {
  if (!raw || typeof raw !== 'object') return emptyLibrary()
  const data = raw as {
    version?: number
    stories?: Story[]
    characters?: CharacterAsset[]
    scenes?: SceneAsset[]
  }

  if (!Array.isArray(data.stories)) return emptyLibrary()

  if (data.version === 2) {
    return {
      version: 2,
      stories: data.stories,
      characters: Array.isArray(data.characters) ? data.characters : [],
      scenes: Array.isArray(data.scenes) ? data.scenes : [],
    }
  }

  // v1 or unknown → v2
  return {
    version: 2,
    stories: data.stories,
    characters: [],
    scenes: [],
  }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyLibrary()
    return migrate(JSON.parse(raw))
  } catch {
    return emptyLibrary()
  }
}

export function saveLibrary(library: Library): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
}

export function upsertStory(library: Library, story: Story): Library {
  const index = library.stories.findIndex((s) => s.id === story.id)
  const stories =
    index === -1
      ? [story, ...library.stories]
      : library.stories.map((s, i) => (i === index ? story : s))
  return { ...library, stories }
}

export function deleteStory(library: Library, storyId: string): Library {
  return {
    ...library,
    stories: library.stories.filter((s) => s.id !== storyId),
  }
}

export function upsertCharacter(
  library: Library,
  character: CharacterAsset,
): Library {
  const index = library.characters.findIndex((c) => c.id === character.id)
  const characters =
    index === -1
      ? [character, ...library.characters]
      : library.characters.map((c, i) => (i === index ? character : c))
  return { ...library, characters }
}

export function deleteCharacter(library: Library, characterId: string): Library {
  return {
    ...library,
    characters: library.characters.filter((c) => c.id !== characterId),
  }
}

export function upsertScene(library: Library, scene: SceneAsset): Library {
  const index = library.scenes.findIndex((s) => s.id === scene.id)
  const scenes =
    index === -1
      ? [scene, ...library.scenes]
      : library.scenes.map((s, i) => (i === index ? scene : s))
  return { ...library, scenes }
}

export function deleteScene(library: Library, sceneId: string): Library {
  return {
    ...library,
    scenes: library.scenes.filter((s) => s.id !== sceneId),
  }
}

export function exportLibrary(library: Library, filename = 'emily-manga.json'): void {
  const blob = new Blob([JSON.stringify(library, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportStory(story: Story): void {
  const safe = story.title.replace(/[^\w\-]+/g, '-').toLowerCase() || 'story'
  const blob = new Blob([JSON.stringify(story, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  aDownload(url, `${safe}.json`)
}

function aDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function importJsonFile(file: File): Promise<Library | Story> {
  const text = await file.text()
  const data = JSON.parse(text) as Library | Story | { version: 1; stories: Story[] }
  if ('version' in data && Array.isArray((data as Library).stories)) {
    return migrate(data)
  }
  if ('pages' in data && Array.isArray(data.pages) && data.id && data.title) {
    return data as Story
  }
  throw new Error('That file does not look like an EMily manga export.')
}
