// Photos are stored as JPEGs with the long side capped, about 150 to 300 KB each.
export const PHOTO_MAX_SIDE = 1600
export const PHOTO_QUALITY = 0.8

/**
 * The part of a video frame that is on screen when it is shown with object-fit: cover
 * in a box of clientW x clientH. Returns the source rectangle { sx, sy, sw, sh }.
 */
export function visibleRect(videoW, videoH, clientW, clientH) {
  const scale = Math.max(clientW / videoW, clientH / videoH)
  const sw = Math.min(videoW, clientW / scale)
  const sh = Math.min(videoH, clientH / scale)
  return { sx: (videoW - sw) / 2, sy: (videoH - sh) / 2, sw, sh }
}

/** Scales w x h down (never up) so the long side is at most `max`. Whole pixels. */
export function fitWithin(w, h, max = PHOTO_MAX_SIDE) {
  const k = Math.min(1, max / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/** Draws a rectangle of `source` (video, image or bitmap) into a new canvas and encodes it as a JPEG Blob. */
function encode(source, sx, sy, sw, sh) {
  const { width, height } = fitWithin(sw, sh)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))), 'image/jpeg', PHOTO_QUALITY)
  })
}

/** A photo of what the viewfinder shows right now (the object-fit: cover area of the video). */
export function photoFromVideo(video) {
  const { videoWidth: vw, videoHeight: vh, clientWidth: cw, clientHeight: ch } = video
  if (!vw || !vh || !cw || !ch) return Promise.reject(new Error('The camera has no picture yet'))
  const { sx, sy, sw, sh } = visibleRect(vw, vh, cw, ch)
  return encode(video, sx, sy, sw, sh)
}

/** A picked image file, resized and re-encoded. Browsers apply the EXIF rotation when drawing an <img>. */
export async function photoFromFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await encode(img, 0, 0, img.naturalWidth, img.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}
