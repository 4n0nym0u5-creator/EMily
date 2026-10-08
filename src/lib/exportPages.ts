import type { Story } from '../types'
import { canvasToBlob } from './images'
import { buildPdf } from './pdf'
import { renderPageCanvas } from './renderPage'
import { downloadBlob, safeFilename } from './download'
import { zipStore } from './zip'

function pagesWithArt(story: Story) {
  return story.pages.filter((page) => page.elements.length > 0)
}

export async function exportStoryImages(
  story: Story,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const pages = pagesWithArt(story)
  if (!pages.length) throw new Error('Add something to a page before saving pictures.')
  const name = safeFilename(story.title, 'emily-story')
  const files: Array<{ name: string; data: Uint8Array }> = []
  for (let index = 0; index < pages.length; index += 1) {
    onProgress?.(index, pages.length)
    const canvas = await renderPageCanvas(pages[index])
    const blob = await canvasToBlob(canvas, 'image/png')
    files.push({
      name: `${name}-page-${index + 1}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    })
  }
  onProgress?.(pages.length, pages.length)
  if (files.length === 1) {
    downloadBlob(new Blob([bytesOf(files[0].data)], { type: 'image/png' }), files[0].name)
    return
  }
  const zipped = zipStore(files)
  downloadBlob(new Blob([bytesOf(zipped)], { type: 'application/zip' }), `${name}-pages.zip`)
}

export async function exportStoryPdf(
  story: Story,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const pages = pagesWithArt(story)
  if (!pages.length) throw new Error('Add something to a page before saving a PDF.')
  const images: Array<{ jpeg: Uint8Array; pixelWidth: number; pixelHeight: number }> = []
  for (let index = 0; index < pages.length; index += 1) {
    onProgress?.(index, pages.length)
    const canvas = await renderPageCanvas(pages[index])
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.86)
    images.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    })
  }
  onProgress?.(pages.length, pages.length)
  const pdf = buildPdf(images)
  downloadBlob(
    new Blob([bytesOf(pdf)], { type: 'application/pdf' }),
    `${safeFilename(story.title, 'emily-story')}.pdf`,
  )
}

function bytesOf(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}
