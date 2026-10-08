import { useState } from 'react'
import { exportStoryImages, exportStoryPdf } from '../lib/exportPages'
import type { Story } from '../types'

export function ShareActions({ story }: { story: Story }) {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (label: string, action: (onProgress: (done: number, total: number) => void) => Promise<void>) => {
    setError(null)
    setStatus(label)
    try {
      await action((done, total) => {
        setStatus(done >= total ? 'Saved' : `${label} ${done + 1} of ${total}`)
      })
      setStatus('Saved on this device')
      window.setTimeout(() => setStatus(null), 1600)
    } catch (caught) {
      setStatus(null)
      setError(caught instanceof Error ? caught.message : 'Could not save that.')
    }
  }

  return (
    <div className="share-actions">
      <button
        type="button"
        className="btn"
        disabled={Boolean(status && status !== 'Saved on this device')}
        onClick={() => void run('Pictures', (onProgress) => exportStoryImages(story, onProgress))}
      >
        Save pictures
      </button>
      <button
        type="button"
        className="btn btn-primary"
        disabled={Boolean(status && status !== 'Saved on this device')}
        onClick={() => void run('PDF', (onProgress) => exportStoryPdf(story, onProgress))}
      >
        Save PDF
      </button>
      {status && (
        <p className="asset-busy" role="status">
          {status}
        </p>
      )}
      {error && <p className="asset-error">{error}</p>}
    </div>
  )
}
