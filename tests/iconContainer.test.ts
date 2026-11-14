import { describe, expect, test } from 'vitest'
import { encodeIcns, encodeIco } from '../scripts/icon-container.mjs'

describe('encodeIco', () => {
  test('writes a Windows icon directory with PNG payloads at their offsets', () => {
    const small = Buffer.from([1, 2, 3, 4])
    const large = Buffer.from([5, 6, 7])
    const ico = encodeIco([
      { size: 16, png: small },
      { size: 32, png: large },
    ])

    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(2)
    expect(ico[6]).toBe(16)
    expect(ico[7]).toBe(16)
    expect(ico[22]).toBe(32)
    expect(ico[23]).toBe(32)
    expect(ico.readUInt16LE(6 + 4)).toBe(1)
    expect(ico.readUInt16LE(6 + 6)).toBe(32)
    expect(ico.readUInt32LE(6 + 8)).toBe(small.length)
    expect(ico.readUInt32LE(6 + 16 + 8)).toBe(large.length)
    expect(ico.readUInt32LE(6 + 12)).toBe(6 + 32)
    expect(ico.readUInt32LE(6 + 16 + 12)).toBe(6 + 32 + small.length)
    expect(ico.subarray(6 + 32, 6 + 32 + small.length)).toEqual(small)
    expect(ico.subarray(6 + 32 + small.length)).toEqual(large)
  })

  test('uses zero for the 256px dimension and sorts by size', () => {
    const ico = encodeIco([
      { size: 256, png: Buffer.from([9]) },
      { size: 20, png: Buffer.from([8]) },
    ])
    expect(ico[6]).toBe(20)
    expect(ico[22]).toBe(0)
    expect(ico[23]).toBe(0)
  })
})

describe('encodeIcns', () => {
  test('writes a macOS icon container with one PNG chunk per resolution', () => {
    const png16 = Buffer.from([1, 2, 3])
    const png32 = Buffer.from([4, 5, 6, 7])
    const icns = encodeIcns([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
    ])

    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns')
    expect(icns.readUInt32BE(4)).toBe(icns.length)
    expect(icns.subarray(8, 12).toString('ascii')).toBe('icp4')
    expect(icns.readUInt32BE(12)).toBe(8 + png16.length)
    expect(icns.subarray(16, 16 + png16.length)).toEqual(png16)
    const second = 16 + png16.length
    expect(icns.subarray(second, second + 4).toString('ascii')).toBe('icp5')
    expect(icns.readUInt32BE(second + 4)).toBe(8 + png32.length)
    expect(icns.subarray(second + 8)).toEqual(png32)
  })
})
