import { describe, it, expect } from 'vitest'
import { eraseBoxes } from './preprocess.js'

/** A grayscale RGBA image shaped like canvas ImageData, filled with one shade. */
function blank(width, height, shade = 255) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = shade
    data[i + 3] = 255
  }
  return { data, width, height }
}

/** Paints the rectangle x0..x1, y0..y1 (inclusive). */
function fill(img, x0, y0, x1, y1, shade = 0) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * img.width + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = shade
    }
  }
}

/** Paints a rectangle outline `t` pixels thick. */
function outline(img, x0, y0, x1, y1, t, shade = 0) {
  fill(img, x0, y0, x1, y0 + t - 1, shade)
  fill(img, x0, y1 - t + 1, x1, y1, shade)
  fill(img, x0, y0, x0 + t - 1, y1, shade)
  fill(img, x1 - t + 1, y0, x1, y1, shade)
}

/** Paints `n` 6x12 blocks standing in for characters, 20px apart, from (x, y). */
function chars(img, x, y, n) {
  for (let k = 0; k < n; k++) fill(img, x + k * 20, y, x + k * 20 + 5, y + 11)
}

/** The distinct shades inside x0..x1, y0..y1, sorted. */
function shades(img, x0, y0, x1, y1) {
  const seen = new Set()
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) seen.add(img.data[(y * img.width + x) * 4])
  }
  return [...seen].sort((a, b) => a - b)
}

describe('eraseBoxes', () => {
  it('erases a box printed around a serial and keeps the characters inside', () => {
    const img = blank(140, 40)
    outline(img, 4, 4, 135, 35, 2)
    chars(img, 14, 14, 6)

    eraseBoxes(img)

    expect(shades(img, 4, 4, 135, 5)).toEqual([255])
    expect(shades(img, 4, 34, 135, 35)).toEqual([255])
    expect(shades(img, 4, 4, 5, 35)).toEqual([255])
    expect(shades(img, 134, 4, 135, 35)).toEqual([255])
    for (let k = 0; k < 6; k++) expect(shades(img, 14 + k * 20, 14, 19 + k * 20, 25)).toEqual([0])
  })

  it("also erases the box's soft grey edge, which OCR would read as | or /", () => {
    const img = blank(140, 40)
    outline(img, 3, 3, 136, 36, 1, 200)
    outline(img, 5, 5, 134, 34, 1, 200)
    outline(img, 4, 4, 135, 35, 1, 0)
    chars(img, 14, 14, 6)

    eraseBoxes(img)

    expect(shades(img, 3, 3, 136, 5)).toEqual([255])
    expect(shades(img, 3, 3, 5, 36)).toEqual([255])
    for (let k = 0; k < 6; k++) expect(shades(img, 14 + k * 20, 14, 19 + k * 20, 25)).toEqual([0])
  })

  it('keeps an open corner that only partly surrounds the characters', () => {
    const img = blank(140, 40)
    fill(img, 4, 4, 5, 35)
    fill(img, 4, 34, 135, 35)
    chars(img, 14, 14, 6)

    eraseBoxes(img)

    expect(shades(img, 4, 4, 5, 35)).toEqual([0])
    expect(shades(img, 4, 34, 135, 35)).toEqual([0])
  })

  it('keeps a large thin letter O even with specks of noise in its hole', () => {
    const img = blank(60, 60)
    outline(img, 10, 8, 49, 51, 2)
    fill(img, 22, 22, 23, 23)
    fill(img, 34, 36, 35, 37)

    eraseBoxes(img)

    expect(shades(img, 10, 8, 49, 9)).toEqual([0])
    expect(shades(img, 10, 8, 11, 51)).toEqual([0])
  })

  it('keeps a solid dark banner with light text in it', () => {
    const img = blank(140, 40)
    fill(img, 4, 4, 135, 35)
    for (let k = 0; k < 5; k++) {
      fill(img, 14 + k * 24, 12, 27 + k * 24, 27, 255)
      fill(img, 19 + k * 24, 18, 22 + k * 24, 21)
    }

    eraseBoxes(img)

    expect(shades(img, 4, 4, 135, 11)).toEqual([0])
    expect(shades(img, 4, 28, 135, 35)).toEqual([0])
  })

  it('leaves a frame with no box untouched, soft edges included', () => {
    const img = blank(140, 40)
    chars(img, 14, 14, 6)
    fill(img, 10, 30, 130, 30, 120)
    const before = Uint8ClampedArray.from(img.data)

    eraseBoxes(img)

    expect(img.data).toEqual(before)
  })
})
