import { useEffect, useRef, useState } from 'react'
import { registerMagicWord, rememberPasscode } from '../lib/generateClient'

export function MagicWordDialog() {
  const [open, setOpen] = useState(false)
  const [retry, setRetry] = useState(false)
  const [word, setWord] = useState('')
  const resolver = useRef<((value: string | null) => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    registerMagicWord((isRetry) => {
      setRetry(isRetry)
      setWord('')
      setOpen(true)
      return new Promise((resolve) => {
        resolver.current = resolve
      })
    })
    return () => registerMagicWord(null)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) return null

  const finish = (value: string | null) => {
    if (value) rememberPasscode(value)
    setOpen(false)
    resolver.current?.(value)
    resolver.current = null
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => finish(null)}>
      <form
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="magic-title"
        onSubmit={(event) => {
          event.preventDefault()
          if (word.trim()) finish(word)
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="magic-title">Ask your grown-up for the magic word</h2>
        <p>
          {retry
            ? 'That word did not match. Ask your grown-up to try it again.'
            : 'Drawings need a grown-up’s word. Photos, stories, and filters still work without it. The word stays in this browser.'}
        </p>
        <label className="field">
          <span>Magic word</span>
          <input
            ref={inputRef}
            className="text-input"
            type="password"
            autoComplete="off"
            value={word}
            onChange={(event) => setWord(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => finish(null)}>
            Not now
          </button>
          <button type="submit" className="btn btn-primary" disabled={!word.trim()}>
            Use this word
          </button>
        </div>
      </form>
    </div>
  )
}
