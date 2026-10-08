import { useEffect } from 'react'
import { imageFilesFromList } from '../lib/images'

export function useClipboardImages(onFiles: (files: File[]) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onPaste = (event: ClipboardEvent) => {
      const fromFiles = imageFilesFromList(event.clipboardData?.files)
      const fromItems: File[] = []
      if (!fromFiles.length && event.clipboardData?.items) {
        for (const item of event.clipboardData.items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) fromItems.push(file)
          }
        }
      }
      const files = fromFiles.length ? fromFiles : fromItems
      if (!files.length) return
      event.preventDefault()
      onFiles(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [enabled, onFiles])
}
