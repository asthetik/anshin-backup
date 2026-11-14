// PNG-backed Windows ICO / macOS ICNS containers. Keeping these writers local
// lets icon generation stay dependency-free and produce true size-specific art.

const ICNS_TYPES = new Map([
  [16, 'icp4'],
  [32, 'icp5'],
  [64, 'icp6'],
  [128, 'ic07'],
  [256, 'ic08'],
  [512, 'ic09'],
  [1024, 'ic10'],
])

function sortedUnique(entries) {
  const seen = new Set()
  return [...entries]
    .sort((a, b) => a.size - b.size)
    .map((entry) => {
      if (!Number.isInteger(entry.size) || entry.size < 1 || entry.size > 1024) {
        throw new RangeError(`unsupported icon size: ${entry.size}`)
      }
      if (seen.has(entry.size)) throw new Error(`duplicate icon size: ${entry.size}`)
      seen.add(entry.size)
      if (!Buffer.isBuffer(entry.png) || entry.png.length === 0) {
        throw new TypeError(`icon ${entry.size} needs a non-empty PNG buffer`)
      }
      return entry
    })
}

export function encodeIco(entries) {
  const icons = sortedUnique(entries)
  const headerSize = 6 + icons.length * 16
  let offset = headerSize
  const out = Buffer.alloc(headerSize + icons.reduce((sum, icon) => sum + icon.png.length, 0))

  out.writeUInt16LE(0, 0)
  out.writeUInt16LE(1, 2)
  out.writeUInt16LE(icons.length, 4)

  icons.forEach((icon, index) => {
    if (icon.size > 256) throw new RangeError(`ICO does not support ${icon.size}px PNG entries`)
    const at = 6 + index * 16
    const dimension = icon.size === 256 ? 0 : icon.size
    out[at] = dimension
    out[at + 1] = dimension
    out[at + 2] = 0
    out[at + 3] = 0
    out.writeUInt16LE(1, at + 4)
    out.writeUInt16LE(32, at + 6)
    out.writeUInt32LE(icon.png.length, at + 8)
    out.writeUInt32LE(offset, at + 12)
    icon.png.copy(out, offset)
    offset += icon.png.length
  })

  return out
}

export function encodeIcns(entries) {
  const icons = sortedUnique(entries)
  for (const icon of icons) {
    if (!ICNS_TYPES.has(icon.size)) throw new RangeError(`ICNS does not support ${icon.size}px`)
  }

  const chunks = icons.map((icon) => {
    const chunk = Buffer.alloc(8 + icon.png.length)
    chunk.write(ICNS_TYPES.get(icon.size), 0, 4, 'ascii')
    chunk.writeUInt32BE(chunk.length, 4)
    icon.png.copy(chunk, 8)
    return chunk
  })
  const out = Buffer.alloc(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  out.write('icns', 0, 4, 'ascii')
  out.writeUInt32BE(out.length, 4)
  chunks.reduce((offset, chunk) => {
    chunk.copy(out, offset)
    return offset + chunk.length
  }, 8)
  return out
}
