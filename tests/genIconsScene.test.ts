import { describe, expect, test } from 'vitest'
import {
  buildAppIcon,
  buildAppIconAssets,
  buildTraySilhouette,
  buildWindowsTray,
  turtleDesign,
} from '../scripts/gen-icons.mjs'

function px(canvas: { size: number; data: Float64Array }, x: number, y: number) {
  const i = (y * canvas.size + x) * 4
  return {
    r: canvas.data[i] as number,
    g: canvas.data[i + 1] as number,
    b: canvas.data[i + 2] as number,
    a: canvas.data[i + 3] as number,
  }
}

// 设计空间（未旋转 512 画布）→ 实际像素；与 gen-icons 的 -8° 旋转一致
function atDesign(canvas: { size: number; data: Float64Array }, x: number, y: number) {
  const rad = (-8 * Math.PI) / 180
  const dx = x - 256
  const dy = y - 256
  const rx = 256 + dx * Math.cos(rad) - dy * Math.sin(rad)
  const ry = 256 + dx * Math.sin(rad) + dy * Math.cos(rad)
  const scale = canvas.size / 512
  return px(canvas, Math.floor(rx * scale), Math.floor(ry * scale))
}

function bbox(canvas: { size: number; data: Float64Array }) {
  let minX = canvas.size
  let minY = canvas.size
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.size; y += 1) {
    for (let x = 0; x < canvas.size; x += 1) {
      if ((canvas.data[(y * canvas.size + x) * 4 + 3] as number) > 0.5) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

function whiteBbox(canvas: { size: number; data: Float64Array }) {
  let minX = canvas.size
  let minY = canvas.size
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < canvas.size; y += 1) {
    for (let x = 0; x < canvas.size; x += 1) {
      const p = px(canvas, x, y)
      if (p.a > 0.5 && p.r > 240 && p.g > 240 && p.b > 240) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

describe('buildAppIcon', () => {
  const canvas = buildAppIcon(32)

  test('rounded corner clips the field (corner pixel transparent)', () => {
    expect(px(canvas, 0, 0).a).toBeLessThan(0.05)
    expect(px(canvas, 16, 4).a).toBeGreaterThan(0.95)
  })

  test('turtle silhouette is white and dominant in the center', () => {
    let white = 0
    for (let y = 12; y < 20; y += 1) {
      for (let x = 12; x < 20; x += 1) {
        const p = px(canvas, x, y)
        if (p.a > 0.95 && p.r > 240 && p.g > 240 && p.b > 240) white += 1
      }
    }
    expect(white).toBeGreaterThanOrEqual(40)
  })

  test('field is a diagonal gradient (top-left lighter than bottom-right)', () => {
    const topLeft = px(canvas, 4, 6)
    const bottomRight = px(canvas, 27, 25)
    expect(topLeft.a).toBeGreaterThan(0.9)
    expect(bottomRight.a).toBeGreaterThan(0.9)
    expect(topLeft.b).toBeGreaterThan(bottomRight.b)
    expect(topLeft.r).toBeGreaterThan(bottomRight.r)
  })

  test('large icon fills the optical center instead of sitting low', () => {
    const large = buildAppIcon(1024)
    const box = whiteBbox(large)
    expect(box.maxX - box.minX + 1).toBeGreaterThanOrEqual(720)
    expect(box.maxY - box.minY + 1).toBeGreaterThanOrEqual(500)
    expect((box.minX + box.maxX) / 2).toBeCloseTo(512, -1)
    expect((box.minY + box.maxY) / 2).toBeCloseTo(512, -1)
  })
})

describe('buildAppIconAssets', () => {
  test('ships native-size PNGs plus valid ICO and ICNS containers', () => {
    const assets = buildAppIconAssets()
    expect(assets.pngs.map((icon) => icon.size)).toEqual([
      16, 20, 24, 32, 48, 64, 128, 256, 512, 1024,
    ])
    expect(assets.ico.readUInt16LE(4)).toBe(8)
    expect(assets.icns.subarray(0, 4).toString('ascii')).toBe('icns')
    expect(assets.icns.readUInt32BE(4)).toBe(assets.icns.length)
  })
})

describe('turtle silhouette union', () => {
  // 壳/头/颈/鳍各自闭合；同向环绕才能并集成整片白，反向会在重叠处相消成洞
  const icon = buildAppIcon(256)
  test.each([
    ['head × neck', 386, 213],
    ['neck × shell', 356, 244],
    ['far rear flipper × shell', 142, 205],
    ['near rear flipper × shell', 140, 325],
    ['front flipper × shell', 334, 335],
  ])('%s overlap stays solid white', (_name, x, y) => {
    const p = atDesign(icon, x as number, y as number)
    expect(p.a).toBeGreaterThan(0.95)
    expect(p.r).toBeGreaterThan(240)
    expect(p.g).toBeGreaterThan(240)
    expect(p.b).toBeGreaterThan(240)
  })
})

describe('turtle geometry contract', () => {
  test('shell, head-neck, three flippers and tail are closed compound regions', () => {
    const { turtle } = turtleDesign()
    expect(turtle.subpaths).toHaveLength(6)
    expect(turtle.subpaths.every((path) => path.closed)).toBe(true)
  })
})

describe('buildTraySilhouette', () => {
  const canvas = buildTraySilhouette(16)

  test('monochrome turtle shape centered on transparency', () => {
    expect(px(canvas, 0, 0).a).toBeLessThan(0.05)
    const center = px(canvas, 8, 8)
    expect(center.a).toBeGreaterThan(0.9)
    expect(center.r).toBeLessThan(10)
  })

  test('16px silhouette fits the canvas and stays optically centered', () => {
    const box = bbox(canvas)
    expect(box.minX).toBeGreaterThanOrEqual(1)
    expect(box.maxX).toBeLessThanOrEqual(14)
    expect(box.minY).toBeGreaterThanOrEqual(1)
    expect(box.maxY).toBeLessThanOrEqual(14)
    expect((box.minX + box.maxX) / 2).toBeGreaterThanOrEqual(7)
    expect((box.minX + box.maxX) / 2).toBeLessThanOrEqual(8)
    expect((box.minY + box.maxY) / 2).toBeGreaterThanOrEqual(7.5)
    expect((box.minY + box.maxY) / 2).toBeLessThanOrEqual(8.5)
  })
})

describe('buildWindowsTray', () => {
  const canvas = buildWindowsTray(16)

  test('gradient field with white turtle, transparent corner', () => {
    expect(px(canvas, 0, 0).a).toBeLessThan(0.05)
    const center = px(canvas, 8, 8)
    expect(center.a).toBeGreaterThan(0.9)
    expect(center.r).toBeGreaterThan(240)
    const field = px(canvas, 3, 3)
    expect(field.a).toBeGreaterThan(0.9)
    expect(field.b).toBeGreaterThan(150)
    expect(field.r).toBeLessThan(200)
  })

  test.each([
    [16, 11, 8],
    [20, 15, 10],
  ])('%ipx tray uses the readable compact silhouette', (size, minWidth, minHeight) => {
    const canvas = buildWindowsTray(size)
    const box = whiteBbox(canvas)
    expect(box.maxX - box.minX + 1).toBeGreaterThanOrEqual(minWidth)
    expect(box.maxY - box.minY + 1).toBeGreaterThanOrEqual(minHeight)
  })
})
