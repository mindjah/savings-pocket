// One-off script: writes plain PNG app icons (solid bg + circle glyph) with zero deps.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { crc32 } from 'node:zlib'

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput) >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makePng(size, { bg, fg, maskable = false }) {
  const width = size
  const height = size
  const raw = Buffer.alloc((width * 4 + 1) * height)
  const cx = width / 2
  const cy = height / 2
  // maskable icons need content inside the ~80% safe zone; plain icons can fill more
  const r = size * (maskable ? 0.32 : 0.36)
  const coinR = size * (maskable ? 0.20 : 0.24)
  let offset = 0
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      let color = bg
      if (dist <= coinR) color = fg
      else if (dist <= coinR + size * 0.015 && dist > coinR) color = bg
      raw[offset++] = color[0]
      raw[offset++] = color[1]
      raw[offset++] = color[2]
      raw[offset++] = 255
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const idat = deflateSync(raw)
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [21, 128, 61] // green-700
const FG = [255, 255, 255]

const outputs = [
  ['public/pwa-192.png', 192, false],
  ['public/pwa-512.png', 512, false],
  ['public/pwa-maskable-512.png', 512, true],
  ['public/apple-touch-icon.png', 180, false],
]

for (const [path, size, maskable] of outputs) {
  writeFileSync(path, makePng(size, { bg: BG, fg: FG, maskable }))
  console.log('wrote', path)
}
