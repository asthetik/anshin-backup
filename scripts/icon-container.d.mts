export interface IconPng {
  size: number
  png: Buffer
}

export function encodeIco(entries: IconPng[]): Buffer
export function encodeIcns(entries: IconPng[]): Buffer
