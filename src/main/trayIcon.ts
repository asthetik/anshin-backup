/**
 * Windows 任务栏托盘图标的物理像素尺寸，和 scripts/gen-icons.mjs 生成的资源一一对应。
 * 任务栏小图标在 100% 缩放下是 16px，125/150/200% 分别是 20/24/32px。
 */
export const TRAY_ICON_SIZES = [16, 20, 24, 32] as const

export type TrayIconSize = (typeof TRAY_ICON_SIZES)[number]

/**
 * 任务栏按显示缩放放大托盘图标，挑一份够大的资源交给 Electron，
 * 免得它把小图拉伸，高分屏上看着发虚。宁可大一点也不发糊。
 */
export function pickTrayIconSize(scaleFactor: number): TrayIconSize {
  const target = Math.round(16 * scaleFactor)
  return TRAY_ICON_SIZES.find((size) => size >= target) ?? 32
}
