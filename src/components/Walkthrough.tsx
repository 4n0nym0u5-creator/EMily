import { useEffect, useState } from 'react'

const STEPS = [
  {
    title: 'This is your manga studio',
    body: 'Turn a photo or a drawing into a character, then tell a story with panels, speech bubbles, and big sound effects.',
  },
  {
    title: 'Your pictures stay here',
    body: 'Photos stay on this device. They are only sent away if you tap a button that says it draws with AI.',
  },
  {
    title: 'Make someone for the story',
    body: 'Add a picture from your library, paste one, drop it in, or use the camera. Then crop it and try a manga filter.',
  },
  {
    title: 'Read it like a book',
    body: 'Drop characters on a page, write what they say, then turn the pages. You can save pictures or a PDF to share or print.',
  },
]

export function Walkthrough({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setStep((value) => Math.min(STEPS.length - 1, value + 1))
      if (event.key === 'ArrowLeft') setStep((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop">
      <div className="dialog-card walk-card" role="dialog" aria-modal="true" aria-labelledby="walk-title">
        <p className="home-kicker">Hello</p>
        <div className="walk-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2 id="walk-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="step-dots" aria-hidden="true">
          {STEPS.map((item, index) => (
            <i key={item.title} className={index === step ? 'on' : ''} />
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Skip
          </button>
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep((value) => value - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (last) onClose()
              else setStep((value) => value + 1)
            }}
          >
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
