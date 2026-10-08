import { useMemo, useState } from 'react'
import { Creator } from './components/Creator'
import { Home } from './components/Home'
import { Reader } from './components/Reader'
import { useLibrary } from './hooks/useLibrary'
import type { AppMode } from './types'

export default function App() {
  const {
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
  } = useLibrary()

  const [mode, setMode] = useState<AppMode>('home')
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)

  const activeStory = useMemo(
    () => library.stories.find((s) => s.id === activeStoryId) ?? null,
    [library.stories, activeStoryId],
  )

  return (
    <div className="app">
      {mode === 'home' && (
        <Home
          stories={library.stories}
          characterCount={library.characters.length}
          onCreate={(story) => {
            saveStory(story)
            setActiveStoryId(story.id)
          }}
          onOpenCreator={(id) => {
            setActiveStoryId(id)
            setMode('creator')
          }}
          onOpenReader={(id) => {
            setActiveStoryId(id)
            setMode('reader')
          }}
          onDelete={removeStory}
          onExportAll={downloadAll}
          onImport={async (file) => {
            const story = await importFile(file)
            if (story) setActiveStoryId(story.id)
          }}
        />
      )}

      {mode === 'creator' && activeStory && (
        <Creator
          story={activeStory}
          characters={library.characters}
          scenes={library.scenes}
          onSave={saveStory}
          onSaveCharacter={saveCharacter}
          onDeleteCharacter={removeCharacter}
          onSaveScene={saveScene}
          onDeleteScene={removeScene}
          onBack={() => setMode('home')}
          onRead={() => setMode('reader')}
          onExport={() => downloadStory(activeStory)}
        />
      )}

      {mode === 'reader' && activeStory && (
        <Reader
          story={activeStory}
          onBack={() => setMode('home')}
          onEdit={() => setMode('creator')}
        />
      )}
    </div>
  )
}
