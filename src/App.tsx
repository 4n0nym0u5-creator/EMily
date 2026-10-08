import { useEffect, useState } from 'react'
import { CharacterStudio } from './components/CharacterStudio'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Creator } from './components/Creator'
import { Home } from './components/Home'
import { MagicWordDialog } from './components/MagicWordDialog'
import { Reader } from './components/Reader'
import { Walkthrough } from './components/Walkthrough'
import { useAiStatus } from './hooks/useAiStatus'
import { useLibrary } from './hooks/useLibrary'
import { createStory } from './lib/storyFactory'
import type { AppMode, Library, Story } from './types'

const WELCOME_KEY = 'emily-welcome-seen'

export default function App() {
  const {
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
  } = useLibrary()
  const ai = useAiStatus()
  const [mode, setMode] = useState<AppMode>('home')
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)
  const [studio, setStudio] = useState<{ characterId: string | null; fresh: boolean } | null>(null)
  const [welcome, setWelcome] = useState(() => localStorage.getItem(WELCOME_KEY) !== '1')
  const [toast, setToast] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null)
  const [pendingImport, setPendingImport] = useState<Library | null>(null)

  const activeStory = library?.stories.find((story) => story.id === activeStoryId) ?? null
  const overlay = Boolean(welcome || studio || pendingDelete || pendingImport)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const closeWelcome = () => {
    localStorage.setItem(WELCOME_KEY, '1')
    setWelcome(false)
  }

  const openStory = (story: Story, nextMode: AppMode) => {
    saveStory(story)
    setActiveStoryId(story.id)
    setMode(nextMode)
  }

  if (!ready || !library) {
    return (
      <div className="splash" role="status">
        <p className="home-kicker">EMily</p>
        <h1>Opening your studio…</h1>
      </div>
    )
  }

  return (
    <div className="app">
      {(loadWarning || saveError) && (
        <p className="banner-warn" role="status">
          {saveError || loadWarning}
        </p>
      )}
      <div className="app-main" inert={overlay ? true : undefined}>
        {mode === 'home' && (
          <Home
            stories={library.stories}
            characterCount={library.characters.length}
            sceneCount={library.scenes.length}
            onCreate={() => openStory(createStory('My Haikyuu Story'), 'creator')}
            onOpenCreator={(id) => {
              setActiveStoryId(id)
              setMode('creator')
            }}
            onOpenReader={(id) => {
              setActiveStoryId(id)
              setMode('reader')
            }}
            onDelete={setPendingDelete}
            onExportAll={() => {
              downloadAll()
              setToast('Backup downloaded. It contains your photos, so keep the file somewhere safe.')
            }}
            onImport={(file) => {
              void parseImportFile(file)
                .then((result) => {
                  if (result.type === 'library') setPendingImport(result.library)
                  else {
                    saveStory(result.story)
                    setActiveStoryId(result.story.id)
                    setToast(`Added “${result.story.title}”.`)
                  }
                })
                .catch((error: unknown) => {
                  setToast(error instanceof Error ? error.message : 'That file could not be imported.')
                })
            }}
            onCharacters={() => setStudio({ characterId: null, fresh: false })}
            onHelp={() => setWelcome(true)}
          />
        )}

        {mode === 'creator' && activeStory && (
          <Creator
            story={activeStory}
            characters={library.characters}
            scenes={library.scenes}
            ai={ai}
            pasteEnabled={!studio}
            onSave={saveStory}
            onBack={() => setMode('home')}
            onRead={() => setMode('reader')}
            onBackup={() => {
              downloadStory(activeStory)
              setToast('Story backup downloaded.')
            }}
            onCreateCharacter={() => setStudio({ characterId: null, fresh: true })}
            onEditCharacter={(id) => setStudio({ characterId: id, fresh: false })}
            onSaveScene={saveScene}
            onDeleteScene={removeScene}
          />
        )}

        {mode === 'reader' && activeStory && (
          <Reader
            story={activeStory}
            onBack={() => setMode('home')}
            onEdit={() => setMode('creator')}
            onDirection={(readDirection) => saveStory({ ...activeStory, readDirection })}
          />
        )}

        {mode !== 'home' && !activeStory && (
          <div className="reader-empty">
            <p>That story is not on this device anymore.</p>
            <button type="button" className="btn btn-primary" onClick={() => setMode('home')}>
              Back to the library
            </button>
          </div>
        )}
      </div>

      {studio && (
        <CharacterStudio
          key={`${studio.fresh ? 'fresh' : 'edit'}-${studio.characterId ?? 'none'}`}
          characters={library.characters}
          editingId={studio.characterId}
          fresh={studio.fresh}
          ai={ai}
          onClose={() => setStudio(null)}
          onSave={(character) => {
            saveCharacter(character)
            setStudio({ characterId: character.id, fresh: false })
          }}
          onDelete={removeCharacter}
          onEditExisting={(id) => setStudio({ characterId: id, fresh: false })}
        />
      )}

      {welcome && <Walkthrough onClose={closeWelcome} />}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete “${pendingDelete.title}”?`}
          message="This removes it from this device. Export a backup first if you want to keep it."
          confirmLabel="Delete story"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            removeStory(pendingDelete.id)
            if (activeStoryId === pendingDelete.id) {
              setActiveStoryId(null)
              setMode('home')
            }
            setPendingDelete(null)
          }}
        />
      )}

      {pendingImport && (
        <ConfirmDialog
          title="Replace everything on this device?"
          message="This backup will replace the stories, characters, and photos saved in this browser."
          confirmLabel="Replace"
          danger
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            replaceLibrary(pendingImport)
            setActiveStoryId(pendingImport.stories[0]?.id ?? null)
            setPendingImport(null)
            setToast('Backup imported.')
          }}
        />
      )}

      <MagicWordDialog />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
