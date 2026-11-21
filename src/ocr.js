// Text recognition helpers: pure parsers for label text, plus a shared Tesseract worker.

// Prefix: "Serial No/Number/#" or a short S/N form, optionally followed by "No." ("S/N NO.:").
// The short form tolerates common OCR misreads: 5 for S, | \ I l 1 for the slash, 0 for
// the O in "No". Its parts may only be split by a space or tab, never a line break. It must
// not follow a letter or digit, so words like "VERSION" never match.
// Between prefix and value, | and [ are allowed: a box printed around the serial reads as them.
// ; is allowed as a misread colon.
// The value may sit on the next line, but a value that is itself a label ("Model:") is skipped.
// Labels are words; a code with digits followed by a stray ":" is still a serial.
const SERIAL_RE = new RegExp(
  String.raw`(?<![a-z0-9])(?:serial[ \t]*(?:no\.?|number|num\.?|#)|serial(?=[ \t]*:)|[s5][ \t]?[/|\\\.il1]?[ \t]?\.?[ \t]?n\.?(?:[ \t]*n[o0]\.?)?)` +
    String.raw`[\s:;#\-.|[]+` +
    String.raw`(?![a-z-]+[ \t]*:)([a-z0-9][a-z0-9-]{2,})(?![a-z0-9-])`,
  'i',
)

/** Finds the serial number after an S/N-style prefix. Returns it uppercased, or null. */
export function extractSerial(text) {
  const match = SERIAL_RE.exec(text ?? '')
  if (!match) return null
  const value = match[1].replace(/-+$/, '').toUpperCase()
  return value.length >= 3 ? value : null
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Reads the value after "Label:" up to the end of the line or the next "Other:" label. */
export function extractField(text, labels) {
  const re = new RegExp(String.raw`(?<![a-z])(?:${labels.map(escapeRe).join('|')})[ \t]*[:#-][ \t]*([^\n]+)`, 'i')
  const match = re.exec(text ?? '')
  if (!match) return null
  const value = match[1].split(/\s+(?:[a-z][a-z/.]*\s*:|[s5][/.]?n\.?(?=[\s:#]))/i)[0].trim()
  return value || null
}

/**
 * Stops the same label from re-opening the sheet while it stays in view. After hold(serial),
 * accept() rejects that serial until it has been missing from `clearAfter` frames in a row.
 */
export function createRepeatGate(clearAfter = 2) {
  let held = null
  let misses = 0
  return {
    hold(serial) {
      held = serial
      misses = 0
    },
    accept(serial) {
      if (!serial) {
        if (held && ++misses >= clearAfter) held = null
        return false
      }
      if (serial === held) {
        misses = 0
        return false
      }
      return true
    },
  }
}

let workerPromise = null

/** Lazily creates one shared English OCR worker. A failed load can be retried. */
export function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('eng'))
      .catch((err) => {
        workerPromise = null
        throw err
      })
  }
  return workerPromise
}

/** Runs OCR on a canvas (or any image source Tesseract accepts) and returns the raw text. */
export async function recognize(image) {
  const worker = await getWorker()
  const { data } = await worker.recognize(image)
  return data.text ?? ''
}
