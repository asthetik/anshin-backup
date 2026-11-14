import type { Canvas, PathBuilder } from './rasterizer.mjs'

export function buildAppIcon(size?: number): Canvas
export function buildAppIconAssets(): {
  pngs: Array<{ size: number; png: Buffer }>
  ico: Buffer
  icns: Buffer
}
export function buildTraySilhouette(size: number): Canvas
export function buildWindowsTray(size: number): Canvas
export function turtleDesign(compact?: boolean): {
  shell: PathBuilder
  turtle: { subpaths: PathBuilder['subpaths'] }
}
