export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('That picture could not be read.'))
    reader.readAsDataURL(file)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That picture did not open. Try a JPG or PNG.'))
    image.src = src
  })
}

export async function measureImage(src: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(src)
  return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height }
}

export function imageFilesFromList(list: FileList | File[] | null | undefined): File[] {
  if (!list) return []
  return [...list].filter((file) => file.type.startsWith('image/'))
}

export async function fileToDataUrl(file: File, maxEdge = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a picture.')
  }
  const raw = await readFileAsDataUrl(file)
  const image = await loadImage(raw)
  const longest = Math.max(image.width, image.height)
  const scale = Math.min(1, maxEdge / Math.max(1, longest))
  if (scale === 1 && (file.type === 'image/jpeg' || file.type === 'image/jpg') && file.size < 900_000) {
    return raw
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare that picture.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.88)
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality)
  })
  if (!blob) throw new Error('Could not save that picture.')
  return blob
}
