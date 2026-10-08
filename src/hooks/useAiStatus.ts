import { useEffect, useState } from 'react'
import { fetchGenerateStatus, type GenerateStatus } from '../lib/generateClient'

export function useAiStatus(): GenerateStatus & { known: boolean } {
  const [status, setStatus] = useState<GenerateStatus>({ configured: false, mock: false, needsPasscode: false })
  const [known, setKnown] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchGenerateStatus()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch(() => {
        if (!cancelled) setStatus({ configured: false, mock: false, needsPasscode: false })
      })
      .finally(() => {
        if (!cancelled) setKnown(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...status, known }
}
