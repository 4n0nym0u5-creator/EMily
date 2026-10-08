import { useCallback, useRef, useState } from 'react'

export function useHistory<T>(initial: T) {
  const [state, setState] = useState(initial)
  const stateRef = useRef(initial)
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  const gesture = useRef<T | null>(null)
  const [counts, setCounts] = useState({ undo: 0, redo: 0 })

  const publish = useCallback((next: T) => {
    stateRef.current = next
    setState(next)
    setCounts({ undo: past.current.length, redo: future.current.length })
  }, [])

  const update = useCallback(
    (updater: (current: T) => T, mode: 'live' | 'commit') => {
      const current = stateRef.current
      const next = updater(current)
      if (mode === 'live') {
        if (gesture.current === null) gesture.current = current
        stateRef.current = next
        setState(next)
        return
      }
      const base = gesture.current ?? current
      gesture.current = null
      if (base !== next) {
        past.current.push(base)
        if (past.current.length > 40) past.current.shift()
        future.current = []
      }
      publish(next)
    },
    [publish],
  )

  const undo = useCallback(() => {
    const previous = past.current.pop()
    if (!previous) return
    future.current.push(stateRef.current)
    gesture.current = null
    publish(previous)
  }, [publish])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(stateRef.current)
    gesture.current = null
    publish(next)
  }, [publish])

  const reset = useCallback(
    (next: T) => {
      past.current = []
      future.current = []
      gesture.current = null
      publish(next)
    },
    [publish],
  )

  return {
    state,
    update,
    undo,
    redo,
    reset,
    canUndo: counts.undo > 0,
    canRedo: counts.redo > 0,
  }
}
