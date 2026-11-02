// Anshin 光栅器：路径（M/L/C + 闭合子路径）→ 扫描线非零环绕覆盖 → 画笔（纯色 / linearGradient）合成。
// 设计空间约定 512×512，几何与画笔全部在此空间定义，rasterize/blendLayer 负责映射到目标画布。

// ---------- 仿射矩阵：x' = a x + c y + e, y' = b x + d y + f ----------
function Mat(a, b, c, d, e, f) {
  return {
    a,
    b,
    c,
    d,
    e,
    f,
    apply(x, y) {
      return [this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f]
    },
  }
}

export const mat2d = {
  identity: () => Mat(1, 0, 0, 1, 0, 0),
  translate: (tx, ty) => Mat(1, 0, 0, 1, tx, ty),
  scale: (sx, sy = sx) => Mat(sx, 0, 0, sy, 0, 0),
  rotate(deg, cx = 0, cy = 0) {
    const rad = (deg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return this.mul(
      this.translate(cx, cy),
      Mat(cos, sin, -sin, cos, 0, 0),
      this.translate(-cx, -cy),
    )
  },
  // mul(a, b, ...) 先应用最后一个参数，再依次向前（即 a∘b∘c）
  mul(...ms) {
    let m = ms[0]
    for (let i = 1; i < ms.length; i += 1) {
      const n = ms[i]
      m = Mat(
        m.a * n.a + m.c * n.b,
        m.b * n.a + m.d * n.b,
        m.a * n.c + m.c * n.d,
        m.b * n.c + m.d * n.d,
        m.a * n.e + m.c * n.f + m.e,
        m.b * n.e + m.d * n.f + m.f,
      )
    }
    return m
  },
  invert(m) {
    const r = m.a * m.d - m.b * m.c
    return Mat(
      m.d / r,
      -m.b / r,
      -m.c / r,
      m.a / r,
      (m.c * m.f - m.d * m.e) / r,
      (m.b * m.e - m.a * m.f) / r,
    )
  },
  apply(m, x, y) {
    return m.apply(x, y)
  },
}

// ---------- 颜色 ----------
export function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

// ---------- 画笔 ----------
export function solid(color) {
  return { kind: 'solid', color }
}

// stops: [offset, '#rrggbb' | [r,g,b]][]，offset 升序
// units: 'objectBoundingBox'（默认，随 bbox 映射）| 'userSpaceOnUse'（设计坐标）
export function linearGradient({ x1, y1, x2, y2, stops, units = 'objectBoundingBox' }) {
  return {
    kind: 'linear',
    x1,
    y1,
    x2,
    y2,
    units,
    stops: stops.map(([offset, color]) => {
      const rgb = typeof color === 'string' ? hexToRgb(color) : color
      return [offset, rgb[0], rgb[1], rgb[2]]
    }),
  }
}

function stopAt(stops, t) {
  if (t <= stops[0][0]) return stops[0]
  const last = stops[stops.length - 1]
  if (t >= last[0]) return last
  let i = 1
  while (stops[i][0] < t) i += 1
  const a = stops[i - 1]
  const b = stops[i]
  const local = (t - a[0]) / (b[0] - a[0])
  return [
    t,
    a[1] + (b[1] - a[1]) * local,
    a[2] + (b[2] - a[2]) * local,
    a[3] + (b[3] - a[3]) * local,
  ]
}

export function samplePaint(paint, bbox, x, y) {
  if (paint.kind === 'solid') return paint.color
  let px = x
  let py = y
  if (paint.units === 'objectBoundingBox') {
    px = (x - bbox.x) / bbox.w
    py = (y - bbox.y) / bbox.h
  }
  const dx = paint.x2 - paint.x1
  const dy = paint.y2 - paint.y1
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : ((px - paint.x1) * dx + (py - paint.y1) * dy) / lenSq
  const [, r, g, b] = stopAt(paint.stops, Math.min(1, Math.max(0, t)))
  return [r, g, b]
}

// ---------- 路径 ----------
const KAPPA = 0.5522847498307936

function pathBuilder() {
  const subpaths = []
  let current = null

  function ensure() {
    if (!current) {
      current = { cmds: [], closed: false }
      subpaths.push(current)
    }
    return current
  }

  return {
    subpaths,
    moveTo(x, y) {
      current = { cmds: [{ c: 'M', p: [x, y] }], closed: false }
      subpaths.push(current)
      return this
    },
    lineTo(x, y) {
      ensure().cmds.push({ c: 'L', p: [x, y] })
      return this
    },
    cubicTo(x1, y1, x2, y2, x, y) {
      ensure().cmds.push({ c: 'C', p: [x1, y1, x2, y2, x, y] })
      return this
    },
    closePath() {
      if (current) current.closed = true
      current = null
      return this
    },
    transform(m) {
      const out = pathBuilder()
      for (const sub of subpaths) {
        const t = out
        for (const cmd of sub.cmds) {
          if (cmd.c === 'M') t.moveTo(...mat2d.apply(m, cmd.p[0], cmd.p[1]))
          else if (cmd.c === 'L') t.lineTo(...mat2d.apply(m, cmd.p[0], cmd.p[1]))
          else {
            const [a1, b1] = mat2d.apply(m, cmd.p[0], cmd.p[1])
            const [a2, b2] = mat2d.apply(m, cmd.p[2], cmd.p[3])
            const [a3, b3] = mat2d.apply(m, cmd.p[4], cmd.p[5])
            t.cubicTo(a1, b1, a2, b2, a3, b3)
          }
        }
        if (sub.closed) t.closePath()
      }
      return out
    },
    stroke(width) {
      return strokeToPath(subpaths, width)
    },
  }
}

export const Path = {
  of: pathBuilder,
  rect(x, y, w, h) {
    return pathBuilder()
      .moveTo(x, y)
      .lineTo(x + w, y)
      .lineTo(x + w, y + h)
      .lineTo(x, y + h)
      .closePath()
  },
  // 中心 (cx,cy)、半宽 hw、半高 hh、角半径 r
  roundRect(cx, cy, hw, hh, r) {
    const k = KAPPA * r
    const l = cx - hw
    const t = cy - hh
    const rt = cx + hw
    const b = cy + hh
    return pathBuilder()
      .moveTo(l + r, t)
      .lineTo(rt - r, t)
      .cubicTo(rt - r + k, t, rt, t + r - k, rt, t + r)
      .lineTo(rt, b - r)
      .cubicTo(rt, b - r + k, rt - r + k, b, rt - r, b)
      .lineTo(l + r, b)
      .cubicTo(l + r - k, b, l, b - r + k, l, b - r)
      .lineTo(l, t + r)
      .cubicTo(l, t + r - k, l + r - k, t, l + r, t)
      .closePath()
  },
  ellipse(cx, cy, rx, ry, rotDeg = 0) {
    const kx = KAPPA * rx
    const ky = KAPPA * ry
    const base = pathBuilder()
      .moveTo(cx + rx, cy)
      .cubicTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry)
      .cubicTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy)
      .cubicTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry)
      .cubicTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy)
      .closePath()
    return rotDeg === 0 ? base : base.transform(mat2d.rotate(rotDeg, cx, cy))
  },
  circle(cx, cy, r) {
    return Path.ellipse(cx, cy, r, r)
  },
}

// ---------- 扁平化 ----------
function flatness(p0, p1, p2, p3) {
  const ux = 3 * p1[0] - 2 * p0[0] - p3[0]
  const uy = 3 * p1[1] - 2 * p0[1] - p3[1]
  const vx = 3 * p2[0] - 2 * p3[0] - p0[0]
  const vy = 3 * p2[1] - 2 * p3[1] - p0[1]
  return Math.max(ux * ux + uy * uy, vx * vx + vy * vy)
}

function flattenCubic(p0, p1, p2, p3, tolSq, out, depth = 0) {
  if (depth >= 18 || flatness(p0, p1, p2, p3) <= tolSq) {
    out.push(p3)
    return
  }
  const mid01 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
  const mid12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
  const mid23 = [(p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2]
  const mid012 = [(mid01[0] + mid12[0]) / 2, (mid01[1] + mid12[1]) / 2]
  const mid123 = [(mid12[0] + mid23[0]) / 2, (mid12[1] + mid23[1]) / 2]
  const mid = [(mid012[0] + mid123[0]) / 2, (mid012[1] + mid123[1]) / 2]
  flattenCubic(p0, mid01, mid012, mid, tolSq, out, depth + 1)
  flattenCubic(mid, mid123, mid23, p3, tolSq, out, depth + 1)
}

// 路径 → 设备空间折线数组（每个子路径一条，自动闭合）
function pathToPolylines(path, transform, tol) {
  const tolSq = tol * tol
  const polylines = []
  for (const sub of path.subpaths) {
    if (sub.cmds.length === 0) continue
    const pts = []
    let start = null
    let last = null
    for (const cmd of sub.cmds) {
      if (cmd.c === 'M') {
        start = mat2d.apply(transform, cmd.p[0], cmd.p[1])
        pts.push(start)
        last = start
      } else if (cmd.c === 'L') {
        last = mat2d.apply(transform, cmd.p[0], cmd.p[1])
        pts.push(last)
      } else {
        const p0 = last
        const p1 = mat2d.apply(transform, cmd.p[0], cmd.p[1])
        const p2 = mat2d.apply(transform, cmd.p[2], cmd.p[3])
        const p3 = mat2d.apply(transform, cmd.p[4], cmd.p[5])
        flattenCubic(p0, p1, p2, p3, tolSq, pts)
        last = p3
      }
    }
    if (pts.length >= 2) polylines.push(pts)
  }
  return polylines
}

// ---------- 描边（圆头圆角）：中心线折线 → 闭合轮廓路径 ----------
function strokeToPath(subpaths, width) {
  const half = width / 2
  const out = pathBuilder()
  const lines = pathToPolylines({ subpaths }, mat2d.identity(), 0.2)
  const CAP_SEGMENTS = 8
  for (const pts of lines) {
    const n = pts.length
    const normals = []
    for (let i = 0; i < n; i += 1) {
      const prev = pts[Math.max(0, i - 1)]
      const next = pts[Math.min(n - 1, i + 1)]
      let tx = next[0] - prev[0]
      let ty = next[1] - prev[1]
      const len = Math.hypot(tx, ty)
      if (len === 0) {
        tx = 1
        ty = 0
      } else {
        tx /= len
        ty /= len
      }
      normals.push([-ty, tx])
    }
    const left = []
    const right = []
    for (let i = 0; i < n; i += 1) {
      left.push([pts[i][0] + normals[i][0] * half, pts[i][1] + normals[i][1] * half])
      right.push([pts[i][0] - normals[i][0] * half, pts[i][1] - normals[i][1] * half])
    }
    const end = pts[n - 1]
    const start = pts[0]
    const endAngle = Math.atan2(normals[n - 1][1], normals[n - 1][0])
    const startAngle = Math.atan2(-normals[0][1], -normals[0][0])
    // 帽沿行进方向外凸：切线取最后/第一段的走向，不能拿法线充数
    const endTangent = [end[0] - pts[n - 2][0], end[1] - pts[n - 2][1]]
    const startTangent = [start[0] - pts[1][0], start[1] - pts[1][1]]
    // 帽：从左侧点经切线方向绕到右侧点，保证走对半圆
    out.moveTo(left[0][0], left[0][1])
    for (let i = 1; i < n; i += 1) out.lineTo(left[i][0], left[i][1])
    capArc(out, end, half, endAngle, endTangent, CAP_SEGMENTS)
    for (let i = n - 1; i >= 0; i -= 1) out.lineTo(right[i][0], right[i][1])
    capArc(out, start, half, startAngle, startTangent, CAP_SEGMENTS)
    out.closePath()
  }
  return out
}

function capArc(out, center, r, normalAngle, tangent, segments) {
  const tangentAngle = Math.atan2(tangent[1], tangent[0])
  let sweep = Math.PI
  if (!sweepContains(normalAngle, sweep, tangentAngle)) {
    sweep = sweep > 0 ? sweep - 2 * Math.PI : sweep + 2 * Math.PI
  }
  for (let s = 1; s <= segments; s += 1) {
    const a = normalAngle + (sweep * s) / segments
    out.lineTo(center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r)
  }
}

function normPi(a) {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

function sweepContains(from, sweep, angle) {
  const rel = normPi(angle - from)
  if (sweep >= 0) return rel >= 0 && rel <= sweep
  return rel <= 0 && rel >= sweep
}

// ---------- 扫描线光栅化（4×4 超采样 + 非零环绕） ----------
export function rasterize(path, size, { transform = mat2d.identity(), samples = 4 } = {}) {
  const polylines = pathToPolylines(path, transform, 0.15)
  const edges = []
  for (const pts of polylines) {
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (a[1] !== b[1]) edges.push([a, b])
    }
  }
  const total = size * size
  const hits = new Uint16Array(total)
  const rows = size * samples
  const cols = rows
  const crossings = []
  for (let r = 0; r < rows; r += 1) {
    const yc = (r + 0.5) / samples
    crossings.length = 0
    for (const [a, b] of edges) {
      const ymin = Math.min(a[1], b[1])
      const ymax = Math.max(a[1], b[1])
      // 半开区间 [ymin, ymax)：顶点恰好被计数一次，不重不漏
      if (yc < ymin || yc >= ymax) continue
      const x = a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
      crossings.push({ x, dir: b[1] > a[1] ? 1 : -1 })
    }
    if (crossings.length === 0) continue
    crossings.sort((p, q) => p.x - q.x)
    let winding = 0
    let k = 0
    for (let c = 0; c < cols; c += 1) {
      const xc = (c + 0.5) / samples
      while (k < crossings.length && crossings[k].x <= xc) {
        winding += crossings[k].dir
        k += 1
      }
      if (winding !== 0) hits[((r / samples) | 0) * size + ((c / samples) | 0)] += 1
    }
  }
  const perPixel = samples * samples
  const coverage = new Float64Array(total)
  for (let i = 0; i < total; i += 1) coverage[i] = hits[i] / perPixel
  return coverage
}

// ---------- 画布（straight alpha：rgb 0..255，a 0..1） ----------
export function makeCanvas(size) {
  return { size, data: new Float64Array(size * size * 4) }
}

export function blendLayer(canvas, coverage, paint, { bbox, transform, clip } = {}) {
  const size = canvas.size
  const toDesign = transform ? mat2d.invert(transform) : null
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x
      let a = coverage[i]
      if (clip) a *= clip[i]
      if (a <= 0) continue
      let color
      if (paint.kind === 'solid') {
        color = paint.color
      } else {
        const sx = x + 0.5
        const sy = y + 0.5
        const [dx, dy] = toDesign ? mat2d.apply(toDesign, sx, sy) : [sx, sy]
        color = samplePaint(paint, bbox, dx, dy)
      }
      const j = i * 4
      const srcA = Math.min(1, a)
      const dstA = canvas.data[j + 3]
      const outA = srcA + dstA * (1 - srcA)
      if (outA <= 0) continue
      canvas.data[j] = (color[0] * srcA + canvas.data[j] * dstA * (1 - srcA)) / outA
      canvas.data[j + 1] = (color[1] * srcA + canvas.data[j + 1] * dstA * (1 - srcA)) / outA
      canvas.data[j + 2] = (color[2] * srcA + canvas.data[j + 2] * dstA * (1 - srcA)) / outA
      canvas.data[j + 3] = outA
    }
  }
  return canvas
}

export function canvasToPixels(canvas) {
  const size = canvas.size
  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i += 1) {
    out[i * 4] = Math.round(canvas.data[i * 4])
    out[i * 4 + 1] = Math.round(canvas.data[i * 4 + 1])
    out[i * 4 + 2] = Math.round(canvas.data[i * 4 + 2])
    out[i * 4 + 3] = Math.round(canvas.data[i * 4 + 3] * 255)
  }
  return out
}
