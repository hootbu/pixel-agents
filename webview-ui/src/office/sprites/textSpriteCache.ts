import type { SpriteData } from '../types.js'
import { TILE_SIZE } from '../types.js'
import { generateTextSprite, PIXEL_FONTS } from './pixelFont.js'

export interface PixelTextConfig {
  text: string
  fontSize: string   // '3x5' | '5x7'
  pixelScale: number // 1, 2, 3
  textColor: string  // hex e.g. '#FF0000'
}

function cacheKey(config: PixelTextConfig): string {
  return `${config.text}|${config.fontSize}|${config.pixelScale}|${config.textColor}`
}

const spriteCache = new Map<string, SpriteData>()

/** Get (or generate and cache) the text sprite for the given config. */
export function getTextSprite(config: PixelTextConfig): SpriteData {
  const key = cacheKey(config)
  const cached = spriteCache.get(key)
  if (cached) return cached

  const sprite = generateTextSprite(config.text, config.fontSize, config.textColor, config.pixelScale)
  spriteCache.set(key, sprite)
  return sprite
}

/** Get the footprint in tiles for a pixel text config. */
export function getTextFootprint(config: PixelTextConfig): { w: number; h: number } {
  const font = PIXEL_FONTS[config.fontSize]
  if (!font || !config.text) return { w: 1, h: 1 }

  const upper = config.text.toUpperCase()
  const chars = upper.split('')
  const totalBaseWidth = chars.length * font.glyphWidth + (chars.length - 1) * font.charSpacing
  const totalBaseHeight = font.glyphHeight

  const pixelW = totalBaseWidth * config.pixelScale
  const pixelH = totalBaseHeight * config.pixelScale

  return {
    w: Math.max(1, Math.ceil(pixelW / TILE_SIZE)),
    h: Math.max(1, Math.ceil(pixelH / TILE_SIZE)),
  }
}

/** Clear the entire text sprite cache. */
export function clearTextSpriteCache(): void {
  spriteCache.clear()
}
