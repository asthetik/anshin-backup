export interface Mat {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
  apply(x: number, y: number): [number, number]
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export type Rgb = [number, number, number]

export interface Paint {
  readonly kind: 'solid' | 'linear'
}

export interface PathBuilder {
  readonly subpaths: readonly unknown[]
  moveTo(x: number, y: number): PathBuilder
  lineTo(x: number, y: number): PathBuilder
  cubicTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): PathBuilder
  closePath(): PathBuilder
  transform(matrix: Mat): PathBuilder
  stroke(width: number): PathBuilder
}

export interface PathFactory {
  of(): PathBuilder
  rect(x: number, y: number, w: number, h: number): PathBuilder
  roundRect(cx: number, cy: number, hw: number, hh: number, r: number): PathBuilder
  ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg?: number): PathBuilder
  circle(cx: number, cy: number, r: number): PathBuilder
}

export const Path: PathFactory

export function hexToRgb(hex: string): Rgb
export function solid(color: Rgb): Paint

export interface LinearGradientOptions {
  x1: number
  y1: number
  x2: number
  y2: number
  stops: Array<[number, string | Rgb]>
  units?: 'objectBoundingBox' | 'userSpaceOnUse'
}

export function linearGradient(options: LinearGradientOptions): Paint
export function samplePaint(paint: Paint, bbox: BBox, x: number, y: number): Rgb

export interface Mat2D {
  identity(): Mat
  translate(tx: number, ty: number): Mat
  scale(sx: number, sy?: number): Mat
  rotate(deg: number, cx?: number, cy?: number): Mat
  mul(...ms: Mat[]): Mat
  invert(m: Mat): Mat
  apply(m: Mat, x: number, y: number): [number, number]
}

export const mat2d: Mat2D

export interface RasterizeOptions {
  transform?: Mat
  samples?: number
}

export function rasterize(path: PathBuilder, size: number, options?: RasterizeOptions): Float64Array

export interface Canvas {
  size: number
  data: Float64Array
}

export function makeCanvas(size: number): Canvas

export interface BlendOptions {
  bbox?: BBox
  transform?: Mat
  clip?: Float64Array
}

export function blendLayer(
  canvas: Canvas,
  coverage: Float64Array,
  paint: Paint,
  options?: BlendOptions,
): Canvas

export function canvasToPixels(canvas: Canvas): Buffer
