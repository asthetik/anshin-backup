import { crc32, inflateSync } from 'node:zlib'
import { describe, expect, test } from 'vitest'
import { encodePng } from '../scripts/png.mjs'
import {
  blendLayer,
  hexToRgb,
  linearGradient,
  makeCanvas,
  mat2d,
  Path,
  rasterize,
  samplePaint,
  solid,
} from '../scripts/rasterizer.mjs'

const BLUE_FROM = '#55A8F0'
const BLUE_TO = '#2D5FDF'

function covAt(cov: Float64Array, size: number, x: number, y: number): number {
  return cov[y * size + x] as number
}

function alphaAt(canvas: { size: number; data: Float64Array }, x: number, y: number): number {
  return canvas.data[(y * canvas.size + x) * 4 + 3] as number
}

function rgbAt(
  canvas: { size: number; data: Float64Array },
  x: number,
  y: number,
): [number, number, number] {
  const i = (y * canvas.size + x) * 4
  return [canvas.data[i] as number, canvas.data[i + 1] as number, canvas.data[i + 2] as number]
}

describe('hexToRgb', () => {
  test('parses 6-digit hex', () => {
    expect(hexToRgb(BLUE_FROM)).toEqual([85, 168, 240])
    expect(hexToRgb(BLUE_TO)).toEqual([45, 95, 223])
  })
})

describe('mat2d', () => {
  test('translate moves points', () => {
    expect(mat2d.translate(10, 20).apply(5, 6)).toEqual([15, 26])
  })
  test('rotate 90 maps x axis onto y axis', () => {
    const [x, y] = mat2d.rotate(90).apply(1, 0)
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(1, 6)
  })
  test('mul(a, b) applies b first, then a', () => {
    const m = mat2d.mul(mat2d.translate(100, 0), mat2d.scale(2, 2))
    expect(m.apply(5, 5)).toEqual([110, 10])
  })
})

describe('linearGradient sampling', () => {
  test('two stops: ends and midpoint along objectBoundingBox diagonal', () => {
    const g = linearGradient({
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      stops: [
        [0, BLUE_FROM],
        [1, BLUE_TO],
      ],
    })
    const bbox = { x: 0, y: 0, w: 100, h: 100 }
    const from = hexToRgb(BLUE_FROM)
    const to = hexToRgb(BLUE_TO)
    const start = samplePaint(g, bbox, 0, 0)
    const mid = samplePaint(g, bbox, 50, 50)
    const end = samplePaint(g, bbox, 100, 100)
    start.forEach((c, i) => {
      expect(c).toBeCloseTo(from[i] as number, 3)
    })
    end.forEach((c, i) => {
      expect(c).toBeCloseTo(to[i] as number, 3)
    })
    mid.forEach((c, i) => {
      expect(c).toBeCloseTo(((from[i] as number) + (to[i] as number)) / 2, 3)
    })
  })

  test('three stops: piecewise linear inside each segment', () => {
    const g = linearGradient({
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        [0, [255, 0, 0]],
        [0.5, [0, 255, 0]],
        [1, [0, 0, 255]],
      ],
    })
    const bbox = { x: 0, y: 0, w: 100, h: 10 }
    samplePaint(g, bbox, 25, 5).forEach((c, i) => {
      expect(c).toBeCloseTo([127.5, 127.5, 0][i] as number, 3)
    })
    samplePaint(g, bbox, 75, 5).forEach((c, i) => {
      expect(c).toBeCloseTo([0, 127.5, 127.5][i] as number, 3)
    })
  })

  test('userSpaceOnUse samples design coordinates, ignoring bbox', () => {
    const g = linearGradient({
      x1: 0,
      y1: 0,
      x2: 200,
      y2: 0,
      stops: [
        [0, [0, 0, 0]],
        [1, [200, 200, 200]],
      ],
      units: 'userSpaceOnUse',
    })
    expect(samplePaint(g, { x: 0, y: 0, w: 1, h: 1 }, 0, 50)[0]).toBeCloseTo(0, 3)
    expect(samplePaint(g, { x: 0, y: 0, w: 1, h: 1 }, 100, 50)[0]).toBeCloseTo(100, 3)
    expect(samplePaint(g, { x: 0, y: 0, w: 1, h: 1 }, 200, 50)[2]).toBeCloseTo(200, 3)
  })

  test('samples clamp to end stops beyond the gradient line', () => {
    const g = linearGradient({
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        [0, [10, 20, 30]],
        [1, [200, 210, 220]],
      ],
    })
    const bbox = { x: 0, y: 0, w: 100, h: 10 }
    samplePaint(g, bbox, -50, 5).forEach((c, i) => {
      expect(c).toBeCloseTo([10, 20, 30][i] as number, 3)
    })
    samplePaint(g, bbox, 150, 5).forEach((c, i) => {
      expect(c).toBeCloseTo(200 + i * 10, 3)
    })
  })
})

describe('rasterize coverage', () => {
  test('full-canvas rect covers every pixel', () => {
    const cov = rasterize(Path.rect(0, 0, 8, 8), 8)
    expect(cov.every((c) => c === 1)).toBe(true)
  })

  test('half-width rect: left columns solid, right columns empty', () => {
    const cov = rasterize(Path.rect(0, 0, 4, 8), 8)
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(covAt(cov, 8, x, y)).toBe(x < 4 ? 1 : 0)
      }
    }
  })

  test('partial edge gets exact fractional coverage on the sample grid', () => {
    // 列 4 覆盖区间 [4.0, 4.5] → 精确面积覆盖 0.5（4×4 采样网格恰好对齐）
    const cov = rasterize(Path.rect(0, 0, 4.5, 8), 8)
    expect(covAt(cov, 8, 4, 0)).toBeCloseTo(0.5, 5)
    expect(covAt(cov, 8, 3, 0)).toBe(1)
    expect(covAt(cov, 8, 5, 0)).toBe(0)
  })

  test('non-zero winding: reversed inner subpath cuts a hole', () => {
    const p = Path.of()
      .moveTo(0, 0)
      .lineTo(8, 0)
      .lineTo(8, 8)
      .lineTo(0, 8)
      .closePath()
      .moveTo(2, 2)
      .lineTo(2, 6)
      .lineTo(6, 6)
      .lineTo(6, 2)
      .closePath()
    const cov = rasterize(p, 8)
    expect(covAt(cov, 8, 1, 1)).toBe(1)
    expect(covAt(cov, 8, 4, 4)).toBe(0)
  })

  test('ellipse: center covered, corners empty', () => {
    const cov = rasterize(Path.ellipse(4, 4, 3.6, 3), 8)
    expect(covAt(cov, 8, 4, 4)).toBe(1)
    expect(covAt(cov, 8, 0, 0)).toBe(0)
    expect(covAt(cov, 8, 7, 7)).toBe(0)
  })

  test('transform moves the shape', () => {
    const cov = rasterize(Path.rect(0, 0, 2, 2), 8, { transform: mat2d.translate(6, 6) })
    expect(covAt(cov, 8, 6, 6)).toBe(1)
    expect(covAt(cov, 8, 0, 0)).toBe(0)
  })
})

describe('stroke', () => {
  test('horizontal line with round caps: center solid, one row above empty', () => {
    const line = Path.of().moveTo(1, 4).lineTo(7, 4)
    const cov = rasterize(line.stroke(2), 8)
    expect(covAt(cov, 8, 4, 4)).toBe(1)
    expect(covAt(cov, 8, 4, 3)).toBe(1)
    expect(covAt(cov, 8, 4, 2)).toBe(0)
    expect(covAt(cov, 8, 4, 1)).toBe(0)
  })

  test('round cap bulges outward past the endpoint instead of folding inward', () => {
    // 线止于 x=5、半径 1：像素 (5,4) 只有外凸的 1/4 圆盘覆盖 ≈ π/4
    const cov = rasterize(Path.of().moveTo(1, 4).lineTo(5, 4).stroke(2), 8)
    expect(covAt(cov, 8, 5, 4)).toBeGreaterThan(0.7)
    expect(covAt(cov, 8, 6, 4)).toBe(0)
  })
})

describe('blendLayer', () => {
  test('clip coverage restricts the painted region', () => {
    const canvas = makeCanvas(8)
    const full = rasterize(Path.rect(0, 0, 8, 8), 8)
    const clip = rasterize(Path.circle(4, 4, 2), 8)
    blendLayer(canvas, full, solid([255, 255, 255]), { clip })
    expect(alphaAt(canvas, 4, 4)).toBeCloseTo(1, 5)
    expect(alphaAt(canvas, 1, 1)).toBe(0)
    expect(alphaAt(canvas, 7, 7)).toBe(0)
  })

  test('objectBoundingBox gradient lands through the full render path', () => {
    const canvas = makeCanvas(8)
    const full = rasterize(Path.rect(0, 0, 8, 8), 8)
    const g = linearGradient({
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        [0, [0, 0, 0]],
        [1, [255, 255, 255]],
      ],
    })
    blendLayer(canvas, full, g, { bbox: { x: 0, y: 0, w: 8, h: 8 } })
    const left = rgbAt(canvas, 0, 4)[0]
    const mid = rgbAt(canvas, 4, 4)[0]
    const right = rgbAt(canvas, 7, 4)[0]
    expect(left).toBeLessThan(20)
    expect(mid).toBeGreaterThan(110)
    expect(mid).toBeLessThan(145)
    expect(right).toBeGreaterThan(235)
    expect(left).toBeLessThan(mid)
    expect(mid).toBeLessThan(right)
  })
})

function pngChunks(png: Buffer) {
  const chunks: { type: string; stored: number; expected: number }[] = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('ascii')
    const body = png.subarray(offset + 4, offset + 8 + length)
    chunks.push({
      type,
      stored: png.readUInt32BE(offset + 8 + length),
      expected: crc32(body) >>> 0,
    })
    offset += 12 + length
  }
  return chunks
}

describe('encodePng round-trip', () => {
  test('every chunk carries a CRC-32 that decoders will accept', () => {
    const png = encodePng(2, 1, Buffer.from([255, 0, 0, 255, 0, 255, 0, 255]))
    const chunks = pngChunks(png)
    expect(chunks.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
    for (const chunk of chunks) {
      expect(chunk.stored, `${chunk.type} CRC`).toBe(chunk.expected)
    }
  })

  test('IEND uses the canonical empty-chunk CRC', () => {
    const png = encodePng(1, 1, Buffer.from([0, 0, 0, 0]))
    expect(pngChunks(png).at(-1)?.stored).toBe(0xae426082)
  })

  test('emits RGBA8 with zero filter bytes', () => {
    const px = Buffer.from([255, 0, 0, 255, 0, 255, 0, 255])
    const png = encodePng(2, 1, px)
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(png.readUInt32BE(8)).toBe(13)
    expect(png.readUInt32BE(16)).toBe(2)
    expect(png.readUInt32BE(20)).toBe(1)
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(6)
    const offset = 33
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('ascii')
    expect(type).toBe('IDAT')
    const raw = inflateSync(png.subarray(offset + 8, offset + 8 + length))
    expect([...raw]).toEqual([0, 255, 0, 0, 255, 0, 255, 0, 255])
  })
})
