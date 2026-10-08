import { useCallback, useEffect, useState } from 'react'
import {
  deleteCharacter,
  deleteScene,
  deleteStory,
  exportLibrary,
  exportStory,
  importJsonFile,
  loadLibrary,
  saveLibrary,
  upsertCharacter,
  upsertScene,
  upsertStory,
} from '../lib/storage'
import type { CharacterAsset, Library, SceneAsset, Story } from '../types'

export function useLibrary() {
  const [library, setLibrary] = useState<Library>(() => loadLibrary())

  useEffect(() => {
    saveLibrary(library)
  }, [library])

  const saveStory = useCallback((story: Story) => {
    setLibrary((prev) => upsertStory(prev, { ...story, updatedAt: Date.now() }))
  }, [])

  const removeStory = useCallback((storyId: string) => {
    setLibrary((prev) => deleteStory(prev, storyId))
  }, [])

  const saveCharacter = useCallback((character: CharacterAsset) => {
    setLibrary((prev) => upsertCharacter(prev, character))
  }, [])

  const removeCharacter = useCallback((characterId: string) => {
    setLibrary((prev) => deleteCharacter(prev, characterId))
  }, [])

  const saveScene = useCallback((scene: SceneAsset) => {
    setLibrary((prev) => upsertScene(prev, scene))
  }, [])

  const removeScene = useCallback((sceneId: string) => {
    setLibrary((prev) => deleteScene(prev, sceneId))
  }, [])

  const downloadAll = useCallback(() => {
    exportLibrary(library)
  }, [library])

  const downloadStory = useCallback((story: Story) => {
    exportStory(story)
  }, [])

  const importFile = useCallback(async (file: File) => {
    const data = await importJsonFile(file)
    if ('version' in data) {
      setLibrary(data)
      return data.stories[0] ?? null
    }
    setLibrary((prev) => upsertStory(prev, data))
    return data
  }, [])

  return {
    library,
    saveStory,
    removeStory,
    saveCharacter,
    removeCharacter,
    saveScene,
    removeScene,
    downloadAll,
    downloadStory,
    importFile,
  }
}
