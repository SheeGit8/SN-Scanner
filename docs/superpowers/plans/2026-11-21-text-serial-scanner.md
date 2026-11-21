# Text (OCR) Serial Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace barcode scanning with camera text recognition that finds the value after `S/N`/`SN`/`Sn:` and records Name, Model, Color for the item.

**Architecture:** Pure text parsers in `src/ocr.js` (unit-tested with Vitest) plus a lazily created Tesseract.js worker. `Scanner.jsx` crops the on-screen frame from the live video into a canvas, OCRs it about once a second (or on Capture), and opens the confirm sheet on a match. The storage/CSV/History layers switch from `type` to `name/model/color`.

**Tech Stack:** React 19, Vite 8, tesseract.js 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-11-21-text-serial-scanner-design.md`

**Note:** The project is not a git repository, so there are no commit steps. Each task ends with its verification instead.

## Global Constraints

- No barcode/QR reading. Remove all `BarcodeDetector` use.
- Prefixes: `S/N`, `SN`, `Sn`, `S.N.`, `S N`, `Serial No`, `Serial Number`, any case. Separator: `:` `#` `-` `.` or whitespace (including a newline). Value: letters/digits/dashes, at least 3 chars, returned uppercase.
- Confirm form fields, in order: Serial (editable), Name, Model, Color, Location (optional), Note (optional).
- Manual typing of a serial must keep working when the camera or OCR is unavailable.
- Existing saved scans that have `type` but no `name` still display, with `type` used as the name.

## Review Focus

1. Other text on the same line (`S/N: 12222 Model: X`): the value stops at whitespace, giving `12222`. Tested in Task 1.
2. Common OCR misreads of the prefix (`5/N`, `S|N`, `SIN:`): these still match. A word that merely contains the letters, like `VERSION 2`, does not. Tested in Task 1.
3. A value on the next line (`S/N:\n12222`) matches. Trailing punctuation (`12222.`) is stripped. Tested in Task 1.
4. OCR engine fails to load (offline on first use): the status shows an error and manual typing still works. Manual check in Task 3.
5. Old localStorage records with only `type`: they render in History and CSV without blanks. Tested in Task 2.

---

### Task 1: Serial and field parsers

**Files:**
- Create: `src/ocr.js`, `src/ocr.test.js`
- Modify: `package.json` (add `"test": "vitest run"`, devDependency `vitest`, dependency `tesseract.js`)

**Interfaces:**
- Produces: `extractSerial(text: string) => string | null` and `extractField(text: string, labels: string[]) => string | null`. The field value runs to the end of the line, is trimmed, and stops before the next `Label:` on the same line.

- [ ] **Step 1:** `npm i tesseract.js && npm i -D vitest`, then add the `test` script.
- [ ] **Step 2: Write failing tests** in `src/ocr.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { extractSerial, extractField } from './ocr.js'

describe('extractSerial', () => {
  it.each([
    ['Sn: 12222', '12222'],
    ['S/N: 5CG1234XYZ', '5CG1234XYZ'],
    ['SN#ABC-123', 'ABC-123'],
    ['S.N. 998877', '998877'],
    ['Serial No: pf2abc12', 'PF2ABC12'],
    ['Serial Number - XJ-44-01', 'XJ-44-01'],
    ['S/N: 12222 Model: X', '12222'],
    ['5/N: 777888', '777888'],
    ['S|N 445566', '445566'],
    ['SIN: 123456', '123456'],
    ['S/N:\n12222', '12222'],
    ['S/N: 12222.', '12222'],
    ['Dell Inc\nModel: P99G\nS/N: 7HX2Q83', '7HX2Q83'],
  ])('%j -> %s', (text, expected) => expect(extractSerial(text)).toBe(expected))

  it.each([['VERSION 2'], ['S/N: A1'], ['no serial here'], ['']])('%j -> null', (text) =>
    expect(extractSerial(text)).toBeNull())
})

describe('extractField', () => {
  it('reads model', () => expect(extractField('Model: Latitude 5420\nS/N: 1', ['model'])).toBe('Latitude 5420'))
  it('stops at next label', () => expect(extractField('Model: P99G Color: Black', ['model'])).toBe('P99G'))
  it('accepts alternates', () => expect(extractField('Colour: Silver', ['color', 'colour'])).toBe('Silver'))
  it('missing -> null', () => expect(extractField('S/N: 12222', ['model'])).toBeNull())
})
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement both functions in `src/ocr.js`. Approach for the serial:
  - Use one case-insensitive regex. The prefix is either `serial\s*(no\.?|number|#)?` or `[s5]\s*[\/|\\.il1]?\s*\.?\s*n\.?`.
  - The prefix must not follow a letter or digit (`(?<![a-z0-9])`). The `I`/`l`/`1` alternates must sit between S and N, so `SIN` matches but `VERSION` does not.
  - Then the separator `[\s:#\-.]*`, then capture `[A-Z0-9][A-Z0-9-]{2,}`.
  - Strip trailing `-`/`.` and uppercase the result.
- [ ] **Step 5:** Run `npm test`. Expected: all pass.

### Task 2: Data model, History, CSV

**Files:**
- Modify: `src/storage.js`, `src/components/ScanRow.jsx`, `src/components/History.jsx`
- Test: `src/storage.test.js`

**Interfaces:**
- Produces:
  - The scan record is `{ id, serial, name, model, color, location, note, source: 'camera'|'manual', scannedAt }`.
  - `itemName(scan) => string` returns `scan.name || scan.type || ''`.
  - `csvRow(scan) => string[]` with header `['Serial number','Name','Model','Color','Location','Note','Method','Scanned at']`.
  - `loadPrefs()` defaults change to `{ name: '', location: '' }`.
  - Remove `ITEM_TYPES` and the `format` column.

- [ ] **Step 1: Write failing tests:**
  - `itemName({type:'Laptop'})` returns `'Laptop'`.
  - `itemName({name:'Dell', type:'Laptop'})` returns `'Dell'`.
  - `csvRow({serial:'1', name:'Dell', model:'5420', color:'Black', location:'B', note:'', source:'camera', scannedAt:'2026-11-21T10:00:00Z'})`: indices 0–6 equal `['1','Dell','5420','Black','B','','Camera']`.
  - `csvRow({serial:'2', type:'Monitor', source:'manual', scannedAt:...})`: `[1]` is `'Monitor'`, `[2]` is `''`, `[6]` is `'Typed'`.
- [ ] **Step 2:** Run `npm test`. Expected: the new tests fail.
- [ ] **Step 3:** Implement the changes:
  - Add `itemName` and `csvRow`. `downloadCsv` uses `csvRow`.
  - `ScanRow` shows `itemName(scan)` in the existing `type-tag` span, then model and color (skip the empty ones), then location.
  - `History`: drop the type `<select>` filter. Search covers serial, name, model, color, location and note. Placeholder: `"Search serial, name, model or location"`. Empty-state copy: `"Try a shorter search."`.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: pass with 0 errors.

### Task 3: Camera OCR scanner and confirm sheet

**Files:**
- Modify: `src/ocr.js` (worker helpers), `src/components/Scanner.jsx`

**Interfaces:**
- Consumes: `extractSerial`, `extractField` (Task 1), `itemName`, prefs, `makeId` (Task 2).
- Produces:
  - `getWorker() => Promise<Worker>` is a singleton `createWorker('eng')`. Check the signature against `node_modules/tesseract.js/README.md`.
  - `recognize(canvas) => Promise<string>`.
  - `pending` becomes `{ serial, model, color, source }`.

- [ ] **Step 1: Camera and OCR loop.**
  - Use `getUserMedia` (environment camera). Statuses: `starting`, `loading` ("Loading text reader…"), `live` ("Point the frame at the S/N on the label"), `reading`, `paused`, `denied`, `error`, `ocr-error` ("The text reader couldn't load. Check your connection, or type the serial number below.").
  - A loop on `setTimeout`, 900 ms after each read finishes:
    - Crop the centre of the video to match the `.frame` overlay (roughly 80% wide × 35% tall) into a canvas.
    - Upscale it so it is at least 1000px wide, apply grayscale and contrast.
    - Run `recognize`, then `extractSerial`.
  - On a match: set `pausedRef`, vibrate, and set `pending` with `model`/`color` from `extractField(text, ['model'])` and `extractField(text, ['color','colour'])`.
  - Keep the 3 s repeat suppression.
  - Clean up on unmount: stop tracks and clear the timer. Do not terminate the singleton worker.
- [ ] **Step 2:**
  - A **Capture** button under the viewfinder (`btn btn-dark`) runs one read immediately. If nothing is found, show a toast: `"No S/N found — move closer or type it below"`.
  - Manual form unchanged.
- [ ] **Step 3: `ConfirmSheet`.**
  - Serial becomes an editable mono `input` (uppercased).
  - Then Name (prefilled from `prefs.name`), Model and Color (prefilled from `pending`), Location (from prefs), and Note.
  - Save is disabled while the serial is empty.
  - `handleSave` stores the Task 2 record and saves prefs `{ name, location }`.
  - Remove the item-type chips and the format badge.
- [ ] **Step 4:** Run `npm run lint && npm test`. Expected: pass.
- [ ] **Step 5: Manual check** with `npm run dev` in Chrome on `localhost`:
  - Hold up a screen or paper showing `Sn: 12222`. The sheet opens with `12222`.
  - With the network blocked before first load, the status shows the `ocr-error` copy and typing still works.

### Task 4: Restore missing component styles

**Files:**
- Create: `src/App.css`

The file is imported by `App.jsx` but missing, so the build fails and every component is unstyled.

- [ ] **Step 1:** Style every class the components use, using the tokens in `index.css` (paper, tape yellow, mono serials):
  - `screen`, `topbar`, `topbar-title`, `icon-btn`, `icon-btn-quiet`, `text-btn`, `pill`
  - home: `home-header`, `wordmark`, `home-summary`, `action*`, `recent`, `section-heading`
  - list: `scan-list`, `scan-row*`, `serial`, `type-tag`
  - scanner: `viewfinder` (with `is-live`, `is-blocked`), `frame` (four corner spans), `scanline` animation, `viewfinder-status`, `manual`, `manual-row`
  - inputs: `input`, `mono`, `select`, `field`, `field-label`, `optional`
  - buttons: `btn` with `-dark`, `-tape`, `-ghost`, `-danger`, `-sm`
  - sheet: `sheet-backdrop`, `sheet`, `sheet-actions`, `tag`, `tag-label`, `notice`
  - feedback: `toast`
  - history: `filters`, `result-count`, `empty*`, `day-group`, `day-heading`, `day-count`, `row-confirm`

  Mobile-first. The sheet is bottom-anchored and the viewfinder has a 3:4 aspect ratio.
- [ ] **Step 2:** Run `npm run build`. Expected: success.
- [ ] **Step 3:** Screenshot Home, Scanner and History in the dev server at 390px width and check nothing looks unstyled or overlaps.
