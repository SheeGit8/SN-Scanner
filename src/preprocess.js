// Image clean-up applied to camera frames before OCR.

const MAX_FILL = 0.2 // an outline covers under a fifth of its bounding box
const MIN_INSIDE = 3 // and surrounds at least this many marks (a serial has 3+ characters)
const MIN_MARK = 4 // marks smaller than this many pixels are specks, not characters
const HALO = 2 // pixels of soft edge erased around an outline

/**
 * Erases boxes printed around text, such as the frame around the serial on a device label.
 * Tesseract drops text that sits inside a closed outline, so a sharp frame of a boxed serial
 * reads as "S/N NO.:" with nothing after it. A box is a thin outline of ink that fully
 * surrounds at least three marks. It is painted white together with its soft edge, sparing
 * the pixels of everything else. Works in place on a grayscale RGBA image (R = G = B), such
 * as canvas ImageData.
 */
export function eraseBoxes(img) {
  const { data, width, height } = img
  const n = width * height
  const { labels, regions } = labelInk(data, width, height, otsuThreshold(data, n))

  const erase = new Uint8Array(regions.length)
  let found = false
  for (let id = 1; id < regions.length; id++) {
    if (isBox(labels, width, regions, id)) {
      erase[id] = 1
      found = true
    }
  }
  if (!found) return

  for (let p = 0; p < n; p++) {
    if (!erase[labels[p]]) continue
    const x = p % width
    const y = (p - x) / width
    for (let yy = Math.max(0, y - HALO); yy <= Math.min(height - 1, y + HALO); yy++) {
      for (let xx = Math.max(0, x - HALO); xx <= Math.min(width - 1, x + HALO); xx++) {
        const q = yy * width + xx
        if (labels[q] === 0 || erase[labels[q]]) data[q * 4] = data[q * 4 + 1] = data[q * 4 + 2] = 255
      }
    }
  }
}

/** Otsu's threshold on the red channel: shades at or below it are ink, above it paper. */
function otsuThreshold(data, n) {
  const hist = new Uint32Array(256)
  for (let p = 0; p < n; p++) hist[data[p * 4]]++
  let total = 0
  for (let t = 0; t < 256; t++) total += t * hist[t]

  let threshold = 127
  let best = -1
  let inkCount = 0
  let inkSum = 0
  for (let t = 0; t < 256; t++) {
    inkCount += hist[t]
    if (!inkCount) continue
    const paperCount = n - inkCount
    if (!paperCount) break
    inkSum += t * hist[t]
    const gap = inkSum / inkCount - (total - inkSum) / paperCount
    const between = inkCount * paperCount * gap * gap
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

/**
 * Splits the ink into 8-connected regions. Returns a label per pixel (0 = paper) and, per
 * label from 1, the region's bounding box and pixel count.
 */
function labelInk(data, width, height, threshold) {
  const n = width * height
  const labels = new Int32Array(n)
  const stack = new Int32Array(n)
  const regions = [null]
  for (let start = 0; start < n; start++) {
    if (labels[start] || data[start * 4] > threshold) continue
    const id = regions.length
    const r = { minX: width, minY: height, maxX: -1, maxY: -1, area: 0 }
    let top = 0
    stack[top++] = start
    labels[start] = id
    while (top) {
      const p = stack[--top]
      const x = p % width
      const y = (p - x) / width
      r.area++
      if (x < r.minX) r.minX = x
      if (x > r.maxX) r.maxX = x
      if (y < r.minY) r.minY = y
      if (y > r.maxY) r.maxY = y
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const q = yy * width + xx
          if (!labels[q] && data[q * 4] <= threshold) {
            labels[q] = id
            stack[top++] = q
          }
        }
      }
    }
    regions.push(r)
  }
  return { labels, regions }
}

/** A box is a thin outline that fully surrounds at least MIN_INSIDE marks. */
function isBox(labels, width, regions, id) {
  const box = regions[id]
  const w = box.maxX - box.minX + 1
  const h = box.maxY - box.minY + 1
  if (w < 8 || h < 8 || box.area >= MAX_FILL * w * h) return false // too small or too solid

  let inside = 0
  for (let j = 1; j < regions.length; j++) {
    const mark = regions[j]
    if (j === id || mark.area < MIN_MARK) continue
    if (mark.minX <= box.minX || mark.maxX >= box.maxX || mark.minY <= box.minY || mark.maxY >= box.maxY) continue
    if (surrounds(labels, width, id, box, mark) && ++inside >= MIN_INSIDE) return true
  }
  return false
}

/**
 * True if region `id` lies on all four sides of `mark`: straight paths from the mark's
 * centre to the edges of the box's bounds each cross the region. An open corner or bracket
 * whose bounds merely overlap the mark fails this.
 */
function surrounds(labels, width, id, box, mark) {
  const cx = (mark.minX + mark.maxX) >> 1
  const cy = (mark.minY + mark.maxY) >> 1
  const row = cy * width
  return (
    crosses(labels, id, row + mark.minX - 1, -1, mark.minX - box.minX) &&
    crosses(labels, id, row + mark.maxX + 1, 1, box.maxX - mark.maxX) &&
    crosses(labels, id, (mark.minY - 1) * width + cx, -width, mark.minY - box.minY) &&
    crosses(labels, id, (mark.maxY + 1) * width + cx, width, box.maxY - mark.maxY)
  )
}

/** True if any of `count` pixels, from index `from` stepping by `step`, has label `id`. */
function crosses(labels, id, from, step, count) {
  for (let k = 0, p = from; k < count; k++, p += step) {
    if (labels[p] === id) return true
  }
  return false
}
