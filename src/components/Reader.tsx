import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ReadDirection, Story } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'
import { Icon } from './Icon'
import { PageFrame } from './PageFrame'
import { ShareActions } from './ShareActions'

interface ReaderProps {
  story: Story
  onBack: () => void
  onEdit: () => void
  onDirection: (direction: ReadDirection) => void
}

export function Reader({ story, onBack, onEdit, onDirection }: ReaderProps) {
  const pages = story.pages.filter((page) => page.elements.length > 0)
  const [index, setIndex] = useState(0)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [turn, setTurn] = useState<'next' | 'prev' | null>(null)
  const [share, setShare] = useState(false)
  const direction = story.readDirection === 'rtl' ? 'rtl' : 'ltr'
  const page = pages[index]

  const go = useCallback((delta: number) => {
    setTurn(delta > 0 ? 'next' : 'prev')
    setIndex((current) => {
      const next = current + delta
      if (next < 0 || next >= pages.length) return current
      return next
    })
  }, [pages.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
      const back = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
      if (event.key === forward || event.key === ' ') {
        event.preventDefault()
        go(1)
      } else if (event.key === back) {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [direction, go, onBack])

  if (!page) {
    return (
      <div className="reader reader-empty">
        <p>This story has no pages to read yet.</p>
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          Make a page
        </button>
      </div>
    )
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, a, input, textarea')) return
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.startX = String(event.clientX)
    event.currentTarget.dataset.startY = String(event.clientY)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const startX = Number(event.currentTarget.dataset.startX ?? event.clientX)
    setOffset(event.clientX - startX)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const startX = Number(event.currentTarget.dataset.startX ?? event.clientX)
    const startY = Number(event.currentTarget.dataset.startY ?? event.clientY)
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    setDragging(false)
    setOffset(0)
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const rect = event.currentTarget.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / rect.width
      if (ratio < 0.28) go(direction === 'rtl' ? 1 : -1)
      else if (ratio > 0.72) go(direction === 'rtl' ? -1 : 1)
      return
    }
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      const forward = direction === 'rtl' ? dx > 0 : dx < 0
      go(forward ? 1 : -1)
    }
  }

  return (
    <div className={`reader direction-${direction}`}>
      <header className="reader-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" /> Library
        </button>
        <div className="reader-meta">
          <h1>{story.title}</h1>
          <p aria-live="polite">
            Page {index + 1} of {pages.length}
          </p>
        </div>
        <div className="reader-top-actions">
          <button type="button" className="btn" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn" onClick={() => setShare((open) => !open)}>
            Share
          </button>
        </div>
      </header>

      {share && (
        <div className="share-pop">
          <ShareActions story={story} />
          <button
            type="button"
            className="btn"
            onClick={() => onDirection(direction === 'rtl' ? 'ltr' : 'rtl')}
          >
            {direction === 'rtl' ? 'Reading right to left' : 'Reading left to right'}
          </button>
        </div>
      )}

      <div
        className="reader-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="reader-book">
          <div
            key={page.id}
            className={`reader-page ${dragging ? 'dragging' : ''} ${turn === 'next' ? 'turn-next' : ''} ${turn === 'prev' ? 'turn-prev' : ''}`}
            style={{
              aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
              transform: dragging ? `translateX(${offset}px)` : undefined,
            }}
          >
            <div className="manga-paper" />
            <PageFrame elements={page.elements} />
          </div>
        </div>
        <p className={`reader-cue ${index === pages.length - 1 ? 'end' : ''}`}>
          {index === pages.length - 1 ? 'To be continued…' : 'Swipe or tap the edge for the next page'}
        </p>
      </div>

      <footer className="reader-controls">
        <button type="button" className="btn" disabled={index === 0} onClick={() => go(-1)}>
          Previous
        </button>
        <div className="reader-dots">
          {pages.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              className={`dot ${dotIndex === index ? 'active' : ''}`}
              aria-label={`Go to page ${dotIndex + 1}`}
              onClick={() => {
                setTurn(dotIndex > index ? 'next' : 'prev')
                setIndex(dotIndex)
              }}
            />
          ))}
        </div>
        <button type="button" className="btn btn-primary" disabled={index >= pages.length - 1} onClick={() => go(1)}>
          Next
        </button>
      </footer>
    </div>
  )
}
