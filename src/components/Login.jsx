import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Alert, Button, Card, Field, Input } from './ui.jsx'
import logoUrl from '../assets/logo-mark.png'
import { stock } from '../stock.js'
import { cn, focusRing } from '../lib/utils.js'

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

function loginError(err) {
  if (err.auth) return 'That password isn’t right.'
  if (err.offline) return 'You’re offline. Connect to the internet to log in.'
  return err.message || 'Couldn’t log in. Try again.'
}

/**
 * The first screen when the app is connected to the Google Sheet: one password for the whole
 * team (APP_PASSWORD in Vercel). It is checked with the server before the app opens.
 */
export default function LoginScreen({ snap }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [capsLock, setCapsLock] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (!password) {
      setError('Enter the password.')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      await stock.login(password) // on success this screen goes away
    } catch (err) {
      setError(loginError(err))
      setBusy(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }

  const watchCaps = (e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center overflow-hidden rounded-2xl border bg-white shadow-sm" aria-hidden="true">
            <img src={logoUrl} alt="" className="size-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight">Sheehan</p>
            <p className="text-sm text-muted-foreground">IT Stock Scanner</p>
          </div>
        </div>

        <Card>
          <form onSubmit={submit} noValidate className="grid gap-5 p-6">
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
              <p className="text-sm text-muted-foreground">Enter the team password to open the stock list.</p>
            </div>

            {snap.error && <Alert variant="warning">{snap.error}</Alert>}

            {/* Lets password managers save the password; the app has no user names. */}
            <input type="text" name="username" autoComplete="username" value="Sheehan IT Stock" readOnly hidden />

            <Field
              id="login-password"
              label="Password"
              error={error}
              hint={capsLock ? 'Caps Lock is on.' : undefined}
            >
              {(p) => (
                <div className="relative">
                  <Input
                    {...p}
                    ref={inputRef}
                    type={show ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    // The only thing to do on this screen, so it starts with the cursor in it.
                    autoFocus
                    className="pr-11"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    onKeyDown={watchCaps}
                    onKeyUp={watchCaps}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    aria-pressed={show}
                    title={show ? 'Hide password' : 'Show password'}
                    className={cn(
                      'absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground transition-colors duration-150 hover:text-foreground pointer-coarse:w-11',
                      focusRing,
                    )}
                  >
                    {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" size="lg" loading={busy} className="w-full">
              {busy ? 'Logging in…' : 'Log in'}
            </Button>

            {snap.pending > 0 && (
              <p className="text-xs text-muted-foreground">
                {plural(snap.pending, 'change')} made on this device will be saved to the sheet once you log in.
              </p>
            )}
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-pretty text-muted-foreground">
          Don’t have the password? Ask whoever manages the stock sheet.
        </p>
      </div>
    </main>
  )
}
