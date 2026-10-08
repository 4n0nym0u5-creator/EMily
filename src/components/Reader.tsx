import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { CanvasElement, Story } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'

interface ReaderProps {
  story: Story
  onBack: () => void
  onEdit: () => void
}

export function Reader({ story, onBack, onEdit }: ReaderProps) {
  const pages = useMemo(
    () => story.pages.filter((p) => p.elements.length > 0),
    [story.pages],
  )
  const [index, setIndex] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const page = pages[index]

  const go = (next: number) => {
    if (next < 0 || next >= pages.length) return
    setIndex(next)
    setAnimKey((k) => k + 1)
    setZoomed(false)
    window.setTimeout(() => setZoomed(true), 40)
  }

  useEffect(() => {
    setZoomed(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(index - 1)
      } else if (e.key === 'Escape') {
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, pages.length])

  if (pages.length === 0) {
    return (
      <div className="reader reader-empty">
        <p>This story has no drawn pages yet.</p>
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          Open Creator
        </button>
      </div>
    )
  }

  const sorted = [...page.elements].sort((a, b) => {
    if (a.kind === 'panel' && b.kind !== 'panel') return -1
    if (b.kind === 'panel' && a.kind !== 'panel') return 1
    return a.zIndex - b.zIndex
  })

  return (
    <div className="reader">
      <div className="reader-spotlight" aria-hidden />
      <header className="reader-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Library
        </button>
        <div className="reader-meta">
          <h1>{story.title}</h1>
          <p>
            Page {index + 1} / {pages.length}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          Edit
        </button>
      </header>

      <button
        type="button"
        className="reader-stage"
        onClick={() => go(index + 1)}
        aria-label="Next page"
      >
        <div
          key={animKey}
          className={`reader-page ${zoomed ? 'in' : ''}`}
          style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
        >
          <div className="manga-paper" />
          {sorted.map((el) => (
            <ReaderElement key={el.id} el={el} />
          ))}
        </div>
        {index < pages.length - 1 ? (
          <span className="reader-cue">Tap / → for the next cliffhanger</span>
        ) : (
          <span className="reader-cue end">To be continued… draw the next page!</span>
        )}
      </button>

      <footer className="reader-controls">
        <button
          type="button"
          className="btn"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          ← Prev
        </button>
        <div className="reader-dots">
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`dot ${i === index ? 'active' : ''}`}
              aria-label={`Go to page ${i + 1}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={index >= pages.length - 1}
          onClick={() => go(index + 1)}
        >
          Next →
        </button>
      </footer>
    </div>
  )
}

function ReaderElement({ el }: { el: CanvasElement }) {
  const style: CSSProperties = {
    left: `${(el.x / CANVAS_WIDTH) * 100}%`,
    top: `${(el.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(el.width / CANVAS_WIDTH) * 100}%`,
    height: `${(el.height / CANVAS_HEIGHT) * 100}%`,
    zIndex: el.zIndex + (el.kind === 'panel' ? 0 : 10),
  }

  if (el.kind === 'panel') {
    return <div className="el panel readonly" style={style} />
  }
  if (el.kind === 'image') {
    return (
      <div className={`el image readonly ${el.panelId ? 'in-panel' : ''}`} style={style}>
        <img src={el.src} alt="" draggable={false} />
      </div>
    )
  }
  if (el.kind === 'bubble') {
    return (
      <div className={`el bubble style-${el.style} readonly`} style={style}>
        <p>{el.text}</p>
        <span className="bubble-tail" aria-hidden />
      </div>
    )
  }
  return (
    <div
      className="el sfx readonly"
      style={{
        ...style,
        color: el.color,
        transform: `rotate(${el.rotation}deg)`,
      }}
    >
      <span>{el.text}</span>
    </div>
  )
}
