// Anshin 图标生成器 — 第六轮「小龟」定稿：海洋蓝渐变场 + 白龟剪影，「背着自己的家走，丢不了」。
// 画法全新：贝塞尔闭合轮廓（壳 / 头颈 / 三鳍 / 尾）经扫描线光栅器（scripts/rasterizer.mjs）
// 以非零环绕并集为剪影；色场与壳纹镂空都是真 linearGradient，零依赖。
// 产物：
//   build/icon.png                     1024 应用图标
//   build/icons/* + icon.ico/icns      分尺寸 PNG、Windows ICO、macOS ICNS
//   resources/trayTemplate.png/@2x     macOS 菜单栏单色剪影（系统自动反色）
//   resources/trayWindows16/20/24/32   Windows 彩色小徽章
// 运行：pnpm icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { encodeIcns, encodeIco } from './icon-container.mjs'
import { encodePng } from './png.mjs'
import {
  blendLayer,
  canvasToPixels,
  linearGradient,
  makeCanvas,
  mat2d,
  Path,
  rasterize,
  solid,
} from './rasterizer.mjs'

const ROOT = join(import.meta.dirname, '..')
const APP_ICON_SIZES = [16, 20, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICNS_APP_ICON_SIZES = new Set([16, 32, 64, 128, 256, 512, 1024])

const FIELD_STOPS = [
  [0, '#55A8F0'],
  [1, '#2D5FDF'],
]
const FIELD = linearGradient({
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 1,
  stops: FIELD_STOPS,
})
// 壳纹要「镂空」见底：userSpaceOnUse 使纹路颜色严格等于该点的场色
const FIELD_CUT = linearGradient({
  x1: 0,
  y1: 0,
  x2: 512,
  y2: 512,
  stops: FIELD_STOPS,
  units: 'userSpaceOnUse',
})
const WHITE = [255, 255, 255]
const BLACK = [0, 0, 0]
const FIELD_BBOX = { x: 0, y: 0, w: 512, h: 512 }
const TURTLE_ROT = -8

// 有根粗、端头圆的鳍足：两段侧面贝塞尔 + 圆端头，锚端藏在壳下。
// 与椭圆同为顺时针，保证非零环绕做并集而不是相消出洞。
function limb(ax, ay, tx, ty, wa, wt) {
  let dx = tx - ax
  let dy = ty - ay
  const len = Math.hypot(dx, dy)
  dx /= len
  dy /= len
  const nx = -dy
  const ny = dx
  const ha = wa / 2
  const ht = wt / 2
  const cap = (ht * 4) / 3
  return Path.of()
    .moveTo(ax - nx * ha, ay - ny * ha)
    .cubicTo(
      ax + dx * len * 0.3 - nx * ha * 1.08,
      ay + dy * len * 0.3 - ny * ha * 1.08,
      tx - dx * len * 0.32 - nx * ht * 0.85,
      ty - dy * len * 0.32 - ny * ht * 0.85,
      tx - nx * ht,
      ty - ny * ht,
    )
    .cubicTo(
      tx + dx * cap - nx * ht,
      ty + dy * cap - ny * ht,
      tx + dx * cap + nx * ht,
      ty + dy * cap + ny * ht,
      tx + nx * ht,
      ty + ny * ht,
    )
    .cubicTo(
      tx - dx * len * 0.32 + nx * ht * 0.85,
      ty - dy * len * 0.32 + ny * ht * 0.85,
      ax + dx * len * 0.3 + nx * ha * 1.08,
      ay + dy * len * 0.3 + ny * ha * 1.08,
      ax + nx * ha,
      ay + ny * ha,
    )
    .closePath()
}

// 小龟（512 设计空间，头朝右，未旋转）：壳是「家」，要占主导
function compactTurtleDesign() {
  const shell = Path.ellipse(246, 270, 150, 104)
  const headNeck = Path.of()
    .moveTo(343, 217)
    .cubicTo(361, 208, 391, 169, 402, 159)
    .cubicTo(412, 147, 425, 147, 438, 151)
    .cubicTo(459, 158, 477, 172, 477, 196)
    .cubicTo(477, 221, 457, 241, 433, 241)
    .cubicTo(414, 247, 398, 259, 381, 275)
    .closePath()
  const flipFar = limb(176, 235, 94, 160, 62, 42)
  const flipNear = limb(155, 318, 77, 356, 66, 44)
  const flipFront = limb(337, 337, 427, 398, 62, 44)
  const tail = limb(145, 280, 68, 263, 27, 11)
  return {
    shell,
    turtle: {
      subpaths: [shell, headNeck, flipFar, flipNear, flipFront, tail].flatMap((p) => p.subpaths),
    },
  }
}

export function turtleDesign(compact = false) {
  if (compact) return compactTurtleDesign()
  const shell = Path.ellipse(236, 270, 140, 106)
  const headNeck = Path.of()
    .moveTo(327, 223)
    .cubicTo(344, 218, 360, 198, 378.5, 180.5)
    .cubicTo(386, 171, 396, 170, 404, 170)
    .cubicTo(424, 170, 440, 186, 440, 206)
    .cubicTo(440, 226, 424, 242, 404, 242)
    .cubicTo(390, 249, 381, 266, 369, 277)
    .closePath()
  const flipFar = limb(172, 236, 112, 174, 56, 40) // 远侧后鳍，抬起
  const flipNear = limb(156, 312, 92, 350, 58, 42) // 近侧后鳍
  const flipFront = limb(322, 330, 394, 378, 56, 42) // 近侧前鳍，向前迈
  const tail = limb(152, 284, 86, 262, 30, 8)
  return {
    shell,
    turtle: {
      subpaths: [shell, headNeck, flipFar, flipNear, flipFront, tail].flatMap((p) => p.subpaths),
    },
  }
}

// 壳面纹路中心线（描成圆头条带，被壳裁切、以场色镂空）
function shellLines(kind = 'full') {
  if (kind === 'none') return []
  if (kind === 'simple') {
    return [
      Path.of().moveTo(142, 239).cubicTo(200, 194, 274, 194, 337, 238).stroke(15),
      Path.of().moveTo(125, 299).cubicTo(191, 259, 291, 259, 358, 296).stroke(15),
    ]
  }
  return [
    Path.of().moveTo(148, 240).cubicTo(205, 192, 275, 192, 332, 236).stroke(13),
    Path.of().moveTo(118, 296).cubicTo(185, 258, 290, 258, 354, 292).stroke(13),
    Path.of().moveTo(240, 172).cubicTo(233, 240, 233, 302, 240, 366).stroke(13),
  ]
}

function renderField(canvas, size) {
  const designToDev = mat2d.scale(size / 512)
  const cov = rasterize(Path.roundRect(256, 256, 256, 256, 115), size, { transform: designToDev })
  blendLayer(canvas, cov, FIELD, { bbox: FIELD_BBOX, transform: designToDev })
}

function renderTurtle(
  canvas,
  size,
  { compact = false, grow = 0, shiftY = 0, color = WHITE, pattern = 'none' } = {},
) {
  const designToDev = mat2d.scale(size / 512)
  const turtleToDev = mat2d.mul(
    designToDev,
    mat2d.rotate(TURTLE_ROT, 256, 256),
    mat2d.translate(256, 256 + shiftY),
    mat2d.scale(1 + grow),
    mat2d.translate(-256, -256),
  )
  const { turtle, shell } = turtleDesign(compact)
  const cov = rasterize(turtle, size, { transform: turtleToDev })
  blendLayer(canvas, cov, solid(color), { transform: designToDev })
  if (pattern === 'none') return
  const shellCov = rasterize(shell, size, { transform: turtleToDev })
  for (const line of shellLines(pattern)) {
    const lineCov = rasterize(line, size, { transform: turtleToDev })
    blendLayer(canvas, lineCov, FIELD_CUT, { transform: designToDev, clip: shellCov })
  }
}

export function buildAppIcon(size = 1024) {
  const canvas = makeCanvas(size)
  renderField(canvas, size)
  const compact = size <= 20
  const grow = size >= 256 ? 0.06 : size >= 64 ? 0.04 : 0
  const shiftY = size >= 64 ? -15 : 0
  const pattern = size >= 256 ? 'full' : size >= 48 ? 'simple' : 'none'
  renderTurtle(canvas, size, { compact, grow, shiftY, pattern })
  return canvas
}

export function buildTraySilhouette(size) {
  const canvas = makeCanvas(size)
  renderTurtle(canvas, size, {
    compact: size <= 20,
    color: BLACK,
    grow: size <= 16 ? 0 : 0.1,
    shiftY: size <= 20 ? 16 : 0,
  })
  return canvas
}

export function buildWindowsTray(size) {
  const canvas = makeCanvas(size)
  renderField(canvas, size)
  renderTurtle(canvas, size, {
    compact: size <= 20,
    grow: size <= 20 ? 0 : 0.04,
    shiftY: size <= 20 ? 0 : -15,
  })
  return canvas
}

export function buildAppIconAssets() {
  const pngs = APP_ICON_SIZES.map((size) => ({
    size,
    png: encodePng(size, size, canvasToPixels(buildAppIcon(size))),
  }))
  return {
    pngs,
    ico: encodeIco(pngs.filter((icon) => icon.size <= 256)),
    icns: encodeIcns(pngs.filter((icon) => ICNS_APP_ICON_SIZES.has(icon.size))),
  }
}

function write(path, buffer) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buffer)
  console.log(`wrote ${path} (${buffer.length} bytes)`)
}

function main() {
  const appIcons = buildAppIconAssets()
  write(join(ROOT, 'build', 'icon.png'), appIcons.pngs.at(-1).png)
  for (const icon of appIcons.pngs) {
    write(join(ROOT, 'build', 'icons', `${icon.size}x${icon.size}.png`), icon.png)
  }
  write(join(ROOT, 'build', 'icon.ico'), appIcons.ico)
  write(join(ROOT, 'build', 'icon.icns'), appIcons.icns)
  write(
    join(ROOT, 'resources', 'trayTemplate.png'),
    encodePng(16, 16, canvasToPixels(buildTraySilhouette(16))),
  )
  write(
    join(ROOT, 'resources', 'trayTemplate@2x.png'),
    encodePng(32, 32, canvasToPixels(buildTraySilhouette(32))),
  )
  for (const size of [16, 20, 24, 32]) {
    write(
      join(ROOT, 'resources', `trayWindows${size}.png`),
      encodePng(size, size, canvasToPixels(buildWindowsTray(size))),
    )
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
