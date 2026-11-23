/*
 * The item someone is in the middle of adding: the open form on the Scanner or Photo page.
 * It is saved on this device on every change and cleared on Save or Discard, so a refresh, a
 * crash or closing the app by accident doesn't lose it. The app reopens it on the next start.
 *
 * One draft per page, so a typed entry on the Scanner can't replace a photo waiting on the
 * Photo page. The fields go in localStorage; a photo goes in IndexedDB (photos.js), because
 * localStorage only holds about 5 MB.
 */
import { deletePhotos, getPhoto, savePhoto } from './photos.js'

export const DRAFT_PAGES = ['scanner', 'photo']

const draftKey = (page) => `it-stock-draft-v1-${page}`
// Photo keys are scan ids, which never contain a hyphen, so these can't clash with a real photo.
const photoKey = (page) => `draft-${page}`

const idbPhotos = { save: savePhoto, get: getPhoto, remove: deletePhotos }

export function createDrafts({ storage = globalThis.localStorage, photos = idbPhotos, now = () => new Date().toISOString() } = {}) {
  function load(page) {
    try {
      const draft = JSON.parse(storage.getItem(draftKey(page)) ?? 'null')
      return draft?.pending?.id ? draft : null
    } catch {
      return null
    }
  }

  function write(page, draft) {
    try {
      storage.setItem(draftKey(page), JSON.stringify(draft))
    } catch {
      /* full or blocked: the form still works, it just won't survive a refresh */
    }
  }

  return {
    /** The page's draft: { pending, values, hasPhoto, savedAt }, or null. `values` is null until something is typed. */
    load,

    /**
     * Starts a draft when the form opens. `pending` is what the form opened with, without the
     * photo; pass the photo Blob as `photo`. Resolves once the photo is stored.
     */
    async start(page, pending, photo = null) {
      write(page, { pending, values: null, hasPhoto: !!photo, savedAt: now() })
      if (photo) await photos.save(photoKey(page), photo).catch(() => {})
    },

    /** Saves the form's fields. Ignored when that draft was cleared or replaced meanwhile. */
    update(page, id, values) {
      const draft = load(page)
      if (draft?.pending.id === id) write(page, { ...draft, values, savedAt: now() })
    },

    /** The draft's photo Blob, or null when there is none or it couldn't be read. */
    photo: (page) => Promise.resolve(photos.get(photoKey(page))).then((blob) => blob ?? null, () => null),

    /** Saved or discarded: forget the draft and its photo. */
    clear(page) {
      const draft = load(page)
      try {
        storage.removeItem(draftKey(page))
      } catch {
        /* ignore */
      }
      if (draft?.hasPhoto) Promise.resolve(photos.remove([photoKey(page)])).catch(() => {})
    },

    /** The page whose draft was touched last, to reopen when the app starts. Null when there are none. */
    latestPage() {
      let best = null
      for (const page of DRAFT_PAGES) {
        const draft = load(page)
        if (draft && (!best || draft.savedAt > best.savedAt)) best = { page, savedAt: draft.savedAt }
      }
      return best?.page ?? null
    },
  }
}

/** The app's drafts, on this device. */
export const drafts = createDrafts()
