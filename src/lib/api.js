/**
 * How the app reaches the Google Sheet (app-script/code.gs).
 *
 * Production builds set VITE_REMOTE_API=/api/gas (.env.production): the Vercel function adds the
 * sync token on the server, and the browser only sends the app password people type in once.
 * Without it (npm run dev) the app keeps its list in this browser only, as it always has.
 */
const remote = import.meta.env.VITE_REMOTE_API || ''

/** True when the stock list is the shared Google Sheet. */
export const isRemote = !!remote

/** For delete confirmations: what a delete takes the item out of. */
export const deletedFrom = isRemote ? 'from the shared stock list, for everyone' : 'from the stock list on this device'

/** Apps Script can wait up to 20 s for the sheet's lock, then do the work. */
const TIMEOUT_MS = 60_000

/* The app password, remembered on this device. */
const PASSWORD_KEY = 'it-stock-app-password'
let password = ''
try {
  password = localStorage.getItem(PASSWORD_KEY) || ''
} catch {
  /* storage blocked: ask each visit */
}

export const hasPassword = () => !!password

export function setPassword(value) {
  password = value
  try {
    if (value) localStorage.setItem(PASSWORD_KEY, value)
    else localStorage.removeItem(PASSWORD_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Errors carry what the screens need to say next:
 *   auth     the password is missing or wrong
 *   offline  the request never reached the server
 *   status   the HTTP status otherwise (400 = the sheet refused the request)
 */
function apiError(message, extra) {
  return Object.assign(new Error(message), extra)
}

/** Calls a function in code.gs through the Vercel server and returns its result. */
export async function call(fn, ...args) {
  if (!remote) throw apiError('This copy of the app isn’t connected to the Google Sheet.', { status: 0 })
  if (!password) throw apiError('Enter the app password.', { auth: true })
  let res
  try {
    res = await fetch(remote, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Password': password },
      body: JSON.stringify({ fn, args }),
      // A request that hangs would hold up every later change, so give up and retry instead.
      signal: AbortSignal.timeout?.(TIMEOUT_MS),
    })
  } catch {
    throw apiError('Can’t reach the server. Check your internet connection.', { offline: true })
  }
  const data = await res.json().catch(() => null)
  if (res.status === 401) throw apiError(data?.error || 'Wrong password.', { auth: true })
  if (!data?.ok) {
    let message = data?.error || `The server answered ${res.status}.`
    // Vercel is newer than the Code.gs pasted into Apps Script.
    if (/Unknown function|is not a function/i.test(message)) {
      message = 'The sheet’s Code.gs is older than this app. Paste the latest code.gs into Apps Script and deploy a new version.'
    }
    throw apiError(message, { status: res.status })
  }
  return data.result
}
