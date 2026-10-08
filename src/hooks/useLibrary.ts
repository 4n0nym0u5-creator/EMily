import { useCallback, useEffect, useState } from 'react'
import {
  deleteCharacter,
  deleteScene,
  deleteStory,
  flushSave,
  loadLibrary,
  parseImportFile,
  scheduleSave,
  subscribeSaveErrors,
  upsertCharacter,
  upsertScene,
  upsertStory,
} from '../lib/storage'
import { downloadJson, safeFilename } from '../lib/download'
import type { CharacterAsset, Library, SceneAsset, Story } from '../types'

export function useLibrary() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [ready, setReady] = useState(false)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadLibrary().then((loaded) => {
      if (cancelled) return
      setLibrary(loaded.library)
      setLoadWarning(loaded.warning)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => subscribeSaveErrors(setSaveError), [])

  useEffect(() => {
    if (!ready || !library) return
    scheduleSave(library)
  }, [library, ready])

  useEffect(() => {
    const flush = () => flushSave()
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [])

  const saveStory = useCallback((story: Story) => {
    setLibrary((prev) => (prev ? upsertStory(prev, { ...story, updatedAt: Date.now() }) : prev))
  }, [])

  const removeStory = useCallback((storyId: string) => {
    setLibrary((prev) => (prev ? deleteStory(prev, storyId) : prev))
  }, [])

  const saveCharacter = useCallback((character: CharacterAsset) => {
    setLibrary((prev) =>
      prev ? upsertCharacter(prev, { ...character, updatedAt: Date.now() }) : prev,
    )
  }, [])

  const removeCharacter = useCallback((characterId: string) => {
    setLibrary((prev) => (prev ? deleteCharacter(prev, characterId) : prev))
  }, [])

  const saveScene = useCallback((scene: SceneAsset) => {
    setLibrary((prev) => (prev ? upsertScene(prev, scene) : prev))
  }, [])

  const removeScene = useCallback((sceneId: string) => {
    setLibrary((prev) => (prev ? deleteScene(prev, sceneId) : prev))
  }, [])

  const replaceLibrary = useCallback((next: Library) => {
    setLibrary(next)
  }, [])

  const downloadAll = useCallback(() => {
    if (!library) return
    downloadJson(library, 'emily-library.json')
  }, [library])

  const downloadStory = useCallback((story: Story) => {
    downloadJson(story, `${safeFilename(story.title, 'story')}.json`)
  }, [])

  return {
    library,
    ready,
    loadWarning,
    saveError,
    saveStory,
    removeStory,
    saveCharacter,
    removeCharacter,
    saveScene,
    removeScene,
    replaceLibrary,
    downloadAll,
    downloadStory,
    parseImportFile,
  }
}
