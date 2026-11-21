# Scan photos — design

Status: proposed 2026-11-21, not built yet. Size: small change (one new module, edits to three components).

## Intent
Keep a photo of the label with every camera scan, so a misread serial can be checked against
the photo later. A photo is taken automatically when a scan succeeds, or when the user presses
a "Take photo" button.

## Current state
- Scans live only in the browser: `localStorage` key `it-stock-scans-v1`, rewritten whole by
  `App.jsx` on every change. Record: `{ id, serial, name, model, color, location, note,
  source: 'camera' | 'manual', scannedAt }`.
- `Scanner.jsx`: `readOnce()` → `grabFrame()` (grey crop under the on-screen frame, then
  `eraseBoxes`) → `recognize()` → `extractSerial()` → `setPending(...)` opens `ConfirmSheet`.
  The live loop runs every 900 ms. The "Capture" button runs `readOnce({ ignoreRepeat: true })`
  and shows a toast when no serial is found.
- Scans are deleted through `App.deleteScans(ids)` (History, ItemDrawer, Spreadsheet).
- No server: `app-script/code.gs` is empty.

## Goals
- Auto-scan success keeps the photo of the exact frame the serial was read from.
- "Capture" becomes "Take photo": it always takes a photo and opens the form, with the serial
  filled in if it was read, or empty for the user to type.
- The photo shows small at the top of the confirm form (tap to enlarge) and in item details.
- Photos are stored on the phone and deleted together with their scan.

## Non-goals
- Getting photos off the phone (Google Drive or Sheet upload, shared folder).
- Photos in the CSV export.
- Photos for typed entries; retaking or replacing a photo from item details.
- Photo thumbnails in History or Spreadsheet rows.

## Anti-goals
- Slower live scanning: no JPEG encoding per frame, only when a photo is kept.
- Losing a scan because its photo failed to store: save the scan anyway and say so.
- Breaking existing scans: records without photos look and work as before.

## Constraints
- Browser only. Must work in Android Chrome (including Custom Tabs) and iOS Safari.
- `localStorage` holds about 5 MB in total, so images never go there.
- Browser storage belongs to one web address (the devtunnel URL) and can be cleared or
  evicted. This already applies to scans.

## Approaches
| | Approach | Verdict |
|---|---|---|
| A | IndexedDB on the phone, one Blob per scan id | **Chosen.** Room for thousands of ~200 KB photos, linked to the scan, no setup. |
| B | Data URLs inside the scan list in `localStorage` | Rejected. About 20 photos fill the ~5 MB quota, then saving fails. |
| C | Auto-download each photo to the phone | Rejected. A download popup on every scan, and the file isn't linked to its scan. |
| D | Upload to Google Drive via Apps Script | Deferred. Needs a script and setup. Can be added later on top of A. |

## Design
**The photo:** the visible viewfinder area (what the user sees, the `object-fit: cover`
region), in colour, long side at most 1600 px, JPEG quality 0.8 (about 150–300 KB).

**Capturing it** (`Scanner.jsx`)
- Move the cover math out of `grabFrame` into a pure `visibleRect(videoW, videoH, clientW,
  clientH)`, used by both the OCR crop and the photo.
- Every frame read for OCR also draws the visible area into a second canvas (a cheap
  `drawImage`), so the photo matches the frame that was read.
- On a match (auto) or on "Take photo": `canvas.toBlob(..., 'image/jpeg', 0.8)`, awaited
  before the sheet opens. The Blob goes on `pending.photo`.
- "Take photo": status "Reading text…", grab and OCR once, then open the sheet whether or not
  a serial was found (`serial: ''` if not; model and colour from the text when present). If OCR
  throws, still open the sheet with the photo.

**Confirm form** (`ConfirmSheet`)
- Photo thumbnail above the serial tag. Tapping it opens a full-screen view; tap or Escape
  closes it. Revoke the object URL on unmount.
- When Take photo found no serial, the tag label reads "Type the serial number from the photo".
  Saving still requires a serial.
- Save: `savePhoto(id, blob)`, then `onSave({ ..., hasPhoto: true })`, using the same `id` for
  the scan and the photo. If `savePhoto` rejects, save the scan without `hasPhoto` and toast
  "Saved {serial} (photo not stored)".

**Storage** (new `src/photos.js`)
- IndexedDB database `it-stock-photos`, version 1, object store `photos`, key = scan id,
  value = JPEG Blob.
- `savePhoto(id, blob)`, `getPhoto(id)` → Blob or undefined, `deletePhotos(ids)`.
- Scan records only gain `hasPhoto: true`. The Blob never touches `localStorage`.
- After the first photo is saved, call `navigator.storage?.persist?.()` to lower the risk of
  the browser evicting photos.

**Item details** (`ItemDrawer.jsx`): if `scan.hasPhoto`, load it with `getPhoto` and show it
(tap to enlarge). If it's missing, show "Photo not available on this device".

**Deleting** (`App.jsx`): `deleteScans(ids)` also calls `deletePhotos(ids)`, ignoring errors.

## Testing
- Unit: `visibleRect`; `photos.js` against `fake-indexeddb` (dev-only dependency): save, get,
  delete, and deleting missing ids does nothing.
- All existing tests stay green.
- On the phone: auto-scan shows the photo in the form and in item details. Take photo on an
  unreadable label opens the form with the photo and an empty serial. Deleting a scan removes
  its photo. Old scans are unchanged. Scanning feels as fast as before.

## Left to the builder
- Styling: reuse the `App.css` sheet classes in the scanner, Tailwind in `ItemDrawer`.
- Whether the thumbnail and full-screen view become a shared `PhotoView` component.
- The exact size cap and JPEG quality, within the ranges above.
