# Text (OCR) serial scanner — design

Status: approved 2026-11-21

## Intent
Staff point the phone camera at a device label. The app reads the printed text,
finds the serial number after an `S/N`-style prefix (e.g. `Sn: 12222` → `12222`),
and opens a form to record the item's Name, Model and Color. Barcodes/QR codes are
**not** used.

## Goals
- Live camera OCR, auto-detecting a serial roughly once per second, plus a manual
  "Capture" button.
- Prefix matching: `S/N`, `SN`, `Sn`, `S.N.`, `S N`, `Serial No`, `Serial Number`,
  separated by `:`, `#`, `-`, `.` or whitespace; value = letters/digits/dashes (3+ chars).
- Confirm form: editable Serial, Name, Model, Color, plus optional Location and Note.
- Auto-fill Model/Color when the label text contains `Model:` / `Color:`/`Colour:`.
- Manual typing of a serial still works.
- History and CSV export show Name, Model, Color.

## Non-goals
- Barcode/QR reading (removed).
- Looking up item details from a remote database / Google Sheet.

## Approaches
- **Tesseract.js in the browser (chosen):** works in every modern browser incl. iOS
  Safari, no server or API key. Costs a one-time few-MB download and ~0.5–1.5s per read.
- Cloud OCR (Google Vision via Apps Script): more accurate but needs an API key and
  billing, and a network round-trip per frame. Rejected.
- Browser `TextDetector` (Shape Detection API): only behind a Chrome flag. Rejected.

## Design
- `src/ocr.js`: pure `extractSerial(text)` and `extractField(text, names)` parsers
  (unit-tested), plus a lazily-created Tesseract worker.
- `Scanner.jsx`: camera stream; crops the on-screen frame region of the video to a
  canvas, grayscale + contrast boost, OCR it; on a match, pause and show the sheet.
- `ConfirmSheet`: fields Serial / Name / Model / Color / Location / Note. Name, Location
  remembered as last-used prefs. "Item type" chips replaced by Name.
- Scan record: `{ id, serial, name, model, color, location, note, source, scannedAt }`.
  Older records with `type` still display (type used as fallback name).
- Fix: missing `src/App.css` import breaks the build.

## Builder's calls
- OCR cadence, crop size, and preprocessing details.
- Exact styling of new fields, reusing existing CSS classes.
