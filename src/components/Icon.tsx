import type { ReactNode } from 'react'

export function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] ?? paths.plus}
    </svg>
  )
}

const paths: Record<string, ReactNode> = {
  back: <path d="M15 5 7 12l8 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  undo: <path d="M8 8H4v4M4.5 8.5A8 8 0 1 1 6 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  redo: <path d="M16 8h4v4M19.5 8.5A8 8 0 1 0 18 17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  move: <path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8 3 12l4 4M17 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  layout: <path d="M4 4h16v16H4zM4 12h16M12 12v8" fill="none" stroke="currentColor" strokeWidth="2" />,
  speech: <path d="M5 5h14v10H9l-4 4v-4H5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  thought: (
    <>
      <ellipse cx="12" cy="10" rx="7" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="7" cy="17" r="1.4" fill="currentColor" />
      <circle cx="4.5" cy="19.5" r="0.9" fill="currentColor" />
    </>
  ),
  sound: <path d="M5 15 12 4l2 8h5l-8 8 1.5-6z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  camera: (
    <>
      <path d="M4 8h3l2-2h6l2 2h3v10H4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  image: <path d="M4 6h16v12H4zM4 15l4-3 3 2 3-4 6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  trash: <path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  flip: <path d="M12 4v16M7 8 4 12l3 4M17 8l3 4-3 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  rotate: <path d="M20 12a8 8 0 1 1-2.2-5.5M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
  book: <path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 3zM20 5h-7a3 3 0 0 0-3 3v11h7a3 3 0 0 1 3 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  bigger: <path d="M5 9V5h4M19 9V5h-4M5 15v4h4M19 15v4h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  smaller: <path d="M9 5v4H5M15 5v4h4M9 19v-4H5M15 19v-4h4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
}
