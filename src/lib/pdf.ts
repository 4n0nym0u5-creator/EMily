interface PdfPage {
  jpeg: Uint8Array
  pixelWidth: number
  pixelHeight: number
}

function latin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff
  return bytes
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function buildPdf(pages: PdfPage[]): Uint8Array {
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 28
  const pageIds: number[] = []
  // catalog and pages are reserved after we know kids; build page objects first with placeholders.
  // We'll assemble in order: catalog, pages, then each page trio. Kids need ids, so precompute.
  const pageCount = Math.max(1, pages.length)
  const catalogId = 1
  const pagesId = 2
  let nextId = 3
  const triples = (pages.length ? pages : [{ jpeg: emptyJpeg(), pixelWidth: 1, pixelHeight: 1 }]).map((page) => {
    const contentId = nextId
    const imageId = nextId + 1
    const pageId = nextId + 2
    nextId += 3
    pageIds.push(pageId)
    return { page, contentId, imageId, pageId }
  })

  const availW = pageWidth - margin * 2
  const availH = pageHeight - margin * 2

  const chunks: Uint8Array[] = [latin1('%PDF-1.4\n')]
  const offsets: number[] = [0]

  const pushObject = (id: number, body: Uint8Array) => {
    offsets[id] = chunks.reduce((total, chunk) => total + chunk.length, 0)
    chunks.push(latin1(`${id} 0 obj\n`))
    chunks.push(body)
    chunks.push(latin1('\nendobj\n'))
  }

  pushObject(catalogId, latin1(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`))
  pushObject(
    pagesId,
    latin1(
      `<< /Type /Pages /Count ${pageCount} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
    ),
  )

  for (const item of triples) {
    const scale = Math.min(availW / item.page.pixelWidth, availH / item.page.pixelHeight)
    const drawW = item.page.pixelWidth * scale
    const drawH = item.page.pixelHeight * scale
    const x = (pageWidth - drawW) / 2
    const y = (pageHeight - drawH) / 2
    const content = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`
    pushObject(item.contentId, latin1(`<< /Length ${content.length} >>\nstream\n${content}endstream`))
    const header = `<< /Type /XObject /Subtype /Image /Width ${item.page.pixelWidth} /Height ${item.page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${item.page.jpeg.length} >>\nstream\n`
    pushObject(item.imageId, concat([latin1(header), item.page.jpeg, latin1('\nendstream')]))
    pushObject(
      item.pageId,
      latin1(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${item.contentId} 0 R /Resources << /XObject << /Im0 ${item.imageId} 0 R >> >> >>`,
      ),
    )
  }

  const size = nextId
  const startxref = chunks.reduce((total, chunk) => total + chunk.length, 0)
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`
  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${size} /Root ${catalogId} 0 R >>\nstartxref\n${startxref}\n%%EOF`
  chunks.push(latin1(xref))
  return concat(chunks)
}

function emptyJpeg(): Uint8Array {
  // 1x1 white jpeg
  const base64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUVFRUWFxUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAABBQEBAAAAAAAAAAAAAAADAAIEBQYBB//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AnQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//9k='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
