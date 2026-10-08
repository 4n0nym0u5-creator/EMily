import type { Rect } from '../types'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../types'

const MARGIN = 32
const GUTTER = 16
const INNER_W = CANVAS_WIDTH - MARGIN * 2
const INNER_H = CANVAS_HEIGHT - MARGIN * 2

export interface PageLayout {
  id: string
  name: string
  rects: Rect[]
}

function row(y: number, height: number): Rect {
  return { x: MARGIN, y, width: INNER_W, height }
}

const twoH = (INNER_H - GUTTER) / 2
const threeH = (INNER_H - GUTTER * 2) / 3
const gridW = (INNER_W - GUTTER) / 2
const gridH = (INNER_H - GUTTER) / 2
const heroH = INNER_H * 0.58
const heroBottom = INNER_H - heroH - GUTTER
const sideLeft = INNER_W * 0.56
const sideRight = INNER_W - sideLeft - GUTTER

export const LAYOUTS: PageLayout[] = [
  {
    id: 'single',
    name: 'One big panel',
    rects: [row(MARGIN, INNER_H)],
  },
  {
    id: 'two',
    name: 'Two rows',
    rects: [row(MARGIN, twoH), row(MARGIN + twoH + GUTTER, twoH)],
  },
  {
    id: 'three',
    name: 'Three rows',
    rects: [
      row(MARGIN, threeH),
      row(MARGIN + threeH + GUTTER, threeH),
      row(MARGIN + (threeH + GUTTER) * 2, threeH),
    ],
  },
  {
    id: 'hero',
    name: 'Big moment',
    rects: [
      row(MARGIN, heroH),
      {
        x: MARGIN,
        y: MARGIN + heroH + GUTTER,
        width: gridW,
        height: heroBottom,
      },
      {
        x: MARGIN + gridW + GUTTER,
        y: MARGIN + heroH + GUTTER,
        width: gridW,
        height: heroBottom,
      },
    ],
  },
  {
    id: 'grid',
    name: 'Four panels',
    rects: [
      { x: MARGIN, y: MARGIN, width: gridW, height: gridH },
      { x: MARGIN + gridW + GUTTER, y: MARGIN, width: gridW, height: gridH },
      { x: MARGIN, y: MARGIN + gridH + GUTTER, width: gridW, height: gridH },
      { x: MARGIN + gridW + GUTTER, y: MARGIN + gridH + GUTTER, width: gridW, height: gridH },
    ],
  },
  {
    id: 'side',
    name: 'Tall and stacks',
    rects: [
      { x: MARGIN, y: MARGIN, width: sideLeft, height: INNER_H },
      { x: MARGIN + sideLeft + GUTTER, y: MARGIN, width: sideRight, height: twoH },
      {
        x: MARGIN + sideLeft + GUTTER,
        y: MARGIN + twoH + GUTTER,
        width: sideRight,
        height: twoH,
      },
    ],
  },
]
